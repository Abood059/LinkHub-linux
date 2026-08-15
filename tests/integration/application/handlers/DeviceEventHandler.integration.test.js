const DeviceEventHandler = require('../../../../src/main/application/handlers/DeviceEventHandler');
const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');
const Device = require('../../../../src/main/domain/entities/Device');

describe('DeviceEventHandler Integration Tests', () => {
  let handler;
  let deviceRegistry;
  let stateSyncService;
  let mockWindowManager;
  let mockConnectionService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create real instances
    deviceRegistry = new DeviceRegistry();

    // Create mock window manager
    mockWindowManager = {
      send: jest.fn(),
      broadcast: jest.fn()
    };

    // Create real StateSyncService with mock window manager
    stateSyncService = new StateSyncService(mockWindowManager, deviceRegistry, { interval: 100 });
    stateSyncService.start();

    // Create handler with real dependencies
    handler = new DeviceEventHandler({
      deviceRegistry,
      stateSyncService,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    });

    // Create mock ConnectionService
    mockConnectionService = {
      on: jest.fn(),
      emit: jest.fn()
    };
  });

  afterEach(() => {
    if (stateSyncService) {
      stateSyncService.stop();
    }
  });

  describe('Integration with real DeviceRegistry', () => {
    it('should register device in real DeviceRegistry on adbDevices event', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      handler._handleAdbDevices(devices);

      const registeredDevice = deviceRegistry.getDevice('device-1');
      expect(registeredDevice).toBeDefined();
      expect(registeredDevice.id).toBe('device-1');
      expect(registeredDevice.isNew).toBe(true);
    });

    it('should update device state in real DeviceRegistry', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      handler._handleAdbDevices(devices);

      const runtimeState = deviceRegistry.getRuntimeState('device-1');
      expect(runtimeState).toBeDefined();
      expect(runtimeState.status).toBe('connected');
      expect(runtimeState.adbTarget).toBe('device-1');
    });

    it('should remove device from real DeviceRegistry when offline and new', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      handler._handleAdbDevices(devices);

      // Simulate device going offline
      handler._handleAdbDevices([]);

      const removedDevice = deviceRegistry.getDevice('device-1');
      expect(removedDevice).toBeNull();
    });

    it('should update to offline status for registered devices', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      handler._handleAdbDevices(devices);

      // Mark device as registered (not new)
      const device = deviceRegistry.getDevice('device-1');
      device._isNew = false;

      // Simulate device going offline
      handler._handleAdbDevices([]);

      const runtimeState = deviceRegistry.getRuntimeState('device-1');
      expect(runtimeState.status).toBe('offline');
    });

    it('should handle wireless device discovery with real DeviceRegistry', () => {
      const service = { host: '192.168.1.10', port: 5555, name: 'My Phone' };

      handler._handleWirelessFound(service);

      const deviceId = deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555');
      expect(deviceId).toBeDefined();

      const device = deviceRegistry.getDevice(deviceId);
      expect(device).toBeDefined();
      expect(device.deviceFriendlyName).toBe('My Phone');
    });

    it('should handle connect success with real DeviceRegistry', () => {
      const data = { target: '192.168.1.10:5555' };

      handler._handleConnectSuccess(data);

      const deviceId = deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555');
      expect(deviceId).toBeDefined();

      const runtimeState = deviceRegistry.getRuntimeState(deviceId);
      expect(runtimeState.status).toBe('connected');
    });

    it('should handle disconnect with real DeviceRegistry', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      handler._handleAdbDevices(devices);

      const device = deviceRegistry.getDevice('device-1');
      device._isNew = false;

      handler._handleDisconnect({ target: 'device-1' });

      const runtimeState = deviceRegistry.getRuntimeState('device-1');
      expect(runtimeState.status).toBe('offline');
    });

    it('should handle disconnect all with real DeviceRegistry', () => {
      const devices = [
        { serial: 'device-1', state: 'device' },
        { serial: 'device-2', state: 'device' }
      ];

      handler._handleAdbDevices(devices);

      // Mark devices as registered
      const device1 = deviceRegistry.getDevice('device-1');
      device1._isNew = false;
      const device2 = deviceRegistry.getDevice('device-2');
      device2._isNew = false;

      handler._handleDisconnect({ target: 'all' });

      const runtimeState1 = deviceRegistry.getRuntimeState('device-1');
      const runtimeState2 = deviceRegistry.getRuntimeState('device-2');
      expect(runtimeState1.status).toBe('offline');
      expect(runtimeState2.status).toBe('offline');
    });
  });

  describe('Integration with real StateSyncService', () => {
    it('should notify StateSyncService on device state change', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      // Spy on StateSyncService methods
      const stateChangedSpy = jest.spyOn(stateSyncService, 'onDeviceStateChanged');

      handler._handleAdbDevices(devices);

      // StateSyncService is called immediately by _notifyStateSync
      expect(stateChangedSpy).toHaveBeenCalled();

      stateChangedSpy.mockRestore();
    });

    it('should notify StateSyncService on device removal', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      // Register the device first
      handler._handleAdbDevices(devices);

      // Mark device as new so it will be removed
      const device = deviceRegistry.getDevice('device-1');
      device._isNew = true;

      const deviceRemovedSpy = jest.spyOn(stateSyncService, 'onDeviceRemoved');

      // Simulate device going offline
      handler._handleAdbDevices([]);

      expect(deviceRemovedSpy).toHaveBeenCalled();

      deviceRemovedSpy.mockRestore();
    });

    it('should notify StateSyncService on pair success', () => {
      const data = { host: '192.168.1.10:37000', pairingCode: '123456' };

      const devicePairedSpy = jest.spyOn(stateSyncService, 'onDevicePaired');

      handler._handlePairSuccess(data);

      expect(devicePairedSpy).toHaveBeenCalled();

      devicePairedSpy.mockRestore();
    });

    it('should not notify StateSyncService when it is null', () => {
      handler._stateSyncService = null;

      const devices = [{ serial: 'device-1', state: 'device' }];

      const stateChangedSpy = jest.spyOn(stateSyncService, 'onDeviceStateChanged');

      handler._handleAdbDevices(devices);

      expect(stateChangedSpy).not.toHaveBeenCalled();

      stateChangedSpy.mockRestore();
    });
  });

  describe('Full event flow from ConnectionService to StateSyncService', () => {
    it('should complete full flow: adbDevices -> DeviceRegistry -> StateSyncService', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const stateChangedSpy = jest.spyOn(stateSyncService, 'onDeviceStateChanged');

      handler._handleAdbDevices(devices);

      // Verify device registered
      const device = deviceRegistry.getDevice('device-1');
      expect(device).toBeDefined();

      // Verify state updated
      const runtimeState = deviceRegistry.getRuntimeState('device-1');
      expect(runtimeState.status).toBe('connected');

      // Verify StateSyncService was called
      expect(stateChangedSpy).toHaveBeenCalled();

      stateChangedSpy.mockRestore();
    });

    it('should complete full flow: wirelessFound -> DeviceRegistry -> StateSyncService', () => {
      const service = { host: '192.168.1.10', port: 5555, name: 'My Phone' };

      const stateChangedSpy = jest.spyOn(stateSyncService, 'onDeviceStateChanged');

      handler._handleWirelessFound(service);

      // Verify device registered
      const deviceId = deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555');
      expect(deviceId).toBeDefined();

      const device = deviceRegistry.getDevice(deviceId);
      expect(device).toBeDefined();

      // Verify state updated
      const runtimeState = deviceRegistry.getRuntimeState(deviceId);
      expect(runtimeState.status).toBe('discovered');

      // Verify StateSyncService was called
      expect(stateChangedSpy).toHaveBeenCalled();

      stateChangedSpy.mockRestore();
    });

    it('should complete full flow: connectSuccess -> DeviceRegistry -> StateSyncService', () => {
      const data = { target: '192.168.1.10:5555' };

      const stateChangedSpy = jest.spyOn(stateSyncService, 'onDeviceStateChanged');

      handler._handleConnectSuccess(data);

      // Verify device registered
      const deviceId = deviceRegistry.findDeviceIdByAdbTarget('192.168.1.10:5555');
      expect(deviceId).toBeDefined();

      // Verify state updated
      const runtimeState = deviceRegistry.getRuntimeState(deviceId);
      expect(runtimeState.status).toBe('connected');

      // Verify StateSyncService was called
      expect(stateChangedSpy).toHaveBeenCalled();

      stateChangedSpy.mockRestore();
    });

    it('should complete full flow: disconnect -> DeviceRegistry -> StateSyncService', () => {
      const devices = [{ serial: 'device-1', state: 'device' }];

      const stateChangedSpy = jest.spyOn(stateSyncService, 'onDeviceStateChanged');

      handler._handleAdbDevices(devices);

      const device = deviceRegistry.getDevice('device-1');
      device._isNew = false;

      handler._handleDisconnect({ target: 'device-1' });

      // Verify state updated
      const runtimeState = deviceRegistry.getRuntimeState('device-1');
      expect(runtimeState.status).toBe('offline');

      // Verify StateSyncService was called
      expect(stateChangedSpy).toHaveBeenCalled();

      stateChangedSpy.mockRestore();
    });
  });

  describe('setup with real ConnectionService', () => {
    it('should register event handlers on ConnectionService', () => {
      handler.setup(mockConnectionService);

      expect(mockConnectionService.on).toHaveBeenCalledWith('adbDevices', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledWith('wirelessServiceFound', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledWith('pairSuccess', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledWith('connectSuccess', expect.any(Function));
      expect(mockConnectionService.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should trigger handler when ConnectionService emits event', () => {
      handler.setup(mockConnectionService);

      const devices = [{ serial: 'device-1', state: 'device' }];

      // Get the registered handler
      const adbDevicesHandler = mockConnectionService.on.mock.calls.find(
        call => call[0] === 'adbDevices'
      )[1];

      // Emit event through the handler
      adbDevicesHandler(devices);

      // Verify device was registered
      const device = deviceRegistry.getDevice('device-1');
      expect(device).toBeDefined();
    });
  });

  describe('setStateSyncService integration', () => {
    it('should update StateSyncService reference', () => {
      const newMockWindowManager = { send: jest.fn(), broadcast: jest.fn() };
      const newStateSyncService = new StateSyncService(newMockWindowManager, deviceRegistry, { interval: 100 });
      newStateSyncService.start();

      handler.setStateSyncService(newStateSyncService);

      expect(handler._stateSyncService).toBe(newStateSyncService);

      newStateSyncService.stop();
    });

    it('should use new StateSyncService for subsequent notifications', () => {
      const newMockWindowManager = { send: jest.fn(), broadcast: jest.fn() };
      const newStateSyncService = new StateSyncService(newMockWindowManager, deviceRegistry, { interval: 100 });
      newStateSyncService.start();

      const stateChangedSpy = jest.spyOn(newStateSyncService, 'onDeviceStateChanged');

      handler.setStateSyncService(newStateSyncService);

      const devices = [{ serial: 'device-1', state: 'device' }];
      handler._handleAdbDevices(devices);

      expect(stateChangedSpy).toHaveBeenCalled();

      stateChangedSpy.mockRestore();
      newStateSyncService.stop();
    });
  });
});
