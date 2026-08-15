// DeviceOrchestrator.resilience.test.js
const DeviceOrchestrator = require('../../../../src/main/application/orchestrators/DeviceOrchestrator');
const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const Device = require('../../../../src/main/domain/entities/Device');

jest.mock('../../../../src/main/infrastructure/adb/ConnectionService');
jest.mock('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

const ConnectionService = require('../../../../src/main/infrastructure/adb/ConnectionService');
const ScrcpyAdapter = require('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

describe('DeviceOrchestrator Resilience', () => {
  let registry;
  let orchestrator;
  let mockConnectionService;
  let mockScrcpyAdapter;
  let mockLogger;

  beforeEach(() => {
    // Use REAL DeviceRegistry to verify state consistency
    registry = new DeviceRegistry();
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    mockConnectionService = new ConnectionService();
    mockScrcpyAdapter = new ScrcpyAdapter();

    orchestrator = new DeviceOrchestrator({
      deviceRegistry: registry,
      connectionService: mockConnectionService,
      scrcpyAdapter: mockScrcpyAdapter,
      logger: mockLogger
    });

    jest.clearAllMocks();
  });

  afterEach(() => registry.clear());

  describe('Group A: Connection and Registration Failures', () => {
    // Test #1: connectionService.connect fails (TCP/IP)
    test('should NOT register device when connectionService.connect fails', async () => {
      // CRITICAL: If connect fails, no device should be registered
      // This prevents partial state that could leak memory or cause confusion
      mockConnectionService.connect.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(orchestrator.connectDevice('192.168.1.10:5555')).rejects.toThrow('ECONNREFUSED');
      
      // Verify no device was registered (registry should be empty)
      expect(registry.getAllDevices()).toHaveLength(0);
      expect(mockConnectionService.connect).toHaveBeenCalledWith('192.168.1.10:5555');
      
      // Verify no success logging occurred
      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    // Test #2: getDeviceInfo fails after successful connect
    test('should register device with default data when getDeviceInfo fails after successful connection', async () => {
      // CRITICAL: Connection succeeded but device info fetch failed
      // System should continue with default data rather than failing completely
      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockRejectedValue(new Error('ADB timeout'));

      const device = await orchestrator.connectDevice('emulator-5554');

      // Verify device WAS registered (partial success)
      expect(registry.getAllDevices()).toHaveLength(1);
      expect(device.model).toBe('Unknown');
      expect(device.version).toBe('Unknown');
      expect(device.arch).toBe('Unknown');
      expect(device.isNew).toBe(true);
      
      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch detailed device info')
      );
      
      // Verify runtime state was updated to 'connected'
      const runtimeState = registry.getRuntimeState(device.id);
      expect(runtimeState.status).toBe('connected');
      expect(runtimeState.adbTarget).toBe('emulator-5554');
    });

    // Test #3: getDeviceInfo fails with TypeError (invalid data)
    test('should register device with default data when getDeviceInfo throws TypeError', async () => {
      // CRITICAL: Same as #2 but with different error type
      // System should handle various error types consistently
      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockRejectedValue(new TypeError('Cannot read property "model" of undefined'));

      const device = await orchestrator.connectDevice('192.168.1.10:5555');

      // Verify device WAS registered with defaults
      expect(registry.getAllDevices()).toHaveLength(1);
      expect(device.model).toBe('Unknown');
      expect(device.version).toBe('Unknown');
      expect(device.arch).toBe('Unknown');
      
      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not fetch detailed device info')
      );
    });
  });

  describe('Group B: Streaming Failures', () => {
    // Test #4: scrcpyAdapter.startMirroring fails
    test('should re-throw error when scrcpyAdapter.startMirroring fails', async () => {
      // CRITICAL: Streaming failure should not corrupt device state
      // Error should be propagated to caller for proper handling
      const deviceId = 'device-123';
      const mockDevice = new Device({
        id: deviceId,
        deviceFriendlyName: 'Test Device',
        model: 'Pixel 6',
        version: '13',
        arch: 'arm64',
        isNew: false
      });
      
      registry.registerDevice(mockDevice);
      registry.updateState(deviceId, {
        status: 'connected',
        adbTarget: 'emulator-5554',
        connectionType: 'USB'
      });

      mockScrcpyAdapter.startMirroring.mockImplementation(() => {
        throw new Error('Scrcpy binary not found');
      });

      expect(() => orchestrator.startStreaming(deviceId)).toThrow('Scrcpy binary not found');
      
      // Verify device state remains unchanged (no corruption)
      const runtimeState = registry.getRuntimeState(deviceId);
      expect(runtimeState.status).toBe('connected');
    });

    // Test #5: startStreaming for non-existent device
    test('should throw error when startStreaming called for non-existent device', () => {
      // CRITICAL: Logical failure - device doesn't exist
      // Should fail fast without calling infrastructure layer
      const deviceId = 'non-existent-device';

      expect(() => orchestrator.startStreaming(deviceId)).toThrow(`Device ${deviceId} not found`);
      
      // Verify scrcpyAdapter was never called (no side effects)
      expect(mockScrcpyAdapter.startMirroring).not.toHaveBeenCalled();
    });

    // Test #6: scrcpyAdapter rejects due to active mirroring
    test('should re-throw error when scrcpyAdapter reports mirroring already active', () => {
      // CRITICAL: Infrastructure layer reports conflict
      // Orchestrator should pass this error through unchanged
      const deviceId = 'device-123';
      const mockDevice = new Device({
        id: deviceId,
        deviceFriendlyName: 'Test Device',
        model: 'Pixel 6',
        version: '13',
        arch: 'arm64',
        isNew: false
      });
      
      registry.registerDevice(mockDevice);
      registry.updateState(deviceId, {
        status: 'connected',
        adbTarget: 'emulator-5554',
        connectionType: 'USB'
      });

      mockScrcpyAdapter.startMirroring.mockImplementation(() => {
        throw new Error('Mirroring already active');
      });

      expect(() => orchestrator.startStreaming(deviceId)).toThrow('Mirroring already active');
    });
  });

  describe('Group C: Concurrency and Edge Cases', () => {
    // Test #7: connectDevice called twice for same target
    test('should register two different devices when connectDevice called twice for same target', async () => {
      // CRITICAL: Device ID includes timestamp, so same target = different devices
      // This prevents conflicts and allows multiple connection attempts
      // Using TCP/IP target (with colon) to trigger connect() call
      mockConnectionService.connect.mockResolvedValue('connected');
      mockConnectionService.getDeviceInfo.mockResolvedValue({
        model: 'Pixel 6',
        version: '13',
        arch: 'arm64'
      });

      const device1 = await orchestrator.connectDevice('192.168.1.10:5555');
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      const device2 = await orchestrator.connectDevice('192.168.1.10:5555');

      // Verify two devices were registered with different IDs
      expect(registry.getAllDevices()).toHaveLength(2);
      expect(device1.id).not.toBe(device2.id);
      expect(device1.id).toContain('192.168.1.10-5555');
      expect(device2.id).toContain('192.168.1.10-5555');
      
      // Verify no conflicts or exceptions occurred
      expect(mockConnectionService.connect).toHaveBeenCalledTimes(2);
    });

    // Test #8: getAllDevices during concurrent registry modifications
    test('should return consistent data when getAllDevices called during registry modifications', async () => {
      // CRITICAL: Concurrency test - ensure getAllDevices returns consistent data
      // This prevents ConcurrentModificationException-like issues
      const mockDevice1 = new Device({
        id: 'device-1',
        deviceFriendlyName: 'Device 1',
        model: 'Pixel 6',
        version: '13',
        arch: 'arm64',
        isNew: false
      });
      const mockDevice2 = new Device({
        id: 'device-2',
        deviceFriendlyName: 'Device 2',
        model: 'Pixel 7',
        version: '14',
        arch: 'arm64',
        isNew: false
      });

      registry.registerDevice(mockDevice1);
      registry.registerDevice(mockDevice2);

      // Simulate concurrent operations using Promise.all
      const results = await Promise.all([
        Promise.resolve(orchestrator.getAllDevices()),
        Promise.resolve(registry.removeDevice('device-1')),
        Promise.resolve(orchestrator.getAllDevices())
      ]);

      // Verify getAllDevices returns consistent data (no crashes)
      expect(results[0]).toHaveLength(2);
      expect(results[2]).toHaveLength(1);
      
      // Verify DeviceRegistry.getAllDevices uses Array.from (returns a new array each time)
      const devices1 = registry.getAllDevices();
      const devices2 = registry.getAllDevices();
      
      // Each call should return a different array reference (Array.from creates new array)
      expect(devices1).not.toBe(devices2);
      // But they should have the same content at the moment of call
      expect(devices1).toHaveLength(1);
      expect(devices2).toHaveLength(1);
    });

    // Test #9: stopStreaming when no active mirroring
    test('should pass through result when stopStreaming called for device with no active mirroring', () => {
      // CRITICAL: Stop operation should not fail even if nothing to stop
      // Orchestrator should pass through the adapter's response unchanged
      const deviceId = 'device-123';
      const mockDevice = new Device({
        id: deviceId,
        deviceFriendlyName: 'Test Device',
        model: 'Pixel 6',
        version: '13',
        arch: 'arm64',
        isNew: false
      });
      
      registry.registerDevice(mockDevice);
      registry.updateState(deviceId, {
        status: 'connected',
        adbTarget: 'emulator-5554',
        connectionType: 'USB'
      });

      // Adapter returns false (no active process)
      mockScrcpyAdapter.stopMirroring.mockReturnValue(false);

      const result = orchestrator.stopStreaming(deviceId);

      // Verify result is passed through unchanged
      expect(result).toBe(false);
      expect(mockScrcpyAdapter.stopMirroring).toHaveBeenCalledWith('emulator-5554');
    });
  });
});
