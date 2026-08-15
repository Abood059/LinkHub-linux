// src/main/infrastructure/ipc/TransferHandlers.js
'use strict';

/**
 * TransferHandlers
 * 
 * Thin IPC layer for transfer-related operations.
 * Responsibilities ONLY:
 * - Register IPC channels with Electron's ipcMain
 * - Forward requests to TransferOrchestrator
 * - Return results/errors
 * 
 * NO business logic, NO runtime state, NO process execution.
 */
class TransferHandlers {
    constructor(transferOrchestrator) {
        if (!transferOrchestrator) {
            throw new Error('TransferOrchestrator is required for TransferHandlers');
        }
        this._transferOrchestrator = transferOrchestrator;
    }

    /**
     * Register all transfer IPC channels
     */
    register(ipcMain) {
        if (!ipcMain || typeof ipcMain.handle !== 'function') {
            throw new Error('Valid ipcMain instance required');
        }

        // بدء نقل ملف محدد
        ipcMain.handle('transfer:startFile', async (event, localPath, deviceId, options = {}) => {
            if (!localPath) {
                throw new Error('localPath is required');
            }
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._transferOrchestrator.startTransfer(localPath, deviceId, options);
        });

        // بدء نقل لعدة أجهزة
        ipcMain.handle('transfer:startMultiple', async (event, localPath, deviceIds, options = {}) => {
            if (!localPath) {
                throw new Error('localPath is required');
            }
            if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
                throw new Error('deviceIds is required and must be a non-empty array');
            }
            return this._transferOrchestrator.startMultipleTransfers(localPath, deviceIds, options);
        });

        // بدء نقل بعد اكتمال تحميل
        ipcMain.handle('transfer:startDownload', async (event, downloadId, deviceIds, localPath) => {
            if (!downloadId) {
                throw new Error('downloadId is required');
            }
            if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
                throw new Error('deviceIds is required and must be a non-empty array');
            }
            if (!localPath) {
                throw new Error('localPath is required');
            }
            return this._transferOrchestrator.startDownloadTransfer(downloadId, deviceIds, localPath);
        });

        // إلغاء نقل
        ipcMain.handle('transfer:cancel', async (event, transferId) => {
            if (!transferId) {
                throw new Error('transferId is required');
            }
            return this._transferOrchestrator.cancelTransfer(transferId);
        });

        // الحصول على حالة نقل
        ipcMain.handle('transfer:getStatus', async (event, transferId) => {
            if (!transferId) {
                throw new Error('transferId is required');
            }
            return this._transferOrchestrator.getTransferStatus(transferId);
        });

        // الحصول على جميع النقلات النشطة
        ipcMain.handle('transfer:getActive', async () => {
            return this._transferOrchestrator.getActiveTransfers();
        });

        // الحصول على نقلات جهاز معين
        ipcMain.handle('transfer:getByDevice', async (event, deviceId) => {
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._transferOrchestrator.getTransfersByDevice(deviceId);
        });
    }
}

module.exports = TransferHandlers;
