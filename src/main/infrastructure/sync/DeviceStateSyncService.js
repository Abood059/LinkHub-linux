// src/main/infrastructure/sync/DeviceStateSyncService.js
'use strict';

/**
 * DeviceStateSyncService
 * 
 * Service for aggregating device state and sending it to the UI separately
 * Reduces IPC pressure by aggregating changes and sending them periodically
 */
class DeviceStateSyncService {
    constructor(windowManager, deviceRegistry, options = {}) {
        if (!windowManager) {
            throw new Error('WindowManager is required for DeviceStateSyncService');
        }
        if (!deviceRegistry) {
            throw new Error('DeviceRegistry is required for DeviceStateSyncService');
        }

        this._windowManager = windowManager;
        this._deviceRegistry = deviceRegistry;
        this._interval = options.interval || 1000; // 1 second default
        this._timer = null;
        this._isRunning = false;

        // Aggregated state
        this._state = {
            devices: [],
            timestamp: Date.now()
        };

        // Previous state for comparison (to emit separate events)
        this._previousState = {
            devices: new Map() // deviceId -> deviceData
        };

        // Dirty flag to indicate changes exist
        this._hasChanges = false;
    }

    /**
     * Start the service
     */
    start() {
        if (this._isRunning) return;

        this._isRunning = true;

        // Load initial state and send immediately
        this._loadInitialDeviceState();
        this._broadcastState();

        // Start periodic timer for sending
        this._timer = setInterval(() => {
            this._broadcastState();
        }, this._interval);
    }

    /**
     * Stop the service
     */
    stop() {
        if (!this._isRunning) return;

        this._isRunning = false;
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }


    /**
     * Get current state
     */
    getState() {
        return {
            devices: this._state.devices,
            timestamp: this._state.timestamp
        };
    }

    // ============================================================================
    // Device updates
    // ============================================================================

    onDeviceStateChanged(data) {
        // Update state from DeviceRegistry with change detection
        this._loadDeviceState();
        // Sending is done periodically via setInterval
    }

    onDevicePaired(data) {
        // Update state from DeviceRegistry with change detection
        this._loadDeviceState();
        // Sending is done periodically via setInterval
    }

    onDeviceRemoved(data) {
        // Update state from DeviceRegistry with change detection
        this._loadDeviceState();
        // Sending is done periodically via setInterval
    }

    // ============================================================================
    // Internal methods
    // ============================================================================

    /**
     * Load initial device state from DeviceRegistry
     */
    _loadInitialDeviceState() {
        this._loadDeviceState();
        this._hasChanges = true;
    }

    /**
     * Load device state from DeviceRegistry with change detection
     */
    _loadDeviceState() {
        const devices = this._deviceRegistry.getAllDevices();
        const newDevices = devices.map(device => {
            const runtimeState = this._deviceRegistry.getRuntimeState(device.id);
            return {
                device: device.toJSON(),
                runtimeState: runtimeState ? runtimeState.toJSON() : {},
                isPersistent: device.isFavorite // isPersistent indicates if device is saved in database
            };
        });

        // Check if changes exist
        if (this._hasStateChanged(newDevices)) {
            this._state.devices = newDevices;
            this._hasChanges = true;
        }
    }

    /**
     * Check if device state has changed
     */
    _hasStateChanged(newDevices) {
        // If count is different, there is a change
        if (newDevices.length !== this._state.devices.length) {
            return true;
        }

        // Compare each device
        for (let i = 0; i < newDevices.length; i++) {
            const newDevice = newDevices[i];
            const oldDevice = this._state.devices[i];

            // Check device ID
            if (newDevice.device.id !== oldDevice.device.id) {
                return true;
            }

            // Check favorite status (isFavorite)
            if (newDevice.device.isFavorite !== oldDevice.device.isFavorite) {
                return true;
            }

            // Check runtime state
            const newRuntime = newDevice.runtimeState || {};
            const oldRuntime = oldDevice.runtimeState || {};

            if (newRuntime.status !== oldRuntime.status ||
                newRuntime.adbTarget !== oldRuntime.adbTarget) {
                return true;
            }
        }

        return false;
    }

    /**
     * Send state to UI
     */
    _broadcastState() {
        if (!this._hasChanges) return;

        const currentState = this.getState();
        
        // Send aggregated state
        this._windowManager.broadcast('device:state:update', currentState);
        
        // Compare and emit separate events
        this._diffAndEmitDevices(currentState.devices);
        
        this._hasChanges = false;
        this._state.timestamp = Date.now();
        
        // Update previous state
        this._updatePreviousState(currentState);
    }

    // ============================================================================
    // Diffing methods to emit separate events
    // ============================================================================

    /**
     * Compare device state and emit separate events
     */
    _diffAndEmitDevices(currentDevices) {
        const currentMap = new Map();
        currentDevices.forEach(d => currentMap.set(d.device.id, d));

        // New devices
        for (const [id, deviceData] of currentMap) {
            if (!this._previousState.devices.has(id)) {
                this._windowManager.broadcast('device:added', deviceData);
            }
        }

        // Removed devices
        for (const id of this._previousState.devices.keys()) {
            if (!currentMap.has(id)) {
                this._windowManager.broadcast('device:removed', { deviceId: id });
            }
        }

        // Devices with changed state
        for (const [id, deviceData] of currentMap) {
            const prev = this._previousState.devices.get(id);
            if (prev && this._deviceStateChanged(prev, deviceData)) {
                this._windowManager.broadcast('device:stateChanged', deviceData);
            }
        }
    }

    /**
     * Check if device state has changed
     */
    _deviceStateChanged(prev, current) {
        const prevRuntime = prev.runtimeState || {};
        const currRuntime = current.runtimeState || {};
        
        return prevRuntime.status !== currRuntime.status ||
               prevRuntime.adbTarget !== currRuntime.adbTarget ||
               prev.device.isFavorite !== current.device.isFavorite;
    }

    /**
     * تحديث الحالة السابقة
     */
    _updatePreviousState(currentState) {
        this._previousState.devices.clear();
        currentState.devices.forEach(d => {
            this._previousState.devices.set(d.device.id, JSON.parse(JSON.stringify(d)));
        });
    }
}

module.exports = DeviceStateSyncService;
