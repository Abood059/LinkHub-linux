// src/main/infrastructure/media/ProcessManager.js
'use strict';

/**
 * ProcessManager
 * مسؤول عن إدارة عمليات yt-dlp
 */
class ProcessManager {
    constructor(processSupervisor, toolPathResolver, logger = null) {
        this._processSupervisor = processSupervisor;
        this._toolPathResolver = toolPathResolver;
        this._logger = logger;
        this._ytdlpPath = this._resolveYtdlpPath();
    }

    /**
     * تحديد مسار yt-dlp
     * @param {string} explicitPath - مسار صريح
     * @returns {string} مسار yt-dlp
     */
    _resolveYtdlpPath(explicitPath = null) {
        if (explicitPath) return explicitPath;
        if (this._toolPathResolver) return this._toolPathResolver.getYtDlpPath();
        const fallbackPath = 'yt-dlp';
        if (this._logger && typeof this._logger.warn === 'function') {
            this._logger.warn(`ProcessManager: No toolPathResolver provided, using fallback: ${fallbackPath}`);
        }
        return fallbackPath;
    }

    /**
     * الحصول على مسار yt-dlp
     * @returns {string} مسار yt-dlp
     */
    getYtdlpPath() {
        return this._ytdlpPath;
    }

    /**
     * تسجيل عملية yt-dlp في ProcessSupervisor
     * @param {string} processId - معرف العملية
     * @param {ChildProcess} process - كائن العملية من yt-dlp-wrap-plus
     * @param {AbortController} controller - للتحكم في الإلغاء
     * @param {Object} metadata - بيانات وصفية
     */
    registerProcessWithSupervisor(processId, process, controller, metadata) {
        if (!this._processSupervisor) {
            if (this._logger && typeof this._logger.warn === 'function') {
                this._logger.warn('ProcessSupervisor not available, process will not be tracked');
            }
            return;
        }

        // استخدام الواجهة الجديدة في ProcessSupervisor
        this._processSupervisor.registerExternalProcess(processId, process, controller, metadata);
    }

    /**
     * التحقق من حالة عملية التحميل
     * @param {string} processId - معرف العملية
     * @param {Object} entry - إدخال التحميل
     * @returns {boolean} true إذا كانت العملية قيد التشغيل، false إذا كانت متوقفة
     */
    isProcessRunning(processId, entry) {
        if (!entry) return false;

        // التحقق من وجود العملية وحالتها
        if (entry.process) {
            // إذا كانت العملية موجودة، تحقق من حالتها
            return entry.status === 'downloading' || entry.status === 'starting';
        }

        return false;
    }

    /**
     * إيقاف عملية التحميل
     * @param {string} processId - معرف العملية
     * @param {Object} entry - إدخال التحميل
     * @param {boolean} updateStatus - هل تحديث الحالة في الذاكرة
     * @returns {Object} كائن نتيجة يوضح حالة الإيقاف
     */
    stopProcess(processId, entry, updateStatus = true) {
        // إيقاف من المكتبة عبر AbortController
        if (entry && entry.controller) {
            entry.controller.abort();
        }

        // إيقاف من ProcessSupervisor
        if (this._processSupervisor && this._processSupervisor.hasProcess(processId)) {
            this._processSupervisor.stopManagedProcess(processId);
        }

        return { success: true, wasRunning: true };
    }
}

module.exports = ProcessManager;
