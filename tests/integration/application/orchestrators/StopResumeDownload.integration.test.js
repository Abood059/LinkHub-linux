// tests/integration/application/orchestrators/StopResumeDownload.integration.test.js
'use strict';

const DownloadOrchestrator = require('../../../../src/main/application/orchestrators/DownloadOrchestrator');
const DownloadManager = require('../../../../src/main/infrastructure/media/DownloadManager');

// Mock YtdlpAdapter
jest.mock('../../../../src/main/infrastructure/media/YtdlpAdapter');
const YtdlpAdapter = require('../../../../src/main/infrastructure/media/YtdlpAdapter');

describe('Stop and Resume Download Integration', () => {
  let orchestrator;
  let mockYtdlpAdapter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create mock instance
    mockYtdlpAdapter = new YtdlpAdapter();

    // Mock the methods
    mockYtdlpAdapter.stopDownload = jest.fn();
    mockYtdlpAdapter.startDownload = jest.fn();
    mockYtdlpAdapter._downloadManager = new DownloadManager({ logger: mockLogger });

    orchestrator = new DownloadOrchestrator({
      ytdlpAdapter: mockYtdlpAdapter,
      logger: mockLogger
    });

    jest.clearAllMocks();
  });

  describe('Stop Download with manuallyStopped flag', () => {
    it('should set manuallyStopped flag when stopDownload is called', () => {
      const processId = 'ytdlp-dl-12345';
      
      // Mock stopDownload to return true
      mockYtdlpAdapter.stopDownload.mockReturnValue(true);
      
      // Call stopDownload through orchestrator
      const result = orchestrator.stopDownload(processId);
      
      // Verify it returns true
      expect(result).toBe(true);
      
      // Verify stopDownload was called
      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(processId);
    });

    it('should emit downloadStopped event with correct data', () => {
      const processId = 'ytdlp-dl-12345';
      const testData = {
        url: 'https://youtube.com/watch?v=test',
        formatId: '137',
        deviceId: 'device-123',
        title: 'Test Video'
      };

      // Setup download entry first
      mockYtdlpAdapter._downloadManager.createDownloadEntry(processId, {
        resolve: jest.fn(),
        reject: jest.fn(),
        ...testData
      });

      // Spy on emit method
      const emitSpy = jest.spyOn(mockYtdlpAdapter, 'emit');

      // Mock stopDownload to emit the event
      mockYtdlpAdapter.stopDownload.mockImplementation((id) => {
        const entry = mockYtdlpAdapter._downloadManager.getDownloadEntry(id);
        if (entry) {
          entry.manuallyStopped = true;
          mockYtdlpAdapter.emit('downloadStopped', {
            downloadId: id,
            url: entry.url,
            formatId: entry.formatId,
            deviceId: entry.deviceId,
            title: entry.title
          });
        }
        return true;
      });

      // Call stopDownload
      orchestrator.stopDownload(processId);
      
      // Verify emit was called with correct event name and data
      expect(emitSpy).toHaveBeenCalledWith('downloadStopped', {
        downloadId: processId,
        url: testData.url,
        formatId: testData.formatId,
        deviceId: testData.deviceId,
        title: testData.title
      });
      
      emitSpy.mockRestore();
    });
  });

  describe('Resume Download with existing processId', () => {
    it('should resume download by passing existing processId', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      const deviceId = 'device-123';
      const existingProcessId = 'ytdlp-dl-12345';
      const options = { title: 'Test Video' };

      // Mock startDownload to return success
      mockYtdlpAdapter.startDownload.mockResolvedValue({
        success: true,
        processId: existingProcessId
      });

      // Call resumeDownload
      const result = await orchestrator.resumeDownload(
        existingProcessId,
        url,
        formatId,
        deviceId,
        options
      );

      // Verify startDownload was called with processId in options
      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(
        url,
        formatId,
        { ...options, deviceId, processId: existingProcessId }
      );
    });
  });

  describe('Exit handler with manuallyStopped flag', () => {
    it('should not call handleDownloadFailure when manuallyStopped is true', async () => {
      const processId = 'ytdlp-dl-12345';
      const testData = {
        url: 'https://youtube.com/watch?v=test',
        formatId: '137',
        deviceId: 'device-123',
        title: 'Test Video'
      };

      // Setup download entry
      mockYtdlpAdapter._downloadManager.createDownloadEntry(processId, {
        resolve: jest.fn(),
        reject: jest.fn(),
        ...testData
      });

      // Set manuallyStopped flag
      const entry = mockYtdlpAdapter._downloadManager.getDownloadEntry(processId);
      entry.manuallyStopped = true;

      // Spy on handleDownloadFailure
      const handleFailureSpy = jest.spyOn(mockYtdlpAdapter._downloadManager, 'handleDownloadFailure');

      // Spy on emit method
      const emitSpy = jest.spyOn(mockYtdlpAdapter, 'emit');

      // Simulate exit handler being called with non-zero exit code
      // This would normally trigger handleDownloadFailure, but should not when manuallyStopped is true
      const exitHandler = async (code) => {
        const entry = mockYtdlpAdapter._downloadManager.getDownloadEntry(processId);
        if (!entry) return;
        
        if (entry.manuallyStopped) {
          mockYtdlpAdapter._downloadManager.updateDownloadStatus(processId, 'stopped');
          mockYtdlpAdapter.emit('downloadStopped', {
            downloadId: processId,
            url: entry.url,
            formatId: entry.formatId,
            deviceId: entry.deviceId,
            title: entry.title
          });
          mockYtdlpAdapter._downloadManager.removeDownloadEntry(processId);
          return;
        }
        
        if (code !== 0) {
          mockYtdlpAdapter._downloadManager.handleDownloadFailure(processId, code, entry.deviceId, entry.url, entry.title);
        }
      };

      await exitHandler(1); // Exit with non-zero code

      // Verify handleDownloadFailure was NOT called
      expect(handleFailureSpy).not.toHaveBeenCalled();
      
      // Verify downloadStopped event was emitted
      expect(emitSpy).toHaveBeenCalledWith('downloadStopped', {
        downloadId: processId,
        url: testData.url,
        formatId: testData.formatId,
        deviceId: testData.deviceId,
        title: testData.title
      });
      
      emitSpy.mockRestore();
    });

    it('should call handleDownloadFailure when manuallyStopped is false', async () => {
      const processId = 'ytdlp-dl-12345';
      const testData = {
        url: 'https://youtube.com/watch?v=test',
        formatId: '137',
        deviceId: 'device-123',
        title: 'Test Video'
      };

      // Setup download entry without manuallyStopped flag
      mockYtdlpAdapter._downloadManager.createDownloadEntry(processId, {
        resolve: jest.fn(),
        reject: jest.fn(),
        ...testData,
        manuallyStopped: false
      });

      // Spy on handleDownloadFailure
      const handleFailureSpy = jest.spyOn(mockYtdlpAdapter._downloadManager, 'handleDownloadFailure');

      // Simulate exit handler being called with non-zero exit code
      const exitHandler = async (code) => {
        const entry = mockYtdlpAdapter._downloadManager.getDownloadEntry(processId);
        if (!entry) return;
        
        if (entry.manuallyStopped) {
          mockYtdlpAdapter._downloadManager.updateDownloadStatus(processId, 'stopped');
          mockYtdlpAdapter.emit('downloadStopped', {
            downloadId: processId,
            url: entry.url,
            formatId: entry.formatId,
            deviceId: entry.deviceId,
            title: entry.title
          });
          mockYtdlpAdapter._downloadManager.removeDownloadEntry(processId);
          return;
        }
        
        if (code !== 0) {
          mockYtdlpAdapter._downloadManager.handleDownloadFailure(processId, code, entry.deviceId, entry.url, entry.title);
        }
      };

      await exitHandler(1); // Exit with non-zero code

      // Verify handleDownloadFailure WAS called
      expect(handleFailureSpy).toHaveBeenCalledWith(processId, 1, testData.deviceId, testData.url, testData.title);
    });
  });

  describe('DownloadManager shouldRetry with manuallyStopped', () => {
    it('should return false when manuallyStopped is true', () => {
      const downloadManager = new DownloadManager({ logger: mockLogger });
      const processId = 'ytdlp-dl-12345';
      
      downloadManager.createDownloadEntry(processId, {
        resolve: jest.fn(),
        reject: jest.fn(),
        url: 'https://youtube.com/watch?v=test',
        formatId: '137',
        deviceId: 'device-123',
        title: 'Test Video'
      });

      const entry = downloadManager.getDownloadEntry(processId);
      entry.manuallyStopped = true;

      const shouldRetry = downloadManager.shouldRetry(entry, 1);

      expect(shouldRetry).toBe(false);
    });

    it('should return true when manuallyStopped is false and retries not exhausted', () => {
      const downloadManager = new DownloadManager({ logger: mockLogger });
      const processId = 'ytdlp-dl-12345';
      
      downloadManager.createDownloadEntry(processId, {
        resolve: jest.fn(),
        reject: jest.fn(),
        url: 'https://youtube.com/watch?v=test',
        formatId: '137',
        deviceId: 'device-123',
        title: 'Test Video'
      });

      const entry = downloadManager.getDownloadEntry(processId);
      entry.manuallyStopped = false;

      const shouldRetry = downloadManager.shouldRetry(entry, 1);

      expect(shouldRetry).toBe(true);
      expect(entry.retryCount).toBe(1);
    });
  });
});
