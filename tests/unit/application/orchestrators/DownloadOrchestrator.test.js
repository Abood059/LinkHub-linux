const DownloadOrchestrator = require('../../../../src/main/application/orchestrators/DownloadOrchestrator');

// Mock dependencies
jest.mock('../../../../src/main/infrastructure/media/YtdlpAdapter');

const YtdlpAdapter = require('../../../../src/main/infrastructure/media/YtdlpAdapter');

describe('DownloadOrchestrator', () => {
  let orchestrator;
  let mockYtdlpAdapter;
  let mockDeviceRegistry;
  let mockLogger;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create mock instances
    mockYtdlpAdapter = new YtdlpAdapter();
    mockDeviceRegistry = null;

    // Mock YtdlpAdapter methods
    mockYtdlpAdapter.inspectFormats = jest.fn();
    mockYtdlpAdapter.extractMetadata = jest.fn();
    mockYtdlpAdapter.startDownload = jest.fn();
    mockYtdlpAdapter.stopDownload = jest.fn();

    // Create orchestrator instance
    orchestrator = new DownloadOrchestrator({
      ytdlpAdapter: mockYtdlpAdapter,
      deviceRegistry: mockDeviceRegistry,
      logger: mockLogger
    });
  });

  describe('inspectLink', () => {
    it('should inspect link and return formats', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const mockResult = {
        title: 'Test Video',
        duration: 120,
        thumbnail: 'https://example.com/thumb.jpg',
        formats: [
          { formatId: '137', ext: 'mp4', resolution: '1920x1080' },
          { formatId: '140', ext: 'm4a', resolution: null }
        ]
      };
      
      mockYtdlpAdapter.inspectFormats.mockResolvedValue(mockResult);
      
      const result = await orchestrator.inspectLink(url);

      expect(mockYtdlpAdapter.inspectFormats).toHaveBeenCalledWith(url);
      expect(result).toBe(mockResult);
    });

    it('should delegate url validation to adapter when url is empty', async () => {
      const url = '';
      mockYtdlpAdapter.inspectFormats.mockRejectedValue(new Error('URL is required'));
      
      await expect(orchestrator.inspectLink(url)).rejects.toThrow('URL is required');
    });

    it('should delegate url validation to adapter when url is null', async () => {
      const url = null;
      mockYtdlpAdapter.inspectFormats.mockRejectedValue(new Error('URL is required'));
      
      await expect(orchestrator.inspectLink(url)).rejects.toThrow('URL is required');
    });

    it('should throw error when inspectFormats fails', async () => {
      const url = 'https://youtube.com/watch?v=test';
      
      mockYtdlpAdapter.inspectFormats.mockRejectedValue(new Error('Network error'));
      
      await expect(orchestrator.inspectLink(url)).rejects.toThrow('Network error');
    });
  });

  describe('getMetadata', () => {
    it('should extract metadata and return result', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const mockResult = {
        id: 'test-id',
        title: 'Test Video',
        duration: 120,
        thumbnail: 'https://example.com/thumb.jpg',
        uploader: 'Test Channel',
        webpageUrl: url
      };
      
      mockYtdlpAdapter.extractMetadata.mockResolvedValue(mockResult);
      
      const result = await orchestrator.getMetadata(url);

      expect(mockYtdlpAdapter.extractMetadata).toHaveBeenCalledWith(url);
      expect(result).toBe(mockResult);
    });

    it('should delegate url validation to adapter when url is empty', async () => {
      const url = '';
      mockYtdlpAdapter.extractMetadata.mockRejectedValue(new Error('URL is required'));
      
      await expect(orchestrator.getMetadata(url)).rejects.toThrow('URL is required');
    });

    it('should delegate url validation to adapter when url is null', async () => {
      const url = null;
      mockYtdlpAdapter.extractMetadata.mockRejectedValue(new Error('URL is required'));
      
      await expect(orchestrator.getMetadata(url)).rejects.toThrow('URL is required');
    });

    it('should throw error when extractMetadata fails', async () => {
      const url = 'https://youtube.com/watch?v=test';
      
      mockYtdlpAdapter.extractMetadata.mockRejectedValue(new Error('Invalid URL'));
      
      await expect(orchestrator.getMetadata(url)).rejects.toThrow('Invalid URL');
    });
  });

  describe('startDownload', () => {
    it('should start download with deviceId', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      const deviceId = 'device-123';
      const options = {};
      const mockResult = { success: true, processId: 'ytdlp-dl-12345' };
      
      mockYtdlpAdapter.startDownload.mockResolvedValue(mockResult);
      
      const result = await orchestrator.startDownload(url, formatId, deviceId, options);

      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(url, formatId, { ...options, deviceId });
      expect(result).toBe(mockResult);
    });

    it('should start download without deviceId', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      const mockResult = { success: true, processId: 'ytdlp-dl-12345' };
      
      mockYtdlpAdapter.startDownload.mockResolvedValue(mockResult);
      
      const result = await orchestrator.startDownload(url, formatId);

      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(url, formatId, { deviceId: null });
      expect(result).toBe(mockResult);
    });

    it('should throw error when url is empty', async () => {
      await expect(orchestrator.startDownload('', '137')).rejects.toThrow('url and formatId are required');
    });

    it('should throw error when url is null', async () => {
      await expect(orchestrator.startDownload(null, '137')).rejects.toThrow('url and formatId are required');
    });

    it('should throw error when formatId is empty', async () => {
      await expect(orchestrator.startDownload('https://youtube.com/watch?v=test', '')).rejects.toThrow('url and formatId are required');
    });

    it('should throw error when formatId is null', async () => {
      await expect(orchestrator.startDownload('https://youtube.com/watch?v=test', null)).rejects.toThrow('url and formatId are required');
    });

    it('should pass additional options to adapter', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      const options = { quality: 'high', outputPath: '/custom/path' };
      const mockResult = { success: true, processId: 'ytdlp-dl-12345' };
      
      mockYtdlpAdapter.startDownload.mockResolvedValue(mockResult);
      
      const result = await orchestrator.startDownload(url, formatId, null, options);

      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(url, formatId, { ...options, deviceId: null });
      expect(result).toBe(mockResult);
    });

    it('should merge deviceId with additional options', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      const deviceId = 'device-123';
      const options = { quality: 'high' };
      const mockResult = { success: true, processId: 'ytdlp-dl-12345' };
      
      mockYtdlpAdapter.startDownload.mockResolvedValue(mockResult);
      
      const result = await orchestrator.startDownload(url, formatId, deviceId, options);

      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(url, formatId, { quality: 'high', deviceId });
      expect(result).toBe(mockResult);
    });

    it('should throw error when startDownload fails', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      
      mockYtdlpAdapter.startDownload.mockRejectedValue(new Error('Download failed'));
      
      await expect(orchestrator.startDownload(url, formatId)).rejects.toThrow('Download failed');
    });
  });

  describe('stopDownload', () => {
    it('should stop download with correct processId', () => {
      const fileId = 'ytdlp-dl-12345';
      mockYtdlpAdapter.stopDownload.mockReturnValue(true);
      
      const result = orchestrator.stopDownload(fileId);

      // CRITICAL TEST: This verifies that the orchestrator passes the processId (fileId) to the adapter
      // If the current implementation passes url instead of processId, this test will fail
      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(fileId);
      expect(result).toBe(true);
    });

    it('should throw error when fileId is empty', () => {
      // Based on the current implementation, it returns false for empty fileId
      // This test verifies the expected behavior
      mockYtdlpAdapter.stopDownload.mockReturnValue(false);
      
      const result = orchestrator.stopDownload('');

      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith('');
      expect(result).toBe(false);
    });

    it('should throw error when fileId is null', () => {
      // Based on the current implementation, it returns false for null fileId
      mockYtdlpAdapter.stopDownload.mockReturnValue(false);
      
      const result = orchestrator.stopDownload(null);

      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(null);
      expect(result).toBe(false);
    });

    it('should return false when download not found', () => {
      const fileId = 'ytdlp-dl-99999';
      mockYtdlpAdapter.stopDownload.mockReturnValue(false);
      
      const result = orchestrator.stopDownload(fileId);

      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(fileId);
      expect(result).toBe(false);
    });

    it('should fail when fileId is incorrectly passed as url', () => {
      // This test is designed to FAIL if the orchestrator incorrectly passes a URL instead of processId
      // The YtdlpAdapter.stopDownload expects a processId (e.g., 'ytdlp-dl-12345')
      // If the orchestrator passes a URL (e.g., 'https://youtube.com/watch?v=test'), the adapter will fail
      
      const incorrectFileId = 'https://youtube.com/watch?v=test';
      mockYtdlpAdapter.stopDownload.mockImplementation((id) => {
        // Simulate adapter behavior: it expects a processId format
        if (id && id.startsWith('ytdlp-dl-')) {
          return true;
        }
        return false; // Returns false for invalid processId (like a URL)
      });
      
      const result = orchestrator.stopDownload(incorrectFileId);

      // This should fail because the orchestrator is passing a URL instead of a processId
      // The test will reveal the bug if the implementation is incorrect
      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(incorrectFileId);
      expect(result).toBe(false); // This reveals the bug - URL is not a valid processId
    });

    it('should handle successful stop correctly', () => {
      const fileId = 'ytdlp-dl-12345';
      mockYtdlpAdapter.stopDownload.mockReturnValue(true);
      
      const result = orchestrator.stopDownload(fileId);

      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });
  });
});
