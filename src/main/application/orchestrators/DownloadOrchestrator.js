'use strict';

/**
 * DownloadOrchestrator
 * Responsible for coordinating download operations and making business logic decisions
 * Principles:
 * - Memory is the single source of truth during runtime
 * - Never accesses database
 * - Checks for existing download in memory and decides: start new, resume existing, or prevent duplication
 */
class DownloadOrchestrator {
    constructor({
        ytdlpAdapter,
        downloadManager,
        deviceRegistry = null,
        adbPushService = null,
        downloadRepository = null,
        logger = null
    }) {
        this._ytdlpAdapter = ytdlpAdapter;
        this._downloadManager = downloadManager;
        this._deviceRegistry = deviceRegistry;
        this._adbPushService = adbPushService;
        this._downloadRepository = downloadRepository;
        this._logger = logger;
    }

    async inspectLink(url) {
        if (!url) {
            throw new Error('URL is required');
        }
        return this._ytdlpAdapter.inspectFormats(url);
    }

    async getMetadata(url) {
        if (!url) {
            throw new Error('URL is required');
        }
        return this._ytdlpAdapter.extractMetadata(url);
    }

    async startDownload(url, formatId, deviceIds = null, options = {}) {
        console.log('[DownloadOrchestrator] === Starting startDownload ===');
        console.log('[DownloadOrchestrator] url:', url);
        console.log('[DownloadOrchestrator] formatId:', formatId);
        console.log('[DownloadOrchestrator] deviceIds:', deviceIds);
        console.log('[DownloadOrchestrator] options:', options);
        if (!url || !formatId) {
            console.log('[DownloadOrchestrator] Error: url or formatId missing');
            throw new Error('url and formatId are required');
        }

        // If processId exists, it's a resume - skip duplicate check
        if (options.processId) {
            console.log('[DownloadOrchestrator] processId exists - resume, skip duplicate check');
            const adapterOptions = { ...options, deviceIds, formatsData: options.formatsData };
            console.log('[DownloadOrchestrator] adapterOptions:', adapterOptions);
            const result = this._ytdlpAdapter.startDownload(url, formatId, adapterOptions);
            console.log('[DownloadOrchestrator] startDownload result from adapter:', result);
            return result;
        }

        // Search memory for active download with same link and quality
        const activeProcessId = this._ytdlpAdapter.findActiveDownload(url, formatId);
        console.log('[DownloadOrchestrator] Searching for active download in memory');
        console.log('[DownloadOrchestrator] activeProcessId:', activeProcessId);
        if (activeProcessId) {
            // Download exists in memory - prevent duplication
            console.log('[DownloadOrchestrator] Download exists in memory');
            const entry = this._ytdlpAdapter.getDownloadEntry(activeProcessId);
            console.log('[DownloadOrchestrator] entry:', entry);
            const result = {
                existing: true,
                downloadId: activeProcessId,
                status: entry ? entry.status : 'unknown',
                title: entry ? entry.title : options.title || 'Unknown'
            };
            console.log('[DownloadOrchestrator] Returning existing download result:', result);
            return result;
        }

        // No download in memory - start new download
        console.log('[DownloadOrchestrator] No download in memory - starting new download');
        const adapterOptions = { ...options, deviceIds, formatsData: options.formatsData };
        console.log('[DownloadOrchestrator] adapterOptions:', adapterOptions);
        const result = this._ytdlpAdapter.startDownload(url, formatId, adapterOptions);
        console.log('[DownloadOrchestrator] startDownload result from adapter:', result);
        return result;
    }

    /**
     * Stop download process
     * @param {string} fileId - File/process identifier
     * @returns {Object} Result object showing stop status from YtdlpAdapter
     */
    stopDownload(fileId) {
        console.log('[DownloadOrchestrator] === Starting stopDownload ===');
        console.log('[DownloadOrchestrator] fileId:', fileId);
        if (!fileId) {
            console.log('[DownloadOrchestrator] Error: fileId missing');
            throw new Error('fileId is required');
        }
        const result = this._ytdlpAdapter.stopDownload(fileId);
        console.log('[DownloadOrchestrator] stopDownload result:', result);
        return result;
    }

    async resumeDownload(processId, url, formatId, deviceIds = null, options = {}) {
        console.log('[DownloadOrchestrator] === Starting resumeDownload ===');
        console.log('[DownloadOrchestrator] processId:', processId);
        console.log('[DownloadOrchestrator] url:', url);
        console.log('[DownloadOrchestrator] formatId:', formatId);
        console.log('[DownloadOrchestrator] deviceIds:', deviceIds);
        console.log('[DownloadOrchestrator] options:', options);
        if (!url || !formatId) {
            console.log('[DownloadOrchestrator] Error: url or formatId missing');
            throw new Error('url and formatId are required');
        }

        // If processId not passed, search for matching download in memory
        if (!processId) {
            console.log('[DownloadOrchestrator] processId null - searching for matching download');
            processId = this._ytdlpAdapter.findActiveDownload(url, formatId);
            console.log('[DownloadOrchestrator] found processId:', processId);
            if (!processId) {
                console.log('[DownloadOrchestrator] Error: No active download found');
                throw new Error('No active download found for this URL and quality');
            }
        }

        // Verify entry exists in memory
        const entry = this._ytdlpAdapter.getDownloadEntry(processId);
        console.log('[DownloadOrchestrator] entry:', entry);
        if (!entry) {
            console.log('[DownloadOrchestrator] Error: Entry not found');
            throw new Error('No active download found for this URL and quality');
        }

        // Check process status before resume
        const isRunning = this._ytdlpAdapter.isProcessRunning(processId);
        console.log('[DownloadOrchestrator] isProcessRunning:', isRunning);

        if (isRunning) {
            // Process is running - stop current process only without changing memory state
            console.log('[DownloadOrchestrator] Process is running - stopping current process');
            const stopResult = this._ytdlpAdapter.stopProcessOnly(processId);
            console.log('[DownloadOrchestrator] stopProcessOnly result:', stopResult);
            if (this._logger) {
                this._logger.info(`resumeDownload: Stopped running process ${processId}`, stopResult);
            }
        }

        // Start new download
        console.log('[DownloadOrchestrator] Starting new download');
        const result = this.startDownload(url, formatId, deviceIds, { ...options, processId });
        console.log('[DownloadOrchestrator] startDownload result:', result);
        return result;
    }

    /**
     * Get active download status
     * @param {string} processId - Process identifier
     * @returns {string|null} Download status or null if not found
     */
    getDownloadStatus(processId) {
        return this._ytdlpAdapter.getDownloadStatus(processId);
    }

    /**
     * Search for active download in memory based on URL and format ID
     * @param {string} url - Download URL
     * @param {string} formatId - Format identifier
     * @returns {string|null} processId if found, null if not found
     */
    findActiveDownload(url, formatId) {
        return this._ytdlpAdapter.findActiveDownload(url, formatId);
    }

    /**
     * Handle download completion and transfer file to device if needed
     * @param {string} downloadId - Download identifier
     * @param {string} tempPath - Temporary path of the file
     * @param {Array} deviceIds - Array of device identifiers (optional)
     */
    async handleDownloadComplete(downloadId, tempPath, deviceIds = null) {
        if (!tempPath) {
            if (this._logger) {
                this._logger.warn(`No temp path provided for download ${downloadId}`);
            }
            return;
        }

        if (!deviceIds || deviceIds.length === 0 || !this._adbPushService) {
            // لا يوجد أجهزة للنقل، الملف تم نقله بالفعل لمجلد التحميلات
            return;
        }

        try {
            // نقل الملف للأجهزة المحددة
            for (const deviceId of deviceIds) {
                const result = await this._adbPushService.pushAndDelete(tempPath, deviceId);
            
                if (result.success) {
                    if (this._logger) {
                        this._logger.info(`File transferred successfully to device ${deviceId}`);
                    }
                    // إرسال إشعار للواجهة
                    this._ytdlpAdapter.emit('transferComplete', {
                        downloadId,
                        deviceId,
                        message: result.message
                    });
                } else {
                    if (this._logger) {
                        this._logger.error(`Failed to transfer file to device ${deviceId}: ${result.message}`);
                    }
                    // إرسال إشعار بالفشل
                    this._ytdlpAdapter.emit('transferError', {
                        downloadId,
                        deviceId,
                        error: result.message
                    });
                }
            }
        } catch (err) {
            if (this._logger) {
                this._logger.error(`Error during file transfer: ${err.message}`);
            }
            this._ytdlpAdapter.emit('transferError', {
                downloadId,
                deviceId,
                error: err.message
            });
        }
    }

    /**
     * الحصول على خريطة التحميلات النشطة من الذاكرة
     * @returns {Object} خريطة التحميلات النشطة
     */
    getActiveDownloads() {
        return this._ytdlpAdapter.getActiveDownloads();
    }

    /**
     * نقل ملف موجود إلى جهاز
     * @param {string} localPath - المسار المحلي للملف
     * @param {string} deviceId - معرف الجهاز
     * @returns {Promise<Object>} نتيجة النقل
     */
    async transferFileToDevice(localPath, deviceId) {
        if (!localPath) {
            throw new Error('Local path is required');
        }
        if (!deviceId) {
            throw new Error('Device ID is required');
        }
        if (!this._adbPushService) {
            throw new Error('AdbPushService not available');
        }
        return this._adbPushService.pushFromDownloads(localPath, deviceId);
    }


    /**
     * الحصول على السجل التاريخي للتحميلات
     * @returns {Array} قائمة جميع التحميلات
     */
    getDownloadHistory() {
        return this._downloadManager.getAllDownloads();
    }

    /**
     * حذف تحميل من الذاكرة فقط (دون حذف من قاعدة البيانات)
     * @param {string} processId - معرف العملية
     * @returns {Object} كائن نتيجة يوضح حالة الحذف
     */
    deleteDownloadFromMemory(processId) {
        console.log('[DownloadOrchestrator] === بدء deleteDownloadFromMemory ===');
        console.log('[DownloadOrchestrator] processId:', processId);
        if (!processId) {
            console.log('[DownloadOrchestrator] خطأ: processId مفقود');
            throw new Error('processId is required');
        }

        const result = this._ytdlpAdapter.removeDownloadEntry(processId);
        console.log('[DownloadOrchestrator] نتيجة deleteDownloadFromMemory:', result);
        return result;
    }

    /**
     * الحصول على تفاصيل التحميل من قاعدة البيانات
     * @param {string} downloadId - معرف التحميل
     * @returns {Object|null} تفاصيل التحميل أو null إذا لم يوجد
     */
    getDownloadDetails(downloadId) {
        console.log('[DownloadOrchestrator] === بدء getDownloadDetails ===');
        console.log('[DownloadOrchestrator] downloadId:', downloadId);
        if (!downloadId) {
            console.log('[DownloadOrchestrator] خطأ: downloadId مفقود');
            throw new Error('downloadId is required');
        }

        if (!this._downloadRepository) {
            console.log('[DownloadOrchestrator] خطأ: downloadRepository غير متوفر');
            throw new Error('downloadRepository not available');
        }

        const download = this._downloadRepository.findDownloadById(downloadId);
        console.log('[DownloadOrchestrator] نتيجة getDownloadDetails:', download);
        return download;
    }

}

module.exports = DownloadOrchestrator;