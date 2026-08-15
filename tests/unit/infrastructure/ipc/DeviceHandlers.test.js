// DeviceHandlers.test.js
'use strict';

const DeviceHandlers = require('../../../../src/main/infrastructure/ipc/DeviceHandlers');

describe('DeviceHandlers Unit Tests', () => {
  let deviceHandlers;
  let mockDeviceOrchestrator;
  let mockIpcMain;

  beforeEach(() => {
    // Create mock orchestrator with all required methods
    mockDeviceOrchestrator = {
      getAllDevices: jest.fn().mockResolvedValue([{ id: 'device-1' }]),
      getDevice: jest.fn().mockResolvedValue({ id: 'device-1' }),
      pairDevice: jest.fn().mockResolvedValue({ success: true }),
      connectDevice: jest.fn().mockResolvedValue({ connected: true }),
      startStreaming: jest.fn().mockResolvedValue({ streaming: true }),
      stopStreaming: jest.fn().mockResolvedValue({ stopped: true })
    };

    // Create mock ipcMain with handle function
    mockIpcMain = {
      handle: jest.fn()
    };

    deviceHandlers = new DeviceHandlers(mockDeviceOrchestrator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test #1: Constructor validation
  describe('Constructor', () => {
    test('should throw error when orchestrator is null', () => {
      expect(() => new DeviceHandlers(null)).toThrow('DeviceOrchestrator is required for DeviceHandlers');
    });

    test('should throw error when orchestrator is undefined', () => {
      expect(() => new DeviceHandlers(undefined)).toThrow('DeviceOrchestrator is required for DeviceHandlers');
    });

    test('should accept valid orchestrator', () => {
      const handler = new DeviceHandlers(mockDeviceOrchestrator);
      expect(handler).toBeInstanceOf(DeviceHandlers);
    });
  });

  // Test #2: Registration
  describe('Registration', () => {
    test('should register all 6 IPC channels', () => {
      deviceHandlers.register(mockIpcMain);

      // Verify handle was called for each channel
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(6);
      
      const channels = mockIpcMain.handle.mock.calls.map(call => call[0]);
      expect(channels).toContain('device:list');
      expect(channels).toContain('device:get');
      expect(channels).toContain('device:pair');
      expect(channels).toContain('device:connect');
      expect(channels).toContain('device:stream:start');
      expect(channels).toContain('device:stream:stop');
    });

    test('should throw error when ipcMain is null', () => {
      expect(() => deviceHandlers.register(null)).toThrow('Valid ipcMain instance required');
    });

    test('should throw error when ipcMain.handle is not a function', () => {
      expect(() => deviceHandlers.register({})).toThrow('Valid ipcMain instance required');
    });
  });

  // Test #3: device:list
  describe('device:list channel', () => {
    test('should call orchestrator.getAllDevices and return result', async () => {
      deviceHandlers.register(mockIpcMain);

      // Extract the handler function for device:list
      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:list');
      
      const result = await handlerFn({}, {});

      expect(mockDeviceOrchestrator.getAllDevices).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'device-1' }]);
    });
  });

  // Test #4-5: device:get
  describe('device:get channel', () => {
    test('should call orchestrator.getDevice with valid deviceId', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:get');
      
      const result = await handlerFn({}, 'device-123');

      expect(mockDeviceOrchestrator.getDevice).toHaveBeenCalledWith('device-123');
      expect(result).toEqual({ id: 'device-1' });
    });

    test('should throw error when deviceId is null', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:get');

      await expect(handlerFn({}, null)).rejects.toThrow('deviceId is required');
      expect(mockDeviceOrchestrator.getDevice).not.toHaveBeenCalled();
    });

    test('should throw error when deviceId is undefined', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:get');

      await expect(handlerFn({}, undefined)).rejects.toThrow('deviceId is required');
      expect(mockDeviceOrchestrator.getDevice).not.toHaveBeenCalled();
    });

    test('should throw error when deviceId is empty string', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:get');

      await expect(handlerFn({}, '')).rejects.toThrow('deviceId is required');
      expect(mockDeviceOrchestrator.getDevice).not.toHaveBeenCalled();
    });
  });

  // Test #6-8: device:pair
  describe('device:pair channel', () => {
    test('should call orchestrator.pairDevice with valid host and code', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:pair');
      
      const result = await handlerFn({}, 'host:port', '123456');

      expect(mockDeviceOrchestrator.pairDevice).toHaveBeenCalledWith('host:port', '123456');
      expect(result).toEqual({ success: true });
    });

    test('should throw error when host is undefined', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:pair');

      await expect(handlerFn({}, undefined, '123456')).rejects.toThrow('host and pairingCode are required');
      expect(mockDeviceOrchestrator.pairDevice).not.toHaveBeenCalled();
    });

    test('should throw error when pairingCode is null', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:pair');

      await expect(handlerFn({}, 'host', null)).rejects.toThrow('host and pairingCode are required');
      expect(mockDeviceOrchestrator.pairDevice).not.toHaveBeenCalled();
    });

    test('should throw error when both are missing', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:pair');

      await expect(handlerFn({}, null, null)).rejects.toThrow('host and pairingCode are required');
      expect(mockDeviceOrchestrator.pairDevice).not.toHaveBeenCalled();
    });
  });

  // Test #9-11: device:connect
  describe('device:connect channel', () => {
    test('should call orchestrator.connectDevice with target and friendlyName', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:connect');
      
      const result = await handlerFn({}, 'emulator', 'My Phone');

      expect(mockDeviceOrchestrator.connectDevice).toHaveBeenCalledWith('emulator', 'My Phone');
      expect(result).toEqual({ connected: true });
    });

    test('should call orchestrator.connectDevice with target and null friendlyName', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:connect');
      
      const result = await handlerFn({}, 'emulator');

      expect(mockDeviceOrchestrator.connectDevice).toHaveBeenCalledWith('emulator', null);
      expect(result).toEqual({ connected: true });
    });

    test('should throw error when target is empty string', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:connect');

      await expect(handlerFn({}, '')).rejects.toThrow('target is required (USB serial or host:port)');
      expect(mockDeviceOrchestrator.connectDevice).not.toHaveBeenCalled();
    });

    test('should throw error when target is null', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:connect');

      await expect(handlerFn({}, null)).rejects.toThrow('target is required (USB serial or host:port)');
      expect(mockDeviceOrchestrator.connectDevice).not.toHaveBeenCalled();
    });
  });

  // Test #12-14: device:stream:start
  describe('device:stream:start channel', () => {
    test('should call orchestrator.startStreaming with deviceId and options', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:start');
      
      const result = await handlerFn({}, 'id', { fullscreen: true });

      expect(mockDeviceOrchestrator.startStreaming).toHaveBeenCalledWith('id', { fullscreen: true });
      expect(result).toEqual({ streaming: true });
    });

    test('should call orchestrator.startStreaming with deviceId and empty options', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:start');
      
      const result = await handlerFn({}, 'id');

      expect(mockDeviceOrchestrator.startStreaming).toHaveBeenCalledWith('id', {});
      expect(result).toEqual({ streaming: true });
    });

    test('should throw error when deviceId is null', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:start');

      await expect(handlerFn({}, null)).rejects.toThrow('deviceId is required');
      expect(mockDeviceOrchestrator.startStreaming).not.toHaveBeenCalled();
    });

    test('should throw error when deviceId is undefined', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:start');

      await expect(handlerFn({}, undefined)).rejects.toThrow('deviceId is required');
      expect(mockDeviceOrchestrator.startStreaming).not.toHaveBeenCalled();
    });
  });

  // Test #15-16: device:stream:stop
  describe('device:stream:stop channel', () => {
    test('should call orchestrator.stopStreaming with deviceId', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:stop');
      
      const result = await handlerFn({}, 'id');

      expect(mockDeviceOrchestrator.stopStreaming).toHaveBeenCalledWith('id');
      expect(result).toEqual({ stopped: true });
    });

    test('should throw error when deviceId is undefined', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:stop');

      await expect(handlerFn({}, undefined)).rejects.toThrow('deviceId is required');
      expect(mockDeviceOrchestrator.stopStreaming).not.toHaveBeenCalled();
    });

    test('should throw error when deviceId is null', async () => {
      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:stop');

      await expect(handlerFn({}, null)).rejects.toThrow('deviceId is required');
      expect(mockDeviceOrchestrator.stopStreaming).not.toHaveBeenCalled();
    });
  });

  // Test #17: Error propagation
  describe('Error propagation', () => {
    test('should propagate orchestrator errors without catching them', async () => {
      // Simulate orchestrator throwing an error
      mockDeviceOrchestrator.getAllDevices.mockRejectedValue(new Error('DB Error'));

      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:list');

      // The handler should NOT catch the error - it should propagate
      await expect(handlerFn({}, {})).rejects.toThrow('DB Error');
      
      // Verify the orchestrator was called
      expect(mockDeviceOrchestrator.getAllDevices).toHaveBeenCalled();
    });

    test('should propagate orchestrator errors for device:get', async () => {
      mockDeviceOrchestrator.getDevice.mockRejectedValue(new Error('Device not found'));

      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:get');

      await expect(handlerFn({}, 'device-123')).rejects.toThrow('Device not found');
    });

    test('should propagate orchestrator errors for device:pair', async () => {
      mockDeviceOrchestrator.pairDevice.mockRejectedValue(new Error('Pairing failed'));

      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:pair');

      await expect(handlerFn({}, 'host:port', '123456')).rejects.toThrow('Pairing failed');
    });

    test('should propagate orchestrator errors for device:connect', async () => {
      mockDeviceOrchestrator.connectDevice.mockRejectedValue(new Error('Connection failed'));

      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:connect');

      await expect(handlerFn({}, 'emulator')).rejects.toThrow('Connection failed');
    });

    test('should propagate orchestrator errors for device:stream:start', async () => {
      mockDeviceOrchestrator.startStreaming.mockRejectedValue(new Error('Stream start failed'));

      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:start');

      await expect(handlerFn({}, 'id')).rejects.toThrow('Stream start failed');
    });

    test('should propagate orchestrator errors for device:stream:stop', async () => {
      mockDeviceOrchestrator.stopStreaming.mockRejectedValue(new Error('Stream stop failed'));

      deviceHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:stop');

      await expect(handlerFn({}, 'id')).rejects.toThrow('Stream stop failed');
    });
  });
});
