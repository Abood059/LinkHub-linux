// DownloadOrchestrator.resilience.test.js
const DownloadOrchestrator = require('../../../../src/main/application/orchestrators/DownloadOrchestrator');

jest.mock('../../../../src/main/infrastructure/media/YtdlpAdapter');

const YtdlpAdapter = require('../../../../src/main/infrastructure/media/YtdlpAdapter');

describe('DownloadOrchestrator Resilience', () => {
  let orchestrator;
  let mockYtdlpAdapter;
  let mockLogger;

  beforeEach(() => {
    mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    mockYtdlpAdapter = new YtdlpAdapter();

    orchestrator = new DownloadOrchestrator({
      ytdlpAdapter: mockYtdlpAdapter,
      deviceRegistry: null,
      logger: mockLogger
    });

    jest.clearAllMocks();
  });

  describe('Group D: Download Failures', () => {
    // Test #10: ytdlpAdapter.startDownload fails
    test('should re-throw error when ytdlpAdapter.startDownload fails', async () => {
      // CRITICAL: Download failure should be propagated to caller
      // Orchestrator is stateless, so no side effects should occur
      mockYtdlpAdapter.startDownload.mockRejectedValue(new Error('Invalid URL'));

      await expect(orchestrator.startDownload('https://example.com/video', 'best', null, {}))
        .rejects.toThrow('Invalid URL');
      
      // Verify the error was passed through without modification
      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(
        'https://example.com/video',
        'best',
        { deviceId: null }
      );
      
      // Verify no state was stored (orchestrator is stateless)
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test #11: stopDownload after download already completed
    test('should return false when stopDownload called for non-existent process', () => {
      // CRITICAL: Stop operation should not fail even if process doesn't exist
      // Orchestrator should pass through the adapter's response unchanged
      mockYtdlpAdapter.stopDownload.mockReturnValue(false);

      const result = orchestrator.stopDownload('non-existent-process-id');

      // Verify result is passed through unchanged
      expect(result).toBe(false);
      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith('non-existent-process-id');
      
      // Verify no side effects
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    // Test #12: ytdlpAdapter.extractMetadata fails
    test('should re-throw error when ytdlpAdapter.extractMetadata fails', async () => {
      // CRITICAL: Metadata extraction failure should be propagated
      // Orchestrator should not swallow or modify the error
      mockYtdlpAdapter.extractMetadata.mockRejectedValue(new Error('Network error'));

      await expect(orchestrator.getMetadata('https://example.com/video'))
        .rejects.toThrow('Network error');
      
      // Verify the error was passed through without modification
      expect(mockYtdlpAdapter.extractMetadata).toHaveBeenCalledWith('https://example.com/video');
      
      // Verify no side effects
      expect(mockLogger.info).not.toHaveBeenCalled();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
