// src/main/infrastructure/media/RetryHandler.js
'use strict';

/**
 * فئة مسؤولة عن إدارة منطق إعادة المحاولة والتأخير التصاعدي
 */
class RetryHandler {
    constructor(logger = null) {
        this._logger = logger;
    }

    /**
     * التحقق مما إذا كان يجب إعادة المحاولة
     */
    shouldRetry(entry, exitCode) {
        if (exitCode === 0) return false;
        
        // عدم إعادة المحاولة إذا كان التوقف يدوياً
        if (entry.manuallyStopped) return false;
        
        // التحقق من الحد الأقصى قبل زيادة العداد
        const currentRetryCount = entry.retryCount || 0;
        if (currentRetryCount >= entry.maxRetries) {
            return false;
        }
        
        entry.retryCount = currentRetryCount + 1;
        return true;
    }

    /**
     * معالجة إعادة المحاولة
     */
    handleRetry(entry, processId, url, formatId, options, startDownloadCallback, exitCode ,getStateCallback) {
        entry.status = 'retrying';
        entry.exitCode = exitCode;
        
        if (this._logger) {
            this._logger.warn(`Download failed (attempt ${entry.retryCount}/${entry.maxRetries}), retrying... Exit code: ${exitCode}`);
        }
        
        // إعادة تعيين الحالة
        entry.status = 'starting';
        entry.downloadedBytes = 0;
        entry.currentFileIndex = 0;
        entry.stderrBuffer = '';
        
        // حساب التأخير التصاعدي
        const delayIndex = Math.min(entry.retryCount - 1, entry.retryDelays.length - 1);
        const delay = entry.retryDelays[delayIndex];
        
        if (this._logger) {
            this._logger.info(`Retrying download ${processId} after ${delay/1000}s (attempt ${entry.retryCount}/${entry.maxRetries})`);
        }
        
        // إعادة بدء التحميل بعد التأخير التصاعدي
        setTimeout(async () => {
            try {
                // التأكد من أن entry لا يزال موجوداً ولم يتم إلغاؤه
                const currentEntry = getStateCallback(processId);
                if (!currentEntry || currentEntry.status === 'cancelled' || currentEntry.manuallyStopped) {
                    if (this._logger) {
                        this._logger.warn(`Download ${processId} was cancelled or removed, skipping retry`);
                    }
                    return;
                }
                
                await startDownloadCallback(url, formatId, { ...options, processId });
            } catch (retryErr) {
                if (this._logger) {
                    this._logger.error(`Retry attempt ${entry.retryCount} failed: ${retryErr.message}`);
                }
            }
        }, delay);
    }
}

module.exports = RetryHandler;
