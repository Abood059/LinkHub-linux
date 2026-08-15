// DownloadHandlers.test.js
'use strict';

const DownloadHandlers = require('../../../../src/main/infrastructure/ipc/DownloadHandlers');

describe('DownloadHandlers Unit Tests', () => {
  let downloadHandlers;
  let mockDownloadOrchestrator;
  let mockIpcMain;

  beforeEach(() => {
    // Create mock orchestrator with all required methods
    mockDownloadOrchestrator = {
      inspectLink: jest.fn().mockResolvedValue({ title: 'Video Title' }),
      startDownload: jest.fn().mockResolvedValue({ processId: 'proc-123' }),
      stopDownload: jest.fn().mockResolvedValue({ stopped: true }),
      getMetadata: jest.fn().mockResolvedValue({ duration: 120 }),
      getActiveDownloads: jest.fn().mockResolvedValue([])
    };

    // Create mock ipcMain with handle function
    mockIpcMain = {
      handle: jest.fn()
    };

    downloadHandlers = new DownloadHandlers(mockDownloadOrchestrator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test #18: Constructor validation
  describe('Constructor', () => {
    test('should throw error when orchestrator is null', () => {
      expect(() => new DownloadHandlers(null)).toThrow('DownloadOrchestrator is required for DownloadHandlers');
    });

    test('should throw error when orchestrator is undefined', () => {
      expect(() => new DownloadHandlers(undefined)).toThrow('DownloadOrchestrator is required for DownloadHandlers');
    });

    test('should accept valid orchestrator', () => {
      const handler = new DownloadHandlers(mockDownloadOrchestrator);
      expect(handler).toBeInstanceOf(DownloadHandlers);
    });
  });

  // Test #19: Registration
  describe('Registration', () => {
    test('should register all 5 IPC channels', () => {
      downloadHandlers.register(mockIpcMain);

      // Verify handle was called for each channel
      expect(mockIpcMain.handle).toHaveBeenCalledTimes(5);
      
      const channels = mockIpcMain.handle.mock.calls.map(call => call[0]);
      expect(channels).toContain('download:inspect');
      expect(channels).toContain('download:start');
      expect(channels).toContain('download:stop');
      expect(channels).toContain('download:metadata');
      expect(channels).toContain('download:active');
    });

    test('should throw error when ipcMain is null', () => {
      expect(() => downloadHandlers.register(null)).toThrow('Valid ipcMain instance required');
    });

    test('should throw error when ipcMain.handle is not a function', () => {
      expect(() => downloadHandlers.register({})).toThrow('Valid ipcMain instance required');
    });
  });

  // Test #19-20: download:inspect
  describe('download:inspect channel', () => {
    test('should call orchestrator.inspectLink with valid url', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');
      
      const result = await handlerFn({}, 'https://example.com/video');

      expect(mockDownloadOrchestrator.inspectLink).toHaveBeenCalledWith('https://example.com/video');
      expect(result).toEqual({ title: 'Video Title' });
    });

    test('should throw error when url is empty string', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');

      await expect(handlerFn({}, '')).rejects.toThrow('URL is required');
      expect(mockDownloadOrchestrator.inspectLink).not.toHaveBeenCalled();
    });

    test('should throw error when url is null', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');

      await expect(handlerFn({}, null)).rejects.toThrow('URL is required');
      expect(mockDownloadOrchestrator.inspectLink).not.toHaveBeenCalled();
    });

    test('should throw error when url is undefined', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');

      await expect(handlerFn({}, undefined)).rejects.toThrow('URL is required');
      expect(mockDownloadOrchestrator.inspectLink).not.toHaveBeenCalled();
    });
  });

  // Test #21-24: download:start
  describe('download:start channel', () => {
    test('should call orchestrator.startDownload with all parameters', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:start');
      
      const url = 'https://example.com/video';
      const formatId = '137';
      const deviceId = 'device-123';
      const options = { path: '/downloads' };
      
      const result = await handlerFn({}, url, formatId, deviceId, options);

      expect(mockDownloadOrchestrator.startDownload).toHaveBeenCalledWith(url, formatId, deviceId, options);
      expect(result).toEqual({ processId: 'proc-123' });
    });

    test('should throw error when url is empty string', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:start');

      await expect(handlerFn({}, '', '137')).rejects.toThrow('url and formatId are required');
      expect(mockDownloadOrchestrator.startDownload).not.toHaveBeenCalled();
    });

    test('should throw error when formatId is empty string', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:start');

      await expect(handlerFn({}, 'https://example.com', '')).rejects.toThrow('url and formatId are required');
      expect(mockDownloadOrchestrator.startDownload).not.toHaveBeenCalled();
    });

    test('should throw error when both url and formatId are missing', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:start');

      await expect(handlerFn({}, null, null)).rejects.toThrow('url and formatId are required');
      expect(mockDownloadOrchestrator.startDownload).not.toHaveBeenCalled();
    });

    test('should call orchestrator with default values when deviceId and options are missing', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:start');
      
      const url = 'https://example.com/video';
      const formatId = '137';
      
      const result = await handlerFn({}, url, formatId);

      expect(mockDownloadOrchestrator.startDownload).toHaveBeenCalledWith(url, formatId, null, {});
      expect(result).toEqual({ processId: 'proc-123' });
    });

    test('should call orchestrator with default options when only deviceId is provided', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:start');
      
      const url = 'https://example.com/video';
      const formatId = '137';
      const deviceId = 'device-123';
      
      const result = await handlerFn({}, url, formatId, deviceId);

      expect(mockDownloadOrchestrator.startDownload).toHaveBeenCalledWith(url, formatId, deviceId, {});
      expect(result).toEqual({ processId: 'proc-123' });
    });
  });

  // Test #25-26: download:stop
  describe('download:stop channel', () => {
    test('should call orchestrator.stopDownload with processId', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:stop');
      
      const processId = 'proc-123';
      
      await handlerFn({}, processId);

      expect(mockDownloadOrchestrator.stopDownload).toHaveBeenCalledWith(processId);
    });

    test('should throw error when processId is empty string', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:stop');

      await expect(handlerFn({}, '')).rejects.toThrow('processId is required');
      expect(mockDownloadOrchestrator.stopDownload).not.toHaveBeenCalled();
    });

    test('should throw error when processId is null', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:stop');

      await expect(handlerFn({}, null)).rejects.toThrow('processId is required');
      expect(mockDownloadOrchestrator.stopDownload).not.toHaveBeenCalled();
    });

    test('should throw error when processId is undefined', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:stop');

      await expect(handlerFn({}, undefined)).rejects.toThrow('processId is required');
      expect(mockDownloadOrchestrator.stopDownload).not.toHaveBeenCalled();
    });
  });

  // Test #27-28: download:metadata
  describe('download:metadata channel', () => {
    test('should call orchestrator.getMetadata with valid url', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:metadata');
      
      const result = await handlerFn({}, 'https://example.com/video');

      expect(mockDownloadOrchestrator.getMetadata).toHaveBeenCalledWith('https://example.com/video');
      expect(result).toEqual({ duration: 120 });
    });

    test('should throw error when url is null', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:metadata');

      await expect(handlerFn({}, null)).rejects.toThrow('URL is required');
      expect(mockDownloadOrchestrator.getMetadata).not.toHaveBeenCalled();
    });

    test('should throw error when url is empty string', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:metadata');

      await expect(handlerFn({}, '')).rejects.toThrow('URL is required');
      expect(mockDownloadOrchestrator.getMetadata).not.toHaveBeenCalled();
    });
  });

  // download:active channel
  describe('download:active channel', () => {
    test('should call orchestrator.getActiveDownloads', async () => {
      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:active');
      
      const result = await handlerFn({}, {});

      expect(mockDownloadOrchestrator.getActiveDownloads).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  // Test #29: Error propagation
  describe('Error propagation', () => {
    test('should propagate orchestrator errors for download:inspect', async () => {
      mockDownloadOrchestrator.inspectLink.mockRejectedValue(new Error('Invalid URL'));

      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:inspect');

      await expect(handlerFn({}, 'https://example.com')).rejects.toThrow('Invalid URL');
    });

    test('should propagate orchestrator errors for download:start', async () => {
      mockDownloadOrchestrator.startDownload.mockRejectedValue(new Error('Download failed'));

      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:start');

      await expect(handlerFn({}, 'https://example.com', '137')).rejects.toThrow('Download failed');
    });

    test('should propagate orchestrator errors for download:stop', async () => {
      mockDownloadOrchestrator.stopDownload.mockRejectedValue(new Error('Stop failed'));

      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:stop');

      await expect(handlerFn({}, 'proc-123')).rejects.toThrow('Stop failed');
    });

    test('should propagate orchestrator errors for download:metadata', async () => {
      mockDownloadOrchestrator.getMetadata.mockRejectedValue(new Error('Metadata error'));

      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:metadata');

      await expect(handlerFn({}, 'https://example.com')).rejects.toThrow('Metadata error');
    });

    test('should propagate orchestrator errors for download:active', async () => {
      mockDownloadOrchestrator.getActiveDownloads.mockRejectedValue(new Error('Active downloads error'));

      downloadHandlers.register(mockIpcMain);

      const [, handlerFn] = mockIpcMain.handle.mock.calls.find(call => call[0] === 'download:active');

      await expect(handlerFn({}, {})).rejects.toThrow('Active downloads error');
    });
  });
});
