const DeviceRuntimeState = require('../../../src/main/runtime/devices/DeviceRuntimeState');

describe('DeviceRuntimeState', () => {
  let runtimeState;

  beforeEach(() => {
    runtimeState = new DeviceRuntimeState();
  });

  describe('constructor with defaults', () => {
    it('should create DeviceRuntimeState with default values', () => {
      expect(runtimeState.status).toBe('offline');
      expect(runtimeState.ip).toBeNull();
      expect(runtimeState.port).toBeNull();
      expect(runtimeState.connectionType).toBeNull();
      expect(runtimeState.adbTarget).toBeNull();
      expect(runtimeState.lastSeen).toBeNull();
    });
  });

  describe('constructor with custom values', () => {
    it('should create DeviceRuntimeState with custom values', () => {
      const customState = new DeviceRuntimeState({
        status: 'online',
        ip: '192.168.1.10',
        port: 5555,
        connectionType: 'wifi',
        adbTarget: '192.168.1.10:5555',
        lastSeen: new Date('2024-01-01T00:00:00Z')
      });
      expect(customState.status).toBe('online');
      expect(customState.ip).toBe('192.168.1.10');
      expect(customState.port).toBe(5555);
      expect(customState.connectionType).toBe('wifi');
      expect(customState.adbTarget).toBe('192.168.1.10:5555');
      expect(customState.lastSeen).toEqual(new Date('2024-01-01T00:00:00Z'));
    });
  });

  describe('update', () => {
    it('should update all properties with partial state', () => {
      runtimeState.update({
        status: 'online',
        ip: '192.168.1.20',
        port: 5556,
        connectionType: 'usb',
        adbTarget: 'emulator-5554'
      });
      expect(runtimeState.status).toBe('online');
      expect(runtimeState.ip).toBe('192.168.1.20');
      expect(runtimeState.port).toBe(5556);
      expect(runtimeState.connectionType).toBe('usb');
      expect(runtimeState.adbTarget).toBe('emulator-5554');
    });

    it('should update only provided properties', () => {
      runtimeState.update({ status: 'online' });
      expect(runtimeState.status).toBe('online');
      expect(runtimeState.ip).toBeNull();
      expect(runtimeState.port).toBeNull();
    });

    it('should handle empty object', () => {
      runtimeState.update({});
      expect(runtimeState.status).toBe('offline');
      expect(runtimeState.ip).toBeNull();
    });

    it('should handle null', () => {
      runtimeState.update(null);
      expect(runtimeState.status).toBe('offline');
    });

    it('should handle undefined', () => {
      runtimeState.update(undefined);
      expect(runtimeState.status).toBe('offline');
    });

    it('should update lastSeen with Date object', () => {
      const testDate = new Date('2024-01-15T12:00:00Z');
      runtimeState.update({ lastSeen: testDate });
      expect(runtimeState.lastSeen).toEqual(testDate);
    });

    it('should allow updating to null values', () => {
      const customState = new DeviceRuntimeState({
        status: 'online',
        ip: '192.168.1.10'
      });
      customState.update({
        status: 'offline',
        ip: null
      });
      expect(customState.status).toBe('offline');
      expect(customState.ip).toBeNull();
    });
  });

  describe('toJSON', () => {
    it('should return object with all properties', () => {
      const json = runtimeState.toJSON();
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('ip');
      expect(json).toHaveProperty('port');
      expect(json).toHaveProperty('connectionType');
      expect(json).toHaveProperty('adbTarget');
      expect(json).toHaveProperty('lastSeen');
    });

    it('should return correct values for default state', () => {
      const json = runtimeState.toJSON();
      expect(json).toEqual({
        status: 'offline',
        ip: null,
        port: null,
        connectionType: null,
        adbTarget: null,
        lastSeen: null
      });
    });

    it('should return correct values after update', () => {
      runtimeState.update({
        status: 'online',
        ip: '192.168.1.10',
        port: 5555,
        connectionType: 'wifi',
        adbTarget: '192.168.1.10:5555',
        lastSeen: new Date('2024-01-01T00:00:00Z')
      });
      const json = runtimeState.toJSON();
      expect(json.status).toBe('online');
      expect(json.ip).toBe('192.168.1.10');
      expect(json.port).toBe(5555);
      expect(json.connectionType).toBe('wifi');
      expect(json.adbTarget).toBe('192.168.1.10:5555');
      expect(json.lastSeen).toEqual(new Date('2024-01-01T00:00:00Z'));
    });
  });
});
