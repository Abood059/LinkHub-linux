// src/main/infrastructure/transfer/TransferProgressTracker.js
'use strict';

const fs = require('fs').promises;

/**
 * TransferProgressTracker
 * 
 * المسؤولية: حساب وتتبع تقدم النقل
 * - حساب التقدم بناءً على حجم الملف المنقول
 * - الحصول على حجم الملف المحلي
 * - الحصول على حجم الملف البعيد
 * 
 * NO business logic, NO file operations, NO event emission
 */
class TransferProgressTracker {
    constructor({ adbExecutor, logger = null }) {
        if (!adbExecutor) {
            throw new Error('adbExecutor is required for TransferProgressTracker');
        }
        this._adbExecutor = adbExecutor;
        this._logger = logger;
    }

    /**
     * حساب نسبة اكتمال النقل بناءً على حجم الملف على الهاتف مقسوم على الحجم الأصلي
     * @param {string} deviceId - معرف الجهاز
     * @param {string} remotePath - المسار على الجهاز
     * @param {number} originalSize - الحجم الأصلي للملف بالبايت
     * @returns {Promise<{progress: number, transferredBytes: number, totalBytes: number}>}
     */
    async calculateProgress(deviceId, remotePath, originalSize) {
        try {
            const remoteSize = await this.getRemoteFileSize(deviceId, remotePath);
            
            if (originalSize <= 0) {
                return {
                    progress: 1,
                    transferredBytes: remoteSize,
                    totalBytes: originalSize
                };
            }

            const progress = Math.min(remoteSize / originalSize, 1);
            
            return {
                progress,
                transferredBytes: remoteSize,
                totalBytes: originalSize
            };
        } catch (error) {
            if (this._logger) {
                this._logger.warn(`[TransferProgressTracker] Failed to calculate progress: ${error.message}`);
            }
            return {
                progress: 1,
                transferredBytes: 0,
                totalBytes: originalSize
            };
        }
    }

    /**
     * الحصول على حجم الملف المحلي
     * @param {string} filePath - مسار الملف
     * @returns {Promise<number>} - الحجم بالبايت
     */
    async getLocalFileSize(filePath) {
        try {
            const stats = await fs.stat(filePath);
            return stats.size;
        } catch (error) {
            if (this._logger) {
                this._logger.error(`[TransferProgressTracker] Failed to get local file size: ${error.message}`);
            }
            return 0;
        }
    }

    /**
     * الحصول على حجم الملف على الجهاز البعيد
     * @param {string} deviceId - معرف الجهاز
     * @param {string} remotePath - المسار على الجهاز
     * @returns {Promise<number>} - الحجم بالبايت
     */
    async getRemoteFileSize(deviceId, remotePath) {
        try {
            const sanitizedSerial = this._adbExecutor._sanitizeSerialOrTarget ? 
                this._adbExecutor._sanitizeSerialOrTarget(deviceId) : deviceId;
            
            // استخدام أمر shell مع escaping صحيح للمسار
            // نستخدم علامات اقتباس مفردة حول المسار للحماية من المسافات والأحرف الخاصة
            const escapedPath = remotePath.replace(/'/g, "'\\''");
            const sizeCommand = ['stat', '-c', '%s', `'${escapedPath}'`];
            const sizeOutput = await this._adbExecutor._executeShellCommand(sanitizedSerial, sizeCommand);
            
            const size = parseInt(sizeOutput.trim());
            return isNaN(size) ? 0 : size;
        } catch (error) {
            if (this._logger) {
                this._logger.warn(`[TransferProgressTracker] Failed to get remote file size: ${error.message}`);
            }
            return 0;
        }
    }
}

module.exports = TransferProgressTracker;
