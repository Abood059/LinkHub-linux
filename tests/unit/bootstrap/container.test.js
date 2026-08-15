'use strict';

// Mock all heavy infrastructure dependencies before importing the container
jest.mock('../../../src/main/infrastructure/logging', () => ({
    errorCentralService: {
        init: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../../src/main/infrastructure/persistence/DatabaseManager');
jest.mock('../../../src/main/infrastructure/adb/AdbCommandExecutor');
jest.mock('../../../src/main/infrastructure/adb/ConnectionService');
jest.mock('../../../src/main/infrastructure/streaming/ScrcpyAdapter');
jest.mock('../../../src/main/infrastructure/media/YtdlpAdapter');
jest.mock('../../../src/main/infrastructure/tools/ToolPathResolver');
jest.mock('../../../src/main/application/orchestrators/DeviceOrchestrator');
jest.mock('../../../src/main/application/orchestrators/DownloadOrchestrator');
jest.mock('../../../src/main/infrastructure/sync/StateSyncService');

const container = require('../../../src/main/bootstrap/container');

describe('BootstrapContainer', () => {
    beforeEach(() => {
        // Reset container state before each test
        container._services.clear();
        container._initialized = false;
        container._windowManager = null;
        container._stateSyncService = null;
    });

    describe('initialize()', () => {
        it('should register all required services in the services map', () => {
            container.initialize();

            const requiredServices = [
                'errorCentralService',
                'processManager',
                'processRegistry',
                'processSupervisor',
                'deviceRegistry',
                'databaseManager',
                'adbCommandExecutor',
                'connectionService',
                'scrcpyAdapter',
                'ytdlpAdapter',
                'deviceOrchestrator',
                'downloadOrchestrator',
                'toolPathResolver',
                'deviceEventHandler'
            ];

            requiredServices.forEach(serviceName => {
                expect(container._services.has(serviceName)).toBe(true);
                expect(container.resolve(serviceName)).not.toBeNull();
            });
        });

        it('should set _initialized to true after initialization', () => {
            expect(container._initialized).toBe(false);
            
            container.initialize();
            
            expect(container._initialized).toBe(true);
        });

        it('should call errorCentralService.init() during initialization', () => {
            const { errorCentralService } = require('../../../src/main/infrastructure/logging');
            
            container.initialize();
            
            expect(errorCentralService.init).toHaveBeenCalled();
        });

        it('should be idempotent - calling initialize twice does not re-register services', () => {
            container.initialize();
            const servicesSizeAfterFirstInit = container._services.size;
            
            container.initialize();
            
            expect(container._services.size).toBe(servicesSizeAfterFirstInit);
            expect(container._initialized).toBe(true);
        });
    });

    describe('resolve()', () => {
        beforeEach(() => {
            container.initialize();
        });

        it('should return the correct service object for existing service', () => {
            const deviceOrchestrator = container.resolve('deviceOrchestrator');
            
            expect(deviceOrchestrator).not.toBeNull();
            expect(deviceOrchestrator).toBeDefined();
        });

        it('should return null for non-existent service', () => {
            const nonExistent = container.resolve('nonExistentService');
            
            expect(nonExistent).toBeNull();
        });

        it('should return the same instance on multiple calls', () => {
            const firstCall = container.resolve('deviceOrchestrator');
            const secondCall = container.resolve('deviceOrchestrator');
            
            expect(firstCall).toBe(secondCall);
        });
    });

    describe('setWindowManager()', () => {
        beforeEach(() => {
            container.initialize();
        });

        it('should set the window manager reference', () => {
            const mockWindowManager = {
                broadcast: jest.fn(),
                sendTo: jest.fn()
            };
            
            container.setWindowManager(mockWindowManager);
            
            expect(container._windowManager).toBe(mockWindowManager);
        });

        it('should create StateSyncService instance', () => {
            const mockWindowManager = {
                broadcast: jest.fn(),
                sendTo: jest.fn()
            };
            const StateSyncService = require('../../../src/main/infrastructure/sync/StateSyncService');
            
            container.setWindowManager(mockWindowManager);
            
            expect(StateSyncService).toHaveBeenCalledWith(
                mockWindowManager,
                container.resolve('deviceRegistry'),
                { interval: 100 }
            );
            expect(container._stateSyncService).not.toBeNull();
        });

        it('should call start() on StateSyncService', () => {
            const mockWindowManager = {
                broadcast: jest.fn(),
                sendTo: jest.fn()
            };
            const StateSyncService = require('../../../src/main/infrastructure/sync/StateSyncService');
            const mockStateSyncService = {
                start: jest.fn(),
                onDownloadProgress: jest.fn(),
                onDownloadComplete: jest.fn(),
                onDownloadError: jest.fn(),
                onDownloadStopped: jest.fn()
            };
            StateSyncService.mockImplementation(() => mockStateSyncService);
            
            container.setWindowManager(mockWindowManager);
            
            expect(mockStateSyncService.start).toHaveBeenCalled();
        });

        it('should call setStateSyncService on deviceEventHandler', () => {
            const mockWindowManager = {
                broadcast: jest.fn(),
                sendTo: jest.fn()
            };
            const StateSyncService = require('../../../src/main/infrastructure/sync/StateSyncService');
            const mockStateSyncService = {
                start: jest.fn(),
                onDownloadProgress: jest.fn(),
                onDownloadComplete: jest.fn(),
                onDownloadError: jest.fn(),
                onDownloadStopped: jest.fn()
            };
            StateSyncService.mockImplementation(() => mockStateSyncService);
            
            const deviceEventHandler = container.resolve('deviceEventHandler');
            deviceEventHandler.setStateSyncService = jest.fn();
            
            container.setWindowManager(mockWindowManager);
            
            expect(deviceEventHandler.setStateSyncService).toHaveBeenCalledWith(mockStateSyncService);
        });

        it('should register event listeners on ytdlpAdapter', () => {
            const mockWindowManager = {
                broadcast: jest.fn(),
                sendTo: jest.fn()
            };
            const StateSyncService = require('../../../src/main/infrastructure/sync/StateSyncService');
            const mockStateSyncService = {
                start: jest.fn(),
                onDownloadProgress: jest.fn(),
                onDownloadComplete: jest.fn(),
                onDownloadError: jest.fn(),
                onDownloadStopped: jest.fn()
            };
            StateSyncService.mockImplementation(() => mockStateSyncService);
            
            const ytdlpAdapter = container.resolve('ytdlpAdapter');
            ytdlpAdapter.on = jest.fn();
            
            container.setWindowManager(mockWindowManager);
            
            expect(ytdlpAdapter.on).toHaveBeenCalledWith('downloadProgress', expect.any(Function));
            expect(ytdlpAdapter.on).toHaveBeenCalledWith('downloadComplete', expect.any(Function));
            expect(ytdlpAdapter.on).toHaveBeenCalledWith('downloadError', expect.any(Function));
            expect(ytdlpAdapter.on).toHaveBeenCalledWith('downloadStopped', expect.any(Function));
        });
    });

    describe('getWindowManager()', () => {
        it('should return null when window manager is not set', () => {
            expect(container.getWindowManager()).toBeNull();
        });

        it('should return the window manager when set', () => {
            const mockWindowManager = {
                broadcast: jest.fn(),
                sendTo: jest.fn()
            };
            
            container.setWindowManager(mockWindowManager);
            
            expect(container.getWindowManager()).toBe(mockWindowManager);
        });
    });
});
