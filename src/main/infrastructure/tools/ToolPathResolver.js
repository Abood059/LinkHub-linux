// src/main/infrastructure/tools/ToolPathResolver.js
'use strict';

const path = require('path');
const fs = require('fs');
const { sanitizePath } = require('../../utils/pathSanitizer');

class ToolPathResolver {
    constructor(options = {}) {
        this._logger = options.logger || null;
        this._appRoot = this._resolveAppRoot(options.appRoot);
        this._platform = process.platform;
        this._binSubDir = this._getBinSubDir();
    }

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
                this._logger.warn('ToolPathResolver: Electron app not available, using cwd');
            }
        }
        return process.cwd();
    }

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
                this._logger.warn('ToolPathResolver: Electron app not available, using appRoot');
            }
        }
        return this._appRoot;
    }

    _getBinSubDir() {
        switch (this._platform) {
            case 'win32': return 'win';
            case 'linux': return 'linux';
            case 'darwin': return 'macos';
            default: throw new Error(`Unsupported platform: ${this._platform}`);
        }
    }

    _getDefaultPath(binaryName) {
        let finalBinaryName = binaryName;
        if (this._platform === 'win32' && !finalBinaryName.toLowerCase().endsWith('.exe')) {
            finalBinaryName += '.exe';
        }
        
        // In production, use process.resourcesPath for extraResources
        // In development, use appRoot/resources
        const basePath = this._resolveResourcesPath();
        return path.join(basePath, 'resources', 'bin', this._binSubDir, finalBinaryName);
    }

    _getPath(envVarName, binaryName) {
        const envPath = process.env[envVarName];
        if (envPath && typeof envPath === 'string' && envPath.trim()) {
            const sanitizedPath = sanitizePath(this._appRoot, envPath, this._logger);
            if (sanitizedPath && fs.existsSync(sanitizedPath)) {
                return sanitizedPath;
            }
            if (this._logger) {
                this._logger.warn(`ToolPathResolver: Environment override ${envVarName} points to non-existent or invalid file.`);
            }
            return null;
        }
    
        const defaultPath = this._getDefaultPath(binaryName);
        if (fs.existsSync(defaultPath)) {
            return defaultPath;
        }
    
        if (this._logger) {
            this._logger.warn(`ToolPathResolver: Optional binary "${binaryName}" not found at ${defaultPath}.`);
        }
        return null; 
    }

    getAdbPath() {
        return this._getPath('LINKHUB_ADB_PATH', 'adb');
    }

    getScrcpyPath() {
        return this._getPath('LINKHUB_SCRCPY_PATH', 'scrcpy');
    }

    getYtDlpPath() {
        return this._getPath('LINKHUB_YTDLP_PATH', 'yt-dlp');
    }

    getDenoPath() {
        return this._getPath('LINKHUB_DENO_PATH', 'deno');
    }

    verifyAll() {
        const result = { adb: false, scrcpy: false, ytdlp: false, deno: false };
        try { result.adb = !!this.getAdbPath(); } catch (e) { /* ignore */ }
        try { result.scrcpy = !!this.getScrcpyPath(); } catch (e) { /* ignore */ }
        try { result.ytdlp = !!this.getYtDlpPath(); } catch (e) { /* ignore */ }
        try { result.deno = !!this.getDenoPath(); } catch (e) { /* ignore */ }
        return result;
    }

    /**
     * Verify that deno works correctly
     * @returns {Promise<{valid: boolean, path: string|null, version: string|null, error: string|null}>}
     */
    async verifyDeno() {
        const denoPath = this.getDenoPath();
        if (!denoPath) {
            return { valid: false, path: null, version: null, error: 'Deno binary not found' };
        }

        const { spawn } = require('child_process');
        
        return new Promise((resolve) => {
            try {
                const child = spawn(denoPath, ['--version'], { timeout: 5000 });
                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (data) => { stdout += data.toString(); });
                child.stderr.on('data', (data) => { stderr += data.toString(); });

                child.on('close', (code) => {
                    if (code === 0 && stdout.trim()) {
                        resolve({ 
                            valid: true, 
                            path: denoPath, 
                            version: stdout.trim(), 
                            error: null 
                        });
                    } else {
                        resolve({ 
                            valid: false, 
                            path: denoPath, 
                            version: null, 
                            error: stderr.trim() || `Deno exited with code ${code}` 
                        });
                    }
                });

                child.on('error', (err) => {
                    resolve({ 
                        valid: false, 
                        path: denoPath, 
                        version: null, 
                        error: err.message 
                    });
                });

                setTimeout(() => {
                    child.kill();
                    resolve({ 
                        valid: false, 
                        path: denoPath, 
                        version: null, 
                        error: 'Deno verification timeout' 
                    });
                }, 5000);
            } catch (err) {
                resolve({ 
                    valid: false, 
                    path: denoPath, 
                    version: null, 
                    error: err.message 
                });
            }
        });
    }
}

module.exports = ToolPathResolver;