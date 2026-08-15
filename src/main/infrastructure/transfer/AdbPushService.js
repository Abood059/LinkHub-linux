// src/main/infrastructure/transfer/AdbPushService.js
'use strict';

const path = require('path');
const EventEmitter = require('events');

/**
 * AdbPushService
 * 
 * Responsibility: Coordinate transfer operations (Orchestration only)
 * - Coordinate single and multiple transfer operations
 * - Send progress and status events
 * - Manage basic condition verification
 * 
 * Delegates specialized tasks to:
 * - FileTransferExecutor: Execute actual transfer
 * - TransferProgressTracker: Calculate progress
 * - FileDeleter: Delete files
 */
class AdbPushService extends EventEmitter {
    constructor({ fileTransferExecutor, progressTracker, fileDeleter, logger = null }) {
        super();
        
        if (!fileTransferExecutor) {
            throw new Error('fileTransferExecutor is required for AdbPushService');
        }
        if (!progressTracker) {
            throw new Error('progressTracker is required for AdbPushService');
        }
        if (!fileDeleter) {
            throw new Error('fileDeleter is required for AdbPushService');
        }
        
        this._fileTransferExecutor = fileTransferExecutor;
        this._progressTracker = progressTracker;
        this._fileDeleter = fileDeleter;
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
        // Determine target path on device
        const fileName = path.basename(localPath);
        const targetRemotePath = remotePath || `/sdcard/Download/${fileName}`;

        // Get original file size
        const originalSize = await this._progressTracker.getLocalFileSize(localPath);

        if (originalSize === 0) {
            return {
                success: false,
                message: `File is empty or not found: ${localPath}`,
                progress: 0
            };
        }

        // Send transfer start event
        this.emit('transferStarted', {
            localPath,
            remotePath: targetRemotePath,
            deviceId,
            totalSize: originalSize
        });

        // Start progress polling every 300ms
        let progressInterval = null;
        let isTransferComplete = false;

        const startProgressPolling = () => {
            progressInterval = setInterval(async () => {
                if (isTransferComplete) {
                    clearInterval(progressInterval);
                    return;
                }

                try {
                    const progressData = await this._progressTracker.calculateProgress(deviceId, targetRemotePath, originalSize);
                    
                    this.emit('progressUpdate', {
                        localPath,
                        remotePath: targetRemotePath,
                        deviceId,
                        progress: progressData.progress,
                        transferredBytes: progressData.transferredBytes,
                        totalBytes: progressData.totalBytes
                    });
                } catch (error) {
                    if (this._logger) {
                        this._logger.warn(`[AdbPushService] Failed to poll progress: ${error.message}`);
                    }
                }
            }, 300);
        };

        startProgressPolling();

        // Execute transfer
        const result = await this._fileTransferExecutor.executePush(deviceId, localPath, targetRemotePath);

        // Stop polling
        isTransferComplete = true;
        if (progressInterval) {
            clearInterval(progressInterval);
        }

        if (result.success) {
            // Calculate final progress after transfer
            const progressData = await this._progressTracker.calculateProgress(deviceId, targetRemotePath, originalSize);
            
            // Send final progress update
            this.emit('progressUpdate', {
                localPath,
                remotePath: targetRemotePath,
                deviceId,
                progress: progressData.progress,
                transferredBytes: progressData.transferredBytes,
                totalBytes: progressData.totalBytes
            });
            
            // Delete temp file after successful transfer
            if (deleteAfterTransfer) {
                await this._fileDeleter.deleteLocalFile(localPath);
            }

            this.emit('transferComplete', {
                localPath,
                remotePath: targetRemotePath,
                deviceId,
                progress: progressData.progress,
                transferredBytes: progressData.transferredBytes,
                totalBytes: progressData.totalBytes
            });

            return {
                success: true,
                message: `File transferred successfully to ${targetRemotePath}`,
                progress: progressData.progress
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
     * Transfer file to device and delete after transfer (for temp files)
     * @param {string} localPath - Local file path
     * @param {string} deviceId - Device ID
     * @returns {Promise<{success: boolean, message: string, progress: number}>}
     */
    async pushAndDelete(localPath, deviceId) {
        return this.pushFile(localPath, deviceId, null, true);
    }

    /**
     * Transfer file from downloads folder to device (without deletion)
     * @param {string} localPath - Local file path
     * @param {string} deviceId - Device ID
     * @returns {Promise<{success: boolean, message: string, progress: number}>}
     */
    async pushFromDownloads(localPath, deviceId) {
        return this.pushFile(localPath, deviceId, null, false);
    }
}

module.exports = AdbPushService;
