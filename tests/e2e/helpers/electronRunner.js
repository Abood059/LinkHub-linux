// tests/e2e/helpers/electronRunner.js
'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs/promises');

// Mock Electron modules
jest.mock('electron', () => ({
    app: {
        whenReady: jest.fn().mockResolvedValue(),
        quit: jest.fn(),
        on: jest.fn()
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
        loadFile: jest.fn(),
        loadURL: jest.fn(),
        once: jest.fn((event, callback) => {
            if (event === 'ready-to-show') setImmediate(callback);
        }),
        show: jest.fn(),
        webContents: { 
            send: jest.fn(),
            openDevTools: jest.fn()
        },
        isDestroyed: jest.fn(() => false),
        destroy: jest.fn(),
        close: jest.fn()
    })),
    ipcMain: {
        handle: jest.fn(),
        on: jest.fn()
    }
}));

// Import after mocking
const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
const container = require('../../../src/main/bootstrap/container');
const DatabaseManager = require('../../../src/main/infrastructure/persistence/DatabaseManager');
const { MockAdbExecutor, MockConnectionService } = require('../mocks/adbMock');

/**
 * Mock WindowManager for testing
 */
class MockWindowManager {
    constructor() {
        this._windows = new Map();
        this._broadcastCalls = [];
    }

    createMainWindow(options = {}) {
        const mockWindow = {
            loadFile: jest.fn(),
            once: jest.fn((event, cb) => {
                if (event === 'ready-to-show') setImmediate(cb);
            }),
            show: jest.fn(),
            webContents: { send: jest.fn() },
            isDestroyed: jest.fn(() => false)
        };
        this._windows.set('main', mockWindow);
        return mockWindow;
    }

    broadcast(channel, data) {
        this._broadcastCalls.push({ channel, data });
        for (const win of this._windows.values()) {
            win.webContents.send(channel, data);
        }
    }

    getWindow(id) {
        return this._windows.get(id) || null;
    }

    getBroadcastCalls() {
        return this._broadcastCalls;
    }

    clearBroadcastCalls() {
        this._broadcastCalls = [];
    }
}

/**
 * Mock WindowRegistry for testing
 */
class MockWindowRegistry {
    constructor() {
        this._windows = new Map();
    }

    register(id, window) {
        this._windows.set(id, window);
    }

    get(id) {
        return this._windows.get(id) || null;
    }

    getAll() {
        return Array.from(this._windows.values());
    }

    clear() {
        this._windows.clear();
    }
}

/**
 * Mock ProcessManager for testing
 */
class MockProcessManager {
    constructor() {
        this.activeProcesses = new Map();
        this._nextPid = 1000;
    }

    execute(id, binPath, args, type, onData, maxBufferSize) {
        const pid = this._nextPid++;
        let exitCallback = null;
        let errorCallback = null;
        
        const mockProcess = {
            pid,
            kill: jest.fn(),
            once: jest.fn((event, callback) => {
                if (event === 'exit') {
                    exitCallback = callback;
                } else if (event === 'error') {
                    errorCallback = callback;
                }
            }),
            stdout: { on: jest.fn() },
            stderr: { 
                on: jest.fn((event, callback) => {
                    if (event === 'data') {
                        // Simulate yt-dlp progress output
                        setTimeout(() => {
                            callback(Buffer.from('[download] 50.0%'));
                        }, 20);
                    }
                })
            }
        };

        // Schedule successful exit after longer delay to allow testing
        const exitTimeout = setTimeout(() => {
            if (exitCallback) exitCallback(0);
        }, 5000); // 5 seconds delay

        // Store timeout for potential cancellation
        mockProcess._exitTimeout = exitTimeout;

        this.activeProcesses.set(id, mockProcess);
        return mockProcess;
    }

    terminate(id) {
        const process = this.activeProcesses.get(id);
        if (process) {
            // Clear the exit timeout to prevent it from firing after termination
            if (process._exitTimeout) {
                clearTimeout(process._exitTimeout);
            }
            this.activeProcesses.delete(id);
            return true;
        }
        return false;
    }

    terminateAll() {
        this.activeProcesses.clear();
        return Promise.resolve();
    }

    getActiveProcesses() {
        return Array.from(this.activeProcesses.keys());
    }

    getProcessStatus(id) {
        const process = this.activeProcesses.get(id);
        return process ? { status: 'running' } : null;
    }

    executeQuickTaskArray(binPath, args, options) {
        return new Promise((resolve) => {
            setImmediate(() => {
                resolve('Mock JSON output');
            });
        });
    }
}

/**
 * Create temporary database for testing
 */
async function createTempDatabase() {
    const projectRoot = path.join(__dirname, '../../../..');
    const testDataDir = path.join(projectRoot, 'data');
    
    // Ensure data directory exists
    try {
        await fs.mkdir(testDataDir, { recursive: true });
    } catch (error) {
        // Ignore if directory already exists
    }
    
    const dbPath = path.join(testDataDir, 'devices-test.json');
    await fs.writeFile(dbPath, JSON.stringify([], null, 4));
    return { dbPath, tempDir: testDataDir };
}

/**
 * Cleanup temporary database
 */
async function cleanupTempDatabase(tempDir) {
    try {
        // Just delete the test database file, not the whole data directory
        const dbPath = path.join(tempDir, 'devices-test.json');
        await fs.unlink(dbPath).catch(() => {});
    } catch (error) {
        console.warn('[electronRunner] Failed to cleanup temp database:', error.message);
    }
}

/**
 * Create test API for direct orchestrator calls
 */
function createTestAPI(testContainer) {
    const deviceOrchestrator = testContainer.resolve('deviceOrchestrator');
    const downloadOrchestrator = testContainer.resolve('downloadOrchestrator');
    const deviceEventHandler = testContainer.resolve('deviceEventHandler');

    return {
        // Device operations
        devices: {
            getAll: () => deviceOrchestrator.getAllDevices(),
            connect: (target, name) => deviceOrchestrator.connectDevice(target, name),
            startStreaming: (id, opts) => deviceOrchestrator.startStreaming(id, opts),
            stopStreaming: (id) => deviceOrchestrator.stopStreaming(id)
        },
        // Download operations
        downloads: {
            inspect: (url) => downloadOrchestrator.inspectLink(url),
            start: (url, formatId, deviceId) => downloadOrchestrator.startDownload(url, formatId, deviceId),
            stop: (processId) => downloadOrchestrator.stopDownload(processId)
        },
        // Event simulation
        emitEvent: (event, data) => {
            if (event === 'adbDevices' && deviceEventHandler._handleAdbDevices) {
                deviceEventHandler._handleAdbDevices(data);
            }
            if (event === 'connectSuccess' && deviceEventHandler._handleConnectSuccess) {
                deviceEventHandler._handleConnectSuccess(data);
            }
        }
    };
}

/**
 * Run the application in test environment
 * @param {Object} options - Test options
 * @param {boolean} options.headless - Run in headless mode
 * @param {boolean} options.mockAdb - Use ADB mock
 * @returns {Promise<Object>} Test application object
 */
async function runElectronTestApp(options = {}) {
    const { headless = true, mockAdb: useMockAdb = true } = options;

    // Set test environment
    process.env.NODE_ENV = 'test';

    // Create temporary database
    const { dbPath, tempDir } = await createTempDatabase();

    // Reset container for clean state
    jest.resetModules();
    jest.clearAllMocks();

    // Initialize container
    const testContainer = require('../../../src/main/bootstrap/container');
    testContainer.initialize();

    // Override ProcessManager with mock
    const mockProcessManager = new MockProcessManager();
    testContainer._services.set('processManager', mockProcessManager);

    // Override ProcessRegistry with mock
    class MockProcessRegistry {
        constructor() {
            this._processes = new Map();
        }

        register(id, process) {
            this._processes.set(id, process);
        }

        get(id) {
            return this._processes.get(id) || null;
        }

        updateStatus(id, status) {
            const process = this._processes.get(id);
            if (process) {
                process.status = status;
            }
        }

        clear() {
            this._processes.clear();
        }
    }

    const mockProcessRegistry = new MockProcessRegistry();
    testContainer._services.set('processRegistry', mockProcessRegistry);

    // Override ProcessSupervisor with mock that uses our mock ProcessManager
    const ProcessSupervisor = require('../../../src/main/runtime/processes/ProcessSupervisor');
    const mockProcessSupervisor = new ProcessSupervisor({
        processManager: mockProcessManager,
        processRegistry: mockProcessRegistry,
        logger: testContainer.resolve('errorCentralService')
    });
    testContainer._services.set('processSupervisor', mockProcessSupervisor);

    // Override YtdlpAdapter to use the mock ProcessSupervisor
    const YtdlpAdapter = require('../../../src/main/infrastructure/media/YtdlpAdapter');
    const mockYtdlpAdapter = new YtdlpAdapter({
        processSupervisor: mockProcessSupervisor,
        logger: testContainer.resolve('errorCentralService'),
        toolPathResolver: testContainer.resolve('toolPathResolver')
    });
    testContainer._services.set('ytdlpAdapter', mockYtdlpAdapter);

    // Override DownloadOrchestrator to use the mock YtdlpAdapter
    const DownloadOrchestrator = require('../../../src/main/application/orchestrators/DownloadOrchestrator');
    const mockDownloadOrchestrator = new DownloadOrchestrator({
        ytdlpAdapter: mockYtdlpAdapter,
        deviceRegistry: testContainer.resolve('deviceRegistry'),
        logger: testContainer.resolve('errorCentralService')
    });
    testContainer._services.set('downloadOrchestrator', mockDownloadOrchestrator);

    // Override DatabaseManager with temporary database
    const mockDatabaseManager = new DatabaseManager({ databasePath: dbPath });
    await mockDatabaseManager.initDb();
    testContainer._services.set('databaseManager', mockDatabaseManager);

    // Override ADB with mock if requested
    let mockAdbExecutor = null;
    let mockConnectionService = null;

    if (useMockAdb) {
        mockAdbExecutor = new MockAdbExecutor();
        mockConnectionService = new MockConnectionService(mockAdbExecutor);
        testContainer._services.set('adbCommandExecutor', mockAdbExecutor);
        testContainer._services.set('connectionService', mockConnectionService);
    }

    // Create mock window manager
    const mockWindowManager = new MockWindowManager();
    const mockWindowRegistry = new MockWindowRegistry();
    testContainer.setWindowManager(mockWindowManager);

    // Setup DeviceEventHandler with mock connection service
    const deviceEventHandler = testContainer.resolve('deviceEventHandler');
    if (mockConnectionService && deviceEventHandler) {
        deviceEventHandler.setup(mockConnectionService);
    }

    // Skip bootstrap - just initialize what we need for testing
    // The bootstrap is not needed for E2E tests of orchestrators

    // Create test API
    const testAPI = createTestAPI(testContainer);

    /**
     * Cleanup function to release resources
     */
    async function cleanup() {
        try {
            // Stop StateSyncService from container
            if (testContainer._stateSyncService && typeof testContainer._stateSyncService.stop === 'function') {
                testContainer._stateSyncService.stop();
            }

            // Stop monitoring
            const connectionService = testContainer.resolve('connectionService');
            if (connectionService && typeof connectionService.dispose === 'function') {
                connectionService.dispose();
            }

            // Terminate all processes
            const processManager = testContainer.resolve('processManager');
            if (processManager && typeof processManager.terminateAll === 'function') {
                await processManager.terminateAll();
            }

            // Close database
            const dbManager = testContainer.resolve('databaseManager');
            if (dbManager && typeof dbManager.close === 'function') {
                await dbManager.close();
            }

            // Cleanup temporary database
            await cleanupTempDatabase(tempDir);

            // Clear mocks and timers
            jest.clearAllMocks();
            jest.useRealTimers();
        } catch (error) {
            console.error('[electronRunner] Cleanup error:', error);
        }
    }

    return {
        app: null, // No bootstrap in simplified mode
        windowManager: mockWindowManager,
        windowRegistry: mockWindowRegistry,
        container: testContainer,
        cleanup,
        mockAdb: mockAdbExecutor,
        mockConnectionService,
        testAPI,
        tempDir,
        dbPath
    };
}

module.exports = {
    runElectronTestApp,
    MockWindowManager,
    MockWindowRegistry,
    MockProcessManager
};
