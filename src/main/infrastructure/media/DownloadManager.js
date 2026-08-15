// src/main/infrastructure/media/DownloadManager.js
'use strict';

const EventEmitter = require('events');
const DownloadStateManager = require('./DownloadStateManager');
const RetryHandler = require('./RetryHandler');
const CompletionHandler = require('./CompletionHandler');
const FailureHandler = require('./FailureHandler');

/**
 * DownloadManager
 * مسؤول عن إدارة حالة التحميلات في الذاكرة فقط
 * المبادئ:
 * - يوفر دوال استعلامية للذاكرة (findActiveDownload, getDownloadEntry, getDownloadStatus)
 * - لا يحتوي على منطق أعمال ولا يتخذ قرارات
 * - ينسق بين المكونات (ProgressHandler, RetryHandler, CompletionHandler, FailureHandler)
 * - المزامنة مع قاعدة البيانات مسؤولية DownloadSyncService (خدمة خارجية مستقلة)
 */
class DownloadManager extends EventEmitter {
    constructor({ logger = null, pathService = null, adbPushService = null }) {
        super();
        this._logger = logger;
        this._pathService = pathService;

        // Initialize all components
        this._stateManager = new DownloadStateManager();
        this._retryHandler = new RetryHandler();
        this._completionHandler = new CompletionHandler(pathService, logger, adbPushService);
        this._failureHandler = new FailureHandler({ logger });
    }

    /**
     * إنشاء إدخال تحميل جديد
     */
    createDownloadEntry(processId, data) {
        return this._stateManager.createDownloadEntry(processId, data);
    }

    /**
     * Update an existing download entry or create it if absent.
     */
    upsertDownloadEntry(processId, data, isResuming = false) {
        return this._stateManager.upsertDownloadEntry(processId, data, isResuming);
    }

    /**
     * الحصول على إدخال التحميل
     */
    getDownloadEntry(processId) {
        return this._stateManager.getDownloadEntry(processId);
    }

    /**
     * تحديث حالة التحميل
     */
    updateDownloadStatus(processId, status) {
        this._stateManager.updateDownloadStatus(processId, status);
    }

    /**
     * تحديث مرجع العملية
     */
    updateDownloadProcess(processId, process) {
        this._stateManager.updateDownloadProcess(processId, process);
    }

    /**
     * إزالة إدخال التحميل
     */
    removeDownloadEntry(processId) {
        this._stateManager.removeDownloadEntry(processId);
    }

    /**
     * الحصول على حالة التحميل
     */
    getDownloadStatus(processId) {
        return this._stateManager.getDownloadStatus(processId);
    }

    /**
     * معالجة بيانات التقدم من stdout/stderr
     * ملاحظة: التقدم يُعالج الآن مباشرة في YtdlpAdapter عبر _handleProgress
     * هذه الدالة محفوظة للتوافق فقط
     */
    handleProgressData(chunk, streamType, processId, onProgress, formatId) {
        const entry = this._stateManager.getDownloadEntry(processId);
        if (!entry) return;

        // التقدم يُعالج الآن مباشرة في YtdlpAdapter عبر _handleProgress
        // هذه الدالة محفوظة للتوافق فقط
    }

    /**
     * التحقق مما إذا كان يجب إعادة المحاولة
     */
    shouldRetry(entry, exitCode) {
        return this._retryHandler.shouldRetry(entry, exitCode);
    }

    /**
     * معالجة إعادة المحاولة
     */
    handleRetry(entry, processId, url, formatId, options, startDownloadCallback, exitCode) {
        this._retryHandler.handleRetry(
            entry, processId, url, formatId, options, 
            startDownloadCallback, exitCode,
            (pid) => this._stateManager.getDownloadEntry(pid)
        );
    }

    /**
     * معالجة اكتمال التحميل بنجاح
     */
    async handleDownloadSuccess(processId, finalOutputPath, deviceIds, url, title, actualFilename = null) {
        const entry = this._stateManager.getDownloadEntry(processId);
        if (!entry) return;

        await this._completionHandler.handleDownloadSuccess(
            entry, processId, finalOutputPath, deviceIds, url, title, actualFilename
        );
    }

    /**
     * معالجة فشل التحميل
     */
    handleDownloadFailure(processId, exitCode, deviceIds, url, title) {
        const entry = this._stateManager.getDownloadEntry(processId);
        if (!entry) return;

        this._failureHandler.handleDownloadFailure(
            entry, processId, exitCode, deviceIds, url, title
        );
    }

    /**
     * معالجة خطأ العملية
     */
    handleProcessError(processId, err, deviceIds, url) {
        const entry = this._stateManager.getDownloadEntry(processId);
        if (!entry) return;

        this._failureHandler.handleProcessError(
            entry, processId, err, deviceIds, url
        );
    }


    /**
     * Restore downloads from database into memory
     * @param {Object} repository - Download repository
     */
    async restoreMemoryFromDatabase(repository) {
        if (!repository) {
            console.warn('[DownloadManager] No repository provided for memory restoration');
            return;
        }

        try {
            // FIX: Added await to ensure data is fetched before passing to StateManager
            const downloadsData = await repository.findAllDownloads();
            this._stateManager.restoreFromRepository(downloadsData);
        } catch (error) {
            console.error('[DownloadManager] Failed to restore memory from database:', error);
        }
    }

    /**
     * البحث عن تحميل نشط في الذاكرة بناءً على الرابط ومعرف التنسيق
     */
    findActiveDownload(url, formatId) {
        return this._stateManager.findActiveDownload(url, formatId);
    }

    /**
     * تنظيف إدخال معلق في الذاكرة
     * يُستخدم عند فشل بدء العملية بعد إنشاء الإدخال
     * @param {string} processId - معرف العملية
     */
    cleanupOrphanedEntry(processId) {
        const entry = this._stateManager.getDownloadEntry(processId);
        if (!entry) {
            console.warn(`[DownloadManager] No entry found to cleanup for ${processId}`);
            return;
        }

        // إلغاء مراجع resolve و reject لتجنب تسرب الذاكرة
        entry.resolve = null;
        entry.reject = null;

        // حذف الإدخال من الذاكرة
        this._stateManager.removeDownloadEntry(processId);
    }

    /**
     * الحصول على جميع التحميلات النشطة
     */
    getActiveDownloads() {
        return this._stateManager.getActiveDownloads();
    }

    /**
     * الحصول على جميع التحميلات من الذاكرة بتنسيق قاعدة البيانات
     * @returns {Array} قائمة جميع التحميلات بتنسيق مطابق لقاعدة البيانات
     */
    getAllDownloads() {
        return this._stateManager.getAllDownloads();
    }

}

module.exports = DownloadManager;
