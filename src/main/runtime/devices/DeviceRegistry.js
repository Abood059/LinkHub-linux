'use strict';

const DeviceRuntimeState =
    require('./DeviceRuntimeState');

/**
 * Runtime registry responsible for:
 *
 * - Device registration
 * - Device lookup
 * - Runtime state management
 * - Sync with repository for persistence
 *
 * This class does NOT:
 * - Connect devices
 * - Pair devices
 * - Execute ADB commands
 * - Implement business logic
 */
class DeviceRegistry {
    constructor({ deviceRepository, connectionService = null } = {}) {
        /**
         * Map<deviceId, Device>
         */
        this._devices =
            new Map();

        /**
         * Map<deviceId, DeviceRuntimeState>
         */
        this._runtimeStates =
            new Map();

        /**
         * Device repository for persistence
         */
        this._deviceRepository = deviceRepository;

        /**
         * Connection service for updating device info
         */
        this._connectionService = connectionService;
    }

    registerDevice(device) {
        if (!device || !device.id) {
            throw new Error(
                'Device must contain a valid id'
            );
        }

        this._devices.set(
            device.id,
            device
        );

        if (
            !this._runtimeStates.has(
                device.id
            )
        ) {
            this._runtimeStates.set(
                device.id,
                new DeviceRuntimeState()
            );
        }

        // Sync with repository for all devices (not just favorites)
        // This is required for foreign key constraints in downloads table
        if (this._deviceRepository) {
            try {
                const existingDevice = this._deviceRepository.findDeviceById(device.id);
                if (existingDevice) {
                    // Device exists, update it
                    this._deviceRepository.updateDevice(device.id, device.toJSON());
                } else {
                    // Device does not exist, insert it
                    this._deviceRepository.insertDevice(device.toJSON());
                }
            } catch (error) {
                console.error('[DeviceRegistry] Failed to sync device to repository:', error);
            }
        }

        return device;
    }

    removeDevice(deviceId) {
        const device = this._devices.get(deviceId);
        const wasFavorite = device ? device.isFavorite : false;

        this._devices.delete(
            deviceId
        );

        this._runtimeStates.delete(
            deviceId
        );

        // Sync with repository only if device was favorite
        if (this._deviceRepository && wasFavorite) {
            try {
                this._deviceRepository.deleteDevice(deviceId);
            } catch (error) {
                console.error('[DeviceRegistry] Failed to delete device from repository:', error);
            }
        }
    }

    updateState(
        deviceId,
        state = {}
    ) {
        // Handle null, undefined, or non-object state gracefully
        if (!state || typeof state !== 'object') {
            state = {};
        }

        let runtimeState =
            this._runtimeStates.get(
                deviceId
            );

        if (!runtimeState) {
            runtimeState =
                new DeviceRuntimeState();

            this._runtimeStates.set(
                deviceId,
                runtimeState
            );
        }

        // Only update known properties of DeviceRuntimeState
        // Only include properties that are actually present in the state object
        const knownProperties = {};
        
        if (state.status !== undefined) knownProperties.status = state.status;
        if (state.ip !== undefined) knownProperties.ip = state.ip;
        if (state.port !== undefined) knownProperties.port = state.port;
        if (state.connectionType !== undefined) knownProperties.connectionType = state.connectionType;
        if (state.adbTarget !== undefined) knownProperties.adbTarget = state.adbTarget;
        
        // Always update lastSeen if not provided, or use provided value
        knownProperties.lastSeen = state.lastSeen || new Date();

        runtimeState.update(knownProperties);

        return runtimeState;
    }

    getDevice(deviceId) {
        return (
            this._devices.get(
                deviceId
            ) || null
        );
    }

    getRuntimeState(
        deviceId
    ) {
        return (
            this._runtimeStates.get(
                deviceId
            ) || null
        );
    }

    getAllDevices() {
        return Array.from(
            this._devices.values()
        );
    }

    getAllRuntimeStates() {
        return Array.from(
            this._runtimeStates.values()
        );
    }

    hasDevice(deviceId) {
        return this._devices.has(
            deviceId
        );
    }

    clear() {
        this._devices.clear();
        this._runtimeStates.clear();
    }

    /**
     * Sync device favorite status to repository immediately
     * @param {string} deviceId - Device ID
     * @param {boolean} isFavorite - New favorite status
     */
    syncDeviceFavorite(deviceId, isFavorite) {
        const device = this._devices.get(deviceId);
        if (!device) {
            console.warn(`[DeviceRegistry] Device ${deviceId} not found for favorite sync`);
            return;
        }

        // Update the device's favorite status
        device.setFavorite(isFavorite);

        if (this._deviceRepository) {
            try {
                const existingDevice = this._deviceRepository.findDeviceById(deviceId);

                if (isFavorite) {
                    if (existingDevice) {
                        // Device exists in database, update only the favorite field
                        this._deviceRepository.updateDevice(deviceId, { isFavorite: true });
                    } else {
                        // Device does not exist in database, insert it
                        this._deviceRepository.insertDevice(device.toJSON());
                    }
                } else {
                    if (existingDevice) {
                        // Device exists in database, delete it
                        this._deviceRepository.deleteDevice(deviceId);
                    }
                    // If device does not exist in database, do nothing
                }
            } catch (error) {
                console.error('[DeviceRegistry] Failed to sync favorite status to repository:', error);
            }
        }
    }

    /**
     * Find device ID by ADB target (serial or host:port)
     * @param {string} adbTarget - e.g., "emulator-5554" or "192.168.1.10:5555"
     * @returns {string|null} deviceId if found, else null
     */
    findDeviceIdByAdbTarget(adbTarget) {
        if (!adbTarget) return null;
        for (const [deviceId, runtimeState] of this._runtimeStates.entries()) {
            if (runtimeState.adbTarget === adbTarget) {
                return deviceId;
            }
        }
        // Also check devices without runtime state? Not needed as each device has runtime.
        return null;
    }

    /**
     * Load devices from repository into memory
     * @param {DeviceRepository} repository - Device repository instance
     * @returns {Promise<void>}
     */
    async loadFromRepository(repository) {
        if (!repository) {
            console.warn('[DeviceRegistry] No repository provided, skipping load');
            return;
        }

        try {
            const devicesData = repository.findAllDevices();
            const Device = require('../../domain/entities/Device');

            for (const deviceData of devicesData) {
                // Data is already in CamelCase format from _mapFromDbFormat
                // No need to convert is_favorite/is_trusted again
                
                const device = Device.fromJSON(deviceData);
                this._devices.set(device.id, device);

                // Initialize runtime state for loaded devices
                if (!this._runtimeStates.has(device.id)) {
                    this._runtimeStates.set(device.id, new DeviceRuntimeState());
                }
            }

            console.log(`[DeviceRegistry] Loaded ${devicesData.length} devices from repository`);

            // Update device info from ADB for connected devices
            if (this._connectionService) {
                await this.updateConnectedDevicesInfo();
            }
        } catch (error) {
            console.error('[DeviceRegistry] Failed to load devices from repository:', error);
        }
    }

    /**
     * Update device info from ADB for connected devices
     * @returns {Promise<void>}
     */
    async updateConnectedDevicesInfo() {
        if (!this._connectionService) {
            console.warn('[DeviceRegistry] No connection service, skipping device info update');
            return;
        }

        try {
            // Get actually connected devices from ADB
            const adbDevices = await this._connectionService.discoverDevices();
            console.log(`[DeviceRegistry] Found ${adbDevices.length} connected devices from ADB`);

            for (const adbDevice of adbDevices) {
                const device = this._devices.get(adbDevice.serial);
                if (device) {
                    try {
                        const deviceInfo = await this._connectionService.getDeviceInfo(adbDevice.serial);
                        if (deviceInfo) {
                            device.updateDetails(deviceInfo.model, deviceInfo.version, deviceInfo.arch);
                            console.log(`[DeviceRegistry] Updated device ${device.id}: ${deviceInfo.model} (${deviceInfo.version})`);
                            
                            // Update repository with new info
                            if (this._deviceRepository) {
                                this._deviceRepository.updateDevice(device.id, device.toJSON());
                            }
                        }
                    } catch (err) {
                        console.warn(`[DeviceRegistry] Failed to update info for device ${device.id}:`, err.message);
                    }
                }
            }
        } catch (error) {
            console.error('[DeviceRegistry] Failed to update connected devices info:', error);
        }
    }

    /**
     * Get trusted devices
     * @returns {Array} Array of trusted devices
     */
    getTrustedDevices() {
        return this.getAllDevices().filter(device => device.isTrusted);
    }

    /**
     * Get favorite devices
     * @returns {Array} Array of favorite devices
     */
    getFavoriteDevices() {
        return this.getAllDevices().filter(device => device.isFavorite);
    }

    /**
     * Get connected devices (devices with runtime state and status === 'connected')
     * @returns {Array} Array of connected devices
     */
    getConnectedDevices() {
        const connectedIds = Array.from(this._runtimeStates.entries())
            .filter(([id, state]) => state.status === 'connected')
            .map(([id]) => id);
        return connectedIds.map(id => this._devices.get(id)).filter(Boolean);
    }

    /**
     * Get untrusted devices
     * @returns {Array} Array of untrusted devices
     */
    getUntrustedDevices() {
        return this.getAllDevices().filter(device => !device.isTrusted);
    }
}

module.exports =
    DeviceRegistry;