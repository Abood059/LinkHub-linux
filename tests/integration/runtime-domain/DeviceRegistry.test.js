const Device = require('../../../src/main/domain/entities/Device');
const DeviceRuntimeState = require('../../../src/main/runtime/devices/DeviceRuntimeState');
const DeviceRegistry = require('../../../src/main/runtime/devices/DeviceRegistry');

describe('DeviceRegistry (Integration with Domain)', () => {
  let deviceRegistry;
  let device;

  beforeEach(() => {
    deviceRegistry = new DeviceRegistry();
    device = new Device({
      id: 'test-device-id',
      deviceFriendlyName: 'Test Device',
      model: 'Pixel 6',
      version: '13',
      arch: 'arm64',
      isNew: true
    });
  });

  describe('registerDevice', () => {
    it('should register device and make it retrievable', () => {
      deviceRegistry.registerDevice(device);
      const retrievedDevice = deviceRegistry.getDevice('test-device-id');
      expect(retrievedDevice).toBe(device);
      expect(retrievedDevice.id).toBe('test-device-id');
      expect(retrievedDevice.deviceFriendlyName).toBe('Test Device');
    });

    it('should create default DeviceRuntimeState for registered device', () => {
      deviceRegistry.registerDevice(device);
      const runtimeState = deviceRegistry.getRuntimeState('test-device-id');
      expect(runtimeState).toBeInstanceOf(DeviceRuntimeState);
      expect(runtimeState.status).toBe('offline');
      expect(runtimeState.ip).toBeNull();
      expect(runtimeState.port).toBeNull();
    });

    it('should not create new runtime state if one already exists', () => {
      deviceRegistry.registerDevice(device);
      const firstRuntimeState = deviceRegistry.getRuntimeState('test-device-id');
      deviceRegistry.registerDevice(device);
      const secondRuntimeState = deviceRegistry.getRuntimeState('test-device-id');
      expect(firstRuntimeState).toBe(secondRuntimeState);
    });

    it('should throw error if device is null', () => {
      expect(() => deviceRegistry.registerDevice(null)).toThrow('Device must contain a valid id');
    });

    it('should throw error if device has no id', () => {
      const deviceWithoutId = new Device({
        deviceFriendlyName: 'Test'
      });
      expect(() => deviceRegistry.registerDevice(deviceWithoutId)).toThrow('Device must contain a valid id');
    });

    it('should return the registered device', () => {
      const result = deviceRegistry.registerDevice(device);
      expect(result).toBe(device);
    });

    it('should allow registering multiple devices', () => {
      const device2 = new Device({
        id: 'test-device-id-2',
        deviceFriendlyName: 'Test Device 2',
        model: 'Pixel 7',
        version: '14',
        arch: 'arm64-v8a'
      });
      deviceRegistry.registerDevice(device);
      deviceRegistry.registerDevice(device2);
      expect(deviceRegistry.getAllDevices()).toHaveLength(2);
      expect(deviceRegistry.getAllRuntimeStates()).toHaveLength(2);
    });
  });

  describe('removeDevice', () => {
    it('should remove device from registry', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.removeDevice('test-device-id');
      expect(deviceRegistry.getDevice('test-device-id')).toBeNull();
    });

    it('should remove runtime state from registry', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.removeDevice('test-device-id');
      expect(deviceRegistry.getRuntimeState('test-device-id')).toBeNull();
    });

    it('should not affect other devices when removing one', () => {
      const device2 = new Device({
        id: 'test-device-id-2',
        deviceFriendlyName: 'Test Device 2'
      });
      deviceRegistry.registerDevice(device);
      deviceRegistry.registerDevice(device2);
      deviceRegistry.removeDevice('test-device-id');
      expect(deviceRegistry.getDevice('test-device-id')).toBeNull();
      expect(deviceRegistry.getDevice('test-device-id-2')).not.toBeNull();
      expect(deviceRegistry.getRuntimeState('test-device-id')).toBeNull();
      expect(deviceRegistry.getRuntimeState('test-device-id-2')).not.toBeNull();
    });

    it('should handle removing non-existent device gracefully', () => {
      expect(() => deviceRegistry.removeDevice('non-existent')).not.toThrow();
    });
  });

  describe('updateState', () => {
    it('should update existing runtime state', () => {
      deviceRegistry.registerDevice(device);
      const updatedState = deviceRegistry.updateState('test-device-id', {
        status: 'online',
        ip: '192.168.1.10',
        port: 5555,
        connectionType: 'wifi',
        adbTarget: '192.168.1.10:5555'
      });
      expect(updatedState.status).toBe('online');
      expect(updatedState.ip).toBe('192.168.1.10');
      expect(updatedState.port).toBe(5555);
      expect(updatedState.connectionType).toBe('wifi');
      expect(updatedState.adbTarget).toBe('192.168.1.10:5555');
    });

    it('should create new runtime state if device does not exist', () => {
      const updatedState = deviceRegistry.updateState('test-device-id', {
        status: 'online',
        ip: '192.168.1.10'
      });
      expect(updatedState).toBeInstanceOf(DeviceRuntimeState);
      expect(updatedState.status).toBe('online');
      expect(updatedState.ip).toBe('192.168.1.10');
      expect(deviceRegistry.getRuntimeState('test-device-id')).toBe(updatedState);
    });

    it('should auto-update lastSeen to current Date if not provided', () => {
      deviceRegistry.registerDevice(device);
      const beforeUpdate = new Date();
      const updatedState = deviceRegistry.updateState('test-device-id', {
        status: 'online'
      });
      const afterUpdate = new Date();
      expect(updatedState.lastSeen).not.toBeNull();
      expect(updatedState.lastSeen.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(updatedState.lastSeen.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });

    it('should use provided lastSeen if given', () => {
      deviceRegistry.registerDevice(device);
      const testDate = new Date('2024-01-01T00:00:00Z');
      const updatedState = deviceRegistry.updateState('test-device-id', {
        status: 'online',
        lastSeen: testDate
      });
      expect(updatedState.lastSeen).toEqual(testDate);
    });

    it('should allow partial updates', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.updateState('test-device-id', { status: 'online' });
      deviceRegistry.updateState('test-device-id', { ip: '192.168.1.10' });
      const state = deviceRegistry.getRuntimeState('test-device-id');
      expect(state.status).toBe('online');
      expect(state.ip).toBe('192.168.1.10');
      expect(state.port).toBeNull();
    });

    it('should return the updated runtime state', () => {
      deviceRegistry.registerDevice(device);
      const updatedState = deviceRegistry.updateState('test-device-id', { status: 'online' });
      expect(updatedState).toBeInstanceOf(DeviceRuntimeState);
    });

    it('should handle null state gracefully', () => {
      deviceRegistry.registerDevice(device);
      expect(() => deviceRegistry.updateState('test-device-id', null)).not.toThrow();
    });

    it('should handle undefined state gracefully', () => {
      deviceRegistry.registerDevice(device);
      expect(() => deviceRegistry.updateState('test-device-id', undefined)).not.toThrow();
    });

    it('should handle non-object state gracefully', () => {
      deviceRegistry.registerDevice(device);
      expect(() => deviceRegistry.updateState('test-device-id', 'invalid')).not.toThrow();
      expect(() => deviceRegistry.updateState('test-device-id', 123)).not.toThrow();
      expect(() => deviceRegistry.updateState('test-device-id', [])).not.toThrow();
    });

    it('should not add unknown fields to runtime state', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.updateState('test-device-id', {
        status: 'online',
        extraField: 'should not appear',
        anotherField: 999
      });
      const state = deviceRegistry.getRuntimeState('test-device-id');
      expect(state).not.toHaveProperty('extraField');
      expect(state).not.toHaveProperty('anotherField');
    });
  });

  describe('getDevice', () => {
    it('should return registered device', () => {
      deviceRegistry.registerDevice(device);
      const retrieved = deviceRegistry.getDevice('test-device-id');
      expect(retrieved).toBe(device);
    });

    it('should return null if device does not exist', () => {
      const retrieved = deviceRegistry.getDevice('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('getRuntimeState', () => {
    it('should return runtime state for registered device', () => {
      deviceRegistry.registerDevice(device);
      const state = deviceRegistry.getRuntimeState('test-device-id');
      expect(state).toBeInstanceOf(DeviceRuntimeState);
    });

    it('should return null if device does not exist', () => {
      const state = deviceRegistry.getRuntimeState('non-existent');
      expect(state).toBeNull();
    });

    it('should return updated state after updateState', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.updateState('test-device-id', { status: 'online' });
      const state = deviceRegistry.getRuntimeState('test-device-id');
      expect(state.status).toBe('online');
    });
  });

  describe('getAllDevices', () => {
    it('should return empty array when no devices registered', () => {
      const devices = deviceRegistry.getAllDevices();
      expect(devices).toEqual([]);
      expect(Array.isArray(devices)).toBe(true);
    });

    it('should return array of all registered devices', () => {
      const device2 = new Device({
        id: 'test-device-id-2',
        deviceFriendlyName: 'Test Device 2'
      });
      deviceRegistry.registerDevice(device);
      deviceRegistry.registerDevice(device2);
      const devices = deviceRegistry.getAllDevices();
      expect(devices).toHaveLength(2);
      expect(devices).toContain(device);
      expect(devices).toContain(device2);
    });
  });

  describe('getAllRuntimeStates', () => {
    it('should return empty array when no devices registered', () => {
      const states = deviceRegistry.getAllRuntimeStates();
      expect(states).toEqual([]);
      expect(Array.isArray(states)).toBe(true);
    });

    it('should return array of all runtime states', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.updateState('test-device-id', { status: 'online' });
      const states = deviceRegistry.getAllRuntimeStates();
      expect(states).toHaveLength(1);
      expect(states[0]).toBeInstanceOf(DeviceRuntimeState);
      expect(states[0].status).toBe('online');
    });

    it('should return states for all registered devices', () => {
      const device2 = new Device({
        id: 'test-device-id-2',
        deviceFriendlyName: 'Test Device 2'
      });
      deviceRegistry.registerDevice(device);
      deviceRegistry.registerDevice(device2);
      deviceRegistry.updateState('test-device-id', { status: 'online' });
      deviceRegistry.updateState('test-device-id-2', { status: 'offline' });
      const states = deviceRegistry.getAllRuntimeStates();
      expect(states).toHaveLength(2);
    });
  });

  describe('hasDevice', () => {
    it('should return true for registered device', () => {
      deviceRegistry.registerDevice(device);
      expect(deviceRegistry.hasDevice('test-device-id')).toBe(true);
    });

    it('should return false for non-existent device', () => {
      expect(deviceRegistry.hasDevice('non-existent')).toBe(false);
    });

    it('should return false after device is removed', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.removeDevice('test-device-id');
      expect(deviceRegistry.hasDevice('test-device-id')).toBe(false);
    });
  });

  describe('findDeviceIdByAdbTarget', () => {
    it('should return device ID if adbTarget matches', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.updateState('test-device-id', { adbTarget: '192.168.1.10:5555' });
      const foundId = deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555');
      expect(foundId).toBe('test-device-id');
    });

    it('should return null if adbTarget not found', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.updateState('test-device-id', { adbTarget: '192.168.1.10:5555' });
      const foundId = deviceRegistry.findDeviceIdByAdbTarget('192.168.1.20:5555');
      expect(foundId).toBeNull();
    });

    it('should return null if no devices registered', () => {
      const foundId = deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555');
      expect(foundId).toBeNull();
    });

    it('should return null if adbTarget is null or undefined', () => {
      expect(deviceRegistry.findDeviceIdByAdbTarget(null)).toBeNull();
      expect(deviceRegistry.findDeviceIdByAdbTarget(undefined)).toBeNull();
    });

    it('should find device among multiple devices', () => {
      const device2 = new Device({
        id: 'test-device-id-2',
        deviceFriendlyName: 'Test Device 2'
      });
      deviceRegistry.registerDevice(device);
      deviceRegistry.registerDevice(device2);
      deviceRegistry.updateState('test-device-id', { adbTarget: '192.168.1.10:5555' });
      deviceRegistry.updateState('test-device-id-2', { adbTarget: 'emulator-5554' });
      
      expect(deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555')).toBe('test-device-id');
      expect(deviceRegistry.findDeviceIdByAdbTarget('emulator-5554')).toBe('test-device-id-2');
    });

    it('should handle emulator serial format', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.updateState('test-device-id', { adbTarget: 'emulator-5554' });
      const foundId = deviceRegistry.findDeviceIdByAdbTarget('emulator-5554');
      expect(foundId).toBe('test-device-id');
    });
  });

  describe('clear', () => {
    it('should clear all devices', () => {
      const device2 = new Device({
        id: 'test-device-id-2',
        deviceFriendlyName: 'Test Device 2'
      });
      deviceRegistry.registerDevice(device);
      deviceRegistry.registerDevice(device2);
      deviceRegistry.clear();
      expect(deviceRegistry.getAllDevices()).toHaveLength(0);
      expect(deviceRegistry.getAllRuntimeStates()).toHaveLength(0);
    });

    it('should clear all runtime states', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.updateState('test-device-id', { status: 'online' });
      deviceRegistry.clear();
      expect(deviceRegistry.getRuntimeState('test-device-id')).toBeNull();
    });

    it('should reset hasDevice to false for all devices', () => {
      deviceRegistry.registerDevice(device);
      deviceRegistry.clear();
      expect(deviceRegistry.hasDevice('test-device-id')).toBe(false);
    });

    it('should handle clearing empty registry', () => {
      expect(() => deviceRegistry.clear()).not.toThrow();
      expect(deviceRegistry.getAllDevices()).toHaveLength(0);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full lifecycle: register, update, find, remove', () => {
      // Register
      deviceRegistry.registerDevice(device);
      expect(deviceRegistry.hasDevice('test-device-id')).toBe(true);

      // Update state
      deviceRegistry.updateState('test-device-id', {
        status: 'online',
        ip: '192.168.1.10',
        port: 5555,
        connectionType: 'wifi',
        adbTarget: '192.168.1.10:5555'
      });

      // Find by adbTarget
      const foundId = deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555');
      expect(foundId).toBe('test-device-id');

      // Get updated state
      const state = deviceRegistry.getRuntimeState('test-device-id');
      expect(state.status).toBe('online');
      expect(state.lastSeen).not.toBeNull();

      // Remove
      deviceRegistry.removeDevice('test-device-id');
      expect(deviceRegistry.hasDevice('test-device-id')).toBe(false);
      expect(deviceRegistry.getRuntimeState('test-device-id')).toBeNull();
    });

    it('should handle multiple devices with independent states', () => {
      const device2 = new Device({
        id: 'test-device-id-2',
        deviceFriendlyName: 'Test Device 2'
      });
      const device3 = new Device({
        id: 'test-device-id-3',
        deviceFriendlyName: 'Test Device 3'
      });

      deviceRegistry.registerDevice(device);
      deviceRegistry.registerDevice(device2);
      deviceRegistry.registerDevice(device3);

      deviceRegistry.updateState('test-device-id', { status: 'online', adbTarget: '192.168.1.10:5555' });
      deviceRegistry.updateState('test-device-id-2', { status: 'offline', adbTarget: 'emulator-5554' });
      deviceRegistry.updateState('test-device-id-3', { status: 'online', adbTarget: '192.168.1.20:5555' });

      expect(deviceRegistry.getAllDevices()).toHaveLength(3);
      expect(deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555')).toBe('test-device-id');
      expect(deviceRegistry.findDeviceIdByAdbTarget('emulator-5554')).toBe('test-device-id-2');
      expect(deviceRegistry.findDeviceIdByAdbTarget('192.168.1.20:5555')).toBe('test-device-id-3');

      deviceRegistry.removeDevice('test-device-id-2');
      expect(deviceRegistry.getAllDevices()).toHaveLength(2);
      expect(deviceRegistry.findDeviceIdByAdbTarget('emulator-5554')).toBeNull();
    });
  });
});
