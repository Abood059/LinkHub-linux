// tests/e2e/mocks/adbMock.js
'use strict';

const EventEmitter = require('events');

/**
 * Mock AdbCommandExecutor for testing
 * Simulates ADB operations without requiring real ADB installation
 */
class MockAdbExecutor {
    constructor() {
        this.devices = [
            { serial: 'emulator-5554', state: 'device' },
            { serial: '192.168.1.10:5555', state: 'device' }
        ];
        this.deviceInfo = {
            model: 'Pixel 6',
            version: '13',
            arch: 'arm64-v8a'
        };
        this.shouldFail = false;
        this.failMessage = 'ADB failed';
        this.connectionResults = new Map();
        this.pairResults = new Map();
    }

    /**
     * Get list of connected devices
     * @returns {Promise<Array>} Array of device objects with serial and state
     */
    async getDevices() {
        if (this.shouldFail) {
            throw new Error(this.failMessage);
        }
        return this.devices;
    }

    /**
     * Get detailed device information
     * @param {string} serial - Device serial or target
     * @returns {Promise<Object>} Device info with serial, model, version, arch
     */
    async getDeviceInfo(serial) {
        if (this.shouldFail) {
            throw new Error(this.failMessage);
        }
        return {
            serial,
            model: this.deviceInfo.model,
            version: this.deviceInfo.version,
            arch: this.deviceInfo.arch
        };
    }

    /**
     * Connect to a device over TCP/IP
     * @param {string} target - Host:port (e.g., "192.168.1.10:5555")
     * @returns {Promise<Array>} Connection result
     */
    async connect(target) {
        if (this.shouldFail) {
            throw new Error(this.failMessage);
        }
        const result = this.connectionResults.get(target) || ['connected'];
        return result;
    }

    /**
     * Pair with a device using pairing code
     * @param {string} host - Host:port for pairing (e.g., "192.168.1.10:37000")
     * @param {string} pairingCode - 6-digit pairing code
     * @returns {Promise<Array>} Pairing result
     */
    async pair(host, pairingCode) {
        if (this.shouldFail) {
            throw new Error(this.failMessage);
        }
        const key = `${host}:${pairingCode}`;
        const result = this.pairResults.get(key) || ['paired'];
        return result;
    }

    /**
     * Disconnect from a device or all devices
     * @param {string|null} target - Optional host:port to disconnect, or null for all
     * @returns {Promise<Array>} Disconnect result
     */
    async disconnect(target = null) {
        if (this.shouldFail) {
            throw new Error(this.failMessage);
        }
        if (target) {
            return ['disconnected', target];
        }
        return ['disconnected', 'all'];
    }

    /**
     * Set mock devices list
     * @param {Array} devices - Array of device objects
     */
    setMockDevices(devices) {
        this.devices = devices;
    }

    /**
     * Set mock device info template
     * @param {Object} info - Device info object
     */
    setMockDeviceInfo(info) {
        this.deviceInfo = { ...this.deviceInfo, ...info };
    }

    /**
     * Set custom connection result for a target
     * @param {string} target - Host:port
     * @param {Array} result - Custom result
     */
    setConnectionResult(target, result) {
        this.connectionResults.set(target, result);
    }

    /**
     * Set custom pair result for a host and code
     * @param {string} host - Host:port
     * @param {string} pairingCode - Pairing code
     * @param {Array} result - Custom result
     */
    setPairResult(host, pairingCode, result) {
        const key = `${host}:${pairingCode}`;
        this.pairResults.set(key, result);
    }

    /**
     * Enable or disable failure mode
     * @param {boolean} shouldFail - Whether operations should fail
     * @param {string} message - Error message
     */
    setShouldFail(shouldFail, message = 'ADB failed') {
        this.shouldFail = shouldFail;
        this.failMessage = message;
    }

    /**
     * Reset mock to default state
     */
    reset() {
        this.devices = [
            { serial: 'emulator-5554', state: 'device' },
            { serial: '192.168.1.10:5555', state: 'device' }
        ];
        this.deviceInfo = {
            model: 'Pixel 6',
            version: '13',
            arch: 'arm64-v8a'
        };
        this.shouldFail = false;
        this.failMessage = 'ADB failed';
        this.connectionResults.clear();
        this.pairResults.clear();
    }
}

/**
 * Mock ConnectionService for testing
 * Simulates ConnectionService events and operations
 */
class MockConnectionService extends EventEmitter {
    constructor(mockExecutor) {
        super();
        this._executor = mockExecutor;
        this._adbMonitor = null;
        this._monitorInterval = 5000;
    }

    /**
     * Discover devices and emit event
     * @returns {Promise<Array>} Discovered devices
     */
    async discoverDevices() {
        try {
            const devices = await this._executor.getDevices();
            this.emit('devicesDiscovered', devices);
            return devices;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Start ADB monitoring with simulated interval
     * @param {number} intervalMs - Monitoring interval in milliseconds
     */
    startAdbMonitoring(intervalMs = 5000) {
        if (this._adbMonitor) return;
        this._monitorInterval = intervalMs;
        this._adbMonitor = setInterval(async () => {
            try {
                const devices = await this._executor.getDevices();
                this.emit('adbDevices', devices);
            } catch (error) {
                this.emit('error', error);
            }
        }, intervalMs);
    }

    /**
     * Stop ADB monitoring
     */
    stopAdbMonitoring() {
        if (!this._adbMonitor) return;
        clearInterval(this._adbMonitor);
        this._adbMonitor = null;
    }

    /**
     * Simulate device discovery event
     * @param {Array} devices - Devices to emit
     */
    simulateDeviceDiscovery(devices) {
        this.emit('devicesDiscovered', devices);
    }

    /**
     * Simulate ADB devices event
     * @param {Array} devices - Devices to emit
     */
    simulateAdbDevices(devices) {
        this.emit('adbDevices', devices);
    }

    /**
     * Simulate wireless service found event
     * @param {Object} service - Service object
     */
    simulateWirelessServiceFound(service) {
        this.emit('wirelessServiceFound', service);
    }

    /**
     * Start wireless discovery (no-op in mock)
     */
    startWirelessDiscovery() {
        // No-op in mock
    }

    /**
     * Stop wireless discovery (no-op in mock)
     */
    stopWirelessDiscovery() {
        // No-op in mock
    }

    /**
     * Pair with a device
     * @param {string} host - Host:port
     * @param {string} pairingCode - Pairing code
     * @returns {Promise<Array>} Pairing result
     */
    async pair(host, pairingCode) {
        if (!host || !pairingCode) throw new Error('Host and pairing code are required');
        try {
            const result = await this._executor.pair(host, pairingCode);
            this.emit('pairSuccess', { host, pairingCode });
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Simulate pair success event
     * @param {string} host - Host:port
     * @param {string} pairingCode - Pairing code
     */
    simulatePairSuccess(host, pairingCode) {
        this.emit('pairSuccess', { host, pairingCode });
    }

    /**
     * Connect to a device
     * @param {string} target - Host:port
     * @returns {Promise<Array>} Connection result
     */
    async connect(target) {
        if (!target) throw new Error('Target is required');
        try {
            const result = await this._executor.connect(target);
            this.emit('connectSuccess', { target });
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Simulate connect success event
     * @param {string} target - Host:port
     */
    simulateConnectSuccess(target) {
        this.emit('connectSuccess', { target });
    }

    /**
     * Disconnect from a device
     * @param {string|null} target - Optional host:port
     * @returns {Promise<Array>} Disconnect result
     */
    async disconnect(target = null) {
        try {
            const result = await this._executor.disconnect(target);
            this.emit('disconnect', { target: target || 'all' });
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Simulate disconnect event
     * @param {string|null} target - Optional host:port
     */
    simulateDisconnect(target = null) {
        this.emit('disconnect', { target: target || 'all' });
    }

    /**
     * Get device info
     * @param {string} target - Device serial or host:port
     * @returns {Promise<Object>} Device info
     */
    async getDeviceInfo(target) {
        if (!target) throw new Error('Target is required');
        return this._executor.getDeviceInfo(target);
    }

    /**
     * Dispose and cleanup resources
     */
    dispose() {
        this.stopAdbMonitoring();
        this.stopWirelessDiscovery();
        this.removeAllListeners();
    }

    /**
     * Get the underlying mock executor
     * @returns {MockAdbExecutor} Mock executor
     */
    getExecutor() {
        return this._executor;
    }
}

module.exports = {
    MockAdbExecutor,
    MockConnectionService
};
