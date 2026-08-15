const DeviceOrchestrator = require('../../../../src/main/application/orchestrators/DeviceOrchestrator');
const Device = require('../../../../src/main/domain/entities/Device');

// Mock dependencies
jest.mock('../../../../src/main/runtime/devices/DeviceRegistry');
jest.mock('../../../../src/main/infrastructure/adb/ConnectionService');
jest.mock('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const ConnectionService = require('../../../../src/main/infrastructure/adb/ConnectionService');
const ScrcpyAdapter = require('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

describe('DeviceOrchestrator Security Tests', () => {
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

  describe('Indirect Injection Prevention', () => {
    // Test #1: Command injection in target (TCP/IP connection)
    test('should pass malicious target to connectionService.connect unchanged', async () => {
      const maliciousTarget = '192.168.1.10:5555; rm -rf /';
      const friendlyName = 'Test';

      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Test', version: '1', arch: 'arm64' });

      await orchestrator.connectDevice(maliciousTarget, friendlyName);

      // SECURITY: Verify the orchestrator passes the malicious value unchanged
      // The Infrastructure layer (ConnectionService) is responsible for sanitization
      expect(mockConnectionService.connect).toHaveBeenCalledWith(maliciousTarget);
    });

    // Test #2: Command injection in target (USB connection)
    test('should pass malicious target to device.registerDevice unchanged for USB connection', async () => {
      const maliciousTarget = 'emulator-5554 | whoami';
      const friendlyName = 'Test';

      mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Test', version: '1', arch: 'arm64' });

      await orchestrator.connectDevice(maliciousTarget, friendlyName);

      // SECURITY: Verify the malicious target is stored in the Device entity
      // This value may be used as adbTarget fallback, so it must reach the registry unchanged
      const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
      expect(registeredDevice).toBeInstanceOf(Device);
      expect(registeredDevice.deviceFriendlyName).toBe(friendlyName);
      // The device.id will contain the malicious target (used as adbTarget fallback)
      expect(registeredDevice.id).toContain(maliciousTarget.replace(/:/g, '-'));
    });

    // Test #3: Command injection in host (pairing)
    test('should pass malicious host to connectionService.pair unchanged', async () => {
      const maliciousHost = '192.168.1.10:37000 & whoami';
      const pairingCode = '123456';

      mockConnectionService.pair.mockResolvedValue(['paired']);

      await orchestrator.pairDevice(maliciousHost, pairingCode);

      // SECURITY: Verify the orchestrator passes the malicious value unchanged
      // The Infrastructure layer (ConnectionService) is responsible for sanitization
      expect(mockConnectionService.pair).toHaveBeenCalledWith(maliciousHost, pairingCode);
    });

    // Test #4: Command injection in deviceId (start streaming)
    test('should pass malicious deviceId to getRuntimeState and use as adbTarget unchanged', () => {
      const maliciousDeviceId = 'device;id';
      const mockDevice = new Device({ id: maliciousDeviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { 
        status: 'connected',
        adbTarget: null, 
        toJSON: () => ({ status: 'connected', adbTarget: null }) 
      };
      const options = {};

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.startMirroring.mockReturnValue('process-id');

      orchestrator.startStreaming(maliciousDeviceId, options);

      // SECURITY: Verify the malicious deviceId is passed to getRuntimeState
      expect(mockDeviceRegistry.getRuntimeState).toHaveBeenCalledWith(maliciousDeviceId);
      // SECURITY: When no adbTarget in runtime state, device.id is used as fallback
      // This means the malicious deviceId will be passed to ScrcpyAdapter
      expect(mockScrcpyAdapter.startMirroring).toHaveBeenCalledWith(maliciousDeviceId, options);
    });

    // Test #5: Command injection in deviceId (stop streaming)
    test('should pass malicious deviceId to getRuntimeState and use as adbTarget unchanged for stop', () => {
      const maliciousDeviceId = 'device;id';
      const mockDevice = new Device({ id: maliciousDeviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { adbTarget: null, toJSON: () => ({ adbTarget: null }) };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.stopMirroring.mockReturnValue(true);

      orchestrator.stopStreaming(maliciousDeviceId);

      // SECURITY: Verify the malicious deviceId is passed to getRuntimeState
      expect(mockDeviceRegistry.getRuntimeState).toHaveBeenCalledWith(maliciousDeviceId);
      // SECURITY: When no adbTarget in runtime state, device.id is used as fallback
      expect(mockScrcpyAdapter.stopMirroring).toHaveBeenCalledWith(maliciousDeviceId);
    });
  });

  describe('Device Permission Checks', () => {
    // Test #6: Prevent streaming for offline device
    test('should throw error when starting streaming for offline device', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { 
        status: 'offline', 
        adbTarget: 'emulator-5554',
        toJSON: () => ({ status: 'offline', adbTarget: 'emulator-5554' })
      };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);

      // SECURITY: The orchestrator should enforce device status checks
      // Currently, the implementation does NOT check status - this test will FAIL
      // revealing a security control gap
      expect(() => orchestrator.startStreaming(deviceId)).toThrow();
    });

    // Test #7: Prevent streaming for discovered device
    test('should throw error when starting streaming for discovered device', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { 
        status: 'discovered', 
        adbTarget: 'emulator-5554',
        toJSON: () => ({ status: 'discovered', adbTarget: 'emulator-5554' })
      };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);

      // SECURITY: The orchestrator should enforce device status checks
      // Currently, the implementation does NOT check status - this test will FAIL
      expect(() => orchestrator.startStreaming(deviceId)).toThrow();
    });

    // Test #8: Allow streaming only for connected device
    test('should allow streaming when device status is connected', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { 
        status: 'connected', 
        adbTarget: 'emulator-5554',
        toJSON: () => ({ status: 'connected', adbTarget: 'emulator-5554' })
      };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.startMirroring.mockReturnValue('process-id');

      const result = orchestrator.startStreaming(deviceId);

      // SECURITY: When status is 'connected', streaming should be allowed
      expect(mockScrcpyAdapter.startMirroring).toHaveBeenCalledWith('emulator-5554', {});
      expect(result).toBe('process-id');
    });

    // Test #9: stopStreaming should not check status (always allowed)
    test('should call stopMirroring even for offline device (no status check)', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { 
        status: 'offline', 
        adbTarget: 'emulator-5554',
        toJSON: () => ({ status: 'offline', adbTarget: 'emulator-5554' })
      };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.stopMirroring.mockReturnValue(true);

      const result = orchestrator.stopStreaming(deviceId);

      // SECURITY: stopStreaming should always be allowed (no status check)
      // This is correct behavior - stopping should not be blocked
      expect(mockScrcpyAdapter.stopMirroring).toHaveBeenCalledWith('emulator-5554');
      expect(result).toBe(true);
    });
  });

  describe('Large and Malformed Inputs', () => {
    // Test #10: Very long target (10,000 characters)
    test('should handle 10000 character target without crashing', async () => {
      const longTarget = 'a'.repeat(10000);
      const friendlyName = 'Test';

      mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Test', version: '1', arch: 'arm64' });

      // SECURITY: Should not throw exception or crash with large input
      const result = await orchestrator.connectDevice(longTarget, friendlyName);

      expect(result).toBeInstanceOf(Device);
      expect(mockDeviceRegistry.registerDevice).toHaveBeenCalled();
    });

    // Test #11: Options with unknown keys
    test('should pass options with unknown keys to scrcpyAdapter unchanged', () => {
      const deviceId = 'device-123';
      const mockDevice = new Device({ id: deviceId, deviceFriendlyName: 'Test Device' });
      const mockRuntimeState = { 
        status: 'connected',
        adbTarget: 'emulator-5554',
        toJSON: () => ({ status: 'connected', adbTarget: 'emulator-5554' })
      };
      const maliciousOptions = { unknown: true, malicious: 'value', validOption: 'test' };

      mockDeviceRegistry.getDevice.mockReturnValue(mockDevice);
      mockDeviceRegistry.getRuntimeState.mockReturnValue(mockRuntimeState);
      mockScrcpyAdapter.startMirroring.mockReturnValue('process-id');

      orchestrator.startStreaming(deviceId, maliciousOptions);

      // SECURITY: The orchestrator should pass the options object unchanged
      // The ScrcpyAdapter is responsible for validating/ignoring unknown options
      expect(mockScrcpyAdapter.startMirroring).toHaveBeenCalledWith('emulator-5554', maliciousOptions);
    });

    // Test #12: Very long friendlyName (10,000 characters)
    test('should handle 10000 character friendlyName without crashing', async () => {
      const target = 'emulator-5554';
      const longFriendlyName = 'x'.repeat(10000);

      mockConnectionService.getDeviceInfo.mockResolvedValue({ model: 'Test', version: '1', arch: 'arm64' });

      // SECURITY: Should not throw exception or crash with large input
      const result = await orchestrator.connectDevice(target, longFriendlyName);

      expect(result).toBeInstanceOf(Device);
      
      // Verify the long friendlyName is passed to Device without modification
      const registeredDevice = mockDeviceRegistry.registerDevice.mock.calls[0][0];
      expect(registeredDevice.deviceFriendlyName).toBe(longFriendlyName);
    });
  });
});
