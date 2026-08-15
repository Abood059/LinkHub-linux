'use strict';

/**
 * DeviceHandlers
 * 
 * Thin IPC layer for device-related operations.
 * Responsibilities ONLY:
 * - Register IPC channels with Electron's ipcMain
 * - Forward requests to DeviceOrchestrator
 * - Return results/errors
 * 
 * NO business logic, NO runtime state, NO process execution.
 */
class DeviceHandlers {
    constructor(deviceOrchestrator) {
        if (!deviceOrchestrator) {
            throw new Error('DeviceOrchestrator is required for DeviceHandlers');
        }
        this._deviceOrchestrator = deviceOrchestrator;
    }

    /**
     * Register all device IPC channels
     */
    register(ipcMain) {
        if (!ipcMain || typeof ipcMain.handle !== 'function') {
            throw new Error('Valid ipcMain instance required');
        }

        // Get all devices with their runtime state
        ipcMain.handle('device:list', async () => {
            return this._deviceOrchestrator.getAllDevices();
        });

        // Get a single device by ID
        ipcMain.handle('device:get', async (event, deviceId) => {
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._deviceOrchestrator.getDevice(deviceId);
        });

        // Pair with a wireless device (requires host:port and pairing code)
        ipcMain.handle('device:pair', async (event, host, pairingCode) => {
            if (!host || !pairingCode) {
                throw new Error('host and pairingCode are required');
            }
            return this._deviceOrchestrator.pairDevice(host, pairingCode);
        });

        // Connect to a device (USB serial or TCP/IP host:port)
        ipcMain.handle('device:connect', async (event, target, friendlyName = null) => {
            if (!target) {
                throw new Error('target is required (USB serial or host:port)');
            }
            return this._deviceOrchestrator.connectDevice(target, friendlyName);
        });

        // Start screen mirroring for a connected device
        ipcMain.handle('device:stream:start', async (event, deviceId, options = {}) => {
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._deviceOrchestrator.startStreaming(deviceId, options);
        });

        // Stop screen mirroring
        ipcMain.handle('device:stream:stop', async (event, deviceId) => {
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._deviceOrchestrator.stopStreaming(deviceId);
        });

        // Disconnect a device
        ipcMain.handle('device:disconnect', async (event, deviceId) => {
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._deviceOrchestrator.disconnectDevice(deviceId);
        });

        // Set device favorite status
        ipcMain.handle('device:setFavorite', async (event, deviceId, isFavorite) => {
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._deviceOrchestrator.setDeviceFavorite(deviceId, isFavorite);
        });

        // Set device trusted status
        ipcMain.handle('device:setTrusted', async (event, deviceId, isTrusted) => {
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._deviceOrchestrator.setDeviceTrusted(deviceId, isTrusted);
        });

        // Get favorite devices
        ipcMain.handle('device:getFavorites', async () => {
            return this._deviceOrchestrator.getFavoriteDevices();
        });

        // Get trusted devices
        ipcMain.handle('device:getTrusted', async () => {
            return this._deviceOrchestrator.getTrustedDevices();
        });

        // Set device custom name
        ipcMain.handle('device:setCustomName', async (event, deviceId, customName) => {
            if (!deviceId) {
                throw new Error('deviceId is required');
            }
            return this._deviceOrchestrator.setDeviceCustomName(deviceId, customName);
        });

        // Debug: Log device data from renderer
        ipcMain.handle('debug:logDeviceData', async (event, deviceData) => {
            console.log('[IPC Debug] Device data from renderer:', deviceData);
            if (deviceData && deviceData.device) {
                console.log('[IPC Debug] Device model:', deviceData.device.model);
                console.log('[IPC Debug] Device version:', deviceData.device.version);
                console.log('[IPC Debug] Device arch:', deviceData.device.arch);
            }
            return { success: true };
        });
    }
}

module.exports = DeviceHandlers;