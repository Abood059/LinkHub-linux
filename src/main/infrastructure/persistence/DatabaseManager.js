// src/main/infrastructure/persistence/DatabaseManager.js
'use strict';

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { sanitizePath } = require('../../utils/pathSanitizer');
const DeviceRepository = require('./repositories/DeviceRepository');
const DownloadRepository = require('./repositories/DownloadRepository');
const SettingsRepository = require('./repositories/SettingsRepository');

/**
 * DatabaseManager
 *
 * Responsible for database connection management and providing repository access.
 * Uses SQLite with better-sqlite3 for synchronous operations.
 * 
 * Features:
 * - Initialize SQLite database
 * - Run migrations
 * - Provide repository instances
 * - Close database connection
 * 
 * No ADB logic. No runtime logic. No business logic.
 */
class DatabaseManager {
    constructor({ databasePath, pathService } = {}) {
        this._pathService = pathService;
        this._appRoot = this._pathService ? this._pathService.getAppRoot() : process.cwd();
        this._databasePath = databasePath || (this._pathService ? this._pathService.getDatabasePath() : path.join(this._appRoot, 'data', 'linkhub.db'));
        this._db = null;
        this._initialized = false;
        this._deviceRepository = null;
        this._downloadRepository = null;
        this._settingsRepository = null;
    }

    /**
     * Initialize the database: create connection, run migrations, create repositories.
     * Should be called once during application startup.
     */
    async initDb() {
        try {
            await this._ensureDirectory();
            await this._createConnection();
            await this._runMigrations();
            this._createRepositories();
            this._initialized = true;
            console.log('[DatabaseManager] Initialized successfully at', this._databasePath);
        } catch (error) {
            console.error('[DatabaseManager] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Ensure the directory for the database file exists.
     */
    async _ensureDirectory() {
        const directory = path.dirname(this._databasePath);
        try {
            await fs.promises.access(directory);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.promises.mkdir(directory, { recursive: true });
            } else {
                throw error;
            }
        }
    }

    /**
     * Create database connection.
     */
    async _createConnection() {
        this._db = new Database(this._databasePath);
        this._db.pragma('journal_mode = WAL');
        this._db.pragma('synchronous = NORMAL');
        this._db.pragma('foreign_keys = ON');
    }

    /**
     * Run database migrations.
     */
    async _runMigrations() {
        const migrationsDir = path.join(__dirname, 'migrations');
        const migrationFiles = ['001_init.sql', '003_add_custom_name.sql', '004_add_updated_at.sql', '005_add_failed_at.sql'];

        for (const migrationFile of migrationFiles) {
            const migrationPath = path.join(migrationsDir, migrationFile);
            if (fs.existsSync(migrationPath)) {
                try {
                    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

                    // Special handling for 003_add_custom_name to check if column already exists
                    if (migrationFile === '003_add_custom_name.sql') {
                        const tableInfo = this._db.pragma(`table_info(devices)`);
                        const hasCustomName = tableInfo.some(col => col.name === 'custom_name');
                        if (hasCustomName) {
                            console.log(`[DatabaseManager] Migration ${migrationFile} skipped - column already exists`);
                            continue;
                        }
                    }

                    // Special handling for 004_add_updated_at to check if column already exists
                    if (migrationFile === '004_add_updated_at.sql') {
                        const tableInfo = this._db.pragma(`table_info(downloads)`);
                        const hasUpdatedAt = tableInfo.some(col => col.name === 'updated_at');
                        if (hasUpdatedAt) {
                            console.log(`[DatabaseManager] Migration ${migrationFile} skipped - column already exists`);
                            continue;
                        }
                    }

                    this._db.exec(migrationSql);
                    console.log(`[DatabaseManager] Migration ${migrationFile} executed successfully`);
                } catch (error) {
                    // If it's a duplicate column error, skip it gracefully
                    if (error.code === 'SQLITE_ERROR' && error.message.includes('duplicate column name')) {
                        console.log(`[DatabaseManager] Migration ${migrationFile} skipped - column already exists`);
                    } else {
                        console.error(`[DatabaseManager] Migration ${migrationFile} failed:`, error);
                        throw error;
                    }
                }
            } else {
                console.warn('[DatabaseManager] Migration file not found:', migrationPath);
            }
        }
        console.log('[DatabaseManager] All migrations executed successfully');
    }

    /**
     * Create repository instances.
     */
    _createRepositories() {
        this._deviceRepository = new DeviceRepository(this._db);
        this._downloadRepository = new DownloadRepository(this._db);
        this._settingsRepository = new SettingsRepository(this._db);
    }

    /**
     * Get the device repository.
     * @returns {DeviceRepository} Device repository instance
     */
    get devices() {
        if (!this._initialized) {
            throw new Error('DatabaseManager not initialized. Call initDb() first.');
        }
        return this._deviceRepository;
    }

    /**
     * Get the download repository.
     * @returns {DownloadRepository} Download repository instance
     */
    get downloads() {
        if (!this._initialized) {
            throw new Error('DatabaseManager not initialized. Call initDb() first.');
        }
        return this._downloadRepository;
    }

    /**
     * Get the settings repository.
     * @returns {SettingsRepository} Settings repository instance
     */
    get settings() {
        if (!this._initialized) {
            throw new Error('DatabaseManager not initialized. Call initDb() first.');
        }
        return this._settingsRepository;
    }

    /**
     * Close the database connection.
     */
    async close() {
        if (this._db) {
            this._db.close();
            this._db = null;
            this._initialized = false;
            console.log('[DatabaseManager] Database connection closed');
        }
    }

    /**
     * Check if database is initialized.
     * @returns {boolean} True if initialized
     */
    isInitialized() {
        return this._initialized;
    }
}

module.exports = DatabaseManager;