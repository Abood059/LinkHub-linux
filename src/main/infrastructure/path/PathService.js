// src/main/infrastructure/path/PathService.js
'use strict';

const path = require('path');

/**
 * PathService
 * 
 * Centralized path management service for Electron application.
 * Provides consistent path resolution across development and production environments.
 * 
 * Features:
 * - Uses app.getAppPath() for application root
 * - Uses app.getPath('userData') for user data directory
 * - Platform-aware path resolution
 * - Fallback to process.cwd() when Electron app is not available (e.g., testing)
 */
class PathService {
    constructor(options = {}) {
        this._logger = options.logger || null;
        this._appRoot = this._resolveAppRoot(options.appRoot);
        this._userData = this._resolveUserData(options.userData);
    }

    /**
     * Resolve application root directory
     * @private
     */
    _resolveAppRoot(explicitRoot) {
        if (explicitRoot) {
            return explicitRoot;
        }
        
        try {
            const { app } = require('electron');
            if (app && typeof app.getAppPath === 'function') {
                return app.getAppPath();
            }
        } catch (err) {
            if (this._logger) {
                this._logger.warn('PathService: Electron app not available, using cwd');
            }
        }
        
        return process.cwd();
    }

    /**
     * Resolve resources path for extraResources in production
     * @private
     */
    _resolveResourcesPath() {
        try {
            const { app } = require('electron');
            if (app && typeof app.getPath === 'function') {
                // In production (packaged app), use process.resourcesPath for extraResources
                // In development, process.resourcesPath may not exist, so use appRoot
                if (process.resourcesPath && !app.isPackaged) {
                    // Development mode with resourcesPath (rare case)
                    return this._appRoot;
                } else if (process.resourcesPath && app.isPackaged) {
                    // Production mode
                    return process.resourcesPath;
                }
            }
        } catch (err) {
            if (this._logger) {
                this._logger.warn('PathService: Electron app not available, using appRoot');
            }
        }
        return this._appRoot;
    }

    /**
     * Resolve user data directory
     * @private
     */
    _resolveUserData(explicitUserData) {
        if (explicitUserData) {
            return explicitUserData;
        }
        
        try {
            const { app } = require('electron');
            if (app && typeof app.getPath === 'function') {
                return app.getPath('userData');
            }
        } catch (err) {
            if (this._logger) {
                this._logger.warn('PathService: Electron app.getPath not available, using appRoot/data');
            }
        }
        
        return path.join(this._appRoot, 'data');
    }

    /**
     * Get application root directory
     * @returns {string} Application root path
     */
    getAppRoot() {
        return this._appRoot;
    }

    /**
     * Get user data directory
     * @returns {string} User data path
     */
    getUserData() {
        return this._userData;
    }

    /**
     * Get database path
     * @param {string} [dbName='linkhub.db'] - Database filename
     * @returns {string} Database path
     */
    getDatabasePath(dbName = 'linkhub.db') {
        return path.join(this._userData, dbName);
    }

    /**
     * Get logs directory path
     * @returns {string} Logs directory path
     */
    getLogsDir() {
        return path.join(this._userData, 'logs');
    }

    /**
     * Get log file path
     * @param {string} [logName='application.log'] - Log filename
     * @returns {string} Log file path
     */
    getLogPath(logName = 'application.log') {
        return path.join(this.getLogsDir(), logName);
    }

    /**
     * Get temp directory path
     * @returns {string} Temp directory path
     */
    getTempDir() {
        return path.join(this._userData, 'temp');
    }

    /**
     * Get downloads temp directory path
     * @returns {string} Downloads temp directory path
     */
    getDownloadsTempDir() {
        return path.join(this.getTempDir(), 'downloads');
    }

    /**
     * Get resources directory path
     * @returns {string} Resources directory path
     */
    getResourcesDir() {
        // In production, use process.resourcesPath for extraResources
        // In development, use appRoot/resources
        const basePath = this._resolveResourcesPath();
        return path.join(basePath, 'resources');
    }

    /**
     * Get bin directory path
     * @returns {string} Bin directory path
     */
    getBinDir() {
        return path.join(this.getResourcesDir(), 'bin');
    }

    /**
     * Get platform-specific bin directory path
     * @returns {string} Platform-specific bin directory path
     */
    getPlatformBinDir() {
        const platform = process.platform;
        let subDir;
        
        switch (platform) {
            case 'win32':
                subDir = 'win';
                break;
            case 'linux':
                subDir = 'linux';
                break;
            case 'darwin':
                subDir = 'macos';
                break;
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        
        return path.join(this.getBinDir(), subDir);
    }

    /**
     * Get binary path by name
     * @param {string} binaryName - Binary name (e.g., 'adb', 'scrcpy')
     * @returns {string} Full binary path
     */
    getBinaryPath(binaryName) {
        const platform = process.platform;
        let finalBinaryName = binaryName;
        
        if (platform === 'win32' && !finalBinaryName.toLowerCase().endsWith('.exe')) {
            finalBinaryName += '.exe';
        }
        
        return path.join(this.getPlatformBinDir(), finalBinaryName);
    }

    /**
     * Get renderer HTML file path
     * @returns {string} Renderer HTML path
     */
    getRendererHtmlPath() {
        return path.resolve(this._appRoot, 'src', 'renderer', 'index.html');
    }

    /**
     * Get preload script path
     * @returns {string} Preload script path
     */
    getPreloadScriptPath() {
        return path.resolve(this._appRoot, 'src', 'preload', 'preload.js');
    }
}

module.exports = PathService;
