// src/main/infrastructure/media/FailureHandler.js
'use strict';

/**
 * فئة مسؤولة عن معالجة فشل التحميل وأخطاء العملية
 */
class FailureHandler {
    constructor(logger = null) {
        this._logger = logger;
    }

    /**
     * معالجة فشل التحميل
     */
    handleDownloadFailure(entry, processId, exitCode, deviceIds, url, title) {
        if (!entry) return;

        entry.status = 'failed';
        entry.exitCode = exitCode;
        entry.failedAt = new Date().toISOString();

        const stderrOutput = entry.stderrBuffer || '';
        if (this._logger) {
            this._logger.error(`yt-dlp failed after ${entry.maxRetries} retries. Exit code: ${exitCode}. stderr: ${stderrOutput}`);
        }

        const errorMsg = stderrOutput.includes('ERROR:')
            ? stderrOutput.match(/ERROR:.*/)?.[0] || stderrOutput
            : stderrOutput || `Exit code ${exitCode}`;

        // تخزين رسالة الخطأ في entry لكي يستطيع DownloadStateSyncService قراءتها
        entry.errorMessage = errorMsg;

        entry.reject(new Error(`Download failed after ${entry.maxRetries} retries: ${errorMsg}`));

        return {
            status: 'failed',
            exitCode,
            errorMsg
        };
    }

    /**
     * معالجة خطأ العملية
     */
    handleProcessError(entry, processId, err, deviceIds, url) {
        if (!entry) return;

        entry.status = 'failed';
        entry.failedAt = new Date().toISOString();

        // تخزين رسالة الخطأ في entry لكي يستطيع DownloadStateSyncService قراءتها
        entry.errorMessage = err.message || 'Unknown error';

        entry.reject(err);

        return {
            status: 'failed',
            errorMsg: err.message
        };
    }
}

module.exports = FailureHandler;
