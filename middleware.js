const database = require('./database');
const { logAuth, logError } = require('./logger');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        // For API requests, return JSON
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required',
                redirect: '/login'
            });
        }
        // For page requests, redirect to login
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const requireAdmin = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required',
            redirect: '/login'
        });
    }

    try {
        const user = await database.getUserById(req.session.userId);
        if (!user || user.role !== 'admin') {
            logAuth('ADMIN_ACCESS_DENIED', req.session.username, req.ip, false);
            return res.status(403).json({ 
                success: false, 
                message: 'Admin privileges required' 
            });
        }
        req.user = user;
        next();
    } catch (error) {
        logError(error, 'Admin middleware error', req.session.username, req.ip);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};

// Middleware to check if setup is required
const checkSetup = async (req, res, next) => {
    try {
        const isSetupCompleted = await database.isSetupCompleted();
        const hasAdmin = await database.hasAdminUser();
        
        if (!isSetupCompleted || !hasAdmin) {
            // Allow access to setup routes and API calls
            if (req.path === '/setup' || req.path.startsWith('/api/setup') || req.path.startsWith('/api/translations') || req.path.startsWith('/api/language') || req.path.startsWith('/assets/')) {
                return next();
            }
            
            // For API calls, return JSON
            if (req.path.startsWith('/api/')) {
                return res.status(200).json({
                    success: false,
                    requiresSetup: true,
                    message: 'Initial setup required',
                    redirect: '/setup'
                });
            }
            
            // For regular page requests, redirect to setup
            return res.redirect('/setup');
        }
        
        // Setup completed, block access to setup routes
        if (req.path === '/setup' || req.path.startsWith('/api/setup')) {
            // For API calls, return JSON
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({
                    success: false,
                    message: 'Setup already completed'
                });
            }
            // For page requests, redirect to home
            return res.redirect('/');
        }
        
        next();
    } catch (error) {
        logError(error, 'Setup check middleware error');
        
        // For API calls, return JSON
        if (req.path.startsWith('/api/')) {
            return res.status(500).json({ 
                success: false, 
                message: 'Internal server error' 
            });
        }
        
        // For page requests, redirect to setup (fallback)
        return res.redirect('/setup');
    }
};

// Middleware to attach user info to request
const attachUser = async (req, res, next) => {
    if (req.session && req.session.userId) {
        try {
            const user = await database.getUserById(req.session.userId);
            if (user) {
                req.user = user;
            }
        } catch (error) {
            logError(error, 'Attach user middleware error', req.session.username, req.ip);
        }
    }
    next();
};

// Rate limiting middleware (simple implementation)
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 1000) => {
    const clients = new Map();
    
    // Limpiar clientes antiguos cada 5 minutos
    setInterval(() => {
        const now = Date.now();
        for (const [clientId, client] of clients.entries()) {
            if (now > client.resetTime) {
                clients.delete(clientId);
            }
        }
    }, 5 * 60 * 1000);
    
    return (req, res, next) => {
        const clientId = req.ip;
        const now = Date.now();
        
        if (!clients.has(clientId)) {
            clients.set(clientId, { count: 1, resetTime: now + windowMs });
            return next();
        }
        
        const client = clients.get(clientId);
        
        if (now > client.resetTime) {
            client.count = 1;
            client.resetTime = now + windowMs;
        } else {
            client.count++;
        }
        
        if (client.count > max) {
            logAuth('RATE_LIMIT_EXCEEDED', req.session?.username || 'anonymous', req.ip, false);
            return res.status(429).json({
                success: false,
                message: 'Too many requests. Please wait a few minutes.'
            });
        }
        
        next();
    };
};

// Login rate limiter (more restrictive)
const loginLimiter = createRateLimiter(15 * 60 * 1000, 10); // 10 attempts per 15 minutes

// General rate limiter
const generalLimiter = createRateLimiter(15 * 60 * 1000, 1000); // 1000 requests per 15 minutes

// File access rate limiter
const fileLimiter = createRateLimiter(60 * 1000, 500); // 500 file requests per minute

module.exports = {
    requireAuth,
    requireAdmin,
    checkSetup,
    attachUser,
    loginLimiter,
    generalLimiter,
    fileLimiter
};