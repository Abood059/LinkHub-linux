// src/main/infrastructure/transfer/SpaceChecker.js
'use strict';

/**
 * SpaceChecker
 * 
 * المسؤولية: التحقق من المساحة المتاحة على الجهاز
 * - التحقق من كفاية المساحة قبل النقل
 * - الحصول على المساحة المتاحة
 * - الحصول على معلومات التخزين الكاملة
 * 
 * NO business logic, NO file operations, NO event emission
 */
class SpaceChecker {
    constructor({ adbExecutor, logger = null }) {
        if (!adbExecutor) {
            throw new Error('adbExecutor is required for SpaceChecker');
        }
        this._adbExecutor = adbExecutor;
        this._logger = logger;
    }

    /**
     * التحقق من كفاية المساحة المتاحة
     * @param {string} deviceId - معرف الجهاز
     * @param {number} requiredBytes - الحجم المطلوب بالبايت
     * @returns {Promise<{hasEnoughSpace: boolean, availableBytes: number, requiredBytes: number}>}
     */
    async checkAvailableSpace(deviceId, requiredBytes) {
        try {
            const availableSpace = await this.getAvailableSpace(deviceId);
            
            const hasEnoughSpace = availableSpace >= requiredBytes;
            
            if (this._logger) {
                this._logger.info(`[SpaceChecker] Space check: ${availableSpace} bytes available, ${requiredBytes} bytes required (${hasEnoughSpace ? 'OK' : 'NOT OK'})`);
            }
            
            return {
                hasEnoughSpace,
                availableBytes: availableSpace,
                requiredBytes: requiredBytes
            };
        } catch (error) {
            if (this._logger) {
                this._logger.error(`[SpaceChecker] Failed to check available space: ${error.message}`);
            }
            return {
                hasEnoughSpace: false,
                availableBytes: 0,
                requiredBytes: requiredBytes
            };
        }
    }

    /**
     * الحصول على المساحة المتاحة على الجهاز
     * @param {string} deviceId - معرف الجهاز
     * @returns {Promise<number>} - المساحة المتاحة بالبايت
     */
    async getAvailableSpace(deviceId) {
        try {
            const storageInfo = await this.getStorageInfo(deviceId);
            return storageInfo.availableBytes;
        } catch (error) {
            if (this._logger) {
                this._logger.error(`[SpaceChecker] Failed to get available space: ${error.message}`);
            }
            return 0;
        }
    }

    /**
     * الحصول على معلومات التخزين الكاملة
     * @param {string} deviceId - معرف الجهاز
     * @returns {Promise<{totalBytes: number, usedBytes: number, availableBytes: number, usedPercent: number}>}
     */
    async getStorageInfo(deviceId) {
        try {
            const sanitizedSerial = this._adbExecutor._sanitizeSerialOrTarget ? 
                this._adbExecutor._sanitizeSerialOrTarget(deviceId) : deviceId;
            
            // استخدام أمر df للحصول على معلومات التخزين
            const dfCommand = ['df', '/sdcard'];
            const dfOutput = await this._adbExecutor._executeShellCommand(sanitizedSerial, dfCommand);
            
            // تحليل المخرجات
            const lines = dfOutput.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('Invalid df output');
            }
            
            // السطر الثاني يحتوي على البيانات
            const dataLine = lines[1].trim().split(/\s+/);
            
            // تنسيق df: Filesystem Size Used Available Use% Mounted
            // نحتاج الأعمدة: Size (1), Used (2), Available (3), Use% (4)
            const totalBytes = parseInt(dataLine[1]) * 1024; // KB to Bytes
            const usedBytes = parseInt(dataLine[2]) * 1024; // KB to Bytes
            const availableBytes = parseInt(dataLine[3]) * 1024; // KB to Bytes
            const usedPercent = parseInt(dataLine[4].replace('%', ''));
            
            if (this._logger) {
                this._logger.info(`[SpaceChecker] Storage info: Total=${totalBytes}, Used=${usedBytes}, Available=${availableBytes}, Used%=${usedPercent}`);
            }
            
            return {
                totalBytes,
                usedBytes,
                availableBytes,
                usedPercent
            };
        } catch (error) {
            if (this._logger) {
                this._logger.error(`[SpaceChecker] Failed to get storage info: ${error.message}`);
            }
            return {
                totalBytes: 0,
                usedBytes: 0,
                availableBytes: 0,
                usedPercent: 0
            };
        }
    }
}

module.exports = SpaceChecker;
