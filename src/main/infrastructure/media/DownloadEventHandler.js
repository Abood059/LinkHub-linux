// src/main/infrastructure/media/DownloadEventHandler.js
'use strict';

const { adjustProgressForCombinedDownload } = require('./YtdlpUtils');

/**
 * DownloadEventHandler
 * Responsible for handling download events from yt-dlp-wrap-plus
 */
class DownloadEventHandler {
    constructor(downloadManager, logger = null, windowManager = null) {
        this._downloadManager = downloadManager;
        this._logger = logger;
        this._windowManager = windowManager;
    }

    setWindowManager(windowManager) {
        this._windowManager = windowManager;
    }

    /**
     * Handle progress event
     * @param {string} processId - Process ID
     * @param {Object} progress - Progress data from yt-dlp-wrap-plus
     * @param {Function} onProgress - Progress callback function
     */
    handleProgress(processId, progress, onProgress) {
        const entry = this._downloadManager.getDownloadEntry(processId);
        if (!entry) return;

        // Calculate adjusted progress for combined downloads (video+audio)
        const adjustedProgress = adjustProgressForCombinedDownload(
            progress.percent,
            progress.totalSize,
            entry,
            progress
        );

        entry.percent = adjustedProgress.percent;
        entry.speed = progress.currentSpeed;
        entry.size = adjustedProgress.size;
        entry.eta = progress.eta;

        if (onProgress) {
            onProgress({
                percent: adjustedProgress.percent,
                speed: progress.currentSpeed,
                size: adjustedProgress.size,
                eta: progress.eta
            });
        }
    }

    /**
     * Handle filename from ytDlpEvent
     * @param {string} processId - Process ID
     * @param {string} filename - File name
     */
    handleFilename(processId, filename) {
        const entry = this._downloadManager.getDownloadEntry(processId);
        if (!entry) return;

        entry.actualFilename = filename;
    }

    /**
     * Handle process close event
     * @param {string} processId - Process ID
     * @param {string} outputPath - Output path
     * @param {number} code - Exit code
     * @param {Array} deviceIds - Array of device IDs
     * @param {string} url - Download URL
     * @param {string} title - Video title
     * @param {Function} startDownloadCallback - Retry callback function
     */
    async handleClose(processId, outputPath, code, deviceIds, url, title, startDownloadCallback) {
        const entry = this._downloadManager.getDownloadEntry(processId);
        if (!entry) return;

        // Handle manual stop - don't send error
        if (entry.manuallyStopped) {
            this._downloadManager.updateDownloadStatus(processId, 'stopped');
            return;
        }

        if (code === 0) {
            const result = await this._downloadManager.handleDownloadSuccess(
                processId,
                outputPath,
                deviceIds,
                url,
                title,
                entry.actualFilename
            );
            this._downloadManager.updateDownloadStatus(processId, 'completed');

            // Send automatic transfer event if transfer succeeded
            if (result && result.transferResult) {
                this._sendTransferEvent(processId, deviceIds, result.transferResult);
            }
        } else {
            // Check for retry
            if (this._downloadManager.shouldRetry(entry, code)) {
                this._downloadManager.handleRetry(
                    entry,
                    processId,
                    url,
                    entry.formatId,
                    { outputPath, deviceIds, title },
                    startDownloadCallback,
                    code
                );
                return;
            } else {
                this._downloadManager.handleDownloadFailure(
                    processId,
                    code,
                    deviceIds,
                    url,
                    title
                );
                this._downloadManager.updateDownloadStatus(processId, 'failed');
            }
        }
    }

    /**
     * Send transfer event to UI
     * @param {string} processId - Process ID
     * @param {Array} deviceIds - Array of device IDs
     * @param {Object} transferResult - Transfer result
     */
    _sendTransferEvent(processId, deviceIds, transferResult) {
        if (!this._windowManager) {
            return;
        }

        try {
            const windows = this._windowManager.getAllWindows();
            if (windows && windows.length > 0) {
                const mainWindow = windows[0];
                if (transferResult.success) {
                    mainWindow.webContents.send('transfer:complete', {
                        downloadId: processId,
                        deviceIds: deviceIds,
                        message: transferResult.message
                    });
                } else {
                    mainWindow.webContents.send('transfer:error', {
                        downloadId: processId,
                        deviceIds: deviceIds,
                        error: transferResult.message
                    });
                }
            }
        } catch (err) {
            if (this._logger) {
                this._logger.error(`Failed to send transfer event: ${err.message}`);
            }
        }
    }

    /**
     * Handle error event
     * @param {string} processId - Process ID
     * @param {Error} err - Error object
     * @param {Array} deviceIds - Array of device IDs
     * @param {string} url - Download URL
     */
    handleError(processId, err, deviceIds, url) {
        const entry = this._downloadManager.getDownloadEntry(processId);
        if (!entry) return;

        this._downloadManager.handleProcessError(
            processId,
            err,
            deviceIds,
            url
        );
        this._downloadManager.removeDownloadEntry(processId);
    }
}

module.exports = DownloadEventHandler;
