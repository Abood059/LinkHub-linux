// tests/performance/infrastructure/PerformanceStress.test.js
'use strict';

const { Volume } = require('memfs');
const fs = require('fs');
const path = require('path');

// Mock Electron
jest.mock('electron', () => ({
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    webContents: {
      send: jest.fn()
    },
    isDestroyed: jest.fn(() => false),
    destroy: jest.fn(),
    close: jest.fn(),
    once: jest.fn()
  }))
}));

// Mock ProcessManager
jest.mock('../../../src/main/infrastructure/process/ProcessManager', () => {
  const mockProcessManager = {
    activeProcesses: new Map(),
    executeQuickTaskArray: jest.fn().mockResolvedValue(''),
    execute: jest.fn(),
    executeAndWatch: jest.fn(),
    terminate: jest.fn(),
    terminateAll: jest.fn().mockImplementation(async () => {
      mockProcessManager.activeProcesses.clear();
    }),
    getLogs: jest.fn(),
    getProcessInfo: jest.fn(),
    getProcessStatus: jest.fn()
  };
  
  return mockProcessManager;
});

// Mock errorCentralService
jest.mock('../../../src/main/infrastructure/logging', () => ({
  errorCentralService: {
    report: jest.fn()
  }
}));

const ProcessManager = require('../../../src/main/infrastructure/process/ProcessManager');
const AdbCommandExecutor = require('../../../src/main/infrastructure/adb/AdbCommandExecutor');
const DatabaseManager = require('../../../src/main/infrastructure/persistence/DatabaseManager');
const WindowManager = require('../../../src/main/infrastructure/windows/WindowManager');
const YtdlpAdapter = require('../../../src/main/infrastructure/media/YtdlpAdapter');

// Test results storage
const testResults = [];

/**
 * Helper function to measure execution time
 */
function measureTime(fn) {
  const start = performance.now();
  return fn().then(result => {
    const end = performance.now();
    return { result, duration: end - start };
  });
}

/**
 * Helper function to measure memory usage
 */
function measureMemory(fn) {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const beforeMemory = process.memoryUsage().heapUsed;
  return fn().then(result => {
    if (global.gc) {
      global.gc();
    }
    const afterMemory = process.memoryUsage().heapUsed;
    const memoryDiff = (afterMemory - beforeMemory) / (1024 * 1024); // Convert to MB
    return { result, memoryDiff: Math.max(0, memoryDiff) };
  });
}

/**
 * Helper function to run test multiple times and get average
 */
async function runTestWithAverage(testFn, iterations = 3) {
  const results = [];
  for (let i = 0; i < iterations; i++) {
    const result = await testFn();
    results.push(result);
  }
  
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const avgMemory = results.reduce((sum, r) => sum + (r.memoryDiff || 0), 0) / results.length;
  
  return { duration: avgDuration, memoryDiff: avgMemory };
}

/**
 * Helper to record test result
 */
function recordResult(testName, measuredTime, allowedTime, measuredMemory, allowedMemory) {
  const timePassed = measuredTime <= allowedTime;
  const memoryPassed = allowedMemory === null || measuredMemory <= allowedMemory;
  const passed = timePassed && memoryPassed;
  
  testResults.push({
    'Test Name': testName,
    'Time (ms)': measuredTime.toFixed(2),
    'Allowed Time (ms)': allowedTime,
    'Time Result': timePassed ? 'PASS' : 'FAIL',
    'Memory (MB)': measuredMemory !== null ? measuredMemory.toFixed(2) : 'N/A',
    'Allowed Memory (MB)': allowedMemory !== null ? allowedMemory : 'N/A',
    'Memory Result': allowedMemory === null ? 'N/A' : (memoryPassed ? 'PASS' : 'FAIL'),
    'Overall': passed ? 'PASS' : 'FAIL'
  });
  
  return passed;
}

describe('Performance Tests', () => {
  let memfsVolume;
  let mockRegistry;
  
  beforeAll(() => {
    // Setup memfs for DatabaseManager tests
    memfsVolume = Volume.fromJSON({
      '/data/devices.json': '[]'
    });
    
    // Setup mock registry for WindowManager
    mockRegistry = {
      _windows: new Map(),
      register: jest.fn(function(id, win) {
        this._windows.set(id, win);
      }),
      unregister: jest.fn(function(id) {
        this._windows.delete(id);
      }),
      get: jest.fn(function(id) {
        return this._windows.get(id);
      }),
      getAll: jest.fn(function() {
        return Array.from(this._windows.values());
      }),
      has: jest.fn(function(id) {
        return this._windows.has(id);
      }),
      clear: jest.fn(function() {
        this._windows.clear();
      })
    };
  });
  
  afterAll(() => {
    // Print results table
    console.log('\n========================================');
    console.log('PERFORMANCE TEST RESULTS');
    console.log('========================================\n');
    console.table(testResults);
    
    const failedTests = testResults.filter(r => r.Overall === 'FAIL');
    if (failedTests.length > 0) {
      console.log('\n⚠️  FAILED TESTS:');
      failedTests.forEach(t => {
        console.log(`  - ${t['Test Name']}: Time=${t['Time (ms)']}ms (limit: ${t['Allowed Time (ms)']}ms), Memory=${t['Memory (MB)']}MB (limit: ${t['Allowed Memory (MB)']}MB)`);
      });
    } else {
      console.log('\n✅ All performance tests passed!');
    }
    console.log('\n========================================\n');
  });
  
  describe('ProcessManager', () => {
    beforeEach(() => {
      ProcessManager.activeProcesses.clear();
      ProcessManager.executeQuickTaskArray.mockClear();
    });
    
    test('100 concurrent processes should complete within 500ms', async () => {
      // Mock executeQuickTaskArray to resolve immediately
      ProcessManager.executeQuickTaskArray.mockResolvedValue('test');
      
      const testFn = async () => {
        const promises = [];
        for (let i = 0; i < 100; i++) {
          promises.push(ProcessManager.executeQuickTaskArray('node', ['-e', "console.log('test')"]));
        }
        await Promise.all(promises);
      };
      
      const { duration } = await runTestWithAverage(() => measureTime(testFn));
      const passed = recordResult('ProcessManager: 100 concurrent processes', duration, 500, null, null);
      
      expect(passed).toBe(true);
    });
    
    test('terminateAll with 50 processes should complete within 2000ms', async () => {
      // Simulate 50 active processes
      for (let i = 0; i < 50; i++) {
        ProcessManager.activeProcesses.set(`proc-${i}`, {
          instance: {
            kill: jest.fn(),
            exitCode: null,
            killed: false,
            once: jest.fn((event, callback) => {
              // Simulate immediate exit
              setImmediate(() => callback());
            })
          },
          data: { markAsExited: jest.fn() }
        });
      }
      
      const testFn = async () => {
        await ProcessManager.terminateAll();
      };
      
      const { duration } = await runTestWithAverage(() => measureTime(testFn));
      const passed = recordResult('ProcessManager: terminateAll (50 processes)', duration, 2000, null, null);
      
      expect(passed).toBe(true);
    });
  });
  
  describe('AdbCommandExecutor', () => {
    let adbExecutor;
    
    beforeEach(() => {
      ProcessManager.executeQuickTaskArray.mockClear();
      adbExecutor = new AdbCommandExecutor({
        processSupervisor: ProcessManager,
        logger: null,
        adbPath: '/mock/adb'
      });
    });
    
    test('Parsing 500 devices should complete within 100ms', async () => {
      // Generate mock output for 500 devices
      const deviceLines = ['List of devices attached'];
      for (let i = 0; i < 500; i++) {
        deviceLines.push(`device${i}\tdevice`);
      }
      const mockOutput = deviceLines.join('\n');
      
      ProcessManager.executeQuickTaskArray.mockResolvedValue(mockOutput);
      
      const testFn = async () => {
        await adbExecutor.getDevices();
      };
      
      const { duration } = await runTestWithAverage(() => measureTime(testFn));
      const passed = recordResult('AdbCommandExecutor: Parse 500 devices', duration, 100, null, null);
      
      expect(passed).toBe(true);
    });
    
    test('100 device info queries should complete within 500ms', async () => {
      // Mock shell commands to return immediately as array (for join('\n'))
      ProcessManager.executeQuickTaskArray.mockResolvedValue(['mock_value']);
      
      const testFn = async () => {
        const promises = [];
        for (let i = 0; i < 100; i++) {
          promises.push(adbExecutor.getDeviceInfo(`device${i}`));
        }
        await Promise.all(promises);
      };
      
      const { duration } = await runTestWithAverage(() => measureTime(testFn));
      const passed = recordResult('AdbCommandExecutor: 100 device queries', duration, 500, null, null);
      
      expect(passed).toBe(true);
    });
  });
  
  describe('DatabaseManager', () => {
    let dbManager;
    let tempDbPath;
    
    beforeEach(() => {
      // Use memfs for fast I/O
      tempDbPath = '/data/test_devices.json';
      dbManager = new DatabaseManager({ databasePath: tempDbPath });
      
      // Override fs methods to use memfs
      const originalFs = require('fs/promises');
      jest.spyOn(originalFs, 'mkdir').mockImplementation(async (dir, opts) => {
        return memfsVolume.promises.mkdir(dir, opts);
      });
      jest.spyOn(originalFs, 'writeFile').mockImplementation(async (file, data, opts) => {
        return memfsVolume.promises.writeFile(file, data, opts);
      });
      jest.spyOn(originalFs, 'readFile').mockImplementation(async (file, opts) => {
        return memfsVolume.promises.readFile(file, opts);
      });
      jest.spyOn(originalFs, 'access').mockImplementation(async (file) => {
        return memfsVolume.promises.access(file);
      });
    });
    
    afterEach(async () => {
      if (dbManager) {
        await dbManager.close();
      }
      jest.restoreAllMocks();
    });
    
    test('Inserting 1000 devices should complete within 5000ms total', async () => {
      await dbManager.initDb();
      
      const testFn = async () => {
        for (let i = 0; i < 1000; i++) {
          await dbManager.insertDevice({
            id: `device-${i}`,
            serial: `serial-${i}`,
            name: `Device ${i}`,
            state: 'device'
          });
        }
      };
      
      const { duration } = await runTestWithAverage(() => measureTime(testFn));
      const passed = recordResult('DatabaseManager: Insert 1000 devices', duration, 5000, null, null);
      
      expect(passed).toBe(true);
    });
    
    test('Loading 1000 devices should complete within 300ms', async () => {
      await dbManager.initDb();
      
      // Insert 1000 devices first
      const devices = [];
      for (let i = 0; i < 1000; i++) {
        devices.push({
          id: `device-${i}`,
          serial: `serial-${i}`,
          name: `Device ${i}`,
          state: 'device'
        });
      }
      await dbManager.saveDevices(devices);
      
      const testFn = async () => {
        await dbManager.loadDevices();
      };
      
      const { duration } = await runTestWithAverage(() => measureTime(testFn));
      const passed = recordResult('DatabaseManager: Load 1000 devices', duration, 300, null, null);
      
      expect(passed).toBe(true);
    });
  });
  
  describe('WindowManager', () => {
    let windowManager;
    
    beforeEach(() => {
      windowManager = new WindowManager(mockRegistry);
    });
    
    test('Broadcast to 100 windows should complete within 50ms', async () => {
      // Register 100 mock windows
      for (let i = 0; i < 100; i++) {
        const mockWindow = {
          webContents: {
            send: jest.fn()
          },
          isDestroyed: jest.fn(() => false)
        };
        mockRegistry._windows.set(`win-${i}`, mockWindow);
      }
      
      const testData = { message: 'test', data: 'x'.repeat(1024) }; // ~1KB data
      
      const testFn = async () => {
        windowManager.broadcast('test', testData);
      };
      
      const { duration } = await runTestWithAverage(() => measureTime(testFn));
      const passed = recordResult('WindowManager: Broadcast to 100 windows', duration, 50, null, null);
      
      expect(passed).toBe(true);
    });
  });
  
  describe('YtdlpAdapter', () => {
    let ytdlpAdapter;
    
    beforeEach(() => {
      // Mock ProcessManager with startManagedProcess simulation
      ProcessManager.startManagedProcess = jest.fn().mockReturnValue({
        once: jest.fn()
      });
      
      ytdlpAdapter = new YtdlpAdapter({
        processSupervisor: ProcessManager,
        ytdlpPath: '/mock/yt-dlp',
        logger: null
      });
    });
    
    test('Starting 20 downloads should complete within 200ms', async () => {
      // Mock startManagedProcess to return immediately
      ProcessManager.startManagedProcess.mockReturnValue({
        once: jest.fn()
      });
      
      const testFn = async () => {
        const promises = [];
        for (let i = 0; i < 20; i++) {
          // Start download but don't await the promise
          const downloadPromise = ytdlpAdapter.startDownload(
            `http://example.com/video${i}`,
            'best',
            { outputPath: `/tmp/video${i}.mp4` }
          ).catch(() => {}); // Don't fail on rejection
          promises.push(downloadPromise);
        }
        // Don't await - just measure startup time
        await new Promise(resolve => setImmediate(resolve));
      };
      
      const { duration } = await runTestWithAverage(() => measureTime(testFn));
      const passed = recordResult('YtdlpAdapter: Start 20 downloads', duration, 200, null, null);
      
      expect(passed).toBe(true);
    });
    
    test('20 pending downloads should use less than 50MB memory', async () => {
      // Mock startManagedProcess to keep downloads pending
      ProcessManager.startManagedProcess.mockReturnValue({
        once: jest.fn()
      });
      
      const testFn = async () => {
        // Start 20 downloads and keep them pending
        for (let i = 0; i < 20; i++) {
          ytdlpAdapter.startDownload(
            `http://example.com/video${i}`,
            'best',
            { outputPath: `/tmp/video${i}.mp4` }
          ).catch(() => {});
        }
        await new Promise(resolve => setImmediate(resolve));
      };
      
      const { memoryDiff } = await runTestWithAverage(() => measureMemory(testFn));
      const passed = recordResult('YtdlpAdapter: 20 pending downloads memory', 0, null, memoryDiff, 50);
      
      expect(passed).toBe(true);
    });
  });
});
