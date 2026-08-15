// src/main/infrastructure/persistence/repositories/DownloadRepository.js
'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * DownloadRepository
 *
 * Handles all download-related database operations.
 * Extends BaseRepository with download-specific methods.
 */
class DownloadRepository extends BaseRepository {
    constructor(db) {
        super(db);
        this._table = 'downloads';
    }

    /**
     * Insert a new download
     * @param {Object} download - Download object to insert
     * @returns {Object} The inserted download
     */
    insertDownload(download) {
        return this.insert(this._table, download);
    }

    /**
     * Update an existing download
     * @param {string} downloadId - Download ID
     * @param {Object} data - Data to update
     * @returns {Object|null} The updated download or null if not found
     */
    updateDownload(downloadId, data) {
        return this.update(this._table, downloadId, data);
    }

    /**
     * Delete a download
     * @param {string} downloadId - Download ID
     * @returns {boolean} True if deleted, false if not found
     */
    deleteDownload(downloadId) {
        return this.delete(this._table, downloadId);
    }

    /**
     * Find a download by ID
     * @param {string} downloadId - Download ID
     * @returns {Object|null} The download or null if not found
     */
    findDownloadById(downloadId) {
        return this.findById(this._table, downloadId);
    }

    /**
     * Find all downloads
     * @returns {Array} Array of all downloads
     */
    findAllDownloads() {
        return this.executeQuery(
            `SELECT * FROM ${this._table} ORDER BY created_at DESC`
        );
    }

    /**
     * Find downloads by device ID
     * @param {string} deviceId - Device ID
     * @returns {Array} Array of downloads for the device
     */
    findDownloadsByDeviceId(deviceId) {
        return this.executeQuery(
            `SELECT * FROM ${this._table} WHERE device_id = ? ORDER BY created_at DESC`,
            [deviceId]
        );
    }

    /**
     * Find downloads by status
     * @param {string} status - Download status (pending, in_progress, completed, failed, cancelled)
     * @returns {Array} Array of downloads with the specified status
     */
    findDownloadsByStatus(status) {
        return this.executeQuery(
            `SELECT * FROM ${this._table} WHERE status = ? ORDER BY created_at DESC`,
            [status]
        );
    }

    /**
     * Find pending downloads
     * @returns {Array} Array of pending downloads
     */
    findPendingDownloads() {
        return this.findDownloadsByStatus('pending');
    }

    /**
     * Find in-progress downloads
     * @returns {Array} Array of in-progress downloads
     */
    findInProgressDownloads() {
        return this.findDownloadsByStatus('in_progress');
    }

    /**
     * Find completed downloads
     * @returns {Array} Array of completed downloads
     */
    findCompletedDownloads() {
        return this.findDownloadsByStatus('completed');
    }

    /**
     * Find failed downloads
     * @returns {Array} Array of failed downloads
     */
    findFailedDownloads() {
        return this.findDownloadsByStatus('failed');
    }

    /**
     * Find downloads created before a specific date
     * @param {string} date - Date string (ISO format)
     * @returns {Array} Array of downloads created before the date
     */
    findDownloadsBeforeDate(date) {
        return this.executeQuery(
            `SELECT * FROM ${this._table} WHERE created_at < ? ORDER BY created_at DESC`,
            [date]
        );
    }

    /**
     * Delete downloads created before a specific date
     * @param {string} date - Date string (ISO format)
     * @returns {number} Number of deleted downloads
     */
    deleteDownloadsBeforeDate(date) {
        const result = this.executeStatement(
            `DELETE FROM ${this._table} WHERE created_at < ?`,
            [date]
        );
        return result.changes;
    }

    /**
     * Delete all downloads
     * @returns {number} Number of deleted downloads
     */
    deleteAllDownloads() {
        const result = this.executeStatement(`DELETE FROM ${this._table}`);
        return result.changes;
    }

    /**
     * Update download status
     * @param {string} downloadId - Download ID
     * @param {string} status - New status
     * @returns {Object|null} The updated download or null if not found
     */
    updateStatus(downloadId, status) {
        return this.update(this._table, downloadId, { status });
    }

    /**
     * Update download progress
     * @param {string} downloadId - Download ID
     * @param {Object} progressData - Progress data (percent, speed, eta, downloaded_bytes)
     * @returns {Object|null} The updated download or null if not found
     */
    updateProgress(downloadId, progressData) {
        return this.update(this._table, downloadId, progressData);
    }

    /**
     * Update download error information
     * @param {string} downloadId - Download ID
     * @param {string} errorMessage - Error message
     * @param {number} exitCode - Exit code
     * @returns {Object|null} The updated download or null if not found
     */
    updateError(downloadId, errorMessage, exitCode) {
        return this.update(this._table, downloadId, {
            error_message: errorMessage,
            exit_code: exitCode
        });
    }

    /**
     * Increment retry count
     * @param {string} downloadId - Download ID
     * @returns {Object|null} The updated download or null if not found
     */
    incrementRetryCount(downloadId) {
        const current = this.findDownloadById(downloadId);
        if (!current) return null;
        return this.update(this._table, downloadId, {
            retry_count: (current.retry_count || 0) + 1
        });
    }

    /**
     * Upsert a download (update if exists, insert if not)
     * Uses "try update first, then insert if fails" strategy for optimal performance
     * @param {string} downloadId - Download ID (same as processId)
     * @param {Object} data - Complete download data including all fields
     * @returns {Object} The updated or inserted download
     */
    upsertDownload(downloadId, data) {
        // Try update first (most downloads already exist)
        const updated = this.update(this._table, downloadId, data);
        
        if (updated !== null) {
            // Update succeeded - record exists
            return updated;
        }
        
        // Update failed (changes = 0) - record doesn't exist, insert it
        // Ensure id is included in the data
        const insertData = { id: downloadId, ...data };
        
        // Set created_at if not provided
        if (!insertData.created_at) {
            const timestamp = this.executeQueryOne("SELECT datetime('now') as now");
            insertData.created_at = timestamp.now;
        }
        
        return this.insert(this._table, insertData);
    }
}

module.exports = DownloadRepository;
