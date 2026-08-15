'use strict';

const { ipcMain } = require('electron');
const DeviceHandlers = require('./DeviceHandlers');
const DownloadHandlers = require('./DownloadHandlers');
const TransferHandlers = require('./TransferHandlers');
const FilePickerHandler = require('./FilePickerHandler');

/**
 * Register all IPC handlers with Electron's ipcMain.
 * This function should be called once during application startup,
 * after creating DeviceOrchestrator, DownloadOrchestrator, and TransferOrchestrator.
 *
 * @param {Object} deviceOrchestrator - Instance of DeviceOrchestrator
 * @param {Object} downloadOrchestrator - Instance of DownloadOrchestrator
 * @param {Object} transferOrchestrator - Instance of TransferOrchestrator
 */
function registerIpcHandlers(deviceOrchestrator, downloadOrchestrator, transferOrchestrator) {
    if (!deviceOrchestrator || !downloadOrchestrator || !transferOrchestrator) {
        throw new Error('DeviceOrchestrator, DownloadOrchestrator, and TransferOrchestrator are required');
    }

    const deviceHandlers = new DeviceHandlers(deviceOrchestrator);
    const downloadHandlers = new DownloadHandlers(downloadOrchestrator);
    const transferHandlers = new TransferHandlers(transferOrchestrator);
    const filePickerHandler = new FilePickerHandler();

    deviceHandlers.register(ipcMain);
    downloadHandlers.register(ipcMain);
    transferHandlers.register(ipcMain);
    filePickerHandler.register(ipcMain);
}

module.exports = {
    registerIpcHandlers,
    DeviceHandlers,
    DownloadHandlers,
    TransferHandlers,
    FilePickerHandler
};