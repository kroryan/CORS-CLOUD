const translations = {
    en: {
        // General
        serverName: 'NAS File Browser',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        back: 'Back',
        refresh: 'Refresh',
        search: 'Search files...',
        
        // Navigation
        home: 'Home',
        emptyFolder: 'This folder is empty',
        fileSize: 'Size',
        dateModified: 'Modified',
        download: 'Download',
        
        // Authentication
        login: 'Login',
        logout: 'Logout',
        username: 'Username',
        password: 'Password',
        email: 'Email',
        confirmPassword: 'Confirm Password',
        loginButton: 'Sign In',
        loginRequired: 'Authentication required',
        invalidCredentials: 'Invalid username or password',
        loginSuccess: 'Login successful',
        logoutSuccess: 'Logout successful',
        
        // Setup
        setupTitle: 'Initial Setup - NAS CORS Server',
        setupWelcome: 'Welcome! Please create your administrator account',
        setupDescription: 'This is the first time you\'re running the server. Please create an administrator account to continue.',
        createAdmin: 'Create Administrator Account',
        setupComplete: 'Setup completed successfully!',
        setupError: 'Error during setup',
        adminCreated: 'Administrator account created successfully',
        
        // Admin Panel
        adminPanel: 'Administration Panel',
        userManagement: 'User Management',
        systemSettings: 'System Settings',
        logs: 'System Logs',
        createUser: 'Create User',
        editUser: 'Edit User',
        deleteUser: 'Delete User',
        userCreated: 'User created successfully',
        userUpdated: 'User updated successfully',
        userDeleted: 'User deleted successfully',
        
        // User roles
        admin: 'Administrator',
        user: 'User',
        role: 'Role',
        
        // Settings
        language: 'Language',
        defaultLanguage: 'Default Language',
        serverSettings: 'Server Settings',
        changeLanguage: 'Change Language',
        languageChanged: 'Language changed successfully',
        
        // File operations
        fileAccessDenied: 'Access denied',
        fileNotFound: 'File not found',
        downloadError: 'Error downloading file',
        directoryError: 'Cannot download directory',
        
        // Errors
        internalError: 'Internal server error',
        networkError: 'Network error',
        unauthorizedAccess: 'Unauthorized access',
        adminRequired: 'Administrator privileges required',
        
        // Footer
        footerText: 'Server running on port 7070 | Tailscale compatible'
    },
    
    es: {
        // General
        serverName: 'Explorador de Archivos NAS',
        loading: 'Cargando...',
        error: 'Error',
        success: 'Éxito',
        cancel: 'Cancelar',
        save: 'Guardar',
        delete: 'Eliminar',
        edit: 'Editar',
        back: 'Atrás',
        refresh: 'Actualizar',
        search: 'Buscar archivos...',
        
        // Navigation
        home: 'Inicio',
        emptyFolder: 'Esta carpeta está vacía',
        fileSize: 'Tamaño',
        dateModified: 'Modificado',
        download: 'Descargar',
        
        // Authentication
        login: 'Iniciar Sesión',
        logout: 'Cerrar Sesión',
        username: 'Usuario',
        password: 'Contraseña',
        email: 'Correo Electrónico',
        confirmPassword: 'Confirmar Contraseña',
        loginButton: 'Iniciar Sesión',
        loginRequired: 'Autenticación requerida',
        invalidCredentials: 'Usuario o contraseña incorrectos',
        loginSuccess: 'Inicio de sesión exitoso',
        logoutSuccess: 'Sesión cerrada exitosamente',
        
        // Setup
        setupTitle: 'Configuración Inicial - Servidor CORS NAS',
        setupWelcome: '¡Bienvenido! Por favor crea tu cuenta de administrador',
        setupDescription: 'Esta es la primera vez que ejecutas el servidor. Por favor crea una cuenta de administrador para continuar.',
        createAdmin: 'Crear Cuenta de Administrador',
        setupComplete: '¡Configuración completada exitosamente!',
        setupError: 'Error durante la configuración',
        adminCreated: 'Cuenta de administrador creada exitosamente',
        
        // Admin Panel
        adminPanel: 'Panel de Administración',
        userManagement: 'Gestión de Usuarios',
        systemSettings: 'Configuración del Sistema',
        logs: 'Registros del Sistema',
        createUser: 'Crear Usuario',
        editUser: 'Editar Usuario',
        deleteUser: 'Eliminar Usuario',
        userCreated: 'Usuario creado exitosamente',
        userUpdated: 'Usuario actualizado exitosamente',
        userDeleted: 'Usuario eliminado exitosamente',
        
        // User roles
        admin: 'Administrador',
        user: 'Usuario',
        role: 'Rol',
        
        // Settings
        language: 'Idioma',
        defaultLanguage: 'Idioma Predeterminado',
        serverSettings: 'Configuración del Servidor',
        changeLanguage: 'Cambiar Idioma',
        languageChanged: 'Idioma cambiado exitosamente',
        
        // File operations
        fileAccessDenied: 'Acceso denegado',
        fileNotFound: 'Archivo no encontrado',
        downloadError: 'Error descargando archivo',
        directoryError: 'No se puede descargar un directorio',
        
        // Errors
        internalError: 'Error interno del servidor',
        networkError: 'Error de red',
        unauthorizedAccess: 'Acceso no autorizado',
        adminRequired: 'Se requieren privilegios de administrador',
        
        // Footer
        footerText: 'Servidor ejecutándose en puerto 7070 | Compatible con Tailscale'
    }
};

class I18n {
    constructor() {
        this.defaultLanguage = 'en';
        this.currentLanguage = this.defaultLanguage;
    }

    setLanguage(language) {
        if (translations[language]) {
            this.currentLanguage = language;
            return true;
        }
        return false;
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getAvailableLanguages() {
        return Object.keys(translations);
    }

    translate(key, language = null) {
        const lang = language || this.currentLanguage;
        const translation = translations[lang];
        
        if (!translation) {
            return translations[this.defaultLanguage][key] || key;
        }
        
        return translation[key] || translations[this.defaultLanguage][key] || key;
    }

    getTranslations(language = null) {
        const lang = language || this.currentLanguage;
        return translations[lang] || translations[this.defaultLanguage];
    }

    // Helper method for Express.js
    middleware() {
        return (req, res, next) => {
            // Set language from query parameter, session, or header
            let language = req.query.lang || 
                          req.session?.language || 
                          req.headers['accept-language']?.split(',')[0]?.split('-')[0];
            
            if (!language || !translations[language]) {
                language = this.defaultLanguage;
            }
            
            this.setLanguage(language);
            
            // Make translation functions available in request
            req.t = (key) => this.translate(key);
            req.getTranslations = () => this.getTranslations();
            req.language = this.currentLanguage;
            
            // Make translation functions available in response locals (for templates)
            res.locals.t = req.t;
            res.locals.getTranslations = req.getTranslations;
            res.locals.language = req.language;
            
            next();
        };
    }
}

module.exports = { I18n, translations };