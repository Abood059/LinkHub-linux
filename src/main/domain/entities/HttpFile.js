const crypto = require('crypto');
const FileStatus = require('../value-objects/FileStatus');

/**
 * HttpFile Model
 * نموذج بيانات الملفات المحملة عبر HTTP
 */
class HttpFile {
    constructor(data = {}) {
        // الخصائص الأساسية
        this.id = data.id || crypto.randomUUID();
        this.url = data.url || '';
        this.fileName = data.fileName || '';
        this.storagePath = data.storagePath || '';
        this.mimeType = data.mimeType || '';

        // خصائص حالة التحميل
        this.status = data.status || 'pending'; // 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled'

        // تهيئة fileStatus وتعبئة البيانات الممررة إن وجدت
        const statusData = data.fileStatus || {};
        this.fileStatus = new FileStatus({
            percentage: statusData.percentage !== undefined ? statusData.percentage : (data.progress !== undefined ? data.progress : 0),
            downloadedBytes: statusData.downloadedBytes !== undefined ? statusData.downloadedBytes : (data.downloadedBytes !== undefined ? data.downloadedBytes : 0),
            speed: statusData.speed !== undefined ? statusData.speed : (data.speed !== undefined ? data.speed : ''),
            eta: statusData.eta !== undefined ? statusData.eta : (data.eta !== undefined ? data.eta : ''),
            totalBytes: statusData.totalBytes !== undefined ? statusData.totalBytes : (data.sizeBytes !== undefined ? data.sizeBytes : null),
            isPaused: statusData.isPaused !== undefined ? statusData.isPaused : false
        });
    }

    /**
     * تحويل الكائن إلى JSON عادي
     */
    toJSON() {
        return {
            id: this.id,
            url: this.url,
            fileName: this.fileName,
            storagePath: this.storagePath,
            mimeType: this.mimeType,
            status: this.status,
            fileStatus: this.fileStatus.toJSON()
        };
    }

    /**
     * تحديث حالة التقدم
     */
    updateProgress(progressData) {
        if (!progressData) return;
        this.fileStatus.update({
            percentage: progressData.progress,
            downloadedBytes: progressData.downloadedBytes,
            speed: progressData.speed,
            eta: progressData.eta,
            totalBytes: progressData.totalBytes
        });
    }

    /**
     * تحديث الحالة
     */
    setStatus(status) {
        this.status = status;
    }

    /**
     * التحقق من اكتمال التحميل
     */
    isCompleted() {
        return this.status === 'completed';
    }

    /**
     * التحقق من فشل التحميل
     */
    isFailed() {
        return this.status === 'failed';
    }

    /**
     * التحقق من إلغاء التحميل
     */
    isCancelled() {
        return this.status === 'cancelled';
    }

    /**
     * التحقق من أن التحميل نشط
     */
    isActive() {
        return this.status === 'downloading' || this.status === 'pending';
    }
}

module.exports = HttpFile;
