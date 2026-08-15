// tests/performance/application/orchestrators/DeviceOrchestrator.performance.test.js
'use strict';

/**
 * Performance & Stress Tests for DeviceOrchestrator
 * 
 * Run with: npm test -- tests/performance/application/orchestrators/DeviceOrchestrator.performance.test.js
 * For accurate memory measurement, run with: node --expose-gc node_modules/.bin/jest tests/performance/application/orchestrators/DeviceOrchestrator.performance.test.js
 */

const DeviceOrchestrator = require('../../../../src/main/application/orchestrators/DeviceOrchestrator');
const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');
const Device = require('../../../../src/main/domain/entities/Device');

// Mock heavy dependencies to ensure fast execution
jest.mock('../../../../src/main/infrastructure/adb/ConnectionService');
jest.mock('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

const ConnectionService = require('../../../../src/main/infrastructure/adb/ConnectionService');
const ScrcpyAdapter = require('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

describe('DeviceOrchestrator Performance', () => {
  let orchestrator;
  let registry;
  let mockConnectionService;
  let mockScrcpyAdapter;

  // Helper to measure memory usage
  const measureMemory = (fn) => {
    if (global.gc) global.gc();
    const before = process.memoryUsage().heapUsed;
    const result = fn();
    if (global.gc) global.gc();
    const after = process.memoryUsage().heapUsed;
    return { result, memoryDiff: (after - before) / (1024 * 1024) }; // Convert to MB
  };

  beforeEach(() => {
    registry = new DeviceRegistry();
    mockConnectionService = new ConnectionService();
    mockScrcpyAdapter = new ScrcpyAdapter();

    // Instant mock functions - no delays
    mockConnectionService.connect = jest.fn().mockResolvedValue('connected');
    mockConnectionService.getDeviceInfo = jest.fn().mockResolvedValue({ 
      model: 'Pixel', 
      version: '13', 
      arch: 'arm64' 
    });
    mockScrcpyAdapter.startMirroring = jest.fn().mockReturnValue('mock-pid');

    orchestrator = new DeviceOrchestrator({
      deviceRegistry: registry,
      connectionService: mockConnectionService,
      scrcpyAdapter: mockScrcpyAdapter,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });
  });

  test('getAllDevices with 1000 devices should average < 100ms', () => {
    // 1. Fill registry with 1000 devices
    for (let i = 0; i < 1000; i++) {
      const device = new Device({ 
        id: `perf-device-${i}`, 
        deviceFriendlyName: `Device ${i}` 
      });
      registry.registerDevice(device);
      registry.updateState(device.id, { status: 'connected' });
    }

    // 2. Measure average time over 100 iterations
    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      orchestrator.getAllDevices();
    }
    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`[Performance] getAllDevices (1000 devices) avg: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(100);
  });

  test('connectDevice concurrent 50 devices should complete < 2 seconds', async () => {
    const deviceCount = 50;
    const targets = [];
    
    // Generate unique targets
    for (let i = 0; i < deviceCount; i++) {
      targets.push(`192.168.1.${i}:5555`);
    }

    const start = performance.now();
    
    // Connect all devices concurrently
    const promises = targets.map(target => 
      orchestrator.connectDevice(target, `Device ${target}`)
    );
    await Promise.all(promises);
    
    const end = performance.now();
    const totalTime = end - start;

    console.log(`[Performance] connectDevice (50 concurrent) total: ${totalTime.toFixed(2)}ms`);
    expect(totalTime).toBeLessThan(2000);
  });

  test('startStreaming concurrent 20 devices should complete < 1 second', () => {
    const deviceCount = 20;
    
    // Register 20 devices
    for (let i = 0; i < deviceCount; i++) {
      const device = new Device({ 
        id: `stream-device-${i}`, 
        deviceFriendlyName: `Stream Device ${i}` 
      });
      registry.registerDevice(device);
      registry.updateState(device.id, { 
        status: 'connected',
        adbTarget: `192.168.1.${i}:5555`
      });
    }

    const start = performance.now();
    
    // Start streaming for all devices concurrently
    const promises = [];
    for (let i = 0; i < deviceCount; i++) {
      promises.push(Promise.resolve(orchestrator.startStreaming(`stream-device-${i}`)));
    }
    Promise.all(promises);
    
    const end = performance.now();
    const totalTime = end - start;

    console.log(`[Performance] startStreaming (20 concurrent) total: ${totalTime.toFixed(2)}ms`);
    expect(totalTime).toBeLessThan(1000);
  });

  test('getAllDevices with 5000 devices (stress) - time < 500ms, memory < 50MB', () => {
    const deviceCount = 5000;
    
    // Fill registry with 5000 devices
    for (let i = 0; i < deviceCount; i++) {
      const device = new Device({ 
        id: `stress-device-${i}`, 
        deviceFriendlyName: `Stress Device ${i}` 
      });
      registry.registerDevice(device);
      registry.updateState(device.id, { status: 'connected' });
    }

    // Measure time
    const start = performance.now();
    const devices = orchestrator.getAllDevices();
    const end = performance.now();
    const time = end - start;

    console.log(`[Performance] getAllDevices (5000 devices) time: ${time.toFixed(2)}ms`);

    // Measure memory separately
    const { memoryDiff } = measureMemory(() => {
      return orchestrator.getAllDevices();
    });

    console.log(`[Performance] getAllDevices (5000 devices) memory increase: ${memoryDiff.toFixed(2)}MB`);

    expect(time).toBeLessThan(500);
    expect(memoryDiff).toBeLessThan(50);
  });
});
