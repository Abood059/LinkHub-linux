const DeviceEventHandler = require('../../../../src/main/application/handlers/DeviceEventHandler');
const Device = require('../../../../src/main/domain/entities/Device');

// Mock dependencies
jest.mock('../../../../src/main/runtime/devices/DeviceRegistry');
jest.mock('../../../../src/main/infrastructure/sync/StateSyncService');

const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('DeviceEventHandler Security Tests', () => {
  let handler;
  let mockDeviceRegistry;
  let mockStateSyncService;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockDeviceRegistry = new DeviceRegistry();
    mockStateSyncService = new StateSyncService();

    mockDeviceRegistry.hasDevice = jest.fn().mockReturnValue(false);
    mockDeviceRegistry.registerDevice = jest.fn();
    mockDeviceRegistry.updateState = jest.fn();
    mockDeviceRegistry.removeDevice = jest.fn();
    mockDeviceRegistry.getAllDevices = jest.fn().mockReturnValue([]);
    mockDeviceRegistry.getRuntimeState = jest.fn();
    mockDeviceRegistry.findDeviceIdByAdbTarget = jest.fn().mockReturnValue(null);

    mockStateSyncService.onDeviceStateChanged = jest.fn();
    mockStateSyncService.onDeviceRemoved = jest.fn();
    mockStateSyncService.onDevicePaired = jest.fn();

    handler = new DeviceEventHandler({
      deviceRegistry: mockDeviceRegistry,
      stateSyncService: mockStateSyncService,
      logger: mockLogger
    });
  });

  describe('Malicious data injection in serial', () => {
    it('should handle SQL injection attempt in serial', () => {
      const devices = [
        { serial: "'; DROP TABLE devices; --", state: 'device' }
      ];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
      const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
      expect(registeredDevice.id).toBe("'; DROP TABLE devices; --");
    });

    it('should handle XSS attempt in serial', () => {
      const devices = [
        { serial: '<script>alert("xss")</script>', state: 'device' }
      ];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
      const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
      expect(registeredDevice.id).toBe('<script>alert("xss")</script>');
    });

    it('should handle path traversal attempt in serial', () => {
      const devices = [
        { serial: '../../../etc/passwd', state: 'device' }
      ];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
      const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
      expect(registeredDevice.id).toBe('../../../etc/passwd');
    });

    it('should handle null byte injection in serial', () => {
      const devices = [
        { serial: 'device\x00', state: 'device' }
      ];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });

    it('should handle extremely long serial', () => {
      const longSerial = 'a'.repeat(10000);
      const devices = [
        { serial: longSerial, state: 'device' }
      ];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });
  });

  describe('Malicious data injection in host/port', () => {
    it('should handle SQL injection in host', () => {
      const service = { host: "'; DROP TABLE devices; --", port: 5555 };

      handler._handleWirelessFound(service);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });

    it('should handle XSS in host', () => {
      const service = { host: '<script>alert("xss")</script>', port: 5555 };

      handler._handleWirelessFound(service);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });

    it('should handle malicious port value', () => {
      const service = { host: '192.168.1.10', port: 'DROP TABLE' };

      handler._handleWirelessFound(service);

      // The implementation accepts string ports and converts them to string in adbTarget
      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });

    it('should handle extremely long host', () => {
      const longHost = 'a'.repeat(10000);
      const service = { host: longHost, port: 5555 };

      handler._handleWirelessFound(service);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });
  });

  describe('DoS attacks via repeated events', () => {
    it('should handle rapid repeated events without crashing', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      for (let i = 0; i < 1000; i++) {
        handler._handleAdbDevices(devices);
      }

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1000);
    });

    it('should handle rapid wireless discovery events', () => {
      const service = { host: '192.168.1.10', port: 5555 };

      for (let i = 0; i < 1000; i++) {
        handler._handleWirelessFound(service);
      }

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1000);
    });

    it('should handle rapid connect success events', () => {
      const data = { target: '192.168.1.10:5555' };

      for (let i = 0; i < 1000; i++) {
        handler._handleConnectSuccess(data);
      }

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1000);
    });
  });

  describe('Memory exhaustion via many devices', () => {
    it('should handle large number of devices in single event', () => {
      const devices = [];
      for (let i = 0; i < 10000; i++) {
        devices.push({ serial: `device-${i}`, state: 'device' });
      }

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(10000);
    });

    it('should handle device list with many duplicate entries', () => {
      const devices = [];
      for (let i = 0; i < 1000; i++) {
        devices.push({ serial: 'device-1', state: 'device' });
      }

      mockDeviceRegistry.hasDevice.mockReturnValue(true);

      handler._handleAdbDevices(devices);

      // Should update existing device instead of creating new ones
      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledTimes(1000);
    });
  });

  describe('Protocol injection in target', () => {
    it('should handle protocol injection in connect target', () => {
      const data = { target: 'file:///etc/passwd' };

      handler._handleConnectSuccess(data);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });

    it('should handle javascript: protocol in target', () => {
      const data = { target: 'javascript:alert("xss")' };

      handler._handleConnectSuccess(data);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });

    it('should handle data: protocol in target', () => {
      const data = { target: 'data:text/html,<script>alert("xss")</script>' };

      handler._handleConnectSuccess(data);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });
  });

  describe('Command injection in pairing code', () => {
    it('should handle command injection in pairing code', () => {
      const data = { host: '192.168.1.10:37000', pairingCode: '; rm -rf /' };

      handler._handlePairSuccess(data);

      expect(mockStateSyncService.onDevicePaired).toHaveBeenCalledWith(data);
    });

    it('should handle pipe injection in pairing code', () => {
      const data = { host: '192.168.1.10:37000', pairingCode: '123456| cat /etc/passwd' };

      handler._handlePairSuccess(data);

      expect(mockStateSyncService.onDevicePaired).toHaveBeenCalledWith(data);
    });
  });

  describe('Null and undefined handling', () => {
    it('should handle null in device array', () => {
      const devices = [null, { serial: 'device-1', state: 'device' }, null];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined in device array', () => {
      const devices = [undefined, { serial: 'device-1', state: 'device' }, undefined];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1);
    });

    it('should handle object without serial in device array', () => {
      const devices = [{}, { serial: 'device-1', state: 'device' }, {}];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1);
    });
  });
});
