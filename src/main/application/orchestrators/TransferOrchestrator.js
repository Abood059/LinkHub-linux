// src/main/application/orchestrators/TransferOrchestrator.js
'use strict';

const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * TransferOrchestrator
 * 
 * Responsibility: Coordinate transfer operations and decision making
 * - Coordinate single and multiple transfer operations
 * - Verify conditions before transfer
 * - Manage transfer cancellation
 * - Send events to UI
 * 
 * Principles:
 * - Memory is the single source of truth
 * - Does not access database
 * - Verify conditions before execution
 */
class TransferOrchestrator {
    constructor({ transferStateManager, adbPushService, spaceChecker, deviceRegistry, logger = null, windowManager = null }) {
        if (!transferStateManager) {
            throw new Error('transferStateManager is required for TransferOrchestrator');
        }
        if (!adbPushService) {
            throw new Error('adbPushService is required for TransferOrchestrator');
        }
        if (!spaceChecker) {
            throw new Error('spaceChecker is required for TransferOrchestrator');
        }
        if (!deviceRegistry) {
            throw new Error('deviceRegistry is required for TransferOrchestrator');
        }

        this._transferStateManager = transferStateManager;
        this._adbPushService = adbPushService;
        this._spaceChecker = spaceChecker;
        this._deviceRegistry = deviceRegistry;
        this._logger = logger;
        this._windowManager = windowManager;

        // Listen to AdbPushService events
        this._setupEventListeners();
    }

    /**
     * Set WindowManager (called after WindowManager is created)
     */
    setWindowManager(windowManager) {
        this._windowManager = windowManager;
    }

    /**
     * Setup event listeners from AdbPushService
     */
    _setupEventListeners() {
        this._adbPushService.on('transferStarted', (data) => {
            this._handleTransferStarted(data);
        });

        this._adbPushService.on('transferComplete', (data) => {
            this._handleTransferComplete(data);
        });

        this._adbPushService.on('transferFailed', (data) => {
            this._handleTransferFailed(data);
        });

        this._adbPushService.on('progressUpdate', (data) => {
            this._handleProgressUpdate(data);
        });
    }

    /**
     * Start a single file transfer
     * @param {string} localPath - Local path of the file
     * @param {string} deviceId - Device identifier
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, transferId: string, message: string}>}
     */
    async startTransfer(localPath, deviceId, options = {}) {
        const transferId = options.transferId || randomUUID();
        const downloadId = options.downloadId || null;
        const remotePath = options.remotePath || null;

        try {
            // Verify device connection
            const device = this._deviceRegistry.getDevice(deviceId);
            const runtimeState = this._deviceRegistry.getRuntimeState(deviceId);
            if (!device || !runtimeState || runtimeState.status !== 'connected') {
                return {
                    success: false,
                    transferId: null,
                    message: 'Device is not connected'
                };
            }

            // Verify file existence
            try {
                await fs.access(localPath);
            } catch (err) {
                return {
                    success: false,
                    transferId: null,
                    message: `File not found: ${localPath}`
                };
            }

            // Get file size
            const stats = await fs.stat(localPath);
            const fileSize = stats.size;

            // Check available space
            const spaceCheck = await this._spaceChecker.checkAvailableSpace(deviceId, fileSize);
            if (!spaceCheck.hasEnoughSpace) {
                return {
                    success: false,
                    transferId: null,
                    message: `Insufficient space on device. Available: ${spaceCheck.availableBytes} bytes, Required: ${spaceCheck.requiredBytes} bytes`
                };
            }

            // Create entry in memory
            this._transferStateManager.createTransferEntry(transferId, {
                deviceId,
                localPath,
                remotePath,
                downloadId,
                status: 'pending',
                totalBytes: fileSize,
                startedAt: new Date().toISOString()
            });

            // Start transfer
            const result = await this._adbPushService.pushFile(localPath, deviceId, remotePath, false);

            if (result.success) {
                return {
                    success: true,
                    transferId,
                    message: 'Transfer started successfully'
                };
            } else {
                // Update status to failed
                this._transferStateManager.updateTransferEntry(transferId, {
                    status: 'failed',
                    errorMessage: result.message,
                    failedAt: new Date().toISOString()
                });

                return {
                    success: false,
                    transferId,
                    message: result.message
                };
            }
        } catch (error) {
            if (this._logger) {
                this._logger.error(`[TransferOrchestrator] Failed to start transfer: ${error.message}`);
            }

            return {
                success: false,
                transferId: null,
                message: error.message
            };
        }
    }

    /**
     * Start transfer to multiple devices (concurrent transfer)
     * @param {string} localPath - Local path of the file
     * @param {Array<string>} deviceIds - Array of device identifiers
     * @param {Object} options - Additional options
     * @returns {Promise<{success: boolean, transferIds: Array<string>, message: string}>}
     */
    async startMultipleTransfers(localPath, deviceIds, options = {}) {
        const transferIds = [];
        const errors = [];

        // Start transfer for each device concurrently
        const transferPromises = deviceIds.map(async (deviceId) => {
            const result = await this.startTransfer(localPath, deviceId, {
                ...options,
                transferId: randomUUID()
            });
            
            if (result.success) {
                transferIds.push(result.transferId);
            } else {
                errors.push({ deviceId, message: result.message });
            }
        });

        await Promise.all(transferPromises);

        if (transferIds.length > 0) {
            return {
                success: true,
                transferIds,
                message: `Started ${transferIds.length} transfers successfully`
            };
        } else {
            return {
                success: false,
                transferIds: [],
                message: `Failed to start any transfers. Errors: ${errors.map(e => e.message).join(', ')}`
            };
        }
    }

    /**
     * Start transfer after download completion
     * @param {string} downloadId - Download identifier
     * @param {Array<string>} deviceIds - Array of device identifiers
     * @param {string} localPath - Local path of the file
     * @returns {Promise<{success: boolean, transferIds: Array<string>, message: string}>}
     */
    async startDownloadTransfer(downloadId, deviceIds, localPath) {
        return this.startMultipleTransfers(localPath, deviceIds, {
            downloadId
        });
    }

    /**
     * Cancel a transfer
     * @param {string} transferId - Transfer identifier
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async cancelTransfer(transferId) {
        try {
            const entry = this._transferStateManager.getTransferEntry(transferId);
            if (!entry) {
                return {
                    success: false,
                    message: 'Transfer not found'
                };
            }

            // If transfer is in progress, delete file from device
            if (entry.status === 'transferring' && entry.remotePath) {
                // Note: Cannot stop running ADB push command
                // Can only delete partially transferred file
                // This requires FileDeleter
                // Currently we will only update status
            }

            // Update status to cancelled
            this._transferStateManager.updateTransferEntry(transferId, {
                status: 'cancelled',
                cancelledAt: new Date().toISOString()
            });

            if (this._logger) {
                this._logger.info(`[TransferOrchestrator] Transfer cancelled: ${transferId}`);
            }

            return {
                success: true,
                message: 'Transfer cancelled successfully'
            };
        } catch (error) {
            if (this._logger) {
                this._logger.error(`[TransferOrchestrator] Failed to cancel transfer: ${error.message}`);
            }

            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Get transfer status
     * @param {string} transferId - Transfer identifier
     * @returns {Object|null} - Transfer status
     */
    getTransferStatus(transferId) {
        return this._transferStateManager.getTransferEntry(transferId);
    }

    /**
     * Get all active transfers
     * @returns {Array} - Array of active transfers
     */
    getActiveTransfers() {
        return this._transferStateManager.getActiveTransfersArray();
    }

    /**
     * Get transfers for a specific device
     * @param {string} deviceId - Device identifier
     * @returns {Array} - Array of transfers
     */
    getTransfersByDevice(deviceId) {
        return this._transferStateManager.getTransfersByDeviceId(deviceId);
    }

    // ============================================================================
    // Event Handlers
    // ============================================================================

    /**
     * Handle transfer started event
     */
    _handleTransferStarted(data) {
        // Find matching transferId
        const transfers = this._transferStateManager.getActiveTransfersArray();
        const matchingTransfer = transfers.find(t => 
            t.localPath === data.localPath && 
            t.deviceId === data.deviceId && 
            t.status === 'pending'
        );

        if (matchingTransfer) {
            this._transferStateManager.updateTransferEntry(matchingTransfer.transferId, {
                status: 'transferring',
                totalBytes: data.totalSize
            });

            if (this._logger) {
                this._logger.info(`[TransferOrchestrator] Transfer started: ${matchingTransfer.transferId}`);
            }

            // Send event to UI
            if (this._windowManager) {
                const fileName = path.basename(data.localPath);
                this._windowManager.broadcast('transfer:started', {
                    transferId: matchingTransfer.transferId,
                    fileName: fileName,
                    deviceIds: [matchingTransfer.deviceId]
                });
            }
        }
    }

    /**
     * Handle transfer completed event
     */
    _handleTransferComplete(data) {
        const transfers = this._transferStateManager.getActiveTransfersArray();
        const matchingTransfer = transfers.find(t => 
            t.localPath === data.localPath && 
            t.deviceId === data.deviceId && 
            t.status === 'transferring'
        );

        if (matchingTransfer) {
            this._transferStateManager.updateTransferEntry(matchingTransfer.transferId, {
                status: 'completed',
                progress: data.progress * 100,
                transferredBytes: data.transferredBytes,
                completedAt: new Date().toISOString()
            });

            if (this._logger) {
                this._logger.info(`[TransferOrchestrator] Transfer completed: ${matchingTransfer.transferId}`);
            }

            // Send event to UI
            if (this._windowManager) {
                this._windowManager.broadcast('transfer:completed', {
                    transferId: matchingTransfer.transferId
                });
            }
        }
    }

    /**
     * Handle transfer failed event
     */
    _handleTransferFailed(data) {
        const transfers = this._transferStateManager.getActiveTransfersArray();
        const matchingTransfer = transfers.find(t => 
            t.localPath === data.localPath && 
            t.deviceId === data.deviceId && 
            t.status === 'transferring'
        );

        if (matchingTransfer) {
            this._transferStateManager.updateTransferEntry(matchingTransfer.transferId, {
                status: 'failed',
                errorMessage: data.error,
                failedAt: new Date().toISOString()
            });

            if (this._logger) {
                this._logger.error(`[TransferOrchestrator] Transfer failed: ${matchingTransfer.transferId} - ${data.error}`);
            }

            // Send event to UI
            if (this._windowManager) {
                this._windowManager.broadcast('transfer:failed', {
                    transferId: matchingTransfer.transferId,
                    error: data.error
                });
            }
        }
    }

    /**
     * Handle progress update event
     */
    _handleProgressUpdate(data) {
        const transfers = this._transferStateManager.getActiveTransfersArray();
        const matchingTransfer = transfers.find(t => 
            t.localPath === data.localPath && 
            t.deviceId === data.deviceId && 
            (t.status === 'transferring' || t.status === 'pending')
        );

        if (matchingTransfer) {
            this._transferStateManager.updateTransferEntry(matchingTransfer.transferId, {
                progress: data.progress * 100,
                transferredBytes: data.transferredBytes
            });

            // Send event to UI (value between 0 and 1)
            if (this._windowManager) {
                this._windowManager.broadcast('transfer:progress', {
                    transferId: matchingTransfer.transferId,
                    progress: data.progress,
                    transferredBytes: data.transferredBytes,
                    totalBytes: data.totalBytes
                });
            }
        }
    }
}

module.exports = TransferOrchestrator;
