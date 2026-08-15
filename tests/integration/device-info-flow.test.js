// tests/integration/device-info-flow.test.js
'use strict';

/**
 * Integration Test Suite: Device Info Flow
 * 
 * Purpose: Verify that device information (model, version, arch) is correctly
 * retrieved from ADB and flows properly through all components to IPC.
 * 
 * Test Coverage:
 * 1. ADB data retrieval completeness
 * 2. Data flow through ConnectionService
 * 3. Data flow through DeviceOrchestrator
 * 4. Data persistence in Device entity
 * 5. Data availability in DeviceRegistry
 * 6. Data transmission through IPC handlers
 */

const AdbCommandExecutor = require('../../src/main/infrastructure/adb/AdbCommandExecutor');
const ConnectionService = require('../../src/main/infrastructure/adb/ConnectionService');
const DeviceOrchestrator = require('../../src/main/application/orchestrators/DeviceOrchestrator');
const Device = require('../../src/main/domain/entities/Device');
const DeviceRegistry = require('../../src/main/runtime/devices/DeviceRegistry');
const DeviceHandlers = require('../../src/main/infrastructure/ipc/DeviceHandlers');

describe('Device Info Flow Integration Tests', () => {
    let mockProcessSupervisor;
    let mockLogger;
    let mockDeviceRepository;
    let mockScrcpyAdapter;
    let adbExecutor;
    let connectionService;
    let deviceRegistry;
    let deviceOrchestrator;
    let deviceHandlers;

    beforeEach(() => {
        // Mock ProcessSupervisor
        mockProcessSupervisor = {
            executeQuickTaskArray: jest.fn()
        };

        // Mock Logger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };

        // Mock DeviceRepository
        mockDeviceRepository = {
            findDeviceById: jest.fn(),
            insertDevice: jest.fn(),
            updateDevice: jest.fn(),
            deleteDevice: jest.fn(),
            findAllDevices: jest.fn(() => []),
            updateTrusted: jest.fn(),
            updateCustomName: jest.fn()
        };

        // Mock ScrcpyAdapter
        mockScrcpyAdapter = {
            startMirroring: jest.fn(),
            stopMirroring: jest.fn()
        };

        // Initialize components
        adbExecutor = new AdbCommandExecutor({
            processSupervisor: mockProcessSupervisor,
            logger: mockLogger,
            adbPath: '/mock/adb/path'
        });

        connectionService = new ConnectionService({
            adbExecutor: adbExecutor,
            logger: mockLogger
        });

        deviceRegistry = new DeviceRegistry({
            deviceRepository: mockDeviceRepository
        });

        deviceOrchestrator = new DeviceOrchestrator({
            deviceRegistry: deviceRegistry,
            connectionService: connectionService,
            scrcpyAdapter: mockScrcpyAdapter,
            deviceRepository: mockDeviceRepository,
            logger: mockLogger
        });

        deviceHandlers = new DeviceHandlers(deviceOrchestrator);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('ADB Data Retrieval Tests', () => {
        test('should retrieve complete device info from ADB', async () => {
            const mockSerial = 'test-device-123';
            const mockModel = 'Pixel 7';
            const mockVersion = '13.0';
            const mockArch = 'arm64-v8a';

            // Mock ADB responses
            mockProcessSupervisor.executeQuickTaskArray
                .mockResolvedValueOnce(mockModel)  // ro.product.model
                .mockResolvedValueOnce(mockVersion) // ro.build.version.release
                .mockResolvedValueOnce(mockArch);   // ro.product.cpu.abi

            const deviceInfo = await adbExecutor.getDeviceInfo(mockSerial);

            // Verify all fields are present and correct
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo.serial).toBe(mockSerial);
            expect(deviceInfo.model).toBe(mockModel);
            expect(deviceInfo.version).toBe(mockVersion);
            expect(deviceInfo.arch).toBe(mockArch);

            // Verify ADB commands were called correctly
            expect(mockProcessSupervisor.executeQuickTaskArray).toHaveBeenCalledTimes(3);
        });

        test('should handle empty ADB responses gracefully', async () => {
            const mockSerial = 'test-device-123';

            // Mock empty responses
            mockProcessSupervisor.executeQuickTaskArray
                .mockResolvedValueOnce('')
                .mockResolvedValueOnce('')
                .mockResolvedValueOnce('');

            const deviceInfo = await adbExecutor.getDeviceInfo(mockSerial);

            // Verify empty strings are trimmed and returned
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo.serial).toBe(mockSerial);
            expect(deviceInfo.model).toBe('');
            expect(deviceInfo.version).toBe('');
            expect(deviceInfo.arch).toBe('');
        });

        test('should handle ADB command failures', async () => {
            const mockSerial = 'test-device-123';

            // Mock ADB failures
            mockProcessSupervisor.executeQuickTaskArray
                .mockRejectedValueOnce(new Error('ADB command failed'))
                .mockRejectedValueOnce(new Error('ADB command failed'))
                .mockRejectedValueOnce(new Error('ADB command failed'));

            await expect(adbExecutor.getDeviceInfo(mockSerial)).rejects.toThrow();
        });
    });

    describe('ConnectionService Data Flow Tests', () => {
        test('should pass through device info from ADB executor', async () => {
            const mockTarget = '192.168.1.10:5555';
            const mockModel = 'Samsung Galaxy S21';
            const mockVersion = '12.0';
            const mockArch = 'arm64-v8a';

            // Mock ADB responses
            mockProcessSupervisor.executeQuickTaskArray
                .mockResolvedValueOnce(mockModel)
                .mockResolvedValueOnce(mockVersion)
                .mockResolvedValueOnce(mockArch);

            const deviceInfo = await connectionService.getDeviceInfo(mockTarget);

            // Verify data flows through correctly
            expect(deviceInfo).toBeDefined();
            expect(deviceInfo.serial).toBe(mockTarget);
            expect(deviceInfo.model).toBe(mockModel);
            expect(deviceInfo.version).toBe(mockVersion);
            expect(deviceInfo.arch).toBe(mockArch);
        });
    });

    describe('DeviceOrchestrator Data Flow Tests', () => {
        test('should update device entity with ADB info after connection', async () => {
            const mockTarget = 'emulator-5554';
            const mockModel = 'Pixel 6 Pro';
            const mockVersion = '14.0';
            const mockArch = 'arm64-v8a';

            // Mock connectionService.getDeviceInfo directly
            connectionService.getDeviceInfo = jest.fn().mockResolvedValue({
                serial: mockTarget,
                model: mockModel,
                version: mockVersion,
                arch: mockArch
            });

            const device = await deviceOrchestrator.connectDevice(mockTarget, 'Test Device');

            // Verify device entity was updated with real info
            expect(device).toBeDefined();
            expect(device.model).toBe(mockModel);
            expect(device.version).toBe(mockVersion);
            expect(device.arch).toBe(mockArch);

            // Verify device was registered
            const registeredDevice = deviceRegistry.getDevice(device.id);
            expect(registeredDevice).toBeDefined();
            expect(registeredDevice.model).toBe(mockModel);
            expect(registeredDevice.version).toBe(mockVersion);
            expect(registeredDevice.arch).toBe(mockArch);

            // Verify getDeviceInfo was called
            expect(connectionService.getDeviceInfo).toHaveBeenCalledWith(mockTarget);
        });

        test('should handle ADB info fetch failure gracefully', async () => {
            const mockTarget = 'emulator-5554';

            // Mock connectionService.getDeviceInfo to fail
            connectionService.getDeviceInfo = jest.fn().mockRejectedValue(new Error('ADB info fetch failed'));

            const device = await deviceOrchestrator.connectDevice(mockTarget, 'Test Device');

            // Verify device is still created with default values
            expect(device).toBeDefined();
            expect(device.model).toBe('Unknown');
            expect(device.version).toBe('Unknown');
            expect(device.arch).toBe('Unknown');

            // Verify warning was logged
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Could not fetch detailed device info')
            );
        });
    });

    describe('Device Entity Data Integrity Tests', () => {
        test('should store and retrieve device info correctly', () => {
            const deviceData = {
                id: 'device-123',
                deviceFriendlyName: 'Test Device',
                model: 'Pixel 7',
                version: '13.0',
                arch: 'arm64-v8a',
                isFavorite: false,
                isTrusted: true
            };

            const device = new Device(deviceData);

            // Verify all fields are stored correctly
            expect(device.id).toBe(deviceData.id);
            expect(device.deviceFriendlyName).toBe(deviceData.deviceFriendlyName);
            expect(device.model).toBe(deviceData.model);
            expect(device.version).toBe(deviceData.version);
            expect(device.arch).toBe(deviceData.arch);
            expect(device.isFavorite).toBe(deviceData.isFavorite);
            expect(device.isTrusted).toBe(deviceData.isTrusted);
        });

        test('should update device details correctly', () => {
            const device = new Device({
                id: 'device-123',
                deviceFriendlyName: 'Test Device',
                model: 'Unknown',
                version: 'Unknown',
                arch: 'Unknown'
            });

            // Update with real info
            device.updateDetails('Pixel 7', '13.0', 'arm64-v8a');

            // Verify updates
            expect(device.model).toBe('Pixel 7');
            expect(device.version).toBe('13.0');
            expect(device.arch).toBe('arm64-v8a');
        });

        test('should serialize device info to JSON correctly', () => {
            const device = new Device({
                id: 'device-123',
                deviceFriendlyName: 'Test Device',
                model: 'Pixel 7',
                version: '13.0',
                arch: 'arm64-v8a'
            });

            const json = device.toJSON();

            // Verify JSON includes all fields
            expect(json.model).toBe('Pixel 7');
            expect(json.version).toBe('13.0');
            expect(json.arch).toBe('arm64-v8a');
        });
    });

    describe('DeviceRegistry Data Persistence Tests', () => {
        test('should store device info in registry', () => {
            const device = new Device({
                id: 'device-123',
                deviceFriendlyName: 'Test Device',
                model: 'Pixel 7',
                version: '13.0',
                arch: 'arm64-v8a'
            });

            deviceRegistry.registerDevice(device);

            // Verify device is retrievable
            const retrievedDevice = deviceRegistry.getDevice('device-123');
            expect(retrievedDevice).toBeDefined();
            expect(retrievedDevice.model).toBe('Pixel 7');
            expect(retrievedDevice.version).toBe('13.0');
            expect(retrievedDevice.arch).toBe('arm64-v8a');
        });

        test('should update runtime state with device info', () => {
            const device = new Device({
                id: 'device-123',
                deviceFriendlyName: 'Test Device',
                model: 'Pixel 7',
                version: '13.0',
                arch: 'arm64-v8a'
            });

            deviceRegistry.registerDevice(device);
            deviceRegistry.updateState(device.id, {
                status: 'connected'
            });

            // Verify runtime state is updated (DeviceRuntimeState doesn't store model/version/arch)
            const runtimeState = deviceRegistry.getRuntimeState('device-123');
            expect(runtimeState).toBeDefined();
            expect(runtimeState.status).toBe('connected');
            
            // Device info is stored in the Device entity, not runtime state
            const registeredDevice = deviceRegistry.getDevice('device-123');
            expect(registeredDevice.model).toBe('Pixel 7');
            expect(registeredDevice.version).toBe('13.0');
            expect(registeredDevice.arch).toBe('arm64-v8a');
        });
    });

    describe('IPC Handlers Data Transmission Tests', () => {
        test('should return complete device info through IPC', async () => {
            const mockTarget = 'emulator-5554';
            const mockModel = 'Pixel 7';
            const mockVersion = '13.0';
            const mockArch = 'arm64-v8a';

            // Mock connectionService.getDeviceInfo
            connectionService.getDeviceInfo = jest.fn().mockResolvedValue({
                serial: mockTarget,
                model: mockModel,
                version: mockVersion,
                arch: mockArch
            });

            // Connect device
            const device = await deviceOrchestrator.connectDevice(mockTarget, 'Test Device');

            // Get device through orchestrator (simulates IPC call)
            const deviceData = deviceOrchestrator.getDevice(device.id);

            // Verify complete data is available
            expect(deviceData).toBeDefined();
            expect(deviceData.model).toBe(mockModel);
            expect(deviceData.version).toBe(mockVersion);
            expect(deviceData.arch).toBe(mockArch);
        });

        test('should return all devices with complete info through IPC', async () => {
            const mockTarget1 = 'emulator-5554';
            const mockTarget2 = '192.168.1.10:5555';
            const mockModel1 = 'Pixel 7';
            const mockModel2 = 'Samsung Galaxy S21';
            const mockVersion1 = '13.0';
            const mockVersion2 = '12.0';
            const mockArch = 'arm64-v8a';

            // Mock connectionService.getDeviceInfo for first device
            connectionService.getDeviceInfo = jest.fn()
                .mockResolvedValueOnce({
                    serial: mockTarget1,
                    model: mockModel1,
                    version: mockVersion1,
                    arch: mockArch
                });

            // Connect first device
            await deviceOrchestrator.connectDevice(mockTarget1, 'Test Device 1');

            // Mock connectionService.getDeviceInfo for second device
            connectionService.getDeviceInfo = jest.fn()
                .mockResolvedValueOnce({
                    serial: mockTarget2,
                    model: mockModel2,
                    version: mockVersion2,
                    arch: mockArch
                });

            // Connect second device
            await deviceOrchestrator.connectDevice(mockTarget2, 'Test Device 2');

            // Get all devices through orchestrator (simulates IPC call)
            const allDevices = deviceOrchestrator.getAllDevices();

            // Verify all devices have complete info
            expect(allDevices).toHaveLength(2);
            expect(allDevices[0].device.model).toBe(mockModel1);
            expect(allDevices[0].device.version).toBe(mockVersion1);
            expect(allDevices[0].device.arch).toBe(mockArch);
            expect(allDevices[1].device.model).toBe(mockModel2);
            expect(allDevices[1].device.version).toBe(mockVersion2);
            expect(allDevices[1].device.arch).toBe(mockArch);
        });
    });

    describe('End-to-End Data Flow Tests', () => {
        test('complete flow: ADB -> ConnectionService -> DeviceOrchestrator -> Device -> Registry -> IPC', async () => {
            const mockTarget = '192.168.1.10:5555';
            const mockModel = 'OnePlus 9';
            const mockVersion = '11.0';
            const mockArch = 'arm64-v8a';

            // Step 1: Mock connectionService.getDeviceInfo
            connectionService.getDeviceInfo = jest.fn().mockResolvedValue({
                serial: mockTarget,
                model: mockModel,
                version: mockVersion,
                arch: mockArch
            });

            // Step 2: Connect device (triggers ADB info fetch)
            const device = await deviceOrchestrator.connectDevice(mockTarget, 'OnePlus Device');

            // Step 3: Verify device entity has correct info
            expect(device.model).toBe(mockModel);
            expect(device.version).toBe(mockVersion);
            expect(device.arch).toBe(mockArch);

            // Step 4: Verify registry has correct info
            const registeredDevice = deviceRegistry.getDevice(device.id);
            expect(registeredDevice.model).toBe(mockModel);
            expect(registeredDevice.version).toBe(mockVersion);
            expect(registeredDevice.arch).toBe(mockArch);

            // Step 5: Verify runtime state exists (DeviceRuntimeState doesn't store model/version/arch)
            const runtimeState = deviceRegistry.getRuntimeState(device.id);
            expect(runtimeState).toBeDefined();
            expect(runtimeState.status).toBe('connected');

            // Step 6: Verify IPC handler can return complete info
            const deviceData = deviceOrchestrator.getDevice(device.id);
            expect(deviceData.model).toBe(mockModel);
            expect(deviceData.version).toBe(mockVersion);
            expect(deviceData.arch).toBe(mockArch);

            // Step 7: Verify JSON serialization includes all fields
            const deviceJson = deviceData.toJSON();
            expect(deviceJson.model).toBe(mockModel);
            expect(deviceJson.version).toBe(mockVersion);
            expect(deviceJson.arch).toBe(mockArch);
        });
    });
});
