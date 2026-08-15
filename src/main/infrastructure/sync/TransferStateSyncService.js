// src/main/infrastructure/sync/TransferStateSyncService.js
'use strict';

/**
 * TransferStateSyncService
 *
 * Service for aggregating transfer state and sending it to the UI separately
 * Reduces IPC pressure by reading state from memory and sending it periodically
 * This is the single source of truth for syncing transfer state with the frontend
 */
class TransferStateSyncService {
    constructor(windowManager, transferStateManager, options = {}) {
        if (!windowManager) {
            throw new Error('WindowManager is required for TransferStateSyncService');
        }

        this._windowManager = windowManager;
        this._transferStateManager = transferStateManager;
        this._interval = options.interval || 300; // 300ms default
        this._timer = null;
        this._isRunning = false;

        // Temporary map to store error messages
        this._pendingErrors = new Map(); // transferId -> errorMessage

        // Counter for consecutive failed attempts
        this._failedAttempts = 0;

        // Aggregated state
        this._state = {
            transfers: new Map(), // transferId -> transfer data
            timestamp: Date.now()
        };

        // Previous state for comparison (to emit separate events)
        this._previousState = {
            transfers: new Map() // transferId -> transferData
        };
    }

    /**
     * Start the service
     */
    start() {
        if (this._isRunning) return;

        this._isRunning = true;
        this._timer = setInterval(() => {
            this._broadcastState();
        }, this._interval);
    }

    /**
     * Stop the service
     */
    stop() {
        if (!this._isRunning) return;

        this._isRunning = false;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    /**
     * Modify the interval
     */
    setInterval(ms) {
        this._interval = ms;
        if (this._isRunning) {
            this.stop();
            this.start();
        }
    }

    /**
     * Get current state
     */
    getState() {
        return {
            transfers: Array.from(this._state.transfers.values()),
            timestamp: this._state.timestamp
        };
    }

    // ============================================================================
    // Internal methods
    // ============================================================================

    /**
     * Send state to UI
     * Reads state from memory (TransferStateManager._transfers) periodically
     */
    _broadcastState() {
        if (!this._transferStateManager) {
            return;
        }

        try {
            // Reset failed attempts counter on success
            this._failedAttempts = 0;

            // Read active transfers from memory
            const activeTransfers = this._transferStateManager.getActiveTransfers();

            // Detect transition to failed state and save error message
            activeTransfers.forEach((entry, transferId) => {
                const prev = this._previousState.transfers.get(transferId);
                if (prev && prev.status !== 'failed' && entry.status === 'failed') {
                    // Transition to failed: save error message temporarily
                    const errorMessage = entry.errorMessage || null;
                    this._pendingErrors.set(transferId, errorMessage);
                }
            });

            // Update current state
            this._state.transfers.clear();
            activeTransfers.forEach((entry, transferId) => {
                const transferData = {
                    transferId: transferId,
                    deviceId: entry.deviceId || null,
                    localPath: entry.localPath || null,
                    remotePath: entry.remotePath || null,
                    downloadId: entry.downloadId || null,
                    status: entry.status || 'unknown',
                    progress: entry.progress || 0,
                    transferredBytes: entry.transferredBytes || 0,
                    totalBytes: entry.totalBytes || 0,
                    speed: entry.speed || null,
                    eta: entry.eta || null,
                    startedAt: entry.startedAt || null,
                    completedAt: entry.completedAt || null,
                    failedAt: entry.failedAt || null,
                    cancelledAt: entry.cancelledAt || null
                };
                this._state.transfers.set(transferId, transferData);
            });

            const currentState = this.getState();

            // Send aggregated state
            this._windowManager.broadcast('transfer:state:update', currentState);

            // Compare and emit separate events
            this._diffAndEmitTransfers(currentState.transfers);

            this._state.timestamp = Date.now();

            // Update previous state
            this._updatePreviousState(currentState);
        } catch (error) {
            this._failedAttempts++;
            console.error(`[TransferStateSyncService] Failed to broadcast state (attempt ${this._failedAttempts}):`, error);
        }
    }

    // ============================================================================
    // Diffing methods to emit separate events
    // ============================================================================

    /**
     * Compare transfer state and emit separate events
     * @param {Array} currentTransfers - Current transfers
     */
    _diffAndEmitTransfers(currentTransfers) {
        const currentMap = new Map();
        currentTransfers.forEach(t => currentMap.set(t.transferId, t));
        
        for (const [transferId, transfer] of currentMap) {
            const prev = this._previousState.transfers.get(transferId);
            
            if (!prev) {
                // New transfer
                this._windowManager.broadcast('transfer:started', { 
                    transferId, 
                    deviceId: transfer.deviceId,
                    localPath: transfer.localPath,
                    downloadId: transfer.downloadId
                });
                continue;
            }
            
            if (transfer.status !== prev.status) {
                if (transfer.status === 'completed') {
                    this._windowManager.broadcast('transfer:complete', { transferId });
                } else if (transfer.status === 'failed') {
                    const errorMessage = this._pendingErrors.get(transferId) || null;
                    const errorData = {
                        transferId,
                        error: errorMessage
                    };
                    this._windowManager.broadcast('transfer:error', errorData);
                    // Delete error message after sending to prevent duplication
                    this._pendingErrors.delete(transferId);
                } else if (transfer.status === 'cancelled') {
                    this._windowManager.broadcast('transfer:cancelled', { transferId });
                } else if (transfer.status === 'transferring' && prev.status === 'pending') {
                    // Transfer actually started
                    this._windowManager.broadcast('transfer:started', { 
                        transferId,
                        deviceId: transfer.deviceId,
                        localPath: transfer.localPath,
                        downloadId: transfer.downloadId
                    });
                }
            }

            // Send progress for active transfers only when percentage changes
            // To reduce IPC pressure
            if (transfer.status === 'transferring' && transfer.progress !== prev.progress) {
                const progressData = {
                    transferId,
                    progress: transfer.progress / 100, // Convert from 0-100 to 0-1
                    transferredBytes: transfer.transferredBytes || null,
                    totalBytes: transfer.totalBytes || null,
                    speed: transfer.speed || null,
                    eta: transfer.eta || null
                };
                this._windowManager.broadcast('transfer:progress', progressData);
            }
        }
    }

    /**
     * تحديث الحالة السابقة
     */
    _updatePreviousState(currentState) {
        this._previousState.transfers.clear();
        currentState.transfers.forEach(t => {
            this._previousState.transfers.set(t.transferId, structuredClone(t));
        });
    }

    /**
     * Initialize the previous state with restored transfers
     * This prevents sending transfer:started events for restored transfers on first sync cycle
     * @param {Map} transfersMap - Map of transferId -> transfer data
     */
    initializeState(transfersMap) {
        if (!transfersMap || !(transfersMap instanceof Map)) {
            console.warn('[TransferStateSyncService] Invalid transfersMap provided for initialization');
            return;
        }

        this._previousState.transfers.clear();
        transfersMap.forEach((entry, transferId) => {
            const transferData = {
                transferId: transferId,
                deviceId: entry.deviceId || null,
                localPath: entry.localPath || null,
                remotePath: entry.remotePath || null,
                downloadId: entry.downloadId || null,
                status: entry.status || 'unknown',
                progress: entry.progress || 0,
                transferredBytes: entry.transferredBytes || 0,
                totalBytes: entry.totalBytes || 0,
                speed: entry.speed || null,
                eta: entry.eta || null,
                startedAt: entry.startedAt || null,
                completedAt: entry.completedAt || null,
                failedAt: entry.failedAt || null,
                cancelledAt: entry.cancelledAt || null
            };
            this._previousState.transfers.set(transferId, structuredClone(transferData));
        });

        console.log(`[TransferStateSyncService] Initialized previous state with ${this._previousState.transfers.size} transfers`);
    }
}

module.exports = TransferStateSyncService;
