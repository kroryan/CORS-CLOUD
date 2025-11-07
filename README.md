# NAS CORS File Server

Advanced CORS file server for your NAS with modern web interface, authentication system, and multi-language support.

## 🚀 Features

### Core Functionality
- **Port 7070**: Customizable server port
- **CORS Enabled**: Compatible with access from any origin
- **Tailscale Compatible**: Secure remote access through your Tailscale network
- **Modern Web Interface**: Responsive file browser with modern design
- **Intuitive Navigation**: Folder exploration with breadcrumb navigation
- **Direct Download**: Download buttons for all files
- **Real-time Search**: File filtering by name
- **File Type Icons**: Specific icons based on file type
- **Detailed Information**: File size and modification date
- **Mobile Responsive**: Compatible with mobile devices

### Security & Authentication
- **User Authentication**: Secure login system with sessions
- **Password Hashing**: bcrypt for secure password storage
- **Role-Based Access**: Admin and User roles
- **Rate Limiting**: Protection against brute force attacks
- **Session Management**: Secure session handling
- **Initial Setup**: First-run administrator account creation

### Administration
- **Admin Panel**: Complete user and system management
- **User Management**: Create, edit, and delete user accounts
- **System Settings**: Configure server settings and defaults
- **Comprehensive Logging**: Activity logs with Winston
- **SQLite Database**: Lightweight user and settings storage

### Multi-language Support
- **English & Spanish**: Full interface translation
- **Dynamic Language Switching**: Change language on-the-fly
- **Default Language Setting**: Admin-configurable default language
- **Per-user Language Preferences**: Saved in user sessions

## 📁 Project Structure

```
CORS/
├── server.js           # Main Express server
├── package.json        # Dependencies and configuration
├── database.js         # SQLite database management
├── middleware.js       # Authentication and security middleware
├── logger.js           # Winston logging configuration
├── i18n.js            # Multi-language support
├── data/              # Database files (auto-created)
│   └── nas_server.db  # SQLite database
├── logs/              # Log files (auto-created)
│   ├── access.log     # User activity logs
│   ├── error.log      # Error logs
│   └── combined.log   # All logs
├── public/            # Web interface
│   ├── index.html     # Main file browser interface
│   ├── login.html     # Login page
│   ├── setup.html     # Initial setup page
│   ├── admin.html     # Administration panel
│   └── style.css      # CSS styles
└── README.md          # This file
```

## 🛠️ Installation and Usage

### Prerequisites
- Node.js installed on your system
- Tailscale configured (optional, for remote access)

### Quick Start
```bash
# Navigate to directory
cd "d:\NAS\CORS"

# Install dependencies
npm install

# Start the server
npm start
```

### Available Commands
- `npm start`: Start server in production mode
- `npm run dev`: Start with nodemon for development (auto-restart)

### First Run Setup
1. Start the server: `npm start`
2. Navigate to: `http://localhost:7070/setup`
3. Create your administrator account
4. Complete the initial setup
5. Start using the file server!

## 🌐 Access

### Local Access
```
http://localhost:7070
```

### Local Network
```
http://[your-local-ip]:7070
```

### Tailscale Access
```
http://[your-tailscale-ip]:7070
```

### Setup (First Run Only)
```
http://localhost:7070/setup
```

### Admin Panel (Admin Users Only)
```
http://localhost:7070/admin
```

## 🔒 Seguridad

- La carpeta `CORS` está excluida del servidor por seguridad
- Verificación de rutas para prevenir acceso no autorizado
- Headers CORS configurados apropiadamente
- Validación de tipos de archivo

## 📋 Funcionalidades de la Interfaz

### Navegación
- **Breadcrumb**: Navegación rápida entre directorios
- **Botón Atrás**: Retroceder al directorio anterior
- **Clic en carpetas**: Navegar haciendo clic en las carpetas

### Búsqueda
- **Búsqueda en tiempo real**: Filtrado instantáneo por nombre
- **Case-insensitive**: Búsqueda sin distinción entre mayúsculas y minúsculas

### Descarga
- **Botón de descarga**: En cada archivo individual
- **Descarga directa**: Sin necesidad de navegación adicional

### Información de archivos
- **Iconos por tipo**: Iconos específicos para cada tipo de archivo
- **Tamaño formateado**: Bytes, KB, MB, GB automáticamente
- **Fecha de modificación**: Fecha y hora en formato local

## 🎨 Tipos de archivo soportados

El servidor reconoce y muestra iconos específicos para:

- **Imágenes**: JPG, PNG, GIF, BMP, SVG
- **Videos**: MP4, AVI, MKV, MOV, WMV
- **Audio**: MP3, WAV, FLAC, OGG, AAC
- **Documentos**: PDF, DOC, XLS, PPT, TXT
- **Archivos**: ZIP, RAR, 7Z, TAR
- **Código**: JS, HTML, CSS, PY, JAVA, CPP
- **Otros**: ISO, EXE, y tipos genéricos

## 🔧 Configuración

### Puerto personalizado
Edita `server.js` línea 7:
```javascript
const PORT = 7070; // Cambiar por el puerto deseado
```

### CORS Origins
Edita `server.js` líneas 10-15 para configurar orígenes específicos:
```javascript
app.use(cors({
    origin: ['http://localhost:3000', 'http://tu-dominio.com'], // Especificar orígenes
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));
```

## 🐛 Solución de problemas

### El servidor no inicia
- Verificar que Node.js esté instalado: `node --version`
- Verificar que las dependencias estén instaladas: `npm install`
- Comprobar que el puerto 7070 no esté en uso

### No se pueden descargar archivos
- Verificar permisos de lectura en los archivos
- Comprobar que la ruta del archivo sea válida
- Revisar la consola del navegador para errores

### Problemas de CORS
- Verificar la configuración de CORS en `server.js`
- Comprobar que el origen esté permitido
- Revisar headers de la solicitud

## 📝 Notas adicionales

- El servidor está configurado para escuchar en todas las interfaces de red (`0.0.0.0`)
- Compatible con IPv4 e IPv6
- Optimizado para redes locales y VPN (Tailscale)
- Diseño mobile-first para acceso desde dispositivos móviles
- Sin autenticación (considera añadir autenticación para uso en internet público)

## 🔄 Actualizaciones futuras

Posibles mejoras a implementar:
- Autenticación de usuarios
- Subida de archivos
- Previsualización de imágenes
- Compresión de archivos para descarga
- Logs de acceso
- Configuración via archivo de configuración