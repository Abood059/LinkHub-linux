// src/main/application/handlers/DeviceEventHandler.js
'use strict';

const Device = require('../../domain/entities/Device');

/**
 * DeviceEventHandler
 * Responsible for handling all ConnectionService events and managing device state
 * 
 * Responsibilities:
 * - Handle ADB events (adbDevices, wirelessServiceFound, pairSuccess, connectSuccess, disconnect)
 * - Create Device entities and register them in DeviceRegistry
 * - Update device state in DeviceRegistry
 * - Notify StateSyncService uniformly
 */
class DeviceEventHandler {
    constructor({ deviceRegistry, stateSyncService, connectionService = null, logger = null }) {
        this._deviceRegistry = deviceRegistry;
        this._stateSyncService = stateSyncService;
        this._connectionService = connectionService;
        this._logger = logger;
    }

    /**
     * Setup event handlers on ConnectionService
     */
    setup(connectionService) {
        connectionService.on('adbDevices', this._handleAdbDevices.bind(this));
        connectionService.on('wirelessServiceFound', this._handleWirelessFound.bind(this));
        connectionService.on('pairSuccess', this._handlePairSuccess.bind(this));
        connectionService.on('connectSuccess', this._handleConnectSuccess.bind(this));
        connectionService.on('disconnect', this._handleDisconnect.bind(this));
    }

    /**
     * Set StateSyncService (called after WindowManager is created)
     */
    setStateSyncService(stateSyncService) {
        this._stateSyncService = stateSyncService;
    }

    // ============================================================================
    // Event Handlers
    // ============================================================================

    /**
     * Handle device list from ADB
     */
    async _handleAdbDevices(devices) {
        if (!Array.isArray(devices)) return;

        // 1. Collect current serials from ADB
        const currentSerials = new Set();
        for (const device of devices) {
            if (device?.serial) currentSerials.add(device.serial);
        }

        // 2. Process currently existing devices
        for (const device of devices) {
            if (!device?.serial) continue;
            const deviceId = device.serial;

            // Create device entity if not exists
            let deviceEntity = this._deviceRegistry.getDevice(deviceId);
            if (!deviceEntity) {
                deviceEntity = new Device({
                    id: deviceId,
                    deviceFriendlyName: device.serial,
                    model: 'Unknown',
                    version: 'Unknown',
                    arch: 'Unknown',
                    isFavorite: false
                });
                this._deviceRegistry.registerDevice(deviceEntity);
            }

            // Fetch device info from ADB if device info is Unknown
            if (this._connectionService && (deviceEntity.model === 'Unknown' || deviceEntity.version === 'Unknown' || deviceEntity.arch === 'Unknown')) {
                try {
                    const deviceInfo = await this._connectionService.getDeviceInfo(deviceId);
                    if (deviceInfo) {
                        deviceEntity.updateDetails(deviceInfo.model, deviceInfo.version, deviceInfo.arch);
                        console.log(`[DeviceEventHandler] Updated device ${deviceId}: ${deviceInfo.model} (${deviceInfo.version})`);
                    }
                } catch (err) {
                    console.warn(`[DeviceEventHandler] Failed to fetch info for device ${deviceId}:`, err.message);
                }
            }

            // Update runtime state (connected)
            const newStatus = (device.state === 'device') ? 'connected' : (device.state || 'unknown');
            this._deviceRegistry.updateState(deviceId, {
                status: newStatus,
                adbTarget: device.serial,
                connectionType: device.serial.includes(':') ? 'TCPIP' : 'USB',
                lastSeen: new Date()
            });

            this._notifyStateSync('deviceStateChanged', {
                deviceId: deviceId,
                state: newStatus,
                adbTarget: device.serial
            });
        }

        // 3. Process missing devices (not in current list)
        const allDevices = this._deviceRegistry.getAllDevices();
        for (const registeredDevice of allDevices) {
            const deviceId = registeredDevice.id;
            const runtimeState = this._deviceRegistry.getRuntimeState(deviceId);
            
            // If device not in current serials
            if (!currentSerials.has(deviceId)) {
                // Device not favorite => remove completely from registry
                if (!registeredDevice.isFavorite) {
                    this._deviceRegistry.removeDevice(deviceId);
                    this._notifyStateSync('deviceRemoved', { deviceId });
                } 
                // Device is favorite => update status to offline
                else if (runtimeState && runtimeState.status !== 'offline') {
                    this._deviceRegistry.updateState(deviceId, { status: 'offline', lastSeen: new Date() });
                    this._notifyStateSync('deviceStateChanged', {
                        deviceId: deviceId,
                        state: 'offline',
                        adbTarget: deviceId
                    });
                }
            }
        }
    }

    /**
     * Handle wireless device discovery
     */
    _handleWirelessFound(service) {
        if (!service?.host || !service?.port) return;
        const adbTarget = `${service.host}:${service.port}`;
        let deviceId = this._deviceRegistry.findDeviceIdByAdbTarget(adbTarget);

        if (!deviceId) {
            deviceId = `wireless-${adbTarget.replace(/:/g, '-')}`;
            if (!this._deviceRegistry.hasDevice(deviceId)) {
                const newDevice = new Device({
                    id: deviceId,
                    deviceFriendlyName: service.name || adbTarget,
                    model: 'Unknown',
                    version: 'Unknown',
                    arch: 'Unknown',
                    isFavorite: false
                });
                this._deviceRegistry.registerDevice(newDevice);
            }
        }

        this._deviceRegistry.updateState(deviceId, {
            status: 'discovered',
            adbTarget: adbTarget,
            ip: service.host,
            port: service.port,
            connectionType: 'WIRELESS_DISCOVERED',
            lastSeen: new Date()
        });

        this._notifyStateSync('deviceStateChanged', {
            deviceId: deviceId,
            state: 'discovered',
            adbTarget: adbTarget
        });
    }

    /**
     * Handle pairing success
     */
    _handlePairSuccess(data) {
        if (!data || !data.host) return;
        const { host, pairingCode } = data;
        this._logger?.info(`Pair success for ${host}`, { source: 'DeviceEventHandler' });
        this._notifyStateSync('devicePaired', { host, pairingCode });
    }

    /**
     * Handle connection success
     */
    _handleConnectSuccess(data) {
        if (!data || !data.target) return;
        const { target } = data;
        let deviceId = this._deviceRegistry.findDeviceIdByAdbTarget(target);
        
        if (!deviceId) {
            deviceId = `device-${target.replace(/:/g, '-')}-${Date.now()}`;
            if (!this._deviceRegistry.hasDevice(deviceId)) {
                const newDevice = new Device({
                    id: deviceId,
                    deviceFriendlyName: target,
                    model: 'Unknown',
                    version: 'Unknown',
                    arch: 'Unknown',
                    isFavorite: false
                });
                this._deviceRegistry.registerDevice(newDevice);
            }
        }
        
        this._deviceRegistry.updateState(deviceId, {
            status: 'connected',
            adbTarget: target,
            connectionType: 'TCPIP',
            lastSeen: new Date()
        });
        
        this._notifyStateSync('deviceStateChanged', {
            deviceId: deviceId,
            state: 'connected',
            adbTarget: target
        });
    }

    /**
     * معالجة قطع الاتصال
     */
    _handleDisconnect(data) {
        const target = data?.target;
        if (!target || target === 'all') {
            for (const deviceId of this._deviceRegistry.getAllDevices().map(d => d.id)) {
                const state = this._deviceRegistry.getRuntimeState(deviceId);
                if (state && state.status === 'connected') {
                    this._deviceRegistry.updateState(deviceId, { status: 'offline', lastSeen: new Date() });
                    this._notifyStateSync('deviceStateChanged', {
                        deviceId: deviceId,
                        state: 'offline'
                    });
                }
            }
            return;
        }
        const deviceId = this._deviceRegistry.findDeviceIdByAdbTarget(target);
        if (deviceId) {
            this._deviceRegistry.updateState(deviceId, { status: 'offline', lastSeen: new Date() });
            this._notifyStateSync('deviceStateChanged', {
                deviceId: deviceId,
                state: 'offline',
                adbTarget: target
            });
        }
    }

    // ============================================================================
    // Internal methods
    // ============================================================================

    /**
     * إشعار StateSyncService بشكل موحد
     */
    _notifyStateSync(eventType, data) {
        if (!this._stateSyncService) return;

        try {
            switch (eventType) {
                case 'deviceStateChanged':
                    this._stateSyncService.onDeviceStateChanged(data);
                    break;
                case 'deviceRemoved':
                    this._stateSyncService.onDeviceRemoved(data);
                    break;
                case 'devicePaired':
                    this._stateSyncService.onDevicePaired(data);
                    break;
                default:
                    this._logger?.warn(`Unknown event type: ${eventType}`, { source: 'DeviceEventHandler' });
            }
        } catch (error) {
            this._logger?.error(`Error in _notifyStateSync for event ${eventType}:`, error, { source: 'DeviceEventHandler' });
        }
    }
}

module.exports = DeviceEventHandler;
