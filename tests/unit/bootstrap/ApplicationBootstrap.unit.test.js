'use strict';

// Mock external dependencies before importing ApplicationBootstrap
jest.mock('electron', () => ({
    app: { whenReady: jest.fn() }
}));
jest.mock('electron-log/main', () => ({
    default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }
}));
jest.mock('path', () => ({
    join: jest.fn((...args) => args.join('/')),
    dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
    basename: jest.fn((path) => path.split('/').pop())
}));

// Mock local dependencies
jest.mock('../../../src/main/bootstrap/container');
jest.mock('../../../src/main/infrastructure/windows/WindowManager');
jest.mock('../../../src/main/infrastructure/windows/WindowRegistry');
jest.mock('../../../src/main/bootstrap/IpcBootstrap');

const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
const container = require('../../../src/main/bootstrap/container');
const WindowManager = require('../../../src/main/infrastructure/windows/WindowManager');
const WindowRegistry = require('../../../src/main/infrastructure/windows/WindowRegistry');
const IpcBootstrap = require('../../../src/main/bootstrap/IpcBootstrap');

describe('ApplicationBootstrap Unit Tests', () => {
    let bootstrap;
    let mockContainer;
    let mockErrorService;
    let mockDbManager;
    let mockConnectionService;
    let mockDeviceEventHandler;
    let mockToolPathResolver;
    let mockWindowManager;
    let mockWindowRegistry;
    let mockMainWindow;
    let consoleLogSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Spy on console methods
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Create mock container
        mockContainer = {
            initialize: jest.fn(),
            resolve: jest.fn(),
            setWindowManager: jest.fn()
        };

        // Create mock error service
        mockErrorService = {
            init: jest.fn(),
            warn: jest.fn()
        };

        // Create mock database manager
        mockDbManager = {
            initDb: jest.fn().mockResolvedValue(undefined)
        };

        // Create mock connection service
        mockConnectionService = {
            startAdbMonitoring: jest.fn(),
            startWirelessDiscovery: jest.fn()
        };

        // Create mock device event handler
        mockDeviceEventHandler = {
            setup: jest.fn(),
            setStateSyncService: jest.fn()
        };

        // Create mock tool path resolver
        mockToolPathResolver = {
            verifyAll: jest.fn().mockReturnValue({
                adb: true,
                scrcpy: true,
                ytdlp: true
            })
        };

        // Create mock window registry
        mockWindowRegistry = {};

        // Create mock window manager
        mockWindowManager = {
            createMainWindow: jest.fn().mockReturnValue(mockMainWindow),
            _registry: mockWindowRegistry
        };

        // Create mock main window
        mockMainWindow = {
            once: jest.fn(),
            show: jest.fn(),
            webContents: {
                openDevTools: jest.fn()
            }
        };

        // Setup container.resolve to return appropriate mocks
        mockContainer.resolve.mockImplementation((name) => {
            switch (name) {
                case 'errorCentralService':
                    return mockErrorService;
                case 'databaseManager':
                    return mockDbManager;
                case 'connectionService':
                    return mockConnectionService;
                case 'deviceRegistry':
                    return {};
                case 'deviceEventHandler':
                    return mockDeviceEventHandler;
                case 'toolPathResolver':
                    return mockToolPathResolver;
                default:
                    return null;
            }
        });

        // Setup container mock - replace entire module export
        container.initialize = mockContainer.initialize;
        container.resolve = mockContainer.resolve;
        container.setWindowManager = mockContainer.setWindowManager;
        container.getWindowManager = jest.fn();

        // Setup WindowManager mock
        WindowManager.mockImplementation((registry) => {
            const instance = {
                _registry: registry,
                createMainWindow: jest.fn(() => mockMainWindow)
            };
            return instance;
        });

        // Setup WindowRegistry mock
        WindowRegistry.mockImplementation(() => mockWindowRegistry);

        // Setup IpcBootstrap mock
        IpcBootstrap.register = jest.fn();

        // Create new bootstrap instance
        bootstrap = new ApplicationBootstrap();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    describe('run() method - Main flow', () => {
        it('should call container.initialize() once', async () => {
            await bootstrap.run();

            expect(mockContainer.initialize).toHaveBeenCalledTimes(1);
        });

        it('should call errorCentralService.init() after container initialization', async () => {
            await bootstrap.run();

            expect(mockErrorService.init).toHaveBeenCalled();
            expect(mockContainer.initialize).toHaveBeenCalled();
        });

        it('should call databaseManager.initDb() with await', async () => {
            await bootstrap.run();

            expect(mockDbManager.initDb).toHaveBeenCalled();
        });

        it('should call deviceEventHandler.setup() with correct connectionService', async () => {
            await bootstrap.run();

            expect(mockDeviceEventHandler.setup).toHaveBeenCalledWith(mockConnectionService);
        });

        it('should call connectionService.startAdbMonitoring(500)', async () => {
            await bootstrap.run();

            expect(mockConnectionService.startAdbMonitoring).toHaveBeenCalledWith(500);
        });

        it('should call connectionService.startWirelessDiscovery()', async () => {
            await bootstrap.run();

            expect(mockConnectionService.startWirelessDiscovery).toHaveBeenCalled();
        });

        it('should call IpcBootstrap.register() with container', async () => {
            await bootstrap.run();

            expect(IpcBootstrap.register).toHaveBeenCalledWith(container);
        });

        it('should call container.setWindowManager() with WindowManager instance', async () => {
            let capturedWindowManager = null;
            mockContainer.setWindowManager.mockImplementation((wm) => {
                capturedWindowManager = wm;
            });
            
            await bootstrap.run();

            expect(WindowManager).toHaveBeenCalledWith(mockWindowRegistry);
            expect(capturedWindowManager).toBeDefined();
            expect(capturedWindowManager.createMainWindow).toBeDefined();
        });
    });

    describe('createMainWindow() method', () => {
        it('should create window and show it on ready-to-show event', async () => {
            mockWindowManager.createMainWindow.mockReturnValue(mockMainWindow);
            bootstrap._windowManager = mockWindowManager;

            const result = await bootstrap.createMainWindow();

            expect(mockWindowManager.createMainWindow).toHaveBeenCalled();
            expect(mockMainWindow.once).toHaveBeenCalledWith('ready-to-show', expect.any(Function));
            
            // Trigger the ready-to-show callback
            const readyCallback = mockMainWindow.once.mock.calls[0][1];
            readyCallback();

            expect(mockMainWindow.show).toHaveBeenCalled();
            expect(result).toBe(mockMainWindow);
        });
    });

    describe('Error handling', () => {
        it('should throw error when databaseManager.initDb() fails', async () => {
            const testError = new Error('Database initialization failed');
            mockDbManager.initDb.mockRejectedValue(testError);

            await expect(bootstrap.run()).rejects.toThrow('Database initialization failed');
        });

        it('should log warning when toolPathResolver.verifyAll() returns missing tools', async () => {
            mockToolPathResolver.verifyAll.mockReturnValue({
                adb: false,
                scrcpy: true,
                ytdlp: true
            });

            await bootstrap.run();

            expect(mockErrorService.warn).toHaveBeenCalledWith(
                'ADB binary not found. Please ensure resources/bin/win/adb.exe or LINKHUB_ADB_PATH is set.',
                { source: 'ApplicationBootstrap' }
            );
        });

        it('should log warning for scrcpy when not found', async () => {
            mockToolPathResolver.verifyAll.mockReturnValue({
                adb: true,
                scrcpy: false,
                ytdlp: true
            });

            await bootstrap.run();

            expect(mockErrorService.warn).toHaveBeenCalledWith(
                'scrcpy binary not found. Please ensure resources/bin/win/scrcpy.exe or LINKHUB_SCRCPY_PATH is set.',
                { source: 'ApplicationBootstrap' }
            );
        });

        it('should log warning for yt-dlp when not found', async () => {
            mockToolPathResolver.verifyAll.mockReturnValue({
                adb: true,
                scrcpy: true,
                ytdlp: false
            });

            await bootstrap.run();

            expect(mockErrorService.warn).toHaveBeenCalledWith(
                'yt-dlp binary not found. Please ensure resources/bin/win/yt-dlp.exe or LINKHUB_YTDLP_PATH is set.',
                { source: 'ApplicationBootstrap' }
            );
        });

        it('should handle IPC registration error gracefully', async () => {
            IpcBootstrap.register.mockImplementation(() => {
                throw new Error('IPC registration failed');
            });

            await expect(bootstrap.run()).resolves.not.toThrow();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[Bootstrap] Failed to register IPC handlers:',
                expect.any(Error)
            );
        });
    });

    describe('Getter methods', () => {
        it('should return window manager via getWindowManager()', () => {
            bootstrap._windowManager = mockWindowManager;

            const result = bootstrap.getWindowManager();

            expect(result).toBe(mockWindowManager);
        });

        it('should return window registry via getWindowRegistry()', () => {
            bootstrap._windowRegistry = mockWindowRegistry;

            const result = bootstrap.getWindowRegistry();

            expect(result).toBe(mockWindowRegistry);
        });
    });

    describe('Initialization order', () => {
        it('should follow correct initialization sequence', async () => {
            const executionOrder = [];

            mockContainer.initialize.mockImplementation(() => {
                executionOrder.push('container');
            });

            mockErrorService.init.mockImplementation(() => {
                executionOrder.push('errorService');
            });

            mockDbManager.initDb.mockImplementation(async () => {
                executionOrder.push('database');
            });

            mockDeviceEventHandler.setup.mockImplementation(() => {
                executionOrder.push('deviceEventHandler');
            });

            mockConnectionService.startAdbMonitoring.mockImplementation(() => {
                executionOrder.push('adbMonitoring');
            });

            mockConnectionService.startWirelessDiscovery.mockImplementation(() => {
                executionOrder.push('wirelessDiscovery');
            });

            IpcBootstrap.register.mockImplementation(() => {
                executionOrder.push('ipc');
            });

            mockWindowManager.createMainWindow.mockReturnValue(mockMainWindow);
            mockMainWindow.once.mockImplementation((event, callback) => {
                if (event === 'ready-to-show') {
                    callback();
                }
                executionOrder.push('windowSetup');
            });

            mockContainer.setWindowManager.mockImplementation(() => {
                executionOrder.push('setWindowManager');
            });

            await bootstrap.run();

            expect(executionOrder).toEqual([
                'container',
                'errorService',
                'database',
                'deviceEventHandler',
                'adbMonitoring',
                'wirelessDiscovery',
                'ipc',
                'setWindowManager',
                'windowSetup'
            ]);
        });
    });

    describe('Edge cases', () => {
        it('should handle missing errorCentralService gracefully', async () => {
            mockContainer.resolve.mockImplementation((name) => {
                if (name === 'errorCentralService') return null;
                if (name === 'databaseManager') return mockDbManager;
                if (name === 'connectionService') return mockConnectionService;
                if (name === 'deviceEventHandler') return mockDeviceEventHandler;
                if (name === 'toolPathResolver') return mockToolPathResolver;
                return null;
            });

            await expect(bootstrap.run()).resolves.not.toThrow();
        });

        it('should handle missing databaseManager gracefully', async () => {
            mockContainer.resolve.mockImplementation((name) => {
                if (name === 'errorCentralService') return mockErrorService;
                if (name === 'databaseManager') return null;
                if (name === 'connectionService') return mockConnectionService;
                if (name === 'deviceEventHandler') return mockDeviceEventHandler;
                if (name === 'toolPathResolver') return mockToolPathResolver;
                return null;
            });

            await expect(bootstrap.run()).resolves.not.toThrow();
        });

        it('should handle missing toolPathResolver gracefully', async () => {
            mockContainer.resolve.mockImplementation((name) => {
                if (name === 'errorCentralService') return mockErrorService;
                if (name === 'databaseManager') return mockDbManager;
                if (name === 'connectionService') return mockConnectionService;
                if (name === 'deviceEventHandler') return mockDeviceEventHandler;
                if (name === 'toolPathResolver') return null;
                return null;
            });

            await expect(bootstrap.run()).resolves.not.toThrow();
            expect(consoleWarnSpy).toHaveBeenCalledWith('[Bootstrap] ToolPathResolver not available, skipping tool verification.');
        });

        it('should open DevTools in development mode', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            mockWindowManager.createMainWindow.mockReturnValue(mockMainWindow);
            bootstrap._windowManager = mockWindowManager;

            await bootstrap.createMainWindow();

            const readyCallback = mockMainWindow.once.mock.calls[0][1];
            readyCallback();

            expect(mockMainWindow.webContents.openDevTools).toHaveBeenCalled();

            process.env.NODE_ENV = originalEnv;
        });

        it('should not open DevTools in production mode', async () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';

            mockWindowManager.createMainWindow.mockReturnValue(mockMainWindow);
            bootstrap._windowManager = mockWindowManager;

            await bootstrap.createMainWindow();

            const readyCallback = mockMainWindow.once.mock.calls[0][1];
            readyCallback();

            expect(mockMainWindow.webContents.openDevTools).not.toHaveBeenCalled();

            process.env.NODE_ENV = originalEnv;
        });
    });
});
