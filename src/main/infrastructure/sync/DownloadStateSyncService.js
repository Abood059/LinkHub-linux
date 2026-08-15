// src/main/infrastructure/sync/DownloadStateSyncService.js
'use strict';

/**
 * DownloadStateSyncService
 *
 * Service for aggregating download state and sending it to the UI separately
 * Reduces IPC pressure by reading state from memory and sending it periodically
 * This is the single source of truth for syncing download state with the frontend
 */
class DownloadStateSyncService {
    constructor(windowManager, downloadManager, options = {}) {
        if (!windowManager) {
            throw new Error('WindowManager is required for DownloadStateSyncService');
        }

        this._windowManager = windowManager;
        this._downloadManager = downloadManager;
        this._interval = options.interval || 300; // 300ms default
        this._timer = null;
        this._isRunning = false;

        // Temporary map to store error messages
        this._pendingErrors = new Map(); // downloadId -> errorMessage

        // Counter for consecutive failed attempts
        this._failedAttempts = 0;

        // Aggregated state
        this._state = {
            downloads: new Map(), // downloadId -> download data
            timestamp: Date.now()
        };

        // Previous state for comparison (to emit separate events)
        this._previousState = {
            downloads: new Map() // downloadId -> downloadData
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
            downloads: Array.from(this._state.downloads.values()),
            timestamp: this._state.timestamp
        };
    }

    // ============================================================================
    // Internal methods
    // ============================================================================

    /**
     * Send state to UI
     * Reads state from memory (DownloadManager._activeDownloads) periodically
     */
    _broadcastState() {
        if (!this._downloadManager) {
            return;
        }

        try {
            // Reset failed attempts counter on success
            this._failedAttempts = 0;

            // Read active downloads from memory
            const activeDownloads = this._downloadManager.getActiveDownloads();

            // Detect transition to failed state and save error message
            activeDownloads.forEach((entry, downloadId) => {
                const prev = this._previousState.downloads.get(downloadId);
                if (prev && prev.status !== 'failed' && entry.status === 'failed') {
                    // Transition to failed: save error message temporarily
                    const errorMessage = entry.error || entry.errorMessage || null;
                    this._pendingErrors.set(downloadId, errorMessage);
                }
            });

            // Update current state
            this._state.downloads.clear();
            activeDownloads.forEach((entry, downloadId) => {
                const downloadData = {
                    downloadId: downloadId,
                    url: entry.url || null,
                    title: entry.title || null,
                    status: entry.status || 'unknown',
                    deviceId: entry.deviceId || null,
                    formatId: entry.formatId || null,
                    outputPath: entry.outputPath || null,
                    percent: entry.percent || 0,
                    speed: entry.speed || null,
                    size: entry.size || null,
                    totalSize: entry.totalSize || null,
                    downloadedBytes: entry.downloadedBytes || 0,
                    retryCount: entry.retryCount || 0,
                    maxRetries: entry.maxRetries || 3,
                    eta: entry.eta || null,
                    elapsed: entry.elapsed || null
                };
                this._state.downloads.set(downloadId, downloadData);
            });

            const currentState = this.getState();

            // Send aggregated state
            this._windowManager.broadcast('download:state:update', currentState);

            // Compare and emit separate events
            this._diffAndEmitDownloads(currentState.downloads);

            this._state.timestamp = Date.now();

            // Update previous state
            this._updatePreviousState(currentState);
        } catch (error) {
            this._failedAttempts++;
            console.error(`[DownloadStateSyncService] Failed to broadcast state (attempt ${this._failedAttempts}):`, error);
        }
    }

    // ============================================================================
    // Diffing methods to emit separate events
    // ============================================================================

    /**
     * Compare download state and emit separate events
     * @param {Array} currentDownloads - Current downloads
     */
    _diffAndEmitDownloads(currentDownloads) {
        const currentMap = new Map();
        currentDownloads.forEach(d => currentMap.set(d.downloadId, d));
        
        for (const [downloadId, download] of currentMap) {
            const prev = this._previousState.downloads.get(downloadId);
            
            if (!prev) {
                // New download
                this._windowManager.broadcast('download:started', { 
                    downloadId, 
                    url: download.url, 
                    title: download.title,
                    formatId: download.formatId,
                    deviceId: download.deviceId
                });
                continue;
            }
            
            if (download.status !== prev.status) {
                if (download.status === 'completed') {
                    this._windowManager.broadcast('download:complete', { downloadId });
                } else if (download.status === 'failed') {
                    const errorMessage = this._pendingErrors.get(downloadId) || null;
                    const errorData = {
                        downloadId,
                        error: errorMessage
                    };
                    this._windowManager.broadcast('download:error', errorData);
                    // Delete error message after sending to prevent duplication
                    this._pendingErrors.delete(downloadId);
                } else if (download.status === 'stopped') {
                    this._windowManager.broadcast('download:stopped', {
                        downloadId,
                        url: download.url,
                        formatId: download.formatId,
                        deviceId: download.deviceId,
                        title: download.title
                    });
                } else if ((download.status === 'downloading' || download.status === 'starting') && prev.status === 'stopped') {
                    // تم استئناف التحميل من حالة التوقف
                    this._windowManager.broadcast('download:resumed', {
                        downloadId,
                        url: download.url,
                        formatId: download.formatId,
                        deviceId: download.deviceId,
                        title: download.title
                    });
                } else if (download.status === 'retrying' && prev.status !== 'retrying') {
                    // إعادة محاولة التحميل
                    this._windowManager.broadcast('download:retrying', {
                        downloadId,
                        retryCount: download.retryCount,
                        maxRetries: download.maxRetries
                    });
                }
            }

            // إرسال progress للتحميلات النشطة فقط عند تغيير النسبة المئوية
            // لتقليل الضغط على IPC
            if (download.status === 'downloading' && download.percent !== prev.percent) {
                const progressData = {
                    downloadId,
                    percent: download.percent,
                    speed: download.speed || null,
                    size: download.size || null,
                    totalSize: download.totalSize || null,
                    downloadedBytes: download.downloadedBytes || null
                };
                this._windowManager.broadcast('download:progress', progressData);
            }
        }
    }

    /**
     * تحديث الحالة السابقة
     */
    _updatePreviousState(currentState) {
        this._previousState.downloads.clear();
        currentState.downloads.forEach(d => {
            this._previousState.downloads.set(d.downloadId, structuredClone(d));
        });
    }

    /**
     * Initialize the previous state with restored downloads
     * This prevents sending download:started events for restored downloads on first sync cycle
     * @param {Map} downloadsMap - Map of downloadId -> download data
     */
    initializeState(downloadsMap) {
        if (!downloadsMap || !(downloadsMap instanceof Map)) {
            console.warn('[DownloadStateSyncService] Invalid downloadsMap provided for initialization');
            return;
        }

        this._previousState.downloads.clear();
        downloadsMap.forEach((entry, downloadId) => {
            const downloadData = {
                downloadId: downloadId,
                url: entry.url || null,
                title: entry.title || null,
                status: entry.status || 'unknown',
                deviceId: entry.deviceId || null,
                formatId: entry.formatId || null,
                outputPath: entry.outputPath || null,
                percent: entry.percent || 0,
                speed: entry.speed || null,
                size: entry.size || null,
                totalSize: entry.totalSize || null,
                downloadedBytes: entry.downloadedBytes || 0,
                retryCount: entry.retryCount || 0,
                maxRetries: entry.maxRetries || 3,
                eta: entry.eta || null,
                elapsed: entry.elapsed || null
            };
            this._previousState.downloads.set(downloadId, structuredClone(downloadData));
        });

        console.log(`[DownloadStateSyncService] Initialized previous state with ${this._previousState.downloads.size} downloads`);
    }

}

module.exports = DownloadStateSyncService;
