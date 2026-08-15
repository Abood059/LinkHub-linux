// src/main/infrastructure/sync/DownloadSyncService.js
'use strict';

const path = require('path');
const fs = require('fs');

/**
 * DownloadSyncService
 *
 * Independent periodic synchronization service for downloads between memory and database
 *
 * Principles:
 * - Memory is the single source of truth: reads from memory only, writes to database
 * - Unified periodic updates: every 300ms for all active downloads
 * - Dirty tracking: writes only fields that have changed
 * - Limited retry: 5 attempts with exponential backoff on write failure
 * - Auto-deletion: downloads that disappear from memory are deleted from database
 */
class DownloadSyncService {
    constructor(downloadManager, downloadRepository, logger, pathService = null) {
        if (!downloadManager) {
            throw new Error('downloadManager is required for DownloadSyncService');
        }
        if (!downloadRepository) {
            throw new Error('downloadRepository is required for DownloadSyncService');
        }

        this._downloadManager = downloadManager;
        this._downloadRepository = downloadRepository;
        this._logger = logger;
        this._pathService = pathService;

        // Periodic sync settings
        this._interval = 300; // 300ms
        this._timer = null;
        this._isRunning = false;
        this._isSyncing = false; // Track whether a sync cycle is currently executing

        // Dirty tracking
        // Stores the last known value for each field of each download
        this._lastKnownValues = new Map(); // downloadId -> { percent, status, speed, downloadedBytes, eta, totalSize, retryCount }

        // Track downloads that existed in the previous cycle
        this._previousDownloadIds = new Set();

        // Service statistics
        this._stats = {
            totalCycles: 0,
            successfulWrites: 0,
            failedWrites: 0,
            lastCycleTime: null
        };

        // Error log file path
        this._errorLogPath = this._pathService ? this._pathService.getLogPath('sync-errors.log') : path.join(process.cwd(), 'logs', 'sync-errors.log');
        this._ensureLogDirectory();
    }

    /**
     * Start the periodic sync service
     */
    start() {
        if (this._isRunning) {
            console.warn('[DownloadSyncService] Service is already running');
            return;
        }

        this._isRunning = true;
        this._timer = setInterval(() => {
            this._syncCycle();
        }, this._interval);

        console.log('[DownloadSyncService] Service started with 300ms interval');
    }

    /**
     * Stop the periodic sync service
     */
    stop() {
        if (!this._isRunning) {
            return;
        }

        this._isRunning = false;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }

        console.log('[DownloadSyncService] Service stopped');
    }

    /**
     * Immediate write of all data with timeout
     * Called when the application is closing
     */
    async flush() {
        // 1. Stop the periodic timer
        this.stop();

        // 2. Wait for current cycle to complete if it's running
        if (this._isSyncing) {
            try {
                await this._waitForSyncComplete(2000); // 2 second timeout
            } catch (error) {
                console.warn('[DownloadSyncService] Timeout waiting for sync cycle:', error.message);
            }
        }

        // 3. Write all data (ignore dirty tracking)
        try {
            await this._flushAllDataWithRetry(3000); // 3 second timeout
            return true;
        } catch (error) {
            // Ignore closed database connection errors - this is normal during shutdown
            if (error.message === 'The database connection is not open') {
                console.warn('[DownloadSyncService] Database already closed during flush, skipping...');
                return true;
            }
            this._logError('Flush failed', error);
            console.error('[DownloadSyncService] Flush failed:', error);
            return false;
        }
    }

    /**
     * Get the current service status
     */
    getStatus() {
        return {
            isRunning: this._isRunning,
            isSyncing: this._isSyncing,
            interval: this._interval,
            stats: { ...this._stats },
            trackedDownloads: this._lastKnownValues.size
        };
    }

    // ============================================================================
    // Internal methods
    // ============================================================================

    /**
     * Periodic sync cycle
     */
    async _syncCycle() {
        if (this._isSyncing) {
            // If previous cycle didn't complete, skip this cycle
            return;
        }

        this._isSyncing = true;
        const cycleStartTime = Date.now();

        try {
            // Read active downloads from memory
            const activeDownloads = this._downloadManager.getActiveDownloads();
            const currentDownloadIds = new Set(activeDownloads.keys());

            // Handle deleted downloads
            await this._handleDeletedDownloads(currentDownloadIds);

            // Handle existing downloads
            await this._processActiveDownloads(activeDownloads);

            // Update previous IDs list
            this._previousDownloadIds = currentDownloadIds;

            // Update statistics
            this._stats.totalCycles++;
            this._stats.lastCycleTime = Date.now() - cycleStartTime;

        } catch (error) {
            this._stats.failedWrites++;
            this._logError('Sync cycle failed', error);
            console.error('[DownloadSyncService] Sync cycle failed:', error);
        } finally {
            this._isSyncing = false;
        }
    }

    /**
     * Handle downloads deleted from memory
     */
    async _handleDeletedDownloads(currentDownloadIds) {
        const deletedIds = [];

        // Find IDs that existed previously but don't exist now
        for (const downloadId of this._previousDownloadIds) {
            if (!currentDownloadIds.has(downloadId)) {
                deletedIds.push(downloadId);
            }
        }

        // Delete removed downloads from database
        for (const downloadId of deletedIds) {
            try {
                this._downloadRepository.deleteDownload(downloadId);
                this._lastKnownValues.delete(downloadId);
            } catch (error) {
                this._logError(`Failed to delete download ${downloadId}`, error);
                console.error(`[DownloadSyncService] Failed to delete download ${downloadId}:`, error);
            }
        }
    }

    /**
     * Handle active downloads
     */
    async _processActiveDownloads(activeDownloads) {
        for (const [downloadId, entry] of activeDownloads.entries()) {
            try {
                // Detect changes
                const changes = this._detectChanges(downloadId, entry);

                if (Object.keys(changes).length > 0) {
                    // Write changes to database
                    await this._writeChangesWithRetry(downloadId, changes);
                    
                    // Update stored values
                    this._updateLastKnownValues(downloadId, entry);
                }
            } catch (error) {
                this._logError(`Failed to process download ${downloadId}`, error);
                console.error(`[DownloadSyncService] Failed to process download ${downloadId}:`, error);
            }
        }
    }

    /**
     * Detect changes between current value and stored value
     */
    _detectChanges(downloadId, entry) {
        const lastKnown = this._lastKnownValues.get(downloadId) || {};
        const changes = {};

        // Fields to track for changes
        const fieldsToTrack = [
            'percent', 'status', 'speed', 'downloadedBytes', 
            'eta', 'totalSize', 'retryCount', 'completedAt', 'failedAt'
        ];

        for (const field of fieldsToTrack) {
            const currentValue = entry[field];
            const lastValue = lastKnown[field];

            // If value didn't exist before or has changed
            if (lastValue === undefined || currentValue !== lastValue) {
                // Skip undefined values as they are not considered valid changes
                if (currentValue !== undefined) {
                    changes[field] = currentValue;
                }
            }
        }

        return changes;
    }

    /**
     * Update stored values
     */
    _updateLastKnownValues(downloadId, entry) {
        this._lastKnownValues.set(downloadId, {
            percent: entry.percent,
            status: entry.status,
            speed: entry.speed,
            downloadedBytes: entry.downloadedBytes,
            eta: entry.eta,
            totalSize: entry.totalSize,
            retryCount: entry.retryCount,
            completedAt: entry.completedAt,
            failedAt: entry.failedAt
        });
    }

    /**
     * Convert field names from camelCase to snake_case for database
     * and convert arrays to JSON strings
     */
    _mapToDatabaseColumns(data) {
        const columnMapping = {
            downloadedBytes: 'downloaded_bytes',
            totalSize: 'total_size',
            retryCount: 'retry_count',
            completedAt: 'completed_at',
            failedAt: 'failed_at',
            formatId: 'format_id',
            deviceIds: 'device_id',
            outputPath: 'output_path',
            maxRetries: 'max_retries',
            hasSizeInfo: 'has_size_info',
            currentFileIndex: 'current_file_index',
            manuallyStopped: 'manually_stopped',
            retryDelays: 'retry_delays',
            errorMessage: 'error_message',
            exitCode: 'exit_code',
            startedAt: 'started_at'
        };

        const mappedData = {};
        for (const [key, value] of Object.entries(data)) {
            // Skip undefined values
            if (value === undefined) {
                continue;
            }

            const dbKey = columnMapping[key] || key;

            // Convert deviceIds array to JSON string
            if (key === 'deviceIds') {
                if (Array.isArray(value) && value.length > 0) {
                    mappedData[dbKey] = JSON.stringify(value);
                } else {
                    // Empty array or null -> store null
                    mappedData[dbKey] = null;
                }
            } else if (Array.isArray(value)) {
                // Any other array must be converted to JSON or null
                if (value.length > 0) {
                    mappedData[dbKey] = JSON.stringify(value);
                } else {
                    mappedData[dbKey] = null;
                }
            } else {
                mappedData[dbKey] = value;
            }
        }
        return mappedData;
    }

    /**
     * Prepare complete data for insert from memory entry
     * @param {string} downloadId - Download ID
     * @param {Object} entry - Download entry from memory
     * @param {Object} changes - Detected changes (optional, for partial updates)
     * @returns {Object} Complete data ready for database upsert
     */
    _prepareDownloadData(downloadId, entry, changes = null) {
        // If changes provided, use them for partial update
        // Otherwise, prepare complete data for insert
        if (changes) {
            return this._mapToDatabaseColumns(changes);
        }

        // Prepare complete data for insert
        const completeData = {
            id: downloadId,
            url: entry.url,
            format_id: entry.formatId,
            output_path: entry.outputPath,
            device_id: entry.deviceIds,
            title: entry.title,
            status: entry.status,
            percent: entry.percent || 0,
            speed: entry.speed || null,
            downloaded_bytes: entry.downloadedBytes || 0,
            eta: entry.eta || null,
            total_size: entry.totalSize || 0,
            retry_count: entry.retryCount || 0,
            max_retries: entry.maxRetries || 3,
            completed_at: entry.completedAt || null,
            failed_at: entry.failedAt || null,
            error_message: null,
            exit_code: null
        };

        return this._mapToDatabaseColumns(completeData);
    }

    /**
     * Write changes with retry policy
     */
    async _writeChangesWithRetry(downloadId, changes) {
        const maxRetries = 5;
        const delays = [100, 200, 400, 800, 1600]; // Exponential backoff

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Re-read data from memory to ensure writing latest data
                const entry = this._downloadManager.getDownloadEntry(downloadId);
                if (!entry) {
                    console.warn(`[DownloadSyncService] ⚠️  Download ${downloadId} no longer exists in memory, skipping write`);
                    return;
                }

                // Update changes object with latest data
                const latestChanges = this._detectChanges(downloadId, entry);

                if (Object.keys(latestChanges).length === 0) {
                    // No changes, no need to write
                    return;
                }

                // Write to database using Upsert
                // Check if download is new
                const isNew = !this._lastKnownValues.has(downloadId);
                const dbData = isNew 
                    ? this._prepareDownloadData(downloadId, entry, null) // Complete data for new download
                    : this._prepareDownloadData(downloadId, entry, latestChanges); // Changes only for existing download
                
                this._downloadRepository.upsertDownload(downloadId, dbData);
                
                this._stats.successfulWrites++;
                return; // Success

            } catch (error) {
                if (attempt < maxRetries - 1) {
                    // Wait before retry
                    await this._delay(delays[attempt]);
                } else {
                    // All attempts failed
                    this._stats.failedWrites++;
                    this._logError(`Failed to write download ${downloadId} after ${maxRetries} attempts`, error);
                    console.error(`[DownloadSyncService] Failed to write after ${maxRetries} attempts - Download: ${downloadId}, Error:`, error);
                    throw error;
                }
            }
        }
    }

    /**
     * Write all data (ignore dirty tracking) with retry
     */
    async _flushAllDataWithRetry(timeout) {
        const startTime = Date.now();
        const maxRetries = 5;
        const delays = [100, 200, 400, 800, 1600];

        const activeDownloads = this._downloadManager.getActiveDownloads();

        for (const [downloadId, entry] of activeDownloads.entries()) {
            // Check timeout
            if (Date.now() - startTime > timeout) {
                throw new Error('Flush timeout exceeded');
            }

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    // Write all fields
                    const allData = {
                        percent: entry.percent,
                        status: entry.status,
                        speed: entry.speed,
                        downloadedBytes: entry.downloadedBytes,
                        eta: entry.eta,
                        totalSize: entry.totalSize,
                        retryCount: entry.retryCount,
                        completedAt: entry.completedAt,
                        failedAt: entry.failedAt
                    };

                    // Prepare complete data for upsert
                    const dbData = this._prepareDownloadData(downloadId, entry);
                    this._downloadRepository.upsertDownload(downloadId, dbData);
                    
                    this._stats.successfulWrites++;
                    break; // Success

                } catch (error) {
                    if (attempt < maxRetries - 1) {
                        await this._delay(delays[attempt]);
                    } else {
                        this._stats.failedWrites++;
                        this._logError(`Failed to flush download ${downloadId}`, error);
                        console.error(`[DownloadSyncService] Flush failed for download ${downloadId}:`, error);
                        // Continue with next downloads instead of throwing error
                    }
                }
            }
        }
    }

    /**
     * Wait for current sync cycle to complete
     */
    async _waitForSyncComplete(timeout) {
        const startTime = Date.now();
        while (this._isSyncing) {
            if (Date.now() - startTime > timeout) {
                throw new Error('Timeout waiting for sync cycle to complete');
            }
            await this._delay(50); // Check every 50ms
        }
    }

    /**
     * Simple delay
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log error to sync-errors.log file
     */
    _logError(message, error) {
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${message}: ${error.message}\n${error.stack}\n\n`;
            fs.appendFileSync(this._errorLogPath, logEntry);
        } catch (logError) {
            console.error('[DownloadSyncService] Failed to write to error log:', logError);
        }
    }

    /**
     * Ensure logs directory exists
     */
    _ensureLogDirectory() {
        try {
            const logDir = path.dirname(this._errorLogPath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        } catch (error) {
            console.error('[DownloadSyncService] Failed to create log directory:', error);
        }
    }
}

module.exports = DownloadSyncService;
