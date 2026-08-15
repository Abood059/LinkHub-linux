// ipc.performance.test.js
'use strict';

/**
 * Performance Tests for IPC Handlers
 * 
 * PURPOSE: Verify that IPC handler registration and invocation have minimal overhead.
 * The IPC layer should be a thin, fast gateway that doesn't become a bottleneck.
 * 
 * PERFORMANCE PRINCIPLE: Registration happens once at startup, invocation should be
 * extremely fast (just a function call with minimal validation).
 */

const { registerIpcHandlers, DeviceHandlers, DownloadHandlers } = require('../../../../src/main/infrastructure/ipc');

describe('IPC Performance', () => {
  // Test #16: Registration time measurement
  test('should register all handlers in under 50ms', () => {
    const mockIpcMain = { handle: jest.fn() };
    const mockDeviceOrch = { 
      getAllDevices: jest.fn(),
      getDevice: jest.fn(),
      pairDevice: jest.fn(),
      connectDevice: jest.fn(),
      startStreaming: jest.fn(),
      stopStreaming: jest.fn()
    };
    const mockDownloadOrch = { 
      inspectLink: jest.fn(),
      startDownload: jest.fn(),
      stopDownload: jest.fn(),
      getMetadata: jest.fn(),
      getActiveDownloads: jest.fn()
    };

    const start = performance.now();
    
    const deviceHandlers = new DeviceHandlers(mockDeviceOrch);
    deviceHandlers.register(mockIpcMain);
    
    const downloadHandlers = new DownloadHandlers(mockDownloadOrch);
    downloadHandlers.register(mockIpcMain);
    
    const end = performance.now();

    expect(end - start).toBeLessThan(50);
    // Registration should be very fast - just function assignments
  });

  // Test #17: 1000 handler invocations
  test('should invoke handler 1000 times in under 100ms total', async () => {
    const mockIpcMain = { handle: jest.fn() };
    const mockDeviceOrch = { 
      getAllDevices: jest.fn().mockResolvedValue([]),
      getDevice: jest.fn().mockResolvedValue(null),
      pairDevice: jest.fn().mockResolvedValue([]),
      connectDevice: jest.fn().mockResolvedValue({}),
      startStreaming: jest.fn().mockReturnValue('pid'),
      stopStreaming: jest.fn().mockReturnValue(true)
    };

    const handlers = new DeviceHandlers(mockDeviceOrch);
    handlers.register(mockIpcMain);

    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:list');

    const start = performance.now();
    
    for (let i = 0; i < 1000; i++) {
      await handlerFn({}, {});
    }
    
    const end = performance.now();

    expect(end - start).toBeLessThan(100);
    // Each invocation should be extremely fast (< 0.1ms average)
  });

  // Test #18: 100 invocations with large payloads
  test('should invoke handler with large payload 100 times with avg < 1ms', async () => {
    const mockIpcMain = { handle: jest.fn() };
    const mockDownloadOrch = { 
      inspectLink: jest.fn().mockResolvedValue({}),
      startDownload: jest.fn().mockResolvedValue({ processId: 'proc-123' }),
      stopDownload: jest.fn().mockResolvedValue({ stopped: true }),
      getMetadata: jest.fn().mockResolvedValue({}),
      getActiveDownloads: jest.fn().mockResolvedValue([])
    };

    const handlers = new DownloadHandlers(mockDownloadOrch);
    handlers.register(mockIpcMain);

    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'download:start');

    const url = 'https://example.com/video';
    const formatId = '137';
    const largeOptions = { data: Buffer.alloc(100 * 1024) }; // 100KB buffer

    const start = performance.now();
    
    for (let i = 0; i < 100; i++) {
      await handlerFn({}, url, formatId, null, largeOptions);
    }
    
    const end = performance.now();

    const avgTime = (end - start) / 100;
    expect(avgTime).toBeLessThan(1);
    // Even with large payloads, invocation should be fast
    // Handler just passes through - no deep copying or processing
  });
});
