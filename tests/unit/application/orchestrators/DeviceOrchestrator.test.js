const DeviceOrchestrator = require('../../../../src/main/application/orchestrators/DeviceOrchestrator');
const Device = require('../../../../src/main/domain/entities/Device');

// Mock dependencies
jest.mock('../../../../src/main/runtime/devices/DeviceRegistry');
jest.mock('../../../../src/main/infrastructure/adb/ConnectionService');
jest.mock('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const ConnectionService = require('../../../../src/main/infrastructure/adb/ConnectionService');
const ScrcpyAdapter = require('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

describe('DeviceOrchestrator', () => {
  let orchestrator;
  let mockDeviceRegistry;
  let mockConnectionService;
  let mockScrcpyAdapter;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create mock instances
    mockDeviceRegistry = new DeviceRegistry();
    mockConnectionService = new ConnectionService();
    mockScrcpyAdapter = new ScrcpyAdapter();

    // Mock DeviceRegistry methods
    mockDeviceRegistry.registerDevice = jest.fn();
    mockDeviceRegistry.updateState = jest.fn();
    mockDeviceRegistry.getDevice = jest.fn();
    mockDeviceRegistry.getRuntimeState = jest.fn();
    mockDeviceRegistry.getAllDevices = jest.fn();

    // Mock ConnectionService methods
    mockConnectionService.connect = jest.fn();
    mockConnectionService.pair = jest.fn();
    mockConnectionService.getDeviceInfo = jest.fn();

    // Mock ScrcpyAdapter methods
    mockScrcpyAdapter.startMirroring = jest.fn();
    mockScrcpyAdapter.stopMirroring = jest.fn();

    // Create orchestrator instance
    orchestrator = new DeviceOrchestrator({
      deviceRegistry: mockDeviceRegistry,
      connectionService: mockConnectionService,
      scrcpyAdapter: mockScrcpyAdapter,
      logger: mockLogger
    });
  });

  describe('connectDevice', () => {
    describe('TCP/IP connection', () => {
      it('should connect via TCP/IP and register device with correct parameters', async () => {
        const target = '192.168.1.10:5555';
        const friendlyName = 'My Phone';

        mockConnectionService.connect.mockResolvedValue('connected');

        const result = await orchestrator.connectDevice(target, friendlyName);

        expect(mockConnectionService.connect).toHaveBeenCalledWith(target);
        expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1);

        const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
        expect(registeredDevice).toBeInstanceOf(Device);
        expect(registeredDevice.deviceFriendlyName).toBe(friendlyName);
        expect(registeredDevice.isNew).toBe(true);

        expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith(
          registeredDevice.id,
          expect.objectContaining({
            status: 'connected',
            adbTarget: target,
            connectionType: 'TCPIP'
          })
        );

        expect(result).toBeInstanceOf(Device);
      });

      it('should fetch device info after successful connection', async () => {
        const target = '192.168.1.10:5555';
        const deviceInfo = { model: 'Pixel 6', version: '13', arch: 'arm64' };

        mockConnectionService.connect.mockResolvedValue('connected');
        mockConnectionService.getDeviceInfo.mockResolvedValue(deviceInfo);

        const result = await orchestrator.connectDevice(target);

        expect(mockConnectionService.getDeviceInfo).toHaveBeenCalledWith(target);
        expect(result.model).toBe('Pixel 6');
        expect(result.version).toBe('13');
        expect(result.arch).toBe('arm64');
        expect(result.isNew).toBe(false);
        expect(mockLogger.info).toHaveBeenCalled();
      });

      it('should handle device info fetch failure gracefully', async () => {
        const target = '192.168.1.10:5555';

        mockConnectionService.connect.mockResolvedValue('connected');
        mockConnectionService.getDeviceInfo.mockRejectedValue(new Error('ADB timeout'));

        const result = await orchestrator.connectDevice(target);

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Could not fetch detailed device info')
        );
        expect(result.model).toBe('Unknown');
        expect(result.version).toBe('Unknown');
        expect(result.arch).toBe('Unknown');
      });

      it('should throw error when connection fails', async () => {
        const target = '192.168.1.10:5555';

        mockConnectionService.connect.mockRejectedValue(new Error('Connection refused'));

        await expect(orchestrator.connectDevice(target)).rejects.toThrow('Connection refused');
        expect(mockDeviceRegistry.registerDevice).not.toHaveBeenCalled();
      });
    });

    describe('USB connection', () => {
      it('should connect via USB without calling connectionService.connect', async () => {
        const target = 'emulator-5554';
        const friendlyName = 'Emulator';

        mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Pixel 6', version: '13', arch: 'arm64' });

        const result = await orchestrator.connectDevice(target, friendlyName);

        expect(mockConnectionService.connect).not.toHaveBeenCalled();
        expect(mockDeviceRegistry.registerDevice).toHaveBeenCalledTimes(1);

        const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
        expect(registeredDevice.deviceFriendlyName).toBe(friendlyName);

        expect(mockDeviceRegistry.updateState).toHaveBeenCalledWith(
          registeredDevice.id,
          expect.objectContaining({
            status: 'connected',
            adbTarget: target,
            connectionType: 'USB'
          })
        );

        expect(result).toBeInstanceOf(Device);
      });
    });

    describe('friendlyName handling', () => {
      it('should use target as default friendlyName when not provided', async () => {
        const target = 'emulator-5554';

        mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Pixel 6', version: '13', arch: 'arm64' });

        const result = await orchestrator.connectDevice(target);

        const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
        expect(registeredDevice.deviceFriendlyName).toBe(target);
      });
    });

    describe('validation', () => {
      it('should throw error when target is null', async () => {
        await expect(orchestrator.connectDevice(null)).rejects.toThrow('Target is required');
      });

      it('should throw error when target is empty string', async () => {
        await expect(orchestrator.connectDevice('')).rejects.toThrow('Target is required');
      });

      it('should accept whitespace-only target (implementation does not trim)', async () => {
        const target = '   ';

        mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Pixel 6', version: '13', arch: 'arm64' });

        const result = await orchestrator.connectDevice(target);

        // The implementation does not validate whitespace-only targets
        expect(result.deviceFriendlyName).toBe(target);
      });
    });
  });

  describe('pairDevice', () => {
    it('should pair device successfully', async () => {
      const host = '192.168.1.10:37000';
      const pairingCode = '123456';
      const expectedResult = ['pairing successful'];

      mockConnectionService.pair.mockResolvedValue(expectedResult);

      const result = await orchestrator.pairDevice(host, pairingCode);

      expect(mockConnectionService.pair).toHaveBeenCalledWith(host, pairingCode);
      expect(result).toBe(expectedResult);
    });

    it('should throw error when host is null', async () => {
      await expect(orchestrator.pairDevice(null, '123456')).rejects.toThrow('Host and pairing code are required');
    });

    it('should throw error when pairingCode is null', async () => {
      await expect(orchestrator.pairDevice('192.168.1.10:37000', null)).rejects.toThrow('Host and pairing code are required');
    });

    it('should throw error when pairing fails', async () => {
      const host = '192.168.1.10:37000';
      const pairingCode = '123456';

      mockConnectionService.pair.mockRejectedValue(new Error('Pairing failed'));

      await expect(orchestrator.pairDevice(host, pairingCode)).rejects.toThrow('Pairing failed');
    });

    it('should pass pairingCode with non-numeric characters as-is', async () => {
      const host = '192.168.1.10:37000';
      const pairingCode = '12A45';

      mockConnectionService.pair.mockResolvedValue(['success']);

      await orchestrator.pairDevice(host, pairingCode);

      expect(mockConnectionService.pair).toHaveBeenCalledWith(host, '12A45');
    });
  });

  describe('startStreaming', () => {
    it('should start streaming for connected device with adbTarget', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { status: 'connected', adbTarget: 'emulator-5554', toJSON: () => ({ status: 'connected', adbTarget: 'emulator-5554' }) };
      const options = { fullscreen: true, bitrate: '8M' };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.startMirroring.mockReturnValue('process-id-123');

      const result = orchestrator.startStreaming(deviceId, options);

      expect(mockScrcpyAdapter.startMirroring).toHaveBeenCalledWith('emulator-5554', options);
      expect(result).toBe('process-id-123');
    });

    it('should throw error when device not found', () => {
      const deviceId = 'non-existent';

      mockDeviceRegistry.getDevice.mockReturnValue(null);

      expect(() => orchestrator.startStreaming(deviceId)).toThrow(`Device ${deviceId} not found`);
    });

    it('should use device.id as fallback when adbTarget not in runtime state', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { status: 'connected', adbTarget: null, toJSON: () => ({ status: 'connected', adbTarget: null }) };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.startMirroring.mockReturnValue('process-id-123');

      orchestrator.startStreaming(deviceId);

      expect(mockScrcpyAdapter.startMirroring).toHaveBeenCalledWith(deviceId, {});
    });

    it('should use device.id as fallback when runtime state has null adbTarget', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { status: 'connected', adbTarget: null, toJSON: () => ({ status: 'connected', adbTarget: null }) };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.startMirroring.mockReturnValue('process-id-123');

      orchestrator.startStreaming(deviceId);

      expect(mockScrcpyAdapter.startMirroring).toHaveBeenCalledWith(deviceId, {});
    });

    it('should pass empty options when not provided', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { status: 'connected', adbTarget: 'emulator-5554', toJSON: () => ({ status: 'connected', adbTarget: 'emulator-5554' }) };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.startMirroring.mockReturnValue('process-id-123');

      orchestrator.startStreaming(deviceId, {});

      expect(mockScrcpyAdapter.startMirroring).toHaveBeenCalledWith('emulator-5554', {});
    });

    it('should throw error when scrcpyAdapter.startMirroring fails', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { status: 'connected', adbTarget: 'emulator-5554', toJSON: () => ({ status: 'connected', adbTarget: 'emulator-5554' }) };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.startMirroring.mockImplementation(() => {
        throw new Error('Scrcpy failed to start');
      });

      expect(() => orchestrator.startStreaming(deviceId)).toThrow('Scrcpy failed to start');
    });
  });

  describe('stopStreaming', () => {
    it('should stop streaming for device with adbTarget', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { adbTarget: 'emulator-5554', toJSON: () => ({ adbTarget: 'emulator-5554' }) };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.stopMirroring.mockReturnValue(true);

      const result = orchestrator.stopStreaming(deviceId);

      expect(mockScrcpyAdapter.stopMirroring).toHaveBeenCalledWith('emulator-5554');
      expect(result).toBe(true);
    });

    it('should throw error when device not found', () => {
      const deviceId = 'non-existent';

      mockDeviceRegistry.getDevice.mockReturnValue(null);

      expect(() => orchestrator.stopStreaming(deviceId)).toThrow(`Device ${deviceId} not found`);
    });

    it('should use device.id as fallback when adbTarget not in runtime state', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = null;

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.stopMirroring.mockReturnValue(true);

      orchestrator.stopStreaming(deviceId);

      expect(mockScrcpyAdapter.stopMirroring).toHaveBeenCalledWith(deviceId);
    });
  });

  describe('getDevice', () => {
    it('should return device when found', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);

      const result = orchestrator.getDevice(deviceId);

      expect(result).toBe(mockDevice);
      expect(mockDeviceRegistry.getDevice).toHaveBeenCalledWith(deviceId);
    });

    it('should return null when device not found', () => {
      const deviceId = 'unknown';

      mockDeviceRegistry.getDevice.mockReturnValue(null);

      const result = orchestrator.getDevice(deviceId);

      expect(result).toBeNull();
    });
  });

  describe('getAllDevices', () => {
    it('should return empty array when no devices', () => {
      mockDeviceRegistry.getAllDevices.mockReturnValue([]);

      const result = orchestrator.getAllDevices();

      expect(result).toEqual([]);
    });

    it('should return array of devices with runtime states', () => {
      const device1 = new Device({ id: 'device-1', deviceFriendlyName: 'Device 1' });
      const device2 = new Device({ id: 'device-2', deviceFriendlyName: 'Device 2' });
      const device3 = new Device({ id: 'device-3', deviceFriendlyName: 'Device 3' });

      const runtimeState1 = { adbTarget: 'emulator-5554', toJSON: () => ({ adbTarget: 'emulator-5554' }) };
      const runtimeState2 = { adbTarget: '192.168.1.10:5555', toJSON: () => ({ adbTarget: '192.168.1.10:5555' }) };
      const runtimeState3 = { adbTarget: 'emulator-5556', toJSON: () => ({ adbTarget: 'emulator-5556' }) };

      mockDeviceRegistry.getAllDevices.mockReturnValue([device1, device2, device3]);
      mockDeviceRegistry.getRuntimeState.mockImplementation((id) => {
        if (id === 'device-1') return runtimeState1;
        if (id === 'device-2') return runtimeState2;
        if (id === 'device-3') return runtimeState3;
        return null;
      });

      const result = orchestrator.getAllDevices();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        device: device1.toJSON(),
        runtimeState: runtimeState1.toJSON()
      });
      expect(result[1]).toEqual({
        device: device2.toJSON(),
        runtimeState: runtimeState2.toJSON()
      });
      expect(result[2]).toEqual({
        device: device3.toJSON(),
        runtimeState: runtimeState3.toJSON()
      });
    });

    it('should return device with null runtime state when runtime state not found', () => {
      const device1 = new Device({ id: 'device-1', deviceFriendlyName: 'Device 1' });

      mockDeviceRegistry.getAllDevices.mockReturnValue([device1]);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(null);

      const result = orchestrator.getAllDevices();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        device: device1.toJSON(),
        runtimeState: null
      });
    });
  });
});
