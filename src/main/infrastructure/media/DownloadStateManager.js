// src/main/infrastructure/media/DownloadStateManager.js
'use strict';

/**
 * Class responsible for managing download state in memory
 * Includes: creating, updating, deleting, retrieving entries
 */
class DownloadStateManager {
    constructor() {
        this._activeDownloads = new Map(); // processId -> { resolve, reject, process, status, ... }
    }

    /**
     * Create new download entry
     */
    createDownloadEntry(processId, data) {
        const entry = {
            resolve: data.resolve,
            reject: data.reject,
            process: null,
            status: 'starting',
            url: data.url,
            formatId: data.formatId,
            outputPath: data.outputPath,
            deviceIds: data.deviceIds,
            title: data.title,
            stderrBuffer: '',
            totalSize: data.totalSize,
            hasSizeInfo: data.hasSizeInfo,
            currentFileIndex: 0,
            lastPercent: 0,
            completedBytes: 0,
            lastAriaGid: null,
            lastFileDownloadedBytes: 0,
            lastFileTotalBytes: 0,
            downloadedBytes: 0,
            retryCount: 0,
            maxRetries: 3,
            manuallyStopped: false,
            retryDelays: [2000, 5000, 10000],
            percent: 0,
            speed: null,
            size: null,
            eta: null,
            elapsed: null,
            completedAt: null,
            failedAt: null
        };

        this._activeDownloads.set(processId, entry);
        return entry;
    }

    /**
     * Get download entry
     */
    getDownloadEntry(processId) {
        return this._activeDownloads.get(processId);
    }

    /**
     * Update download status
     */
    updateDownloadStatus(processId, status) {
        const entry = this._activeDownloads.get(processId);
        if (entry) {
            entry.status = status;
        }
    }

    /**
     * Update process reference
     */
    updateDownloadProcess(processId, process) {
        const entry = this._activeDownloads.get(processId);
        if (entry) {
            entry.process = process;
        }
    }

    /**
     * Remove download entry
     */
    removeDownloadEntry(processId) {
        this._activeDownloads.delete(processId);
    }

    /**
     * Mark download entry with sync_error status
     * Called when sync fails before removal to preserve entry for retry
     * @param {string} processId - Process identifier
     */
    markSyncError(processId) {
        const entry = this._activeDownloads.get(processId);
        if (entry) {
            entry.status = 'sync_error';
            entry.syncErrorTimestamp = Date.now();
            console.error(`[DownloadStateManager] Marked download ${processId} as sync_error`);
        }
    }

    /**
     * Get entries with sync_error status for retry
     * @returns {Array} Array of {processId, entry} objects
     */
    getSyncErrorEntries() {
        const errorEntries = [];
        for (const [processId, entry] of this._activeDownloads.entries()) {
            if (entry.status === 'sync_error') {
                errorEntries.push({ processId, entry });
            }
        }
        return errorEntries;
    }

    /**
     * Get download status
     */
    getDownloadStatus(processId) {
        const entry = this._activeDownloads.get(processId);
        return entry ? entry.status : null;
    }

    /**
     * Search for active download in memory based on URL and format ID
     * Allows resume from stopped state
     */
    findActiveDownload(url, formatId) {
        for (const [processId, entry] of this._activeDownloads.entries()) {
            if (entry.url === url && entry.formatId === formatId) {
                // Download considered existing if in downloading, starting, or stopped state
                // Allows resume from stopped
                if (entry.status === 'downloading' || entry.status === 'starting' || entry.status === 'stopped') {
                    return processId;
                }
            }
        }
        return null;
    }

    /**
     * Get all active downloads
     */
    getActiveDownloads() {
        return this._activeDownloads;
    }

    /**
     * Get all downloads from memory in database format (snake_case)
     * This function is used as alternative to findAllDownloads() from DownloadRepository
     * @returns {Array} List of all downloads in database-compatible format
     */
    getAllDownloads() {
        const result = [];
        for (const [id, entry] of this._activeDownloads.entries()) {
            result.push({
                id,
                url: entry.url,
                format_id: entry.formatId,
                output_path: entry.outputPath,
                device_id: entry.deviceIds,
                title: entry.title,
                status: entry.status,
                total_size: entry.totalSize,
                downloaded_bytes: entry.downloadedBytes,
                percent: entry.percent,
                speed: entry.speed,
                eta: entry.eta,
                retry_count: entry.retryCount,
                completed_at: entry.completedAt,
                failed_at: entry.failedAt
            });
        }
        // Sort descending by ID (simulate ORDER BY created_at DESC)
        return result.sort((a, b) => b.id.localeCompare(a.id));
    }

    /**
     * Restore downloads from repository into memory
     * @param {Array} downloadsArray - Array of download objects from database
     */
    restoreFromRepository(downloadsArray) {
        if (!downloadsArray || !Array.isArray(downloadsArray)) {
            console.warn('[DownloadStateManager] No downloads array provided for restoration');
            return;
        }

        // FIX: Removed filter - restore ALL downloads (completed, failed, stopped, etc.)
        console.log(`[DownloadStateManager] Restoring ${downloadsArray.length} downloads from repository`);

        for (const download of downloadsArray) {
            // FIX: Conditional mapping - preserve completed and failed as-is, convert others to stopped
            const restoredStatus = (download.status === 'completed' || download.status === 'failed')
                ? download.status
                : 'stopped';

            const entry = {
                resolve: null,
                reject: null,
                process: null,
                status: restoredStatus,
                url: download.url,
                formatId: download.format_id,
                outputPath: download.output_path,
                deviceIds: download.device_id ? this._parseDeviceId(download.device_id) : null,
                title: download.title,
                stderrBuffer: '',
                totalSize: download.total_size || 0,
                hasSizeInfo: !!download.total_size,
                currentFileIndex: 0,
                lastPercent: 0,
                completedBytes: 0,
                lastAriaGid: null,
                lastFileDownloadedBytes: 0,
                lastFileTotalBytes: 0,
                downloadedBytes: download.downloaded_bytes || 0,
                retryCount: download.retry_count || 0,
                maxRetries: download.max_retries || 3,
                manuallyStopped: false,
                retryDelays: [2000, 5000, 10000],
                percent: download.percent || 0,
                speed: download.speed || null,
                size: null,
                eta: download.eta || null,
                elapsed: null,
                completedAt: download.completed_at || null,
                failedAt: download.failed_at || null
            };

            this._activeDownloads.set(download.id, entry);
            console.log(`[DownloadStateManager] Restored download entry: ${download.id}, status: ${restoredStatus}, progress: ${entry.percent}%`);
        }
    }

    /**
     * تحويل device_id من قاعدة البيانات إلى مصفوفة deviceIds
     * يدعم التنسيق القديم (string) والجديد (JSON array)
     * @param {string|Array} deviceId - القيمة من قاعدة البيانات
     * @returns {Array|null} مصفوفة معرفات الأجهزة أو null
     */
    _parseDeviceId(deviceId) {
        if (!deviceId) return null;
        
        // إذا كانت مصفوفة بالفعل، أرجعها كما هي
        if (Array.isArray(deviceId)) return deviceId;
        
        // إذا كانت string، حاول تحليلها كـ JSON
        if (typeof deviceId === 'string') {
            try {
                const parsed = JSON.parse(deviceId);
                return Array.isArray(parsed) ? parsed : [parsed];
            } catch (e) {
                // فشل التحليل - تعامل معها كـ deviceId فردي (تنسيق قديم)
                return [deviceId];
            }
        }
        
        return null;
    }

    /**
     * Update an existing download entry or create it if absent.
     * @param {string} processId - Process identifier
     * @param {Object} newData - New data (resolve, reject, status, etc.)
     * @param {boolean} isResuming - Is this a resume operation?
     * @returns {Object} Updated entry
     */
    upsertDownloadEntry(processId, newData, isResuming = false) {
        const existingEntry = this._activeDownloads.get(processId);

        if (isResuming) {
            if (!existingEntry) {
                throw new Error(`Cannot resume download: entry ${processId} not found in memory. Ensure application startup restoration ran successfully.`);
            }
            // Update the existing entry while preserving old data
            existingEntry.resolve = newData.resolve || existingEntry.resolve;
            existingEntry.reject = newData.reject || existingEntry.reject;
            existingEntry.status = 'starting';
            existingEntry.manuallyStopped = false;
            existingEntry.process = null;
            // Do NOT clear percent, downloadedBytes, totalSize, retryCount, stderrBuffer
            return existingEntry;
        } else {
            // Create new entry (existing logic)
            return this.createDownloadEntry(processId, newData);
        }
    }
}

module.exports = DownloadStateManager;
