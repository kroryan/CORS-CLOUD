const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const { logSystem, logError } = require('./logger');

class Database {
    constructor() {
        this.dbPath = path.join(__dirname, 'data', 'nas_server.db');
        this.initialized = false;
        this.initPromise = this.init();
    }

    async init() {
        return new Promise((resolve, reject) => {
            // Create data directory if it doesn't exist
            const fs = require('fs');
            const dataDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logError(err, 'Database connection failed');
                    console.error('Database connection error:', err);
                    reject(err);
                } else {
                    logSystem('Database connected successfully');
                    this.createTables().then(() => {
                        this.initialized = true;
                        resolve();
                    }).catch(reject);
                }
            });
        });
    }

    async waitForInit() {
        if (!this.initialized) {
            await this.initPromise;
        }
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            // Users table
            const createUsersTable = `
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    email VARCHAR(100),
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(20) DEFAULT 'user',
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME,
                    created_by INTEGER,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            `;

            // Settings table
            const createSettingsTable = `
                CREATE TABLE IF NOT EXISTS settings (
                    key VARCHAR(50) PRIMARY KEY,
                    value TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_by INTEGER,
                    FOREIGN KEY (updated_by) REFERENCES users(id)
                )
            `;

            // Sessions table (optional, for session storage in DB)
            const createSessionsTable = `
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id VARCHAR(128) PRIMARY KEY,
                    expires INTEGER,
                    data TEXT
                )
            `;

            let tablesCreated = 0;
            const totalTables = 3;

            const checkComplete = (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                tablesCreated++;
                if (tablesCreated === totalTables) {
                    this.initializeDefaultSettings().then(resolve).catch(reject);
                }
            };

            this.db.run(createUsersTable, (err) => {
                if (err) {
                    logError(err, 'Failed to create users table');
                    reject(err);
                } else {
                    logSystem('Users table created/verified');
                    checkComplete();
                }
            });

            this.db.run(createSettingsTable, (err) => {
                if (err) {
                    logError(err, 'Failed to create settings table');
                    reject(err);
                } else {
                    logSystem('Settings table created/verified');
                    checkComplete();
                }
            });

            this.db.run(createSessionsTable, (err) => {
                if (err) {
                    logError(err, 'Failed to create sessions table');
                    reject(err);
                } else {
                    logSystem('Sessions table created/verified');
                    checkComplete();
                }
            });
        });
    }

    async initializeDefaultSettings() {
        return new Promise((resolve, reject) => {
            const defaultSettings = [
                { key: 'default_language', value: 'en' },
                { key: 'server_name', value: 'NAS CORS Server' },
                { key: 'setup_completed', value: 'false' },
                { key: 'max_file_size', value: '104857600' }, // 100MB
                { key: 'allowed_file_types', value: '*' }
            ];

            let settingsProcessed = 0;

            if (defaultSettings.length === 0) {
                resolve();
                return;
            }

            defaultSettings.forEach(setting => {
                this.db.run(
                    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
                    [setting.key, setting.value],
                    (err) => {
                        if (err) {
                            logError(err, `Failed to insert default setting: ${setting.key}`);
                        }
                        
                        settingsProcessed++;
                        if (settingsProcessed === defaultSettings.length) {
                            resolve();
                        }
                    }
                );
            });
        });
    }

    // User methods
    async createUser(username, email, password, role = 'user', createdBy = null) {
        await this.waitForInit();
        return new Promise((resolve, reject) => {
            bcrypt.hash(password, 12, (err, hash) => {
                if (err) {
                    logError(err, 'Password hashing failed');
                    reject(err);
                    return;
                }

                this.db.run(
                    'INSERT INTO users (username, email, password_hash, role, created_by) VALUES (?, ?, ?, ?, ?)',
                    [username, email, hash, role, createdBy],
                    function(err) {
                        if (err) {
                            logError(err, `Failed to create user: ${username}`);
                            reject(err);
                        } else {
                            logSystem(`User created: ${username}`, { userId: this.lastID, role });
                            resolve({ id: this.lastID, username, email, role });
                        }
                    }
                );
            });
        });
    }

    async getUserByUsername(username) {
        await this.waitForInit();
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE username = ? AND is_active = 1',
                [username],
                (err, row) => {
                    if (err) {
                        logError(err, `Failed to get user: ${username}`);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    async getUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE id = ? AND is_active = 1',
                [id],
                (err, row) => {
                    if (err) {
                        logError(err, `Failed to get user by id: ${id}`);
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    async getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, username, email, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC',
                [],
                (err, rows) => {
                    if (err) {
                        logError(err, 'Failed to get all users');
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async validatePassword(username, password) {
        return new Promise((resolve, reject) => {
            this.getUserByUsername(username).then(user => {
                if (!user) {
                    resolve({ valid: false, user: null });
                    return;
                }

                bcrypt.compare(password, user.password_hash, (err, result) => {
                    if (err) {
                        logError(err, `Password validation failed for user: ${username}`);
                        reject(err);
                    } else {
                        resolve({ valid: result, user: result ? user : null });
                    }
                });
            }).catch(reject);
        });
    }

    async updateLastLogin(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [userId],
                (err) => {
                    if (err) {
                        logError(err, `Failed to update last login for user: ${userId}`);
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async updateUser(id, updates) {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            Object.keys(updates).forEach(key => {
                if (key !== 'id' && updates[key] !== undefined) {
                    if (key === 'password') {
                        // Hash password if being updated
                        bcrypt.hash(updates[key], 12, (err, hash) => {
                            if (err) {
                                logError(err, 'Password hashing failed during update');
                                reject(err);
                                return;
                            }
                            fields.push('password_hash = ?');
                            values.push(hash);
                        });
                    } else {
                        fields.push(`${key} = ?`);
                        values.push(updates[key]);
                    }
                }
            });

            if (fields.length === 0) {
                resolve({ changes: 0 });
                return;
            }

            values.push(id);
            const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

            this.db.run(sql, values, function(err) {
                if (err) {
                    logError(err, `Failed to update user: ${id}`);
                    reject(err);
                } else {
                    logSystem(`User updated: ${id}`, { changes: this.changes });
                    resolve({ changes: this.changes });
                }
            });
        });
    }

    async deleteUser(id) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET is_active = 0 WHERE id = ? AND role != "admin"',
                [id],
                function(err) {
                    if (err) {
                        logError(err, `Failed to delete user: ${id}`);
                        reject(err);
                    } else {
                        logSystem(`User deactivated: ${id}`, { changes: this.changes });
                        resolve({ changes: this.changes });
                    }
                }
            );
        });
    }

    // Settings methods
    async getSetting(key) {
        await this.waitForInit();
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT value FROM settings WHERE key = ?',
                [key],
                (err, row) => {
                    if (err) {
                        logError(err, `Failed to get setting: ${key}`);
                        reject(err);
                    } else {
                        resolve(row ? row.value : null);
                    }
                }
            );
        });
    }

    async setSetting(key, value, updatedBy = null) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, CURRENT_TIMESTAMP, ?)',
                [key, value, updatedBy],
                (err) => {
                    if (err) {
                        logError(err, `Failed to set setting: ${key}`);
                        reject(err);
                    } else {
                        logSystem(`Setting updated: ${key}`, { value, updatedBy });
                        resolve();
                    }
                }
            );
        });
    }

    async getAllSettings() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT key, value, updated_at FROM settings ORDER BY key',
                [],
                (err, rows) => {
                    if (err) {
                        logError(err, 'Failed to get all settings');
                        reject(err);
                    } else {
                        const settings = {};
                        rows.forEach(row => {
                            settings[row.key] = row.value;
                        });
                        resolve(settings);
                    }
                }
            );
        });
    }

    async isSetupCompleted() {
        await this.waitForInit();
        const setupStatus = await this.getSetting('setup_completed');
        return setupStatus === 'true';
    }

    async hasAdminUser() {
        await this.waitForInit();
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT COUNT(*) as count FROM users WHERE role = "admin" AND is_active = 1',
                [],
                (err, row) => {
                    if (err) {
                        logError(err, 'Failed to check admin users');
                        reject(err);
                    } else {
                        resolve(row.count > 0);
                    }
                }
            );
        });
    }

    close() {
        this.db.close((err) => {
            if (err) {
                logError(err, 'Database close error');
            } else {
                logSystem('Database connection closed');
            }
        });
    }
}

module.exports = new Database();