// tests/performance/bootstrap/BootstrapPerformance.test.js
'use strict';

/**
 * Performance Tests for Bootstrap Layer
 * 
 * Run with: npm test -- tests/performance/bootstrap/BootstrapPerformance.test.js
 * For accurate memory measurement, run with: node --expose-gc ./node_modules/.bin/jest tests/performance/bootstrap/BootstrapPerformance.test.js
 */

// Mock Electron and BrowserWindow to avoid opening real windows
jest.mock('electron', () => {
    const mockMainWindow = {
        once: jest.fn((event, callback) => {
            // Immediately invoke the callback for 'ready-to-show' event
            if (event === 'ready-to-show') {
                callback();
            }
        }),
        show: jest.fn(),
        webContents: {
            openDevTools: jest.fn()
        }
    };
    
    return {
        app: {
            whenReady: jest.fn().mockResolvedValue()
        },
        BrowserWindow: jest.fn().mockReturnValue(mockMainWindow),
        ipcMain: {
            handle: jest.fn()
        }
    };
});

// Mock heavy infrastructure components
jest.mock('../../../src/main/infrastructure/logging', () => ({
    errorCentralService: {
        init: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../../src/main/infrastructure/persistence/DatabaseManager', () => {
    return jest.fn().mockImplementation(() => ({
        initDb: jest.fn().mockResolvedValue()
    }));
});
jest.mock('../../../src/main/infrastructure/adb/AdbCommandExecutor', () => {
    return jest.fn().mockImplementation(() => ({}));
});
jest.mock('../../../src/main/infrastructure/adb/ConnectionService', () => {
    return jest.fn().mockImplementation(() => ({
        startAdbMonitoring: jest.fn(),
        startWirelessDiscovery: jest.fn(),
        on: jest.fn()
    }));
});
jest.mock('../../../src/main/infrastructure/streaming/ScrcpyAdapter', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn()
    }));
});
jest.mock('../../../src/main/infrastructure/media/YtdlpAdapter', () => {
    return jest.fn().mockImplementation(() => ({
        on: jest.fn()
    }));
});
jest.mock('../../../src/main/infrastructure/tools/ToolPathResolver', () => {
    return jest.fn().mockImplementation(() => ({
        verifyAll: jest.fn().mockReturnValue({
            adb: true,
            scrcpy: true,
            ytdlp: true
        }),
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    }));
});
jest.mock('../../../src/main/infrastructure/sync/StateSyncService', () => {
    return jest.fn().mockImplementation(() => ({
        start: jest.fn(),
        onDownloadProgress: jest.fn(),
        onDownloadComplete: jest.fn(),
        onDownloadError: jest.fn(),
        onDownloadStopped: jest.fn()
    }));
});
jest.mock('../../../src/main/infrastructure/windows/WindowManager', () => {
    return jest.fn().mockImplementation(() => ({
        createMainWindow: jest.fn().mockReturnValue({
            once: jest.fn((event, callback) => {
                if (event === 'ready-to-show') {
                    callback();
                }
            }),
            show: jest.fn(),
            webContents: {
                openDevTools: jest.fn()
            }
        })
    }));
});
jest.mock('../../../src/main/infrastructure/windows/WindowRegistry', () => {
    return jest.fn().mockImplementation(() => ({}));
});
jest.mock('../../../src/main/bootstrap/IpcBootstrap', () => ({
    register: jest.fn()
}));

// Import the actual classes after mocking
const container = require('../../../src/main/bootstrap/container');
const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');

// Helper function to calculate average
function calculateAverage(timings) {
    return timings.reduce((a, b) => a + b, 0) / timings.length;
}

// Helper function to measure memory usage in MB
function memoryUsageMB() {
    return process.memoryUsage().heapUsed / 1024 / 1024;
}

describe('Bootstrap Performance Tests', () => {
    // Results tracking for performance report
    const results = {
        containerInit: [],
        bootstrapRun: [],
        memoryIncrease: [],
        serviceResolution: [],
        stabilityMemoryDrift: []
    };

    beforeAll(() => {
        console.log('\n🔬 Starting Bootstrap Performance Tests...\n');
    });

    afterAll(() => {
        // Display performance report
        console.log('\n📊 Performance Test Results:');
        console.log('========================================');
        
        if (results.containerInit.length > 0) {
            const avgContainerInit = calculateAverage(results.containerInit);
            console.log(`  Container Initialization (avg): ${avgContainerInit.toFixed(2)}ms`);
            console.log(`    Threshold: < 100ms | Status: ${avgContainerInit < 100 ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        if (results.bootstrapRun.length > 0) {
            const avgBootstrapRun = calculateAverage(results.bootstrapRun);
            console.log(`  Bootstrap Run (avg): ${avgBootstrapRun.toFixed(2)}ms`);
            console.log(`    Threshold: < 500ms | Status: ${avgBootstrapRun < 500 ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        if (results.memoryIncrease.length > 0) {
            const avgMemoryIncrease = calculateAverage(results.memoryIncrease);
            console.log(`  Memory Increase (avg): ${avgMemoryIncrease.toFixed(2)}MB`);
            console.log(`    Threshold: < 15MB | Status: ${avgMemoryIncrease < 15 ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        if (results.serviceResolution.length > 0) {
            const avgServiceResolution = calculateAverage(results.serviceResolution);
            console.log(`  Service Resolution (avg per call): ${avgServiceResolution.toFixed(3)}ms`);
            console.log(`    Threshold: < 0.1ms | Status: ${avgServiceResolution < 0.1 ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        if (results.stabilityMemoryDrift.length > 0) {
            const avgMemoryDrift = calculateAverage(results.stabilityMemoryDrift);
            console.log(`  Performance Stability (memory drift): ${avgMemoryDrift.toFixed(2)}MB`);
            console.log(`    Threshold: < 5MB | Status: ${avgMemoryDrift < 5 ? '✅ PASS' : '❌ FAIL'}`);
        }
        
        console.log('========================================\n');
    });

    describe('1. Container Initialization Speed', () => {
        it('should initialize container in less than 100ms (average of 10 iterations)', () => {
            const iterations = 10;
            const timings = [];

            for (let i = 0; i < iterations; i++) {
                // Reset container state
                jest.resetModules();
                const freshContainer = require('../../../src/main/bootstrap/container');
                freshContainer._services.clear();
                freshContainer._initialized = false;
                freshContainer._windowManager = null;
                freshContainer._stateSyncService = null;

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                const startTime = performance.now();
                freshContainer.initialize();
                const endTime = performance.now();
                const duration = endTime - startTime;

                timings.push(duration);
            }

            const averageTime = calculateAverage(timings);
            results.containerInit = timings;

            console.log(`[Performance] Container Initialization - Iterations: ${iterations}, Average: ${averageTime.toFixed(2)}ms`);
            expect(averageTime).toBeLessThan(100);
        });
    });

    describe('2. Full Application Bootstrap Speed', () => {
        it('should run full bootstrap in less than 500ms (average of 5 iterations)', async () => {
            const iterations = 5;
            const timings = [];

            for (let i = 0; i < iterations; i++) {
                // Reset modules for clean state
                jest.resetModules();
                jest.clearAllMocks();

                // Re-import after reset
                const freshContainer = require('../../../src/main/bootstrap/container');
                const freshApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');

                // Reset container state
                freshContainer._services.clear();
                freshContainer._initialized = false;
                freshContainer._windowManager = null;
                freshContainer._stateSyncService = null;

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                const bootstrap = new freshApplicationBootstrap();

                const startTime = performance.now();
                await bootstrap.run();
                const endTime = performance.now();
                const duration = endTime - startTime;

                timings.push(duration);
            }

            const averageTime = calculateAverage(timings);
            results.bootstrapRun = timings;

            console.log(`[Performance] Full Bootstrap - Iterations: ${iterations}, Average: ${averageTime.toFixed(2)}ms`);
            expect(averageTime).toBeLessThan(500);
        });
    });

    describe('3. Memory Consumption After Initialization', () => {
        it('should consume less than 15MB additional memory (average of 3 iterations)', () => {
            const iterations = 3;
            const memoryIncreases = [];

            for (let i = 0; i < iterations; i++) {
                // Reset container state
                jest.resetModules();
                const freshContainer = require('../../../src/main/bootstrap/container');
                freshContainer._services.clear();
                freshContainer._initialized = false;
                freshContainer._windowManager = null;
                freshContainer._stateSyncService = null;

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                const memoryBefore = memoryUsageMB();

                freshContainer.initialize();

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                const memoryAfter = memoryUsageMB();
                const memoryIncrease = memoryAfter - memoryBefore;

                memoryIncreases.push(memoryIncrease);
            }

            const averageMemoryIncrease = calculateAverage(memoryIncreases);
            results.memoryIncrease = memoryIncreases;

            console.log(`[Performance] Memory Consumption - Iterations: ${iterations}, Average: ${averageMemoryIncrease.toFixed(2)}MB`);
            expect(averageMemoryIncrease).toBeLessThan(15);
        });
    });

    describe('4. Service Resolution Speed', () => {
        it('should resolve services in less than 0.1ms per call (1000 calls)', () => {
            // Initialize container once
            jest.resetModules();
            const freshContainer = require('../../../src/main/bootstrap/container');
            freshContainer._services.clear();
            freshContainer._initialized = false;
            freshContainer._windowManager = null;
            freshContainer._stateSyncService = null;
            freshContainer.initialize();

            const callCount = 1000;

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const startTime = performance.now();

            for (let i = 0; i < callCount; i++) {
                freshContainer.resolve('deviceOrchestrator');
            }

            const endTime = performance.now();
            const totalTime = endTime - startTime;
            const averageTimePerCall = totalTime / callCount;

            results.serviceResolution = [averageTimePerCall];

            console.log(`[Performance] Service Resolution - Calls: ${callCount}, Total: ${totalTime.toFixed(2)}ms, Avg per call: ${averageTimePerCall.toFixed(3)}ms`);
            expect(averageTimePerCall).toBeLessThan(0.1);
        });
    });

    describe('5. Performance Stability Over Time', () => {
        it('should not accumulate memory excessively over 5 initialization cycles (< 5MB drift)', () => {
            const cycles = 5;
            const memorySnapshots = [];

            for (let i = 0; i < cycles; i++) {
                // Reset modules for clean state
                jest.resetModules();
                jest.clearAllMocks();

                // Re-import after reset
                const freshContainer = require('../../../src/main/bootstrap/container');
                const freshApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');

                // Reset container state
                freshContainer._services.clear();
                freshContainer._initialized = false;
                freshContainer._windowManager = null;
                freshContainer._stateSyncService = null;

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                // Measure memory before cycle
                const memoryBefore = memoryUsageMB();

                // Execute full cycle: initialize -> resolve -> setWindowManager -> run
                freshContainer.initialize();
                freshContainer.resolve('deviceOrchestrator');
                
                // Mock window manager for setWindowManager
                const mockWindowManager = {
                    broadcast: jest.fn(),
                    sendTo: jest.fn()
                };
                freshContainer.setWindowManager(mockWindowManager);

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                // Measure memory after cycle
                const memoryAfter = memoryUsageMB();
                memorySnapshots.push(memoryAfter - memoryBefore);
            }

            // Calculate memory drift between first and last cycle
            const firstCycleMemory = memorySnapshots[0];
            const lastCycleMemory = memorySnapshots[cycles - 1];
            const memoryDrift = Math.abs(lastCycleMemory - firstCycleMemory);

            results.stabilityMemoryDrift = [memoryDrift];

            console.log(`[Performance] Stability Test - Cycles: ${cycles}, Memory Drift: ${memoryDrift.toFixed(2)}MB`);
            console.log(`[Performance] Memory per cycle: ${memorySnapshots.map(m => m.toFixed(2)).join('MB, ')}MB`);
            expect(memoryDrift).toBeLessThan(5);
        });
    });
});
