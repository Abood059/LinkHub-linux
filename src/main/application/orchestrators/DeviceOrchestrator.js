// src/main/application/orchestrators/DeviceOrchestrator.js
'use strict';

const Device = require('../../domain/entities/Device');

/**
 * DeviceOrchestrator
 * Responsible for coordinating device operations:
 * - Pairing and connection
 * - State management in DeviceRegistry
 * - Starting and stopping screen mirroring
 * - Managing favorites and trust
 *
 * Contains no technical execution logic (no spawn, no child_process, no direct ADB)
 */
class DeviceOrchestrator {
    constructor({ deviceRegistry, connectionService, scrcpyAdapter, deviceRepository = null, logger = null }) {
        this._deviceRegistry = deviceRegistry;
        this._connectionService = connectionService;
        this._scrcpyAdapter = scrcpyAdapter;
        this._deviceRepository = deviceRepository;
        this._logger = logger;
    }

    /**
     * Pair with wireless device using pairing code
     * @param {string} host - Address and port e.g. "192.168.1.10:37000"
     * @param {string} pairingCode - 6-digit code
     */
    async pairDevice(host, pairingCode) {
        if (!host || !pairingCode) {
            throw new Error('Host and pairing code are required');
        }
        return this._connectionService.pair(host, pairingCode);
    }

    /**
     * Connect to device (USB or TCP/IP)
     * @param {string} target - serial for USB or host:port for TCP/IP
     * @param {string} friendlyName - Optional friendly name
     */
    async connectDevice(target, friendlyName = null) {
        if (!target) {
            throw new Error('Target is required');
        }

        // Determine connection type
        const connectionType = target.includes(':') ? 'TCPIP' : 'USB';

        // If TCP/IP, execute connection command via ADB
        if (connectionType === 'TCPIP') {
            await this._connectionService.connect(target);
        }

        // Create device entity (initial data unknown)
        const deviceId = `device-${target.replace(/:/g, '-')}-${Date.now()}`;
        const device = new Device({
            id: deviceId,
            deviceFriendlyName: friendlyName || target,
            model: 'Unknown',
            version: 'Unknown',
            arch: 'Unknown',
            isFavorite: false
        });

        // Register device in Registry
        this._deviceRegistry.registerDevice(device);

        // Update runtime state
        this._deviceRegistry.updateState(device.id, {
            status: 'connected',
            adbTarget: target,
            connectionType,
            lastSeen: new Date()
        });

        // === Fetch real device info from ADB (after connection) ===
        try {
            const deviceInfo = await this._connectionService.getDeviceInfo(target);
            console.log('[DeviceOrchestrator] Device info from ADB:', deviceInfo);
            if (deviceInfo) {
                device.updateDetails(deviceInfo.model, deviceInfo.version, deviceInfo.arch);
                this._logger?.info(`Device info updated for ${target}: ${deviceInfo.model} (${deviceInfo.version})`);

                // Update runtime state with additional optional information
                this._deviceRegistry.updateState(device.id, {
                    model: deviceInfo.model,
                    version: deviceInfo.version,
                    arch: deviceInfo.arch
                });
                console.log('[DeviceOrchestrator] Device entity updated:', device.toJSON());
            }
        } catch (err) {
            this._logger?.warn(`Could not fetch detailed device info for ${target}: ${err.message}`);
            console.error('[DeviceOrchestrator] Error fetching device info:', err);
            // Don't prevent connection due to failed detail fetch, continue with default data
        }

        return device;
    }

    /**
     * Start screen mirroring for specific device
     * @param {string} deviceId - Device ID registered in Registry
     * @param {Object} options - Additional settings (fullscreen, bitrate, etc.)
     */
    startStreaming(deviceId, options = {}) {
        const device = this._deviceRegistry.getDevice(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        const runtimeState = this._deviceRegistry.getRuntimeState(deviceId);

        // SECURITY: Verify device is connected before allowing streaming
        if (runtimeState?.status !== 'connected') {
            throw new Error(`Device ${deviceId} is not connected (status: ${runtimeState?.status || 'unknown'})`);
        }

        const adbTarget = runtimeState?.adbTarget || device.id;

        return this._scrcpyAdapter.startMirroring(adbTarget, options);
    }

    /**
     * Stop screen mirroring for specific device
     * @param {string} deviceId - Device ID
     */
    stopStreaming(deviceId) {
        const device = this._deviceRegistry.getDevice(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }
        const runtimeState = this._deviceRegistry.getRuntimeState(deviceId);
        const adbTarget = runtimeState?.adbTarget || device.id;
        return this._scrcpyAdapter.stopMirroring(adbTarget);
    }

    /**
     * Disconnect from specific device
     * @param {string} deviceId - Device ID
     */
    async disconnectDevice(deviceId) {
        const device = this._deviceRegistry.getDevice(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        const runtimeState = this._deviceRegistry.getRuntimeState(deviceId);
        const adbTarget = runtimeState?.adbTarget || device.id;

        // Disconnect via ADB
        await this._connectionService.disconnect(adbTarget);

        // Update device status to offline
        this._deviceRegistry.updateState(deviceId, {
            status: 'offline',
            lastSeen: new Date()
        });

        return device;
    }

    /**
     * Get registered device
     */
    getDevice(deviceId) {
        return this._deviceRegistry.getDevice(deviceId);
    }

    /**
     * Get all registered devices with their states
     */
    getAllDevices() {
        return this._deviceRegistry.getAllDevices().map(device => ({
            device: device.toJSON(),
            runtimeState: this._deviceRegistry.getRuntimeState(device.id)?.toJSON() || null
        }));
   }

    /**
     * Set device as favorite
     * @param {string} deviceId - Device ID
     * @param {boolean} isFavorite - Favorite status
     * @returns {Promise<Object>} Updated device
     */
    async setDeviceFavorite(deviceId, isFavorite) {
        const device = this._deviceRegistry.getDevice(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        // Sync immediately with registry (handles both memory and repository)
        this._deviceRegistry.syncDeviceFavorite(deviceId, isFavorite);

        // Emit event to notify UI about the device state change
        // This will trigger loadDevices() in the renderer
        const { BrowserWindow } = require('electron');
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            windows[0].webContents.send('device:stateChanged', { deviceId, isFavorite });
        }

        return device.toJSON();
    }

    /**
     * Set device as trusted
     * @param {string} deviceId - Device ID
     * @param {boolean} isTrusted - Trust status
     * @returns {Promise<Object>} Updated device
     */
    async setDeviceTrusted(deviceId, isTrusted) {
        const device = this._deviceRegistry.getDevice(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        // Update in memory
        device.setTrusted(isTrusted);

        // Sync with repository
        if (this._deviceRepository) {
            try {
                this._deviceRepository.updateTrusted(deviceId, isTrusted);
            } catch (error) {
                console.error('[DeviceOrchestrator] Failed to sync trusted status to repository:', error);
            }
        }

        return device.toJSON();
    }

    /**
     * الحصول على الأجهزة المفضلة
     * @returns {Array} قائمة الأجهزة المفضلة
     */
    getFavoriteDevices() {
        return this._deviceRegistry.getFavoriteDevices().map(device => device.toJSON());
    }

    /**
     * الحصول على الأجهزة الموثوقة
     * @returns {Array} قائمة الأجهزة الموثوقة
     */
    getTrustedDevices() {
        return this._deviceRegistry.getTrustedDevices().map(device => device.toJSON());
    }

    /**
     * تعيين اسم مخصص للجهاز
     * @param {string} deviceId - معرف الجهاز
     * @param {string} customName - الاسم المخصص
     * @returns {Promise<Object>} الجهاز المحدث
     */
    async setDeviceCustomName(deviceId, customName) {
        const device = this._deviceRegistry.getDevice(deviceId);
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        // Update in memory
        device.setCustomName(customName);

        // Sync with repository
        if (this._deviceRepository) {
            try {
                this._deviceRepository.updateCustomName(deviceId, customName);
            } catch (error) {
                console.error('[DeviceOrchestrator] Failed to sync custom name to repository:', error);
            }
        }

        return device.toJSON();
    }
}

module.exports = DeviceOrchestrator;