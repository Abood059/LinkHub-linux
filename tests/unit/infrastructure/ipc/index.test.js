// index.test.js
'use strict';

const { registerIpcHandlers, DeviceHandlers, DownloadHandlers } = require('../../../../src/main/infrastructure/ipc/index');

// Mock electron's ipcMain
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn()
  }
}));

describe('IPC Index Unit Tests', () => {
  let mockDeviceOrchestrator;
  let mockDownloadOrchestrator;
  let mockIpcMain;

  beforeEach(() => {
    // Create mock orchestrators
    mockDeviceOrchestrator = {
      getAllDevices: jest.fn().mockResolvedValue([]),
      getDevice: jest.fn().mockResolvedValue({}),
      pairDevice: jest.fn().mockResolvedValue({}),
      connectDevice: jest.fn().mockResolvedValue({}),
      startStreaming: jest.fn().mockResolvedValue({}),
      stopStreaming: jest.fn().mockResolvedValue({})
    };

    mockDownloadOrchestrator = {
      inspectLink: jest.fn().mockResolvedValue({}),
      startDownload: jest.fn().mockResolvedValue({}),
      stopDownload: jest.fn().mockResolvedValue({}),
      getMetadata: jest.fn().mockResolvedValue({}),
      getActiveDownloads: jest.fn().mockResolvedValue([])
    };

    // Get the mocked ipcMain
    const { ipcMain } = require('electron');
    mockIpcMain = ipcMain;
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // Test #30: Successful registration
  describe('registerIpcHandlers', () => {
    test('should create DeviceHandlers and DownloadHandlers and register both', () => {
      // Call the registration function
      registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);

      // Verify ipcMain.handle was called (DeviceHandlers has 6 channels, DownloadHandlers has 5)
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(11);

      // Verify the channels registered
      const channels = mockIpcMain.handle.mock.calls.map(call => call[0]);
      
      // DeviceHandlers channels
      expect(channels).toContain('device:list');
      expect(channels).toContain('device:get');
      expect(channels).toContain('device:pair');
      expect(channels).toContain('device:connect');
      expect(channels).toContain('device:stream:start');
      expect(channels).toContain('device:stream:stop');

      // DownloadHandlers channels
      expect(channels).toContain('download:inspect');
      expect(channels).toContain('download:start');
      expect(channels).toContain('download:stop');
      expect(channels).toContain('download:metadata');
      expect(channels).toContain('download:active');
    });

    test('should not throw error when both orchestrators are valid', () => {
      expect(() => {
        registerIpcHandlers(mockDeviceOrchestrator, mockDownloadOrchestrator);
      }).not.toThrow();
    });
  });

  // Test #31: Missing deviceOrchestrator
  describe('Validation - deviceOrchestrator', () => {
    test('should throw error when deviceOrchestrator is null', () => {
      expect(() => {
        registerIpcHandlers(null, mockDownloadOrchestrator);
      }).toThrow('Both DeviceOrchestrator and DownloadOrchestrator are required');
    });

    test('should throw error when deviceOrchestrator is undefined', () => {
      expect(() => {
        registerIpcHandlers(undefined, mockDownloadOrchestrator);
      }).toThrow('Both DeviceOrchestrator and DownloadOrchestrator are required');
    });

    test('should not register any handlers when deviceOrchestrator is missing', () => {
      try {
        registerIpcHandlers(null, mockDownloadOrchestrator);
      } catch {}

      // Verify no handlers were registered
      expect(mockIpcMain.handle).not.toHaveBeenCalled();
    });
  });

  // Test #32: Missing downloadOrchestrator
  describe('Validation - downloadOrchestrator', () => {
    test('should throw error when downloadOrchestrator is null', () => {
      expect(() => {
        registerIpcHandlers(mockDeviceOrchestrator, null);
      }).toThrow('Both DeviceOrchestrator and DownloadOrchestrator are required');
    });

    test('should throw error when downloadOrchestrator is undefined', () => {
      expect(() => {
        registerIpcHandlers(mockDeviceOrchestrator, undefined);
      }).toThrow('Both DeviceOrchestrator and DownloadOrchestrator are required');
    });

    test('should not register any handlers when downloadOrchestrator is missing', () => {
      try {
        registerIpcHandlers(mockDeviceOrchestrator, null);
      } catch {}

      // Verify no handlers were registered
      expect(mockIpcMain.handle).not.toHaveBeenCalled();
    });
  });

  // Test both missing
  describe('Validation - both missing', () => {
    test('should throw error when both orchestrators are null', () => {
      expect(() => {
        registerIpcHandlers(null, null);
      }).toThrow('Both DeviceOrchestrator and DownloadOrchestrator are required');
    });

    test('should throw error when both orchestrators are undefined', () => {
      expect(() => {
        registerIpcHandlers(undefined, undefined);
      }).toThrow('Both DeviceOrchestrator and DownloadOrchestrator are required');
    });
  });

  // Test exports
  describe('Module exports', () => {
    test('should export registerIpcHandlers function', () => {
      expect(typeof registerIpcHandlers).toBe('function');
    });

    test('should export DeviceHandlers class', () => {
      expect(DeviceHandlers).toBeDefined();
      expect(typeof DeviceHandlers).toBe('function');
    });

    test('should export DownloadHandlers class', () => {
      expect(DownloadHandlers).toBeDefined();
      expect(typeof DownloadHandlers).toBe('function');
    });
  });
});
