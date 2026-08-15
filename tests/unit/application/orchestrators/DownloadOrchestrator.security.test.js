const DownloadOrchestrator = require('../../../../src/main/application/orchestrators/DownloadOrchestrator');

// Mock dependencies
jest.mock('../../../../src/main/infrastructure/media/YtdlpAdapter');

const YtdlpAdapter = require('../../../../src/main/infrastructure/media/YtdlpAdapter');

describe('DownloadOrchestrator Security Tests', () => {
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

  describe('Indirect Injection Prevention', () => {
    // Test #13: Command injection in url
    test('should pass malicious url to ytdlpAdapter.inspectFormats unchanged', async () => {
      const maliciousUrl = 'https://youtube.com/watch?v=test;rm -rf /';
      const mockResult = { title: 'Test', formats: [] };

      mockYtdlpAdapter.inspectFormats.mockResolvedValue(mockResult);

      await orchestrator.inspectLink(maliciousUrl);

      // SECURITY: Verify the orchestrator passes the malicious url unchanged
      // The Infrastructure layer (YtdlpAdapter) is responsible for sanitization
      expect(mockYtdlpAdapter.inspectFormats).toHaveBeenCalledWith(maliciousUrl);
    });

    // Test #14: Command injection in formatId
    test('should pass malicious formatId to ytdlpAdapter.startDownload unchanged', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const maliciousFormatId = '137;rm -rf /';
      const mockResult = { success: true, processId: 'ytdlp-dl-12345' };

      mockYtdlpAdapter.startDownload.mockResolvedValue(mockResult);

      await orchestrator.startDownload(url, maliciousFormatId);

      // SECURITY: Verify the orchestrator passes the malicious formatId unchanged
      // The Infrastructure layer (YtdlpAdapter) is responsible for sanitization
      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(url, maliciousFormatId, { deviceId: null });
    });

    // Test #15: URL with control characters
    test('should pass url with control characters to ytdlpAdapter.inspectFormats unchanged', async () => {
      const urlWithControlChars = 'https://youtube.com/watch?v=test\x00malicious';
      const mockResult = { title: 'Test', formats: [] };

      mockYtdlpAdapter.inspectFormats.mockResolvedValue(mockResult);

      await orchestrator.inspectLink(urlWithControlChars);

      // SECURITY: Verify the orchestrator passes the url with control characters unchanged
      // The Infrastructure layer (YtdlpAdapter) is responsible for sanitization
      expect(mockYtdlpAdapter.inspectFormats).toHaveBeenCalledWith(urlWithControlChars);
    });
  });

  describe('Large and Malformed Inputs', () => {
    // Test #16: Very long url (10,000 characters)
    test('should handle 10000 character url without crashing', async () => {
      const longUrl = 'https://'.repeat(1000);
      const mockResult = { title: 'Test', formats: [] };

      mockYtdlpAdapter.inspectFormats.mockResolvedValue(mockResult);

      // SECURITY: Should not throw exception or crash with large input
      const result = await orchestrator.inspectLink(longUrl);

      expect(result).toBe(mockResult);
      expect(mockYtdlpAdapter.inspectFormats).toHaveBeenCalledWith(longUrl);
    });

    // Test #17: Options with large data (1MB buffer)
    test('should pass options with large data to ytdlpAdapter.startDownload unchanged', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      const largeBuffer = Buffer.alloc(1024 * 1024); // 1MB buffer
      const optionsWithLargeData = { data: largeBuffer };
      const mockResult = { success: true, processId: 'ytdlp-dl-12345' };

      mockYtdlpAdapter.startDownload.mockResolvedValue(mockResult);

      // SECURITY: Should not throw exception or crash with large data in options
      const result = await orchestrator.startDownload(url, formatId, null, optionsWithLargeData);

      expect(result).toBe(mockResult);
      // SECURITY: Verify the orchestrator passes the options object unchanged
      // The YtdlpAdapter is responsible for handling/validating large data
      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(url, formatId, { data: largeBuffer, deviceId: null });
    });
  });
});
