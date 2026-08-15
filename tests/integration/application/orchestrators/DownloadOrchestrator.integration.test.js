// tests/integration/application/orchestrators/DownloadOrchestrator.integration.test.js
'use strict';

const DownloadOrchestrator = require('../../../../src/main/application/orchestrators/DownloadOrchestrator');
const DeviceRegistry = require('../../../../src/main/runtime/devices/DeviceRegistry');

// Mock Infrastructure dependencies
jest.mock('../../../../src/main/infrastructure/media/YtdlpAdapter');

const YtdlpAdapter = require('../../../../src/main/infrastructure/media/YtdlpAdapter');

describe('DownloadOrchestrator Integration', () => {
  let orchestrator;
  let mockYtdlpAdapter;
  let deviceRegistry;
  let mockLogger;

  beforeEach(() => {
    // Create real DeviceRegistry instance (optional, for deviceId tracking)
    deviceRegistry = new DeviceRegistry();

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Create mock instance (mocked by jest.mock above)
    mockYtdlpAdapter = new YtdlpAdapter();

    // Mock the methods we need
    mockYtdlpAdapter.inspectFormats = jest.fn();
    mockYtdlpAdapter.extractMetadata = jest.fn();
    mockYtdlpAdapter.startDownload = jest.fn();
    mockYtdlpAdapter.stopDownload = jest.fn();

    // Create orchestrator with mocked infrastructure
    orchestrator = new DownloadOrchestrator({
      ytdlpAdapter: mockYtdlpAdapter,
      deviceRegistry,
      logger: mockLogger
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up real registry to prevent state leakage
    deviceRegistry.clear();
  });

  describe('Inspect Link with Mock JSON', () => {
    it('should inspect link and return parsed formats from mock JSON', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const mockJsonOutput = JSON.stringify({
        title: 'Test Video',
        duration: 120,
        thumbnail: 'https://example.com/thumb.jpg',
        formats: [
          { format_id: '137', ext: 'mp4', resolution: '1920x1080', fps: 30, acodec: 'aac', vcodec: 'h264' },
          { format_id: '140', ext: 'm4a', resolution: null, fps: null, acodec: 'aac', vcodec: null }
        ]
      });

      const expectedResponse = {
        title: 'Test Video',
        duration: 120,
        thumbnail: 'https://example.com/thumb.jpg',
        formats: [
          { formatId: '137', ext: 'mp4', resolution: '1920x1080', fps: 30, acodec: 'aac', vcodec: 'h264' },
          { formatId: '140', ext: 'm4a', resolution: null, fps: null, acodec: 'aac', vcodec: null }
        ]
      };

      mockYtdlpAdapter.inspectFormats.mockResolvedValue(expectedResponse);

      const result = await orchestrator.inspectLink(url);

      // Verify adapter was called with correct URL
      expect(mockYtdlpAdapter.inspectFormats).toHaveBeenCalledWith(url);

      // Verify response structure
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('formats');
      expect(result.formats).toHaveLength(2);
      expect(result.formats[0].formatId).toBe('137');
    });
  });

  describe('Start Download', () => {
    it('should start download and return processId with correct parameters', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      const deviceId = 'device-123';
      const options = { outputPath: '/custom/path' };
      const mockProcessId = 'ytdlp-dl-12345';
      const mockResult = { success: true, processId: mockProcessId, outputPath: '/custom/path.mp4' };

      mockYtdlpAdapter.startDownload.mockResolvedValue(mockResult);

      const result = await orchestrator.startDownload(url, formatId, deviceId, options);

      // Verify adapter was called with correct parameters
      expect(mockYtdlpAdapter.startDownload).toHaveBeenCalledWith(
        url,
        formatId,
        { ...options, deviceId }
      );

      // Verify result contains processId
      expect(result.processId).toBe(mockProcessId);
    });
  });

  describe('Stop Download with processId (CRITICAL BUG TEST)', () => {
    it('should stop download using processId, NOT url - orchestrator level test', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const formatId = '137';
      const deviceId = 'device-123';
      const mockProcessId = 'ytdlp-dl-12345';

      // Mock startDownload to return a processId
      mockYtdlpAdapter.startDownload.mockResolvedValue({
        success: true,
        processId: mockProcessId
      });

      // Start the download to get a real processId
      const startResult = await orchestrator.startDownload(url, formatId, deviceId);

      // Mock stopDownload to succeed
      mockYtdlpAdapter.stopDownload.mockReturnValue(true);

      // Call stopDownload with the processId (correct behavior)
      orchestrator.stopDownload(startResult.processId);

      // CRITICAL ASSERTION: This verifies that the orchestrator passes processId to the adapter
      // The orchestrator itself is correct - it delegates properly
      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(mockProcessId);

      // Additional verification: ensure it was NOT called with the URL
      expect(mockYtdlpAdapter.stopDownload).not.toHaveBeenCalledWith(url);
    });

    it('should expose the bug when simulating IPC handler behavior (passes url instead of processId)', () => {
      const url = 'https://youtube.com/watch?v=test';
      const mockProcessId = 'ytdlp-dl-12345';

      // Mock the adapter to validate the input format
      mockYtdlpAdapter.stopDownload.mockImplementation((id) => {
        // Adapter expects processId format (ytdlp-dl-*)
        // If URL is passed, it should fail
        if (id && id.startsWith('ytdlp-dl-')) {
          return true;
        }
        return false; // URL is not a valid processId
      });

      // SIMULATE THE BUG: This is what DownloadHandlers.js currently does (line 33-36)
      // It passes url instead of processId to the orchestrator
      const buggyIpcHandlerCall = () => orchestrator.stopDownload(url);

      // This will fail because URL is not a valid processId format
      const result = buggyIpcHandlerCall();

      // BUG EXPOSED: The result is false because URL was passed instead of processId
      expect(result).toBe(false);
      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(url);

      // CORRECT BEHAVIOR: When processId is passed, it should succeed
      mockYtdlpAdapter.stopDownload.mockClear();
      const correctCall = orchestrator.stopDownload(mockProcessId);
      expect(correctCall).toBe(true);
      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(mockProcessId);
    });
  });

  describe('Stop Non-existent Download', () => {
    it('should return false when stopping non-existent download', () => {
      const nonExistentId = 'ytdlp-dl-99999';

      mockYtdlpAdapter.stopDownload.mockReturnValue(false);

      const result = orchestrator.stopDownload(nonExistentId);

      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(nonExistentId);
      expect(result).toBe(false);
    });

    it('should return false for empty processId', () => {
      mockYtdlpAdapter.stopDownload.mockReturnValue(false);

      const result = orchestrator.stopDownload('');

      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith('');
      expect(result).toBe(false);
    });

    it('should return false for null processId', () => {
      mockYtdlpAdapter.stopDownload.mockReturnValue(false);

      const result = orchestrator.stopDownload(null);

      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(null);
      expect(result).toBe(false);
    });

    it('should handle random/invalid fileId string appropriately', () => {
      const randomString = 'random-invalid-string-12345';

      // Mock adapter to validate input format
      mockYtdlpAdapter.stopDownload.mockImplementation((id) => {
        // Adapter expects processId format (ytdlp-dl-*)
        // Random strings should be handled gracefully
        if (id && id.startsWith('ytdlp-dl-')) {
          return true;
        }
        return false; // Invalid format
      });

      const result = orchestrator.stopDownload(randomString);

      expect(mockYtdlpAdapter.stopDownload).toHaveBeenCalledWith(randomString);
      expect(result).toBe(false);
    });
  });

  describe('Get Metadata', () => {
    it('should extract and return metadata from adapter', async () => {
      const url = 'https://youtube.com/watch?v=test';
      const mockMetadata = {
        id: 'test-id',
        title: 'Test Video',
        duration: 120,
        thumbnail: 'https://example.com/thumb.jpg',
        uploader: 'Test Channel',
        webpageUrl: url
      };

      mockYtdlpAdapter.extractMetadata.mockResolvedValue(mockMetadata);

      const result = await orchestrator.getMetadata(url);

      // Verify adapter was called with correct URL
      expect(mockYtdlpAdapter.extractMetadata).toHaveBeenCalledWith(url);

      // Verify metadata structure
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('thumbnail');
      expect(result).toHaveProperty('uploader');
      expect(result.title).toBe('Test Video');
    });
  });
});
