// src/main/infrastructure/tools/YtdlpUpdater.js
'use strict';

const fs = require('fs').promises;
const path = require('path');

class YtdlpUpdater {
    constructor(options = {}) {
        this._logger = options.logger || null;
        this._ytdlpPath = options.ytdlpPath || 'yt-dlp';
        this._toolPathResolver = options.toolPathResolver || null;
        this._processSupervisor = options.processSupervisor || null;
    }

    _resolveYtdlpPath() {
        if (this._toolPathResolver) {
            return this._toolPathResolver.getYtDlpPath();
        }
        return this._ytdlpPath;
    }

    /**
     * Check for yt-dlp update
     * @returns {Promise<{hasUpdate: boolean, currentVersion: string, latestVersion: string}>}
     */
    async checkForUpdates() {
        const ytdlpPath = this._resolveYtdlpPath();
        
        if (!this._processSupervisor) {
            throw new Error('ProcessSupervisor is required for YtdlpUpdater');
        }
        
        try {
            const output = await this._processSupervisor.executeQuickTaskArray(
                ytdlpPath,
                ['--version'],
                { timeout: 10000 }
            );
            
            const currentVersion = output.trim();
            return {
                hasUpdate: true, // yt-dlp -U will check automatically
                currentVersion,
                latestVersion: 'unknown'
            };
        } catch (err) {
            if (this._logger) {
                this._logger.error(`Failed to check yt-dlp version: ${err.message}`);
            }
            throw new Error(`Failed to check version: ${err.message}`);
        }
    }

    /**
     * Update yt-dlp using yt-dlp -U
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async update() {
        const ytdlpPath = this._resolveYtdlpPath();
        
        if (!this._processSupervisor) {
            throw new Error('ProcessSupervisor is required for YtdlpUpdater');
        }
        
        try {
            const output = await this._processSupervisor.executeQuickTaskArray(
                ytdlpPath,
                ['-U'],
                { timeout: 60000 }
            );
            
            // yt-dlp -U returns 0 even if there is no update
            if (output.includes('Already up-to-date')) {
                if (this._logger) {
                    this._logger.info('yt-dlp is already up-to-date');
                }
                return {
                    success: true,
                    message: 'yt-dlp is already up-to-date',
                    updated: false
                };
            } else if (output.includes('Updated')) {
                if (this._logger) {
                    this._logger.info('yt-dlp updated successfully');
                }
                return {
                    success: true,
                    message: 'yt-dlp updated successfully',
                    updated: true
                };
            } else {
                // May be updated without clear message
                return {
                    success: true,
                    message: 'Update check completed',
                    updated: false
                };
            }
        } catch (err) {
            if (this._logger) {
                this._logger.error(`Failed to update yt-dlp: ${err.message}`);
            }
            throw new Error(`Update failed: ${err.message}`);
        }
    }

    /**
     * Check write permissions on yt-dlp file
     * @returns {Promise<boolean>}
     */
    async checkWritePermissions() {
        const ytdlpPath = this._resolveYtdlpPath();
        
        try {
            await fs.access(ytdlpPath, fs.constants.W_OK);
            return true;
        } catch (err) {
            if (this._logger) {
                this._logger.warn(`No write permissions for yt-dlp at ${ytdlpPath}`);
            }
            return false;
        }
    }

    /**
     * Check if yt-dlp is not a package (unpacked)
     * yt-dlp does not support auto-update for unpacked packages
     * @returns {Promise<boolean>}
     */
    async isUnpacked() {
        const ytdlpPath = this._resolveYtdlpPath();
        
        try {
            // Check file size - unpacked packages are usually larger
            const stats = await fs.stat(ytdlpPath);
            const fileSizeMB = stats.size / (1024 * 1024);
            
            // Unpacked yt-dlp is usually larger than 50MB
            if (fileSizeMB > 50) {
                if (this._logger) {
                    this._logger.warn('yt-dlp appears to be unpacked (large file size)');
                }
                return true;
            }
            
            return false;
        } catch (err) {
            if (this._logger) {
                this._logger.error(`Failed to check if yt-dlp is unpacked: ${err.message}`);
            }
            return false;
        }
    }

    /**
     * Auto-update with condition checks
     * @returns {Promise<{success: boolean, message: string, updated: boolean}>}
     */
    async autoUpdate() {
        try {
            // Check permissions
            const hasWritePermission = await this.checkWritePermissions();
            if (!hasWritePermission) {
                return {
                    success: false,
                    message: 'No write permissions for yt-dlp',
                    updated: false
                };
            }

            // Check for unpacked package
            const unpacked = await this.isUnpacked();
            if (unpacked) {
                return {
                    success: false,
                    message: 'yt-dlp is unpacked, auto-update not supported. Please download the latest release manually.',
                    updated: false
                };
            }

            // Execute update
            const result = await this.update();
            return result;
        } catch (err) {
            if (this._logger) {
                this._logger.error(`Auto-update failed: ${err.message}`);
            }
            return {
                success: false,
                message: err.message,
                updated: false
            };
        }
    }
}

module.exports = YtdlpUpdater;
