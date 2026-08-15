// ipc.integration.test.js
'use strict';

const { registerIpcHandlers } = require('../../../../src/main/infrastructure/ipc/index');

// Mock electron's ipcMain
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn()
  }
}));

describe('IPC Handlers Integration Tests', () => {
  let mockDeviceOrchestrator;
  let mockDownloadOrchestrator;
  let mockIpcMain;

  beforeEach(() => {
    // Create mock orchestrators with realistic behavior
    mockDeviceOrchestrator = {
      getAllDevices: jest.fn().mockResolvedValue([
        { id: 'device-1', name: 'Phone 1', status: 'connected' },
        { id: 'device-2', name: 'Phone 2', status: 'disconnected' }
      ]),
      getDevice: jest.fn().mockResolvedValue({ id: 'device-1', name: 'Phone 1' }),
      pairDevice: jest.fn().mockResolvedValue({ success: true, deviceId: 'device-3' }),
      connectDevice: jest.fn().mockResolvedValue({ connected: true, deviceId: 'device-1' }),
      startStreaming: jest.fn().mockResolvedValue({ streaming: true, deviceId: 'device-1' }),
      stopStreaming: jest.fn().mockResolvedValue({ stopped: true, deviceId: 'device-1' })
    };

    mockDownloadOrchestrator = {
      inspectLink: jest.fn().mockResolvedValue({
        title: 'Test Video',
        duration: 120,
        formats: [{ id: '137', ext: 'mp4' }]
      }),
      startDownload: jest.fn().mockResolvedValue({ processId: 'proc-abc123', status: 'started' }),
      stopDownload: jest.fn().mockResolvedValue({ stopped: true }),
      getMetadata: jest.fn().mockResolvedValue({ title: 'Test Video', duration: 120 }),
      getActiveDownloads: jest.fn().mockResolvedValue([
        { processId: 'proc-abc123', url: 'https://example.com/video', progress: 50 }
      ])
    };

    // Get the mocked ipcMain
    const { ipcMain } = require('electron');
    mockIpcMain = ipcMain;
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // Test #33: Full device:list flow
  describe('Full IPC flow - device:list', () => {
    test('should complete full flow from IPC registration to orchestrator call', async () => {
      // Register all IPC handlers
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      // Find the device:list handler
      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:list');

      // Simulate IPC invoke call
      const mockEvent = {};
      const result = await handlerFn(mockEvent);

      // Verify orchestrator was called
      expect(mockDeviceOrchestrator.getAllDevices).toHaveBeenCalled();
      
      // Verify result is returned correctly
      expect(result).toEqual([
        { id: 'device-1', name: 'Phone 1', status: 'connected' },
        { id: 'device-2', name: 'Phone 2', status: 'disconnected' }
      ]);
    });
  });

  // Test #34: download:start then download:stop
  describe('Full IPC flow - download:start and download:stop', () => {
    test('should pass processId to download:stop', async () => {
      // Register all IPC handlers
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      // Find the download:start handler
      const [, startHandlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:start');
      
      // Find the download:stop handler
      const [, stopHandlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:stop');

      // Simulate download:start
      const url = 'https://example.com/video';
      const formatId = '137';
      const deviceId = 'device-1';
      
      const startResult = await startHandlerFn({}, url, formatId, deviceId, {});
      
      // Verify startDownload was called correctly
      expect(mockDownloadOrchestrator.startDownload).toHaveBeenCalledWith(url, formatId, deviceId, {});
      expect(startResult).toEqual({ processId: 'proc-abc123', status: 'started' });

      // Simulate download:stop with the correct processId
      const processId = 'proc-abc123';
      await stopHandlerFn({}, processId);

      // Verify stopDownload is called with processId
      expect(mockDownloadOrchestrator.stopDownload).toHaveBeenCalledWith(processId);
    });
  });

  // Test #35: device:stream:start with options
  describe('Full IPC flow - device:stream:start with options', () => {
    test('should pass options to orchestrator correctly', async () => {
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:start');

      const deviceId = 'device-1';
      const options = { fullscreen: true, quality: 'high', bitrate: 8000 };

      const result = await handlerFn({}, deviceId, options);

      // Verify orchestrator received the options
      expect(mockDeviceOrchestrator.startStreaming).toHaveBeenCalledWith(deviceId, options);
      expect(result).toEqual({ streaming: true, deviceId: 'device-1' });
    });

    test('should handle empty options object', async () => {
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:stream:start');

      const deviceId = 'device-1';

      const result = await handlerFn({}, deviceId);

      // Verify orchestrator received empty options (default)
      expect(mockDeviceOrchestrator.startStreaming).toHaveBeenCalledWith(deviceId, {});
      expect(result).toEqual({ streaming: true, deviceId: 'device-1' });
    });
  });

  // Test #36: device:connect with long friendlyName
  describe('Full IPC flow - device:connect with long friendlyName', () => {
    test('should handle long friendlyName without error', async () => {
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:connect');

      const target = 'emulator-5554';
      // Create a very long friendlyName (1000 characters)
      const longFriendlyName = 'A'.repeat(1000);

      const result = await handlerFn({}, target, longFriendlyName);

      // Verify orchestrator received the long name unchanged
      expect(mockDeviceOrchestrator.connectDevice).toHaveBeenCalledWith(target, longFriendlyName);
      expect(result).toEqual({ connected: true, deviceId: 'device-1' });
    });

    test('should handle friendlyName with special characters', async () => {
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:connect');

      const target = '192.168.1.100:5555';
      const friendlyName = 'My Phone 📱 (2024) - Special chars: !@#$%^&*()';

      const result = await handlerFn({}, target, friendlyName);

      // Verify orchestrator received the name with special characters unchanged
      expect(mockDeviceOrchestrator.connectDevice).toHaveBeenCalledWith(target, friendlyName);
      expect(result).toEqual({ connected: true, deviceId: 'device-1' });
    });
  });

  // Test #37: download:inspect with special characters in URL
  describe('Full IPC flow - download:inspect with special URL characters', () => {
    test('should pass URL with special characters unchanged', async () => {
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');

      // URL with query parameters and special characters
      const url = 'https://example.com/video?v=1&t=120&list=abc123&format=mp4';

      const result = await handlerFn({}, url);

      // Verify orchestrator received the complete URL unchanged
      expect(mockDownloadOrchestrator.inspectLink).toHaveBeenCalledWith(url);
      expect(result).toEqual({
        title: 'Test Video',
        duration: 120,
        formats: [{ id: '137', ext: 'mp4' }]
      });
    });

    test('should handle URL with encoded characters', async () => {
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');

      // URL with URL-encoded characters
      const url = 'https://example.com/video?title=Hello%20World&category=test%20video';

      const result = await handlerFn({}, url);

      // Verify orchestrator received the URL with encoding intact
      expect(mockDownloadOrchestrator.inspectLink).toHaveBeenCalledWith(url);
      expect(result).toEqual({
        title: 'Test Video',
        duration: 120,
        formats: [{ id: '137', ext: 'mp4' }]
      });
    });

    test('should handle URL with unicode characters', async () => {
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');

      // URL with unicode characters
      const url = 'https://example.com/video?title=مرحبا&category=فيديو';

      const result = await handlerFn({}, url);

      // Verify orchestrator received the unicode URL unchanged
      expect(mockDownloadOrchestrator.inspectLink).toHaveBeenCalledWith(url);
      expect(result).toEqual({
        title: 'Test Video',
        duration: 120,
        formats: [{ id: '137', ext: 'mp4' }]
      });
    });
  });

  // Additional integration test: Error propagation through full stack
  describe('Full IPC flow - Error propagation', () => {
    test('should propagate orchestrator errors through IPC layer', async () => {
      // Simulate orchestrator error
      mockDeviceOrchestrator.getAllDevices.mockRejectedValue(new Error('Database connection failed'));

      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:list');

      // The error should propagate without being caught
      await expect(handlerFn({})).rejects.toThrow('Database connection failed');
    });

    test('should propagate download orchestrator errors through IPC layer', async () => {
      mockDownloadOrchestrator.inspectLink.mockRejectedValue(new Error('Network timeout'));

      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');

      await expect(handlerFn({}, 'https://example.com')).rejects.toThrow('Network timeout');
    });
  });

  // Additional integration test: Multiple sequential calls
  describe('Full IPC flow - Sequential operations', () => {
    test('should handle multiple sequential IPC calls correctly', async () => {
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      const listHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:list')[1];
      const getHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:get')[1];
      const connectHandler = mockIpcMain.handle.mock.calls.find(call => call[0] === 'device:connect')[1];

      // Sequential calls
      await listHandler({});
      await getHandler({}, 'device-1');
      await connectHandler({}, 'emulator-5554', 'Test Device');

      // Verify all orchestrator methods were called
      expect(mockDeviceOrchestrator.getAllDevices).toHaveBeenCalled();
      expect(mockDeviceOrchestrator.getDevice).toHaveBeenCalledWith('device-1');
      expect(mockDeviceOrchestrator.connectDevice).toHaveBeenCalledWith('emulator-5554', 'Test Device');
    });
  });
});
