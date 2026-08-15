const DeviceEventHandler = require('../../../../src/main/application/handlers/DeviceEventHandler');
const Device = require('../../../../src/main/domain/entities/Device');

// Mock dependencies
jest.mock('../../../../src/main/runtime/devices/DeviceRegistry');
jest.mock('../../../../src/main/infrastructure/sync/StateSyncService');

const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('DeviceEventHandler', () => {
  let handler;
  let mockDeviceRegistry;
  let mockStateSyncService;
  let mockLogger;
  let mockConnectionService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create mock instances
    mockDeviceRegistry = new DeviceRegistry();
    mockStateSyncService = new StateSyncService();

    // Mock DeviceRegistry methods
    mockDeviceRegistry.hasDevice = jest.fn();
    mockDeviceRegistry.registerDevice = jest.fn();
    mockDeviceRegistry.updateState = jest.fn();
    mockDeviceRegistry.removeDevice = jest.fn();
    mockDeviceRegistry.getAllDevices = jest.fn();
    mockDeviceRegistry.getRuntimeState = jest.fn();
    mockDeviceRegistry.findDeviceIdByAdbTarget = jest.fn();

    // Mock StateSyncService methods
    mockStateSyncService.onDeviceStateChanged = jest.fn();
    mockStateSyncService.onDeviceRemoved = jest.fn();
    mockStateSyncService.onDevicePaired = jest.fn();

    // Create mock ConnectionService
    mockConnectionService = {
      on: jest.fn()
    };

    // Create handler instance
    handler = new DeviceEventHandler({
      deviceRegistry: mockDeviceRegistry,
      stateSyncService: mockStateSyncService,
      logger: mockLogger
    });
  });

  describe('setup', () => {
    it('should register all event handlers on ConnectionService', () => {
      handler.setup(mockConnectionService);

      expect(mockConnectionService.on).toHaveBeenCalledWith('adbDevices', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledWith('wirelessServiceFound', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledWith('pairSuccess', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledWith('connectSuccess', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledTimes(5);
    });
  });

  describe('setStateSyncService', () => {
    it('should set the StateSyncService', () => {
      const newMockStateSyncService = new StateSyncService();
      handler.setStateSyncService(newMockStateSyncService);
      expect(handler._stateSyncService).toBe(newMockStateSyncService);
    });
  });

  describe('_handleAdbDevices', () => {
    it('should handle valid device list correctly', () => {
      const devices = [
        { serial: 'device-1', state: 'device' },
        { serial: 'device-2', state: 'device' }
      ];

      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      mockDeviceRegistry.getAllDevices.mockReturnValue([]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'connected' });

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(2);
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledTimes(2);
      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalledTimes(2);
    });

    it('should handle empty device list', () => {
      const devices = [];
      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      mockDeviceRegistry.getAllDevices.mockReturnValue([]);

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should handle null input gracefully', () => {
      handler._handleAdbDevices(null);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should handle non-array input gracefully', () => {
      handler._handleAdbDevices({});

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should skip devices without serial', () => {
      const devices = [
        { serial: 'device-1', state: 'device' },
        { state: 'device' },
        { serial: 'device-2', state: 'device' }
      ];

      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      mockDeviceRegistry.getAllDevices.mockReturnValue([]);

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(2);
    });

    it('should update existing device instead of creating new one', () => {
      const devices = [
        { serial: 'device-1', state: 'device' }
      ];

      mockDeviceRegistry.hasDevice.mockReturnValue(true);
      mockDeviceRegistry.getAllDevices.mockReturnValue([]);

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledTimes(1);
    });

    it('should set correct status based on device state', () => {
      const devices = [
        { serial: 'device-1', state: 'device' },
        { serial: 'device-2', state: 'offline' },
        { serial: 'device-3', state: null }
      ];

      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      mockDeviceRegistry.getAllDevices.mockReturnValue([]);

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.updateState).toHaveBeenNthCalledWith(1, 'device-1', expect.objectContaining({ status: 'connected' }));
      expect(mockDeviceRegistry.updateState).toHaveBeenNthCalledWith(2, 'device-2', expect.objectContaining({ status: 'offline' }));
      expect(mockDeviceRegistry.updateState).toHaveBeenNthCalledWith(3, 'device-3', expect.objectContaining({ status: 'unknown' }));
    });

    it('should detect connection type correctly (USB vs TCPIP)', () => {
      const devices = [
        { serial: 'device-1', state: 'device' },
        { serial: '192.168.1.10:5555', state: 'device' }
      ];

      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      mockDeviceRegistry.getAllDevices.mockReturnValue([]);

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.updateState).toHaveBeenNthCalledWith(1, 'device-1', expect.objectContaining({ connectionType: 'USB' }));
      expect(mockDeviceRegistry.updateState).toHaveBeenNthCalledWith(2, '192.168.1.10:5555', expect.objectContaining({ connectionType: 'TCPIP' }));
    });

    it('should remove new devices not in current list', () => {
      const devices = [
        { serial: 'device-1', state: 'device' }
      ];

      const existingDevice = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: true
      });

      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      mockDeviceRegistry.getAllDevices.mockReturnValue([existingDevice]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'connected' });

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.removeDevice).toHaveBeenCalledWith('device-2');
      expect(mockStateSyncService.onDeviceRemoved).toHaveBeenCalledWith({ deviceId: 'device-2' });
    });

    it('should set offline status for registered devices not in current list', () => {
      const devices = [
        { serial: 'device-1', state: 'device' }
      ];

      const existingDevice = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: false
      });

      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      mockDeviceRegistry.getAllDevices.mockReturnValue([existingDevice]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'connected' });

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith('device-2', expect.objectContaining({ status: 'offline' }));
      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'device-2', state: 'offline' })
      );
    });

    it('should not update offline status for already offline devices', () => {
      const devices = [
        { serial: 'device-1', state: 'device' }
      ];

      const existingDevice = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: false
      });

      mockDeviceRegistry.hasDevice.mockReturnValue(false);
      mockDeviceRegistry.getAllDevices.mockReturnValue([existingDevice]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'offline' });

      handler._handleAdbDevices(devices);

      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalledWith('device-2', expect.objectContaining({ status: 'offline' }));
    });
  });

  describe('_handleWirelessFound', () => {
    it('should handle valid wireless service', () => {
      const service = { host: '192.168.1.10', port: 5555, name: 'My Phone' };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockReturnValue(null);
      mockDeviceRegistry.hasDevice.mockReturnValue(false);

      handler._handleWirelessFound(service);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'discovered',
          adbTarget: '192.168.1.10:5555',
          ip: '192.168.1.10',
          port: 5555,
          connectionType: 'WIRELESS_DISCOVERED'
        })
      );
      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalled();
    });

    it('should handle missing host gracefully', () => {
      const service = { port: 5555, name: 'My Phone' };

      handler._handleWirelessFound(service);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should handle missing port gracefully', () => {
      const service = { host: '192.168.1.10', name: 'My Phone' };

      handler._handleWirelessFound(service);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should handle null service gracefully', () => {
      handler._handleWirelessFound(null);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should update existing device instead of creating new one', () => {
      const service = { host: '192.168.1.10', port: 5555, name: 'My Phone' };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockReturnValue('device-1');
      mockDeviceRegistry.hasDevice.mockReturnValue(true);

      handler._handleWirelessFound(service);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith('device-1', expect.objectContaining({ status: 'discovered' }));
    });

    it('should use adbTarget as name when service name is missing', () => {
      const service = { host: '192.168.1.10', port: 5555 };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockReturnValue(null);
      mockDeviceRegistry.hasDevice.mockReturnValue(false);

      handler._handleWirelessFound(service);

      const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
      expect(registeredDevice.deviceFriendlyName).toBe('192.168.1.10:5555');
    });
  });

  describe('_handlePairSuccess', () => {
    it('should handle pair success with host and pairing code', () => {
      const data = { host: '192.168.1.10:37000', pairingCode: '123456' };

      handler._handlePairSuccess(data);

      expect(mockLogger.info).toHaveBeenCalledWith('Pair success for 192.168.1.10:37000', { source: 'DeviceEventHandler' });
      expect(mockStateSyncService.onDevicePaired).toHaveBeenCalledWith(data);
    });

    it('should handle missing host gracefully', () => {
      const data = { pairingCode: '123456' };

      handler._handlePairSuccess(data);

      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockStateSyncService.onDevicePaired).not.toHaveBeenCalled();
    });

    it('should handle null data gracefully', () => {
      handler._handlePairSuccess(null);

      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockStateSyncService.onDevicePaired).not.toHaveBeenCalled();
    });
  });

  describe('_handleConnectSuccess', () => {
    it('should handle connect success with target', () => {
      const data = { target: '192.168.1.10:5555' };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockReturnValue(null);
      mockDeviceRegistry.hasDevice.mockReturnValue(false);

      handler._handleConnectSuccess(data);

      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'connected',
          adbTarget: '192.168.1.10:5555',
          connectionType: 'TCPIP'
        })
      );
      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalled();
    });

    it('should handle missing target gracefully', () => {
      const data = {};

      handler._handleConnectSuccess(data);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should handle null data gracefully', () => {
      handler._handleConnectSuccess(null);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should update existing device instead of creating new one', () => {
      const data = { target: '192.168.1.10:5555' };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockReturnValue('device-1');
      mockDeviceRegistry.hasDevice.mockReturnValue(true);

      handler._handleConnectSuccess(data);

      expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith('device-1', expect.objectContaining({ status: 'connected' }));
    });
  });

  describe('_handleDisconnect', () => {
    it('should handle disconnect for all devices', () => {
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

      handler._handleDisconnect({ target: 'all' });

      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith('device-1', expect.objectContaining({ status: 'offline' }));
      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'device-1', state: 'offline' })
      );
    });

    it('should handle disconnect for specific target', () => {
      const data = { target: '192.168.1.10:5555' };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockReturnValue('device-1');

      handler._handleDisconnect(data);

      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith('device-1', expect.objectContaining({ status: 'offline' }));
      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'device-1', state: 'offline', adbTarget: '192.168.1.10:5555' })
      );
    });

    it('should handle disconnect with null target (treat as all)', () => {
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

      handler._handleDisconnect({ target: null });

      expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith('device-1', expect.objectContaining({ status: 'offline' }));
    });

    it('should skip offline devices when disconnecting all', () => {
      const device1 = new Device({
        id: 'device-1',
        deviceFriendlyName: 'Device 1',
        model: 'Unknown',
        version: 'Unknown',
        arch: 'Unknown',
        isNew: false
      });

      mockDeviceRegistry.getAllDevices.mockReturnValue([device1]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'offline' });

      handler._handleDisconnect({ target: 'all' });

      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });

    it('should handle disconnect for non-existent target gracefully', () => {
      const data = { target: '192.168.1.10:5555' };

      mockDeviceRegistry.findDeviceIdByAdbTarget.mockReturnValue(null);

      handler._handleDisconnect(data);

      expect(mockDeviceRegistry.updateState).not.toHaveBeenCalled();
    });
  });

  describe('_notifyStateSync', () => {
    it('should notify StateSyncService for deviceStateChanged', () => {
      handler._notifyStateSync('deviceStateChanged', { deviceId: 'device-1', state: 'connected' });

      expect(mockStateSyncService.onDeviceStateChanged).toHaveBeenCalledWith({ deviceId: 'device-1', state: 'connected' });
    });

    it('should notify StateSyncService for deviceRemoved', () => {
      handler._notifyStateSync('deviceRemoved', { deviceId: 'device-1' });

      expect(mockStateSyncService.onDeviceRemoved).toHaveBeenCalledWith({ deviceId: 'device-1' });
    });

    it('should notify StateSyncService for devicePaired', () => {
      handler._notifyStateSync('devicePaired', { host: '192.168.1.10', pairingCode: '123456' });

      expect(mockStateSyncService.onDevicePaired).toHaveBeenCalledWith({ host: '192.168.1.10', pairingCode: '123456' });
    });

    it('should not notify when StateSyncService is null', () => {
      handler._stateSyncService = null;

      handler._notifyStateSync('deviceStateChanged', { deviceId: 'device-1' });

      expect(mockStateSyncService.onDeviceStateChanged).not.toHaveBeenCalled();
    });

    it('should log warning for unknown event type', () => {
      handler._notifyStateSync('unknownEvent', { data: 'test' });

      expect(mockLogger.warn).toHaveBeenCalledWith('Unknown event type: unknownEvent', { source: 'DeviceEventHandler' });
    });
  });
});
