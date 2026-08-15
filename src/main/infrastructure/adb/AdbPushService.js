// src/main/infrastructure/adb/AdbPushService.js
'use strict';

const path = require('path');
const fs = require('fs').promises;
const EventEmitter = require('events');

class AdbPushService extends EventEmitter {
    constructor({ adbExecutor, logger = null }) {
        super();
        this._adbExecutor = adbExecutor;
        this._logger = logger;
    }

    /**
     * Transfer file to device with progress tracking
     * @param {string} localPath - Local file path
     * @param {string} deviceId - Device ID
     * @param {string} remotePath - Target path on device (optional)
     * @param {boolean} deleteAfterTransfer - Delete file after transfer (optional)
     * @returns {Promise<{success: boolean, message: string, progress: number}>}
     */
    async pushFile(localPath, deviceId, remotePath = null, deleteAfterTransfer = false) {
        // Check device connection
        const isConnected = await this._adbExecutor.isDeviceConnected(deviceId);
        if (!isConnected) {
            return {
                success: false,
                message: 'Device is not connected',
                progress: 0
            };
        }

        // Check file existence
        try {
            await fs.access(localPath);
        } catch (err) {
            return {
                success: false,
                message: `File not found: ${localPath}`,
                progress: 0
            };
        }

        // Get original file size
        const originalSize = await this._getFileSize(localPath);

        // Determine target path on device
        const fileName = path.basename(localPath);
        const targetRemotePath = remotePath || `/sdcard/Download/${fileName}`;

        // Send transfer start event
        this.emit('transferStarted', {
            localPath,
            remotePath: targetRemotePath,
            deviceId,
            totalSize: originalSize
        });

        // Transfer file
        const result = await this._adbExecutor.pushFile(deviceId, localPath, targetRemotePath);

        if (result.success) {
            // Calculate progress after transfer
            const progress = await this._calculateProgress(deviceId, targetRemotePath, originalSize);
            
            // Delete temp file after successful transfer
            if (deleteAfterTransfer) {
                try {
                    await fs.unlink(localPath);
                } catch (err) {
                    if (this._logger) {
                        this._logger.warn(`Failed to delete temp file: ${err.message}`);
                    }
                }
            }

            this.emit('transferComplete', {
                localPath,
                remotePath: targetRemotePath,
                deviceId,
                progress
            });

            return {
                success: true,
                message: `File transferred successfully to ${targetRemotePath}`,
                progress
            };
        } else {
            this.emit('transferFailed', {
                localPath,
                remotePath: targetRemotePath,
                deviceId,
                error: result.message
            });

            return {
                success: false,
                message: result.message,
                progress: 0
            };
        }
    }

    /**
     * Transfer multiple files to device
     * @param {Array<string>} localPaths - Array of local file paths
     * @param {string} deviceId - Device ID
     * @param {string} remoteDir - Target directory on device (optional)
     * @param {boolean} deleteAfterTransfer - Delete files after transfer (optional)
     * @returns {Promise<Array<{success: boolean, message: string, progress: number, file: string}>>}
     */
    async pushFiles(localPaths, deviceId, remoteDir = null, deleteAfterTransfer = false) {
        const results = [];
        const targetRemoteDir = remoteDir || '/sdcard/Download/';

        for (const localPath of localPaths) {
            const fileName = path.basename(localPath);
            const remotePath = path.join(targetRemoteDir, fileName);
            
            const result = await this.pushFile(localPath, deviceId, remotePath, deleteAfterTransfer);
            results.push({
                ...result,
                file: localPath
            });
        }

        return results;
    }

    /**
     * Calculate transfer completion percentage based on file size on device divided by original size
     * @param {string} deviceId - Device ID
     * @param {string} remotePath - Path on device
     * @param {number} originalSize - Original file size in bytes
     * @returns {Promise<number>} - Progress ratio between 0 and 1
     */
    async _calculateProgress(deviceId, remotePath, originalSize) {
        try {
            const remoteSize = await this._getRemoteFileSize(deviceId, remotePath);
            
            if (originalSize <= 0) {
                return 1; // If original size is 0, consider transfer complete
            }

            const progress = Math.min(remoteSize / originalSize, 1);
            
            this.emit('progressUpdate', {
                deviceId,
                remotePath,
                progress,
                transferredBytes: remoteSize,
                totalBytes: originalSize
            });

            return progress;
        } catch (error) {
            if (this._logger) {
                this._logger.warn(`Failed to calculate progress: ${error.message}`);
            }
            return 1; // On error, consider transfer complete
        }
    }

    /**
     * Get local file size
     * @param {string} filePath - File path
     * @returns {Promise<number>} - Size in bytes
     */
    async _getFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch (error) {
            if (this._logger) {
                this._logger.error(`Failed to get file size: ${error.message}`);
            }
            return 0;
        }
    }

    /**
     * Get file size on remote device
     * @param {string} deviceId - Device ID
     * @param {string} remotePath - Path on device
     * @returns {Promise<number>} - Size in bytes
     */
    async _getRemoteFileSize(deviceId, remotePath) {
        try {
            const sanitizedSerial = this._adbExecutor._sanitizeSerialOrTarget ? 
                this._adbExecutor._sanitizeSerialOrTarget(deviceId) : deviceId;
            
            // Use shell command with proper path escaping
            // Use single quotes around path to protect from spaces and special characters
            const escapedPath = remotePath.replace(/'/g, "'\\''");
            const sizeCommand = ['stat', '-c', '%s', `'${escapedPath}'`];
            const sizeOutput = await this._adbExecutor._executeShellCommand(sanitizedSerial, sizeCommand);
            
            const size = parseInt(sizeOutput.trim());
            return isNaN(size) ? 0 : size;
        } catch (error) {
            if (this._logger) {
                this._logger.warn(`Failed to get remote file size: ${error.message}`);
            }
            return 0;
        }
    }

    /**
     * نقل ملف للجهاز وحذفه بعد النقل (للملفات المؤقتة)
     * @param {string} localPath - المسار المحلي للملف
     * @param {string} deviceId - معرف الجهاز
     * @returns {Promise<{success: boolean, message: string, progress: number}>}
     */
    async pushAndDelete(localPath, deviceId) {
        return this.pushFile(localPath, deviceId, null, true);
    }

    /**
     * نقل ملف من مجلد التحميلات للجهاز (بدون حذف)
     * @param {string} localPath - المسار المحلي للملف
     * @param {string} deviceId - معرف الجهاز
     * @returns {Promise<{success: boolean, message: string, progress: number}>}
     */
    async pushFromDownloads(localPath, deviceId) {
        return this.pushFile(localPath, deviceId, null, false);
    }
}

module.exports = AdbPushService;
