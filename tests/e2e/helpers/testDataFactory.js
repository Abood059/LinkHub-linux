// tests/e2e/helpers/testDataFactory.js
'use strict';

const Device = require('../../../src/main/domain/entities/Device');

/**
 * Create a mock Device entity with default values
 * @param {Object} overrides - Properties to override
 * @returns {Device} Mock device entity
 */
function createMockDevice(overrides = {}) {
    return new Device({
        id: overrides.id || `device-${Date.now()}`,
        deviceFriendlyName: overrides.deviceFriendlyName || 'Test Device',
        model: overrides.model || 'Pixel 6',
        version: overrides.version || '13',
        arch: overrides.arch || 'arm64-v8a',
        isNew: overrides.isNew ?? false,
        ...overrides
    });
}

/**
 * Create a mock device runtime state
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock runtime state
 */
function createMockRuntimeState(overrides = {}) {
    return {
        status: overrides.status || 'connected',
        adbTarget: overrides.adbTarget || 'emulator-5554',
        connectionType: overrides.connectionType || 'USB',
        ip: overrides.ip || null,
        port: overrides.port || null,
        lastSeen: overrides.lastSeen || new Date(),
        ...overrides
    };
}

/**
 * Create a mock download state object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock download state
 */
function createMockDownload(overrides = {}) {
    return {
        downloadId: overrides.downloadId || `dl-${Date.now()}`,
        url: overrides.url || 'https://example.com/video.mp4',
        status: overrides.status || 'downloading',
        percent: overrides.percent || 0,
        deviceId: overrides.deviceId || 'device-1',
        outputPath: overrides.outputPath || null,
        error: overrides.error || null,
        ...overrides
    };
}

/**
 * Create a list of mock devices
 * @param {number} count - Number of devices to create
 * @param {Object} overrides - Properties to override for each device
 * @returns {Array<Device>} Array of mock device entities
 */
function createMockDeviceList(count = 5, overrides = {}) {
    const devices = [];
    for (let i = 0; i < count; i++) {
        devices.push(createMockDevice({
            id: `device-${i}`,
            deviceFriendlyName: `Device ${i}`,
            ...overrides
        }));
    }
    return devices;
}

/**
 * Create a mock ADB device list (raw format from ADB)
 * @param {number} count - Number of devices to create
 * @param {Object} overrides - Properties to override
 * @returns {Array<Object>} Array of mock ADB device objects
 */
function createMockAdbDeviceList(count = 3, overrides = {}) {
    const devices = [];
    for (let i = 0; i < count; i++) {
        devices.push({
            serial: overrides.serial || `emulator-555${i}`,
            state: overrides.state || 'device',
            ...overrides
        });
    }
    return devices;
}

/**
 * Create a mock wireless service object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock wireless service
 */
function createMockWirelessService(overrides = {}) {
    return {
        name: overrides.name || 'adb-tls-connect',
        host: overrides.host || '192.168.1.10',
        port: overrides.port || 5555,
        addresses: overrides.addresses || ['192.168.1.10'],
        ...overrides
    };
}

/**
 * Create a mock device info object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock device info
 */
function createMockDeviceInfo(overrides = {}) {
    return {
        serial: overrides.serial || 'emulator-5554',
        model: overrides.model || 'Pixel 6',
        version: overrides.version || '13',
        arch: overrides.arch || 'arm64-v8a',
        ...overrides
    };
}

/**
 * Create a mock process object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock process
 */
function createMockProcess(overrides = {}) {
    return {
        pid: overrides.pid || 1000,
        id: overrides.id || 'process-1',
        type: overrides.type || 'scrcpy',
        status: overrides.status || 'running',
        startTime: overrides.startTime || new Date(),
        ...overrides
    };
}

module.exports = {
    createMockDevice,
    createMockRuntimeState,
    createMockDownload,
    createMockDeviceList,
    createMockAdbDeviceList,
    createMockWirelessService,
    createMockDeviceInfo,
    createMockProcess
};
