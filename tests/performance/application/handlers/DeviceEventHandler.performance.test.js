const DeviceEventHandler = require('../../../../src/main/application/handlers/DeviceEventHandler');
const Device = require('../../../../src/main/domain/entities/Device');

// Mock dependencies
jest.mock('../../../../src/main/runtime/devices/DeviceRegistry');
jest.mock('../../../../src/main/infrastructure/sync/StateSyncService');

const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('DeviceEventHandler Performance Tests', () => {
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

  describe('Processing 1000 devices in single event', () => {
    it('should process 1000 devices in acceptable time', () => {
      const devices = [];
      for (let i = 0; i < 1000; i++) {
        devices.push({ serial: `device-${i}`, state: 'device' });
      }

      const startTime = Date.now();
      handler._handleAdbDevices(devices);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1000);
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledTimes(1000);
      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalledTimes(1000);

      // Should complete within 1 second (1000ms)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle 1000 devices with reasonable memory usage', () => {
      const devices = [];
      for (let i = 0; i < 1000; i++) {
        devices.push({ serial: `device-${i}`, state: 'device' });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryBefore = process.memoryUsage().heapUsed;

      handler._handleAdbDevices(devices);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Memory increase should be less than 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('Processing 100 events per second', () => {
    it('should handle 100 events in rapid succession', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        handler._handleAdbDevices(devices);
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(100);

      // Should complete within 1 second (100 events per second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle 100 wireless discovery events in rapid succession', () => {
      const service = { host: '192.168.1.10', port: 5555 };

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        handler._handleWirelessFound(service);
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(100);

      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });

    it('should handle 100 connect success events in rapid succession', () => {
      const data = { target: '192.168.1.10:5555' };

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        handler._handleConnectSuccess(data);
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(100);

      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Memory consumption with many devices', () => {
    it('should handle 5000 devices without excessive memory growth', () => {
      const devices = [];
      for (let i = 0; i < 5000; i++) {
        devices.push({ serial: `device-${i}`, state: 'device' });
      }

      if (global.gc) {
        global.gc();
      }

      const memoryBefore = process.memoryUsage().heapUsed;

      handler._handleAdbDevices(devices);

      if (global.gc) {
        global.gc();
      }

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Memory increase should be less than 200MB for 5000 devices
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024);
    });

    it('should handle device removal without memory leaks', () => {
      const devices = [];
      for (let i = 0; i < 1000; i++) {
        devices.push({ serial: `device-${i}`, state: 'device' });
      }

      // Register devices
      handler._handleAdbDevices(devices);

      if (global.gc) {
        global.gc();
      }

      const memoryAfterRegistration = process.memoryUsage().heapUsed;

      // Remove all devices
      const existingDevices = [];
      for (let i = 0; i < 1000; i++) {
        existingDevices.push(new Device({
          id: `device-${i}`,
          deviceFriendlyName: `Device ${i}`,
          model: 'Unknown',
          version: 'Unknown',
          arch: 'Unknown',
          isNew: true
        }));
      }

      mockDeviceRegistry.getAllDevices.mockReturnValue(existingDevices);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'connected' });

      handler._handleAdbDevices([]);

      if (global.gc) {
        global.gc();
      }

      const memoryAfterRemoval = process.memoryUsage().heapUsed;
      const memoryDecrease = memoryAfterRegistration - memoryAfterRemoval;

      // Memory should decrease after removal (or at least not increase significantly)
      expect(memoryDecrease).toBeGreaterThan(-10 * 1024 * 1024); // Allow small increase
    });
  });

  describe('Performance with existing devices', () => {
    it('should be faster when updating existing devices vs creating new ones', () => {
      const devices = [];
      for (let i = 0; i < 1000; i++) {
        devices.push({ serial: `device-${i}`, state: 'device' });
      }

      // Time for creating new devices
      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      const startTimeNew = Date.now();
      handler._handleAdbDevices(devices);
      const endTimeNew = Date.now();
      const durationNew = endTimeNew - startTimeNew;

      // Reset mocks
      jest.clearAllMocks();
      mockDeviceRegistry.hasDevice = jest.fn().mockReturnValue(true);
      mockDeviceRegistry.updateState = jest.fn();
      mockDeviceRegistry.getAllDevices = jest.fn().mockReturnValue([]);

      // Time for updating existing devices
      const startTimeUpdate = Date.now();
      handler._handleAdbDevices(devices);
      const endTimeUpdate = Date.now();
      const durationUpdate = endTimeUpdate - startTimeUpdate;

      // Updating should be faster than creating
      expect(durationUpdate).toBeLessThan(durationNew);
    });

    it('should handle mixed new and existing devices efficiently', () => {
      const devices = [];
      for (let i = 0; i < 1000; i++) {
        devices.push({ serial: `device-${i}`, state: 'device' });
      }

      // Mix of new and existing devices
      mockDeviceRegistry.hasDevice.mockImplementation((id) => {
        return parseInt(id.split('-')[1]) % 2 === 0; // Even IDs exist
      });

      const startTime = Date.now();
      handler._handleAdbDevices(devices);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Performance with complex device states', () => {
    it('should handle devices with complex state updates efficiently', () => {
      const devices = [];
      for (let i = 0; i < 1000; i++) {
        devices.push({ 
          serial: `device-${i}`, 
          state: i % 3 === 0 ? 'device' : (i % 3 === 1 ? 'offline' : 'unauthorized')
        });
      }

      const startTime = Date.now();
      handler._handleAdbDevices(devices);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should handle disconnect all with many devices efficiently', () => {
      const existingDevices = [];
      for (let i = 0; i < 1000; i++) {
        existingDevices.push(new Device({
          id: `device-${i}`,
          deviceFriendlyName: `Device ${i}`,
          model: 'Unknown',
          version: 'Unknown',
          arch: 'Unknown',
          isNew: false
        }));
      }

      mockDeviceRegistry.getAllDevices.mockReturnValue(existingDevices);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'connected' });

      const startTime = Date.now();
      handler._handleDisconnect({ target: 'all' });
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockDeviceRegistry.updateState).toHaveBeenCalledTimes(1000);
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Performance under load', () => {
    it('should handle concurrent event types without degradation', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];
      const service = { host: '192.168.1.10', port: 5555 };
      const connectData = { target: '192.168.1.10:5555' };

      const startTime = Date.now();
      for (let i = 0; i < 100; i++) {
        handler._handleAdbDevices(devices);
        handler._handleWirelessFound(service);
        handler._handleConnectSuccess(connectData);
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(300);
      expect(duration).toBeLessThan(3000); // 3 seconds for 300 events
    });

    it('should maintain performance with repeated state changes', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        handler._handleAdbDevices(devices);
      }
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockDeviceRegistry.updateState).toHaveBeenCalledTimes(1000);
      expect(duration).toBeLessThan(1000);
    });
  });
});
