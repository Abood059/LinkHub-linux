// src/main/infrastructure/transfer/FileDeleter.js
'use strict';

const fs = require('fs').promises;

/**
 * FileDeleter
 * 
 * المسؤولية: حذف الملفات من الجهاز البعيد والمحلي
 * - حذف الملفات من الجهاز عبر ADB shell
 * - حذف الملفات المحلية
 * 
 * NO business logic, NO file transfer logic, NO event emission
 */
class FileDeleter {
    constructor({ adbExecutor, logger = null }) {
        if (!adbExecutor) {
            throw new Error('adbExecutor is required for FileDeleter');
        }
        this._adbExecutor = adbExecutor;
        this._logger = logger;
    }

    /**
     * حذف ملف من الجهاز البعيد
     * @param {string} deviceId - معرف الجهاز
     * @param {string} remotePath - المسار على الجهاز
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async deleteRemoteFile(deviceId, remotePath) {
        try {
            const sanitizedSerial = this._adbExecutor._sanitizeSerialOrTarget ? 
                this._adbExecutor._sanitizeSerialOrTarget(deviceId) : deviceId;
            
            // استخدام أمر shell لحذف الملف
            const deleteCommand = ['rm', '-f', remotePath];
            const output = await this._adbExecutor._executeShellCommand(sanitizedSerial, deleteCommand);
            
            if (this._logger) {
                this._logger.info(`[FileDeleter] Remote file deleted: ${remotePath} (${deviceId})`);
            }
            
            return {
                success: true,
                message: `Remote file deleted successfully: ${remotePath}`
            };
        } catch (error) {
            if (this._logger) {
                this._logger.error(`[FileDeleter] Failed to delete remote file: ${error.message}`);
            }
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * حذف ملف محلي
     * @param {string} localPath - المسار المحلي للملف
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async deleteLocalFile(localPath) {
        try {
            await fs.unlink(localPath);
            
            if (this._logger) {
                this._logger.info(`[FileDeleter] Local file deleted: ${localPath}`);
            }
            
            return {
                success: true,
                message: `Local file deleted successfully: ${localPath}`
            };
        } catch (error) {
            if (this._logger) {
                this._logger.error(`[FileDeleter] Failed to delete local file: ${error.message}`);
            }
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = FileDeleter;
