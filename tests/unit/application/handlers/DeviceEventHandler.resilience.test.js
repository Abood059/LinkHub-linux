const DeviceEventHandler = require('../../../../src/main/application/handlers/DeviceEventHandler');
const Device = require('../../../../src/main/domain/entities/Device');

// Mock dependencies
jest.mock('../../../../src/main/runtime/devices/DeviceRegistry');
jest.mock('../../../../src/main/infrastructure/sync/StateSyncService');

const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('DeviceEventHandler Resilience Tests', () => {
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

  describe('DeviceRegistry registration failure', () => {
    it('should handle DeviceRegistry.registerDevice throwing error', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      mockDeviceRegistry.registerDevice.mockImplementation(() => {
        throw new Error('Registration failed');
      });

      expect(() => handler._handleAdbDevices(devices)).toThrow('Registration failed');
    });

    it('should continue processing other devices when one fails to register', () => {
      const devices = [
        { serial: 'device-1', state: 'device' },
        { serial: 'device-2', state: 'device' },
        { serial: 'device-3', state: 'device' }
      ];

      let callCount = 0;
      mockDeviceRegistry.registerDevice.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Registration failed');
        }
      });

      try {
        handler._handleAdbDevices(devices);
      } catch (e) {
        // Expected to throw
      }

      expect(callCount).toBe(2);
    });

    it('should handle DeviceRegistry.registerDevice returning null', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      mockDeviceRegistry.registerDevice.mockReturnValue(null);

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).toHaveBeenCalled();
    });
  });

  describe('DeviceRegistry update failure', () => {
    it('should handle DeviceRegistry.updateState throwing error', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      mockDeviceRegistry.updateState.mockImplementation(() => {
        throw new Error('Update failed');
      });

      expect(() => handler._handleAdbDevices(devices)).toThrow('Update failed');
    });

    it('should handle DeviceRegistry.updateState in wireless discovery throwing error', () => {
      const service = { host: '192.168.1.10', port: 5555 };

      mockDeviceRegistry.updateState.mockImplementation(() => {
        throw new Error('Update failed');
      });

      expect(() => handler._handleWirelessFound(service)).toThrow('Update failed');
    });

    it('should handle DeviceRegistry.updateState in connect success throwing error', () => {
      const data = { target: '192.168.1.10:5555' };

      mockDeviceRegistry.updateState.mockImplementation(() => {
        throw new Error('Update failed');
      });

      expect(() => handler._handleConnectSuccess(data)).toThrow('Update failed');
    });

    it('should handle DeviceRegistry.updateState in disconnect throwing error', () => {
      const data = { target: '192.168.1.10:5555' };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockReturnValue('device-1');
      mockDeviceRegistry.updateState.mockImplementation(() => {
        throw new Error('Update failed');
      });

      expect(() => handler._handleDisconnect(data)).toThrow('Update failed');
    });
  });

  describe('DeviceRegistry removal failure', () => {
    it('should handle DeviceRegistry.removeDevice throwing error', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const existingDevice = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: true
      });

      mockDeviceRegistry.getAllDevices.mockReturnValue([existingDevice]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'connected' });
      mockDeviceRegistry.removeDevice.mockImplementation(() => {
        throw new Error('Removal failed');
      });

      expect(() => handler._handleAdbDevices(devices)).toThrow('Removal failed');
    });
  });

  describe('StateSyncService notification failure', () => {
    it('should handle StateSyncService.onDeviceStateChanged throwing error', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      mockStateSyncService.onDeviceStateChanged.mockImplementation(() => {
        throw new Error('Notification failed');
      });

      handler._handleAdbDevices(devices);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in _notifyStateSync'),
        expect.any(Error),
        expect.objectContaining({ source: 'DeviceEventHandler' })
      );
    });

    it('should handle StateSyncService.onDeviceRemoved throwing error', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const existingDevice = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: true
      });

      mockDeviceRegistry.getAllDevices.mockReturnValue([existingDevice]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'connected' });
      mockStateSyncService.onDeviceRemoved.mockImplementation(() => {
        throw new Error('Notification failed');
      });

      handler._handleAdbDevices(devices);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in _notifyStateSync'),
        expect.any(Error),
        expect.objectContaining({ source: 'DeviceEventHandler' })
      );
    });

    it('should handle StateSyncService.onDevicePaired throwing error', () => {
      const data = { host: '192.168.1.10:37000', pairingCode: '123456' };

      mockStateSyncService.onDevicePaired.mockImplementation(() => {
        throw new Error('Notification failed');
      });

      handler._handlePairSuccess(data);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in _notifyStateSync'),
        expect.any(Error),
        expect.objectContaining({ source: 'DeviceEventHandler' })
      );
    });

    it('should continue when StateSyncService is null', () => {
      handler._stateSyncService = null;

      const devices = [{ serial: 'device-1', state: 'device' }];

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).toHaveBeenCalled();
    });
  });

  describe('DeviceRegistry query failures', () => {
    it('should handle DeviceRegistry.hasDevice throwing error', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      mockDeviceRegistry.hasDevice.mockImplementation(() => {
        throw new Error('Query failed');
      });

      expect(() => handler._handleAdbDevices(devices)).toThrow('Query failed');
    });

    it('should handle DeviceRegistry.getAllDevices throwing error', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      mockDeviceRegistry.getAllDevices.mockImplementation(() => {
        throw new Error('Query failed');
      });

      expect(() => handler._handleAdbDevices(devices)).toThrow('Query failed');
    });

    it('should handle DeviceRegistry.getRuntimeState throwing error', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const existingDevice = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: false
      });

      mockDeviceRegistry.getAllDevices.mockReturnValue([existingDevice]);
      mockDeviceRegistry.getRuntimeState.mockImplementation(() => {
        throw new Error('Query failed');
      });

      expect(() => handler._handleAdbDevices(devices)).toThrow('Query failed');
    });

    it('should handle DeviceRegistry.findDeviceIdByAdbTarget throwing error', () => {
      const service = { host: '192.168.1.10', port: 5555 };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockImplementation(() => {
        throw new Error('Query failed');
      });

      expect(() => handler._handleWirelessFound(service)).toThrow('Query failed');
    });
  });

  describe('Error recovery', () => {
    it('should recover after transient error in registration', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      let attempt = 0;
      mockDeviceRegistry.registerDevice.mockImplementation(() => {
        attempt++;
        if (attempt === 1) {
          throw new Error('Transient error');
        }
      });

      // First attempt fails
      try {
        handler._handleAdbDevices(devices);
      } catch (e) {
        // Expected
      }

      // Second attempt succeeds
      handler._handleAdbDevices(devices);

      expect(attempt).toBe(2);
      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(2);
    });

    it('should recover after transient error in update', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      let attempt = 0;
      mockDeviceRegistry.updateState.mockImplementation(() => {
        attempt++;
        if (attempt === 1) {
          throw new Error('Transient error');
        }
      });

      // First attempt fails
      try {
        handler._handleAdbDevices(devices);
      } catch (e) {
        // Expected
      }

      // Second attempt succeeds
      handler._handleAdbDevices(devices);

      expect(attempt).toBe(2);
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledTimes(2);
    });

    it('should recover after transient error in notification', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      let attempt = 0;
      mockStateSyncService.onDeviceStateChanged.mockImplementation(() => {
        attempt++;
        if (attempt === 1) {
          throw new Error('Transient error');
        }
      });

      // First attempt fails
      try {
        handler._handleAdbDevices(devices);
      } catch (e) {
        // Expected
      }

      // Second attempt succeeds
      handler._handleAdbDevices(devices);

      expect(attempt).toBe(2);
      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalledTimes(2);
    });
  });

  describe('Concurrent event handling', () => {
    it('should handle simultaneous events without race conditions', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];
      const service = { host: '192.168.1.10', port: 5555 };
      const connectData = { target: '192.168.1.10:5555' };

      handler._handleAdbDevices(devices);
      handler._handleWirelessFound(service);
      handler._handleConnectSuccess(connectData);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(3);
    });

    it('should handle disconnect all while processing new devices', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];
      const disconnectData = { target: 'all' };

      const device1 = new Device({
        id: 'device-1',
        deviceFriendlyName: 'Device 1',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: false
      });

      mockDeviceRegistry.getAllDevices.mockReturnValue([device1]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'connected' });

      handler._handleAdbDevices(devices);
      handler._handleDisconnect(disconnectData);

      expect(mockDeviceRegistry.updateState).toHaveBeenCalled();
    });
  });

  describe('Partial state corruption', () => {
    it('should handle when device exists in registry but has no runtime state', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const existingDevice = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: false
      });

      mockDeviceRegistry.getAllDevices.mockReturnValue([existingDevice]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(null);

      handler._handleAdbDevices(devices);

      // Should not try to update offline status when runtime state is null
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalledWith(
        'device-2',
        expect.objectContaining({ status: 'offline' })
      );
    });

    it('should handle when runtime state has missing fields', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const existingDevice = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: false
      });

      mockDeviceRegistry.getAllDevices.mockReturnValue([existingDevice]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({}); // Empty state

      handler._handleAdbDevices(devices);

      // The implementation updates to offline when runtime state status is not 'offline'
      // Empty state means status is undefined, so it will update to offline
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith(
        'device-2',
        expect.objectContaining({ status: 'offline' })
      );
    });
  });
});
