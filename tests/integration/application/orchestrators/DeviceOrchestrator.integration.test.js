// tests/integration/application/orchestrators/DeviceOrchestrator.integration.test.js
'use strict';

const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const DeviceOrchestrator = require('../../../../src/main/application/orchestrators/DeviceOrchestrator');
const Device = require('../../../../src/main/domain/entities/Device');

// Mock Infrastructure dependencies
jest.mock('../../../../src/main/infrastructure/adb/ConnectionService');
jest.mock('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

const ConnectionService = require('../../../../src/main/infrastructure/adb/ConnectionService');
const ScrcpyAdapter = require('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

describe('DeviceOrchestrator Integration', () => {
  let deviceRegistry;
  let orchestrator;
  let mockConnectionService;
  let mockScrcpyAdapter;
  let mockLogger;

  beforeEach(() => {
    // Create real DeviceRegistry instance
    deviceRegistry = new DeviceRegistry();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create mock instances (these are mocked by jest.mock above)
    mockConnectionService = new ConnectionService();
    mockScrcpyAdapter = new ScrcpyAdapter();

    // Mock the methods we need
    mockConnectionService.connect = jest.fn();
    mockConnectionService.getDeviceInfo = jest.fn();
    mockScrcpyAdapter.startMirroring = jest.fn();
    mockScrcpyAdapter.stopMirroring = jest.fn();

    // Create orchestrator with real registry and mocked infrastructure
    orchestrator = new DeviceOrchestrator({
      deviceRegistry,
      connectionService: mockConnectionService,
      scrcpyAdapter: mockScrcpyAdapter,
      logger: mockLogger
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up real registry to prevent state leakage
    deviceRegistry.clear();
  });

  describe('TCP/IP Full Connection', () => {
    it('should connect via TCP/IP and register device with correct runtime state', async () => {
      const target = '192.168.1.10:5555';
      const friendlyName = 'TestPhone';
      const deviceInfo = { model: 'Pixel 6', version: '13', arch: 'arm64-v8a' };

      // Mock successful connection and device info fetch
      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockResolvedValue(deviceInfo);

      const result = await orchestrator.connectDevice(target, friendlyName);

      // Verify connectionService.connect was called
      expect(mockConnectionService.connect).toHaveBeenCalledWith(target);

      // Verify device was registered in real DeviceRegistry
      const registeredDevice = deviceRegistry.getDevice(result.id);
      expect(registeredDevice).not.toBeNull();
      expect(registeredDevice.id).toBe(result.id);
      expect(registeredDevice.deviceFriendlyName).toBe(friendlyName);

      // Verify runtime state was updated correctly
      const runtimeState = deviceRegistry.getRuntimeState(result.id);
      expect(runtimeState).not.toBeNull();
      expect(runtimeState.status).toBe('connected');
      expect(runtimeState.adbTarget).toBe(target);
      expect(runtimeState.connectionType).toBe('TCPIP');
      expect(runtimeState.lastSeen).toBeInstanceOf(Date);

      // Verify device info was updated
      expect(result.model).toBe('Pixel 6');
      expect(result.version).toBe('13');
      expect(result.arch).toBe('arm64-v8a');
      expect(result.isNew).toBe(false);

      // Verify logger was called
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Device info updated')
      );
    });
  });

  describe('USB Connection', () => {
    it('should connect via USB without calling connectionService.connect', async () => {
      const target = 'emulator-5554';
      const friendlyName = 'Emulator';
      const deviceInfo = { model: 'Pixel 6', version: '13', arch: 'arm64-v8a' };

      // Mock device info fetch (but NOT connect)
      mockConnectionService.getDeviceInfo.mockResolvedValue(deviceInfo);

      const result = await orchestrator.connectDevice(target, friendlyName);

      // Verify connectionService.connect was NOT called (no colon in target)
      expect(mockConnectionService.connect).not.toHaveBeenCalled();

      // Verify device was registered
      const registeredDevice = deviceRegistry.getDevice(result.id);
      expect(registeredDevice).not.toBeNull();

      // Verify runtime state has USB connection type
      const runtimeState = deviceRegistry.getRuntimeState(result.id);
      expect(runtimeState.connectionType).toBe('USB');
      expect(runtimeState.adbTarget).toBe(target);
      expect(runtimeState.status).toBe('connected');
    });
  });

  describe('Device Info Fetch After Connection', () => {
    it('should fetch and update device info after connection', async () => {
      const target = '192.168.1.10:5555';
      const deviceInfo = { model: 'SM-G998B', version: '12', arch: 'arm64-v8a' };

      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockResolvedValue(deviceInfo);

      const result = await orchestrator.connectDevice(target);

      // Verify device entity was updated
      expect(result.model).toBe('SM-G998B');
      expect(result.version).toBe('12');
      expect(result.arch).toBe('arm64-v8a');
      expect(result.isNew).toBe(false);

      // Note: DeviceRuntimeState does not store model/version/arch
      // These are only stored in the Device entity
      const runtimeState = deviceRegistry.getRuntimeState(result.id);
      expect(runtimeState.status).toBe('connected');
    });
  });

  describe('Start/Stop Streaming', () => {
    it('should start streaming with correct adbTarget and options', async () => {
      const target = '192.168.1.10:5555';
      const options = { fullscreen: true, bitrate: '8M' };

      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Pixel 6', version: '13', arch: 'arm64' });
      mockScrcpyAdapter.startMirroring.mockReturnValue('scrcpy-process-123');

      const device = await orchestrator.connectDevice(target);
      const result = orchestrator.startStreaming(device.id, options);

      // Verify ScrcpyAdapter was called with correct adbTarget and options
      expect(mockScrcpyAdapter.startMirroring).toHaveBeenCalledWith(target, options);
      expect(result).toBe('scrcpy-process-123');
    });

    it('should stop streaming with correct adbTarget', async () => {
      const target = '192.168.1.10:5555';

      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Pixel 6', version: '13', arch: 'arm64' });
      mockScrcpyAdapter.stopMirroring.mockReturnValue(true);

      const device = await orchestrator.connectDevice(target);
      const result = orchestrator.stopStreaming(device.id);

      // Verify ScrcpyAdapter was called with correct adbTarget
      expect(mockScrcpyAdapter.stopMirroring).toHaveBeenCalledWith(target);
      expect(result).toBe(true);
    });
  });

  describe('Multiple Devices', () => {
    it('should register and retrieve multiple devices', async () => {
      const devices = [
        { target: '192.168.1.10:5555', name: 'Phone 1' },
        { target: '192.168.1.20:5555', name: 'Phone 2' },
        { target: 'emulator-5554', name: 'Emulator' }
      ];

      const deviceInfo = { model: 'Pixel 6', version: '13', arch: 'arm64' };

      // Mock all connections
      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockResolvedValue(deviceInfo);

      // Connect all devices
      for (const device of devices) {
        await orchestrator.connectDevice(device.target, device.name);
      }

      // Verify getAllDevices returns all 3 devices
      const allDevices = orchestrator.getAllDevices();
      expect(allDevices).toHaveLength(3);

      // Verify each device has correct structure
      allDevices.forEach((deviceWrapper, index) => {
        expect(deviceWrapper).toHaveProperty('device');
        expect(deviceWrapper).toHaveProperty('runtimeState');
        expect(deviceWrapper.device.deviceFriendlyName).toBe(devices[index].name);
        expect(deviceWrapper.runtimeState.status).toBe('connected');
      });
    });
  });

  describe('Handle getDeviceInfo Failure', () => {
    it('should handle getDeviceInfo failure gracefully with default data', async () => {
      const target = '192.168.1.10:5555';
      const friendlyName = 'TestPhone';

      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockRejectedValue(new Error('ADB timeout'));

      const result = await orchestrator.connectDevice(target, friendlyName);

      // Verify device was still registered
      const registeredDevice = deviceRegistry.getDevice(result.id);
      expect(registeredDevice).not.toBeNull();

      // Verify runtime state was created
      const runtimeState = deviceRegistry.getRuntimeState(result.id);
      expect(runtimeState.status).toBe('connected');

      // Verify device has default data
      expect(result.model).toBe('Unknown');
      expect(result.version).toBe('Unknown');
      expect(result.arch).toBe('Unknown');
      expect(result.isNew).toBe(true);

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch detailed device info')
      );
    });
  });
});
