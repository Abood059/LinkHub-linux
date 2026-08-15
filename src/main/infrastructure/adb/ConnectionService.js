// src/main/infrastructure/adb/ConnectionService.js
'use strict';

const EventEmitter = require('events');
const { Bonjour } = require('bonjour-service');

class ConnectionService extends EventEmitter {
    constructor({ adbExecutor, logger = null }) {
        super();
        this._adbExecutor = adbExecutor;
        this._logger = logger;
        this._bonjour = new Bonjour();
        this._adbMonitor = null;
        this._browser = null;
    }

    async discoverDevices() {
        try {
            console.log('[ConnectionService] Discovering devices...');
            const devices = await this._adbExecutor.getDevices();
            console.log('[ConnectionService] Discovered devices:', devices);
            this.emit('devicesDiscovered', devices);
            return devices;
        } catch (error) {
            console.error('[ConnectionService] Error discovering devices:', error);
            this.emit('error', error);
            throw error;
        }
    }

    startAdbMonitoring(intervalMs = 1000) {
        if (this._adbMonitor) return;
        this._adbMonitor = setInterval(async () => {
            try {
                const devices = await this._adbExecutor.getDevices();
                this.emit('adbDevices', devices);
            } catch (error) {
                this.emit('error', error);
            }
        }, intervalMs);
    }

    stopAdbMonitoring() {
        if (!this._adbMonitor) return;
        clearInterval(this._adbMonitor);
        this._adbMonitor = null;
    }

    startWirelessDiscovery() {
        if (this._browser) return;
        this._browser = this._bonjour.find({ type: 'adb-tls-connect' }, (service) => {
            this.emit('wirelessServiceFound', {
                name: service.name,
                host: service.host,
                port: service.port,
                addresses: service.addresses
            });
        });
    }

    stopWirelessDiscovery() {
        if (!this._browser) return;
        this._browser.stop();
        this._browser = null;
    }

    /**
     * Pair with a device over TCP/IP using a pairing code.
     * @param {string} host - Host:port for pairing (e.g., "192.168.1.10:37000")
     * @param {string} pairingCode - 6-digit pairing code shown on device
     * @returns {Promise<string[]>}
     */
    async pair(host, pairingCode) {
        if (!host || !pairingCode) throw new Error('Host and pairing code are required');
        try {
            const result = await this._adbExecutor.pair(host, pairingCode);
            this.emit('pairSuccess', { host, pairingCode });
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Connect to a device over TCP/IP (already paired or using adb connect).
     * @param {string} target - Host:port (e.g., "192.168.1.10:5555")
     * @returns {Promise<string[]>}
     */
    async connect(target) {
        if (!target) throw new Error('Target is required');
        try {
            const result = await this._adbExecutor.connect(target);
            this.emit('connectSuccess', { target });
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Disconnect from a device or all devices.
     * @param {string|null} target - Optional host:port to disconnect, or null to disconnect all
     * @returns {Promise<string[]>}
     */
    async disconnect(target = null) {
        try {
            const result = await this._adbExecutor.disconnect(target);
            this.emit('disconnect', { target: target || 'all' });
            return result;
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Get detailed device information (model, version, arch) for a given target.
     * @param {string} target - Device serial or host:port
     * @returns {Promise<{serial: string, model: string, version: string, arch: string}>}
     */
    async getDeviceInfo(target) {
        if (!target) throw new Error('Target is required');
        return this._adbExecutor.getDeviceInfo(target);
    }

    dispose() {
        this.stopAdbMonitoring();
        this.stopWirelessDiscovery();
        this._bonjour.destroy();
    }
}

module.exports = ConnectionService;