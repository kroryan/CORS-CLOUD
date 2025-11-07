const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mime = require('mime');
const session = require('express-session');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

// Import our modules
const database = require('./database');
const { logger, logAuth, logFileAccess, logAdmin, logError, logSystem } = require('./logger');
const { requireAuth, requireAdmin, checkSetup, attachUser, loginLimiter, generalLimiter, fileLimiter } = require('./middleware');
const { I18n } = require('./i18n');

const app = express();
const PORT = 7070;
const i18n = new I18n();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
        }
    }
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || uuidv4(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    name: 'nas-session'
}));

// Rate limiting
app.use('/api/auth', loginLimiter);
app.use('/api', generalLimiter);
app.use('/download', fileLimiter);

// I18n middleware
app.use(i18n.middleware());

// User attachment middleware
app.use(attachUser);

// Configuración CORS para permitir acceso desde cualquier origen (local y Tailscale)
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        // Allow localhost and private IP ranges
        const allowedOrigins = [
            /^https?:\/\/localhost(:\d+)?$/,
            /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
            /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
            /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
            /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/,
            /^https?:\/\/.*\.ts\.net(:\d+)?$/ // Tailscale domains
        ];
        
        const isAllowed = allowedOrigins.some(pattern => pattern.test(origin));
        callback(null, isAllowed);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

// Servir archivos estáticos para la interfaz web
app.use('/assets', express.static(path.join(__dirname, 'public')));

// Ruta raíz del NAS (excluyendo la carpeta CORS)
const NAS_ROOT = path.resolve(__dirname, '..');

// Función para verificar si una ruta es válida y no accede a la carpeta CORS
function isValidPath(requestedPath) {
    const fullPath = path.resolve(NAS_ROOT, requestedPath.replace(/^\/+/, ''));
    const corsPath = path.resolve(__dirname);
    
    // Verificar que la ruta esté dentro del NAS y no sea la carpeta CORS
    return fullPath.startsWith(NAS_ROOT) && !fullPath.startsWith(corsPath);
}

// Setup and authentication routes
app.get('/setup', checkSetup, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API Routes

// Setup API
app.post('/api/setup', async (req, res) => {
    try {
        const isSetupCompleted = await database.isSetupCompleted();
        const hasAdmin = await database.hasAdminUser();
        
        if (isSetupCompleted && hasAdmin) {
            return res.status(400).json({ 
                success: false, 
                message: 'Setup already completed' 
            });
        }
        
        const { username, email, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        const admin = await database.createUser(username, email, password, 'admin');
        await database.setSetting('setup_completed', 'true', admin.id);
        
        logSystem('Initial setup completed', { adminUser: username });
        
        res.json({ 
            success: true, 
            message: req.t('setupComplete'),
            user: { id: admin.id, username: admin.username, role: admin.role }
        });
        
    } catch (error) {
        logError(error, 'Setup error', '', req.ip);
        res.status(500).json({ 
            success: false, 
            message: req.t('setupError') 
        });
    }
});

// Authentication API
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: req.t('invalidCredentials') 
            });
        }
        
        const validation = await database.validatePassword(username, password);
        
        if (!validation.valid) {
            logAuth('LOGIN_FAILED', username, req.ip, false);
            return res.status(401).json({ 
                success: false, 
                message: req.t('invalidCredentials') 
            });
        }
        
        req.session.userId = validation.user.id;
        req.session.username = validation.user.username;
        req.session.role = validation.user.role;
        
        await database.updateLastLogin(validation.user.id);
        
        logAuth('LOGIN_SUCCESS', username, req.ip, true);
        
        res.json({ 
            success: true, 
            message: req.t('loginSuccess'),
            user: {
                id: validation.user.id,
                username: validation.user.username,
                role: validation.user.role
            }
        });
        
    } catch (error) {
        logError(error, 'Login error', req.body.username, req.ip);
        res.status(500).json({ 
            success: false, 
            message: req.t('internalError') 
        });
    }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
    const username = req.session.username;
    
    req.session.destroy((err) => {
        if (err) {
            logError(err, 'Logout error', username, req.ip);
            return res.status(500).json({ 
                success: false, 
                message: req.t('internalError') 
            });
        }
        
        logAuth('LOGOUT', username, req.ip, true);
        
        res.json({ 
            success: true, 
            message: req.t('logoutSuccess') 
        });
    });
});

// User management API (Admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await database.getAllUsers();
        res.json({ success: true, users });
    } catch (error) {
        logError(error, 'Get users error', req.user.username, req.ip);
        res.status(500).json({ success: false, message: req.t('internalError') });
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        const user = await database.createUser(username, email, password, role || 'user', req.user.id);
        
        logAdmin('USER_CREATED', req.user.username, username, req.ip);
        
        res.json({ 
            success: true, 
            message: req.t('userCreated'),
            user: { id: user.id, username: user.username, role: user.role }
        });
        
    } catch (error) {
        logError(error, 'Create user error', req.user.username, req.ip);
        res.status(500).json({ success: false, message: req.t('internalError') });
    }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const updates = req.body;
        
        const result = await database.updateUser(userId, updates);
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        logAdmin('USER_UPDATED', req.user.username, `ID:${userId}`, req.ip);
        
        res.json({ 
            success: true, 
            message: req.t('userUpdated') 
        });
        
    } catch (error) {
        logError(error, 'Update user error', req.user.username, req.ip);
        res.status(500).json({ success: false, message: req.t('internalError') });
    }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (userId == req.user.id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot delete your own account' 
            });
        }
        
        const result = await database.deleteUser(userId);
        
        if (result.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }
        
        logAdmin('USER_DELETED', req.user.username, `ID:${userId}`, req.ip);
        
        res.json({ 
            success: true, 
            message: req.t('userDeleted') 
        });
        
    } catch (error) {
        logError(error, 'Delete user error', req.user.username, req.ip);
        res.status(500).json({ success: false, message: req.t('internalError') });
    }
});

// Settings API
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await database.getAllSettings();
        res.json({ success: true, settings });
    } catch (error) {
        logError(error, 'Get settings error', req.user?.username, req.ip);
        res.status(500).json({ success: false, message: req.t('internalError') });
    }
});

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
        const { settings } = req.body;
        
        for (const [key, value] of Object.entries(settings)) {
            await database.setSetting(key, value, req.user.id);
        }
        
        logAdmin('SETTINGS_UPDATED', req.user.username, '', req.ip, Object.keys(settings).join(', '));
        
        res.json({ 
            success: true, 
            message: 'Settings updated successfully' 
        });
        
    } catch (error) {
        logError(error, 'Update settings error', req.user.username, req.ip);
        res.status(500).json({ success: false, message: req.t('internalError') });
    }
});

// Language API (accessible without authentication for setup)
app.get('/api/translations', (req, res) => {
    res.json({ 
        success: true, 
        translations: req.getTranslations(),
        currentLanguage: req.language 
    });
});

app.put('/api/language', (req, res) => {
    try {
        const { language } = req.body;
        
        if (i18n.setLanguage(language)) {
            if (req.session) {
                req.session.language = language;
            }
            res.json({ 
                success: true, 
                message: req.t('languageChanged'),
                translations: req.getTranslations()
            });
        } else {
            res.status(400).json({ 
                success: false, 
                message: 'Invalid language' 
            });
        }
    } catch (error) {
        logError(error, 'Language change error', req.user?.username, req.ip);
        res.status(500).json({ success: false, message: req.t('internalError') });
    }
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
    if (req.user) {
        res.json({ 
            authenticated: true, 
            user: {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Función para obtener información de archivos y directorios
function getFileInfo(filePath) {
    const stats = fs.statSync(filePath);
    const name = path.basename(filePath);
    
    return {
        name,
        isDirectory: stats.isDirectory(),
        size: stats.isDirectory() ? null : stats.size,
        modified: stats.mtime,
        type: stats.isDirectory() ? 'directory' : mime.getType(filePath) || 'application/octet-stream'
    };
}

// Función para formatear el tamaño de archivo
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Ruta principal - interfaz web
app.get('/', checkSetup, requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API para listar directorios
app.get('/api/browse', checkSetup, requireAuth, (req, res) => {
    try {
        const requestedPath = req.query.path || '/';
        
        if (!isValidPath(requestedPath)) {
            logFileAccess('BROWSE_DENIED', requestedPath, req.user.username, req.ip, false);
            return res.status(403).json({ error: req.t('fileAccessDenied') });
        }
        
        const fullPath = path.resolve(NAS_ROOT, requestedPath.replace(/^\/+/, ''));
        
        if (!fs.existsSync(fullPath)) {
            logFileAccess('BROWSE_NOT_FOUND', requestedPath, req.user.username, req.ip, false);
            return res.status(404).json({ error: req.t('fileNotFound') });
        }
        
        const stats = fs.statSync(fullPath);
        
        if (!stats.isDirectory()) {
            return res.status(400).json({ error: 'Path is not a directory' });
        }
        
        const items = fs.readdirSync(fullPath).map(item => {
            const itemPath = path.join(fullPath, item);
            const info = getFileInfo(itemPath);
            
            // Calcular la ruta relativa para el enlace
            const relativePath = path.relative(NAS_ROOT, itemPath).replace(/\\/g, '/');
            info.path = '/' + relativePath;
            
            if (!info.isDirectory) {
                info.formattedSize = formatFileSize(info.size);
            }
            
            return info;
        });
        
        // Separar carpetas y archivos
        const directories = items.filter(item => item.isDirectory).sort((a, b) => a.name.localeCompare(b.name));
        const files = items.filter(item => !item.isDirectory).sort((a, b) => a.name.localeCompare(b.name));
        
        const currentPath = requestedPath === '/' ? '' : requestedPath;
        const parentPath = currentPath ? path.dirname(currentPath).replace(/\\/g, '/') : null;
        
        logFileAccess('BROWSE_SUCCESS', requestedPath, req.user.username, req.ip, true);
        
        res.json({
            currentPath,
            parentPath: parentPath === '.' ? null : parentPath,
            items: [...directories, ...files]
        });
        
    } catch (error) {
        logError(error, 'Browse directory error', req.user.username, req.ip);
        res.status(500).json({ error: req.t('internalError') });
    }
});

// Ruta para descargar archivos
app.get('/download/*', checkSetup, requireAuth, (req, res) => {
    try {
        const requestedPath = req.params[0];
        
        if (!isValidPath(requestedPath)) {
            logFileAccess('DOWNLOAD_DENIED', requestedPath, req.user.username, req.ip, false);
            return res.status(403).send(req.t('fileAccessDenied'));
        }
        
        const fullPath = path.resolve(NAS_ROOT, requestedPath);
        
        if (!fs.existsSync(fullPath)) {
            logFileAccess('DOWNLOAD_NOT_FOUND', requestedPath, req.user.username, req.ip, false);
            return res.status(404).send(req.t('fileNotFound'));
        }
        
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
            logFileAccess('DOWNLOAD_DIRECTORY', requestedPath, req.user.username, req.ip, false);
            return res.status(400).send(req.t('directoryError'));
        }
        
        const fileName = path.basename(fullPath);
        const mimeType = mime.getType(fullPath) || 'application/octet-stream';
        
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Length', stats.size);
        
        logFileAccess('DOWNLOAD_SUCCESS', requestedPath, req.user.username, req.ip, true);
        
        const fileStream = fs.createReadStream(fullPath);
        fileStream.pipe(res);
        
    } catch (error) {
        logError(error, 'Download file error', req.user.username, req.ip);
        res.status(500).send(req.t('internalError'));
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    logError(error, 'Unhandled error', req.user?.username, req.ip);
    res.status(500).json({ 
        success: false, 
        message: req.t ? req.t('internalError') : 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: 'Not found' 
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    logSystem('Server shutdown initiated');
    database.close();
    process.exit(0);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', async () => {
    logSystem('Server started', { port: PORT, nasRoot: NAS_ROOT });
    console.log(`🚀 NAS CORS Server running on port ${PORT}`);
    console.log(`📂 Serving files from: ${NAS_ROOT}`);
    console.log(`🌐 Local access: http://localhost:${PORT}`);
    console.log(`🔗 Tailscale access: http://[your-tailscale-ip]:${PORT}`);
    console.log(`🔒 Authentication enabled with logging`);
    console.log(`🌍 Multi-language support (EN/ES)`);
    console.log(`⚠️  CORS folder excluded for security`);
    
    try {
        const isSetupCompleted = await database.isSetupCompleted();
        const hasAdmin = await database.hasAdminUser();
        
        if (!isSetupCompleted || !hasAdmin) {
            console.log(`\n🔧 SETUP REQUIRED: Navigate to http://localhost:${PORT}/setup to create admin account`);
            logSystem('Setup required - no admin user found');
        } else {
            console.log(`\n✅ Setup completed - ready to use!`);
        }
    } catch (error) {
        logError(error, 'Server startup error');
        console.error('Error checking setup status:', error.message);
    }
});