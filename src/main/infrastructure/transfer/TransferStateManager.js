// src/main/infrastructure/transfer/TransferStateManager.js
'use strict';

const { randomUUID } = require('crypto');

/**
 * TransferStateManager
 * 
 * Responsibility: Manage transfer state in memory only
 * - Create, update, and delete transfer operations
 * - Store data in memory (Map)
 * - Fast query functions
 * 
 * NO business logic, NO file operations, NO event emission
 * Data is cleared when application closes
 */
class TransferStateManager {
    constructor({ logger = null }) {
        this._logger = logger;
        this._transfers = new Map(); // transferId -> transfer entry
    }

    /**
     * Create new transfer entry
     * @param {string} transferId - Transfer ID (UUID)
     * @param {Object} data - Transfer data
     * @returns {Object} - Created entry
     */
    createTransferEntry(transferId, data) {
        const entry = {
            transferId: transferId || randomUUID(),
            deviceId: data.deviceId || null,
            localPath: data.localPath || null,
            remotePath: data.remotePath || null,
            downloadId: data.downloadId || null,
            status: data.status || 'pending',
            progress: data.progress || 0,
            transferredBytes: data.transferredBytes || 0,
            totalBytes: data.totalBytes || 0,
            speed: data.speed || null,
            eta: data.eta || null,
            startedAt: data.startedAt || null,
            completedAt: data.completedAt || null,
            failedAt: data.failedAt || null,
            cancelledAt: data.cancelledAt || null,
            errorMessage: data.errorMessage || null
        };

        this._transfers.set(entry.transferId, entry);

        if (this._logger) {
            this._logger.info(`[TransferStateManager] Created transfer entry: ${entry.transferId}`);
        }

        return entry;
    }

    /**
     * Get transfer entry
     * @param {string} transferId - Transfer ID
     * @returns {Object|null} - Entry or null
     */
    getTransferEntry(transferId) {
        return this._transfers.get(transferId) || null;
    }

    /**
     * Update transfer entry
     * @param {string} transferId - Transfer ID
     * @param {Object} updates - Updated fields
     * @returns {boolean} - Update success
     */
    updateTransferEntry(transferId, updates) {
        const entry = this._transfers.get(transferId);
        if (!entry) {
            if (this._logger) {
                this._logger.warn(`[TransferStateManager] Transfer not found: ${transferId}`);
            }
            return false;
        }

        // Update only specified fields
        Object.assign(entry, updates);

        if (this._logger) {
            this._logger.info(`[TransferStateManager] Updated transfer entry: ${transferId}`);
        }

        return true;
    }

    /**
     * Delete transfer entry
     * @param {string} transferId - Transfer ID
     * @returns {boolean} - Delete success
     */
    removeTransferEntry(transferId) {
        const deleted = this._transfers.delete(transferId);

        if (deleted && this._logger) {
            this._logger.info(`[TransferStateManager] Removed transfer entry: ${transferId}`);
        }

        return deleted;
    }

    /**
     * Get all active transfers
     * @returns {Map} - Map of transferId -> entry
     */
    getActiveTransfers() {
        return this._transfers;
    }

    /**
     * Get all active transfers as array
     * @returns {Array} - Array of entries
     */
    getActiveTransfersArray() {
        return Array.from(this._transfers.values());
    }

    /**
     * Get transfers for a specific device
     * @param {string} deviceId - Device ID
     * @returns {Array} - Array of entries
     */
    getTransfersByDeviceId(deviceId) {
        const transfers = [];
        for (const entry of this._transfers.values()) {
            if (entry.deviceId === deviceId) {
                transfers.push(entry);
            }
        }
        return transfers;
    }

    /**
     * Get transfers for a specific download
     * @param {string} downloadId - Download ID
     * @returns {Array} - Array of entries
     */
    getTransfersByDownloadId(downloadId) {
        const transfers = [];
        for (const entry of this._transfers.values()) {
            if (entry.downloadId === downloadId) {
                transfers.push(entry);
            }
        }
        return transfers;
    }

    /**
     * Get active transfers count
     * @returns {number} - Count
     */
    getActiveTransfersCount() {
        return this._transfers.size;
    }

    /**
     * Clear all transfers
     */
    clearAllTransfers() {
        const count = this._transfers.size;
        this._transfers.clear();

        if (this._logger) {
            this._logger.info(`[TransferStateManager] Cleared all transfers (${count} entries)`);
        }
    }
}

module.exports = TransferStateManager;
