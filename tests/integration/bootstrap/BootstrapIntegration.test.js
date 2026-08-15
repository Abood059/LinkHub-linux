// tests/integration/bootstrap/BootstrapIntegration.test.js
'use strict';

// Mock Electron completely (we don't want to run actual windows)
jest.mock('electron', () => ({
    app: {
        whenReady: jest.fn().mockResolvedValue()
    },
    BrowserWindow: jest.fn(),
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    }
}));

// Mock heavy infrastructure components to prevent running actual processes
jest.mock('../../../src/main/infrastructure/adb/AdbCommandExecutor');
jest.mock('../../../src/main/infrastructure/media/YtdlpAdapter');
jest.mock('../../../src/main/infrastructure/streaming/ScrcpyAdapter');

// Mock ToolPathResolver with configurable verifyAll
let mockVerifyAllResult = { adb: true, scrcpy: true, ytdlp: true };
class MockToolPathResolver {
    constructor(options) {
        this._logger = options?.logger || null;
    }
    verifyAll() {
        return mockVerifyAllResult;
    }
}
jest.mock('../../../src/main/infrastructure/tools/ToolPathResolver', () => MockToolPathResolver);

jest.mock('../../../src/main/infrastructure/persistence/DatabaseManager');

describe('Bootstrap Integration Tests', () => {
    let mockWindowInstance;
    let mockWindowManager;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.resetModules();

        // Setup mock window instance
        mockWindowInstance = {
            loadFile: jest.fn(),
            once: jest.fn((event, callback) => {
                if (event === 'ready-to-show') {
                    setTimeout(callback, 10);
                }
            }),
            show: jest.fn(),
            webContents: { send: jest.fn() },
            isDestroyed: jest.fn(() => false)
        };

        const { BrowserWindow } = require('electron');
        BrowserWindow.mockImplementation(() => mockWindowInstance);

        // Setup mock window manager
        mockWindowManager = {
            broadcast: jest.fn(),
            sendTo: jest.fn(),
            getWindow: jest.fn(() => mockWindowInstance)
        };
    });

    describe('1. Container initialization and service registration', () => {
        it('should initialize container and register all core services', () => {
            const container = require('../../../src/main/bootstrap/container');
            
            container.initialize();

            // Verify all core services are resolvable
            const deviceRegistry = container.resolve('deviceRegistry');
            const connectionService = container.resolve('connectionService');
            const deviceOrchestrator = container.resolve('deviceOrchestrator');
            const downloadOrchestrator = container.resolve('downloadOrchestrator');
            const ytdlpAdapter = container.resolve('ytdlpAdapter');
            const scrcpyAdapter = container.resolve('scrcpyAdapter');
            const deviceEventHandler = container.resolve('deviceEventHandler');

            expect(deviceRegistry).not.toBeNull();
            expect(connectionService).not.toBeNull();
            expect(deviceOrchestrator).not.toBeNull();
            expect(downloadOrchestrator).not.toBeNull();
            expect(ytdlpAdapter).not.toBeNull();
            expect(scrcpyAdapter).not.toBeNull();
            expect(deviceEventHandler).not.toBeNull();
        });

        it('should correctly inject dependencies into orchestrators', () => {
            const container = require('../../../src/main/bootstrap/container');
            
            container.initialize();

            const deviceRegistry = container.resolve('deviceRegistry');
            const deviceOrchestrator = container.resolve('deviceOrchestrator');

            // Verify dependency injection: deviceOrchestrator should have the same deviceRegistry
            expect(deviceOrchestrator._deviceRegistry).toBe(deviceRegistry);
        });
    });

    describe('2. StateSyncService wiring via setWindowManager', () => {
        it('should create StateSyncService when WindowManager is set', () => {
            const container = require('../../../src/main/bootstrap/container');
            
            container.initialize();

            expect(container._stateSyncService).toBeNull();

            container.setWindowManager(mockWindowManager);

            expect(container._stateSyncService).not.toBeNull();
        });

        it('should wire StateSyncService to DeviceEventHandler', () => {
            const container = require('../../../src/main/bootstrap/container');
            
            container.initialize();
            container.setWindowManager(mockWindowManager);

            const deviceEventHandler = container.resolve('deviceEventHandler');

            expect(deviceEventHandler._stateSyncService).not.toBeNull();
            expect(deviceEventHandler._stateSyncService).toBe(container._stateSyncService);
        });

        it('should register YtdlpAdapter event listeners with StateSyncService', () => {
            const container = require('../../../src/main/bootstrap/container');
            
            container.initialize();

            // Mock YtdlpAdapter.on to track calls
            const YtdlpAdapter = require('../../../src/main/infrastructure/media/YtdlpAdapter');
            const onSpy = jest.fn();
            YtdlpAdapter.prototype.on = onSpy;

            container.setWindowManager(mockWindowManager);

            // Verify on was called for download events
            expect(onSpy).toHaveBeenCalledWith('downloadProgress', expect.any(Function));
            expect(onSpy).toHaveBeenCalledWith('downloadComplete', expect.any(Function));
            expect(onSpy).toHaveBeenCalledWith('downloadError', expect.any(Function));
            expect(onSpy).toHaveBeenCalledWith('downloadStopped', expect.any(Function));
        });

        it('should start StateSyncService when WindowManager is set', () => {
            const container = require('../../../src/main/bootstrap/container');
            
            container.initialize();
            container.setWindowManager(mockWindowManager);

            expect(container._stateSyncService._isRunning).toBe(true);
        });
    });

    describe('3. Full ApplicationBootstrap.run() flow', () => {
        it('should complete bootstrap run without errors', async () => {
            const { app } = require('electron');
            app.whenReady.mockResolvedValue();

            const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
            const bootstrap = new ApplicationBootstrap();

            await expect(bootstrap.run()).resolves.not.toThrow();
        });

        it('should create window manager after bootstrap run', async () => {
            const { app } = require('electron');
            app.whenReady.mockResolvedValue();

            const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
            const bootstrap = new ApplicationBootstrap();

            await bootstrap.run();

            expect(bootstrap.getWindowManager()).not.toBeNull();
        });

        it('should create main window and show it', async () => {
            const { app } = require('electron');
            app.whenReady.mockResolvedValue();

            const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
            const bootstrap = new ApplicationBootstrap();

            await bootstrap.run();

            const windowManager = bootstrap.getWindowManager();
            const mainWindow = windowManager.getWindow('main');

            expect(mainWindow).not.toBeNull();
            
            // Wait for the ready-to-show callback to fire
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(mainWindow.show).toHaveBeenCalled();
        });
    });

    describe('4. IPC channel registration', () => {
        it('should register all 11 IPC channels', () => {
            const container = require('../../../src/main/bootstrap/container');
            const IpcBootstrap = require('../../../src/main/bootstrap/IpcBootstrap');
            const { ipcMain } = require('electron');

            container.initialize();
            IpcBootstrap.register(container);

            // 6 device channels + 5 download channels = 11 total (may be 12 if electron-log registers something)
            expect(ipcMain.handle.mock.calls.length).toBeGreaterThanOrEqual(11);
        });

        it('should register device-related IPC channels', () => {
            const container = require('../../../src/main/bootstrap/container');
            const IpcBootstrap = require('../../../src/main/bootstrap/IpcBootstrap');
            const { ipcMain } = require('electron');

            container.initialize();
            IpcBootstrap.register(container);

            const channelNames = ipcMain.handle.mock.calls.map(call => call[0]);

            expect(channelNames).toContain('device:list');
            expect(channelNames).toContain('device:get');
            expect(channelNames).toContain('device:pair');
            expect(channelNames).toContain('device:connect');
            expect(channelNames).toContain('device:stream:start');
            expect(channelNames).toContain('device:stream:stop');
        });

        it('should register download-related IPC channels', () => {
            const container = require('../../../src/main/bootstrap/container');
            const IpcBootstrap = require('../../../src/main/bootstrap/IpcBootstrap');
            const { ipcMain } = require('electron');

            container.initialize();
            IpcBootstrap.register(container);

            const channelNames = ipcMain.handle.mock.calls.map(call => call[0]);

            expect(channelNames).toContain('download:inspect');
            expect(channelNames).toContain('download:start');
            expect(channelNames).toContain('download:stop');
            expect(channelNames).toContain('download:metadata');
            expect(channelNames).toContain('download:active');
        });
    });

    describe('5. Resilience to non-critical component failures', () => {
        it('should continue when all tools are missing', async () => {
            // Configure mock to return all tools missing
            mockVerifyAllResult = { adb: false, scrcpy: false, ytdlp: false };
            jest.resetModules();

            // Re-setup mock window instance after reset
            const { BrowserWindow } = require('electron');
            BrowserWindow.mockImplementation(() => mockWindowInstance);

            const { app } = require('electron');
            app.whenReady.mockResolvedValue();

            const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
            const bootstrap = new ApplicationBootstrap();

            await expect(bootstrap.run()).resolves.not.toThrow();

            // Reset to default
            mockVerifyAllResult = { adb: true, scrcpy: true, ytdlp: true };
        });

        it('should log warnings for missing tools', async () => {
            // Configure mock to return all tools missing
            mockVerifyAllResult = { adb: false, scrcpy: false, ytdlp: false };
            jest.resetModules();

            // Re-setup mock window instance after reset
            const { BrowserWindow } = require('electron');
            BrowserWindow.mockImplementation(() => mockWindowInstance);

            const { errorCentralService } = require('../../../src/main/infrastructure/logging');
            const warnSpy = jest.spyOn(errorCentralService, 'warn');

            const { app } = require('electron');
            app.whenReady.mockResolvedValue();

            const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
            const bootstrap = new ApplicationBootstrap();

            await bootstrap.run();

            // Should warn 3 times (once for each missing tool)
            expect(warnSpy).toHaveBeenCalledTimes(3);

            // Reset to default
            mockVerifyAllResult = { adb: true, scrcpy: true, ytdlp: true };
        });
    });

    describe('6. Main window lifecycle and configuration', () => {
        it('should create main window with correct dimensions', async () => {
            const { BrowserWindow } = require('electron');
            const { app } = require('electron');
            app.whenReady.mockResolvedValue();

            const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
            const bootstrap = new ApplicationBootstrap();

            await bootstrap.run();

            expect(BrowserWindow).toHaveBeenCalledWith(
                expect.objectContaining({
                    width: 1200,
                    height: 800
                })
            );
        });

        it('should create main window with security settings', async () => {
            const { BrowserWindow } = require('electron');
            const { app } = require('electron');
            app.whenReady.mockResolvedValue();

            const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
            const bootstrap = new ApplicationBootstrap();

            await bootstrap.run();

            expect(BrowserWindow).toHaveBeenCalledWith(
                expect.objectContaining({
                    webPreferences: expect.objectContaining({
                        contextIsolation: true,
                        nodeIntegration: false
                    })
                })
            );
        });

        it('should set show to false initially', async () => {
            const { BrowserWindow } = require('electron');
            const { app } = require('electron');
            app.whenReady.mockResolvedValue();

            const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
            const bootstrap = new ApplicationBootstrap();

            await bootstrap.run();

            expect(BrowserWindow).toHaveBeenCalledWith(
                expect.objectContaining({
                    show: false
                })
            );
        });
    });
});
