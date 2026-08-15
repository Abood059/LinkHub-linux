'use strict';

const TransferProgressTracker = require('../../../../src/main/infrastructure/transfer/TransferProgressTracker');
const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    stat: jest.fn()
  }
}));

describe('TransferProgressTracker', () => {
  let tracker;
  let mockAdbExecutor;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockAdbExecutor = {
      _sanitizeSerialOrTarget: jest.fn((id) => id),
      _executeShellCommand: jest.fn()
    };

    tracker = new TransferProgressTracker({
      adbExecutor: mockAdbExecutor,
      logger: mockLogger
    });
  });

  describe('Constructor', () => {
    it('should throw error when adbExecutor is not provided', () => {
      expect(() => {
        new TransferProgressTracker({});
      }).toThrow('adbExecutor is required for TransferProgressTracker');
    });

    it('should create instance with valid dependencies', () => {
      expect(tracker).toBeInstanceOf(TransferProgressTracker);
      expect(tracker._adbExecutor).toBe(mockAdbExecutor);
      expect(tracker._logger).toBe(mockLogger);
    });

    it('should work without logger', () => {
      const trackerWithoutLogger = new TransferProgressTracker({
        adbExecutor: mockAdbExecutor
      });
      expect(trackerWithoutLogger._logger).toBeNull();
    });
  });

  describe('calculateProgress', () => {
    it('should calculate progress correctly', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const originalSize = 1000000;
      const remoteSize = 500000;

      mockAdbExecutor._executeShellCommand.mockResolvedValue('500000');

      const result = await tracker.calculateProgress(deviceId, remotePath, originalSize);

      expect(result).toEqual({
        progress: 0.5,
        transferredBytes: remoteSize,
        totalBytes: originalSize
      });
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        deviceId,
        ['stat', '-c', '%s', remotePath]
      );
    });

    it('should cap progress at 1.0 when remote size exceeds original', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const originalSize = 1000000;
      const remoteSize = 1500000;

      mockAdbExecutor._executeShellCommand.mockResolvedValue('1500000');

      const result = await tracker.calculateProgress(deviceId, remotePath, originalSize);

      expect(result.progress).toBe(1);
      expect(result.transferredBytes).toBe(remoteSize);
    });

    it('should handle zero original size', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const originalSize = 0;

      mockAdbExecutor._executeShellCommand.mockResolvedValue('1000000');

      const result = await tracker.calculateProgress(deviceId, remotePath, originalSize);

      expect(result.progress).toBe(1);
      expect(result.transferredBytes).toBe(1000000);
      expect(result.totalBytes).toBe(0);
    });

    it('should handle negative original size', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const originalSize = -1000;

      mockAdbExecutor._executeShellCommand.mockResolvedValue('500000');

      const result = await tracker.calculateProgress(deviceId, remotePath, originalSize);

      expect(result.progress).toBe(1);
    });

    it('should handle shell command failure', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const originalSize = 1000000;

      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('Command failed'));

      const result = await tracker.calculateProgress(deviceId, remotePath, originalSize);

      expect(result.progress).toBe(0);
      expect(result.transferredBytes).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get remote file size')
      );
    });

    it('should handle invalid size output (NaN)', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const originalSize = 1000000;

      mockAdbExecutor._executeShellCommand.mockResolvedValue('invalid');

      const result = await tracker.calculateProgress(deviceId, remotePath, originalSize);

      expect(result.transferredBytes).toBe(0);
    });

    it('should handle empty size output', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const originalSize = 1000000;

      mockAdbExecutor._executeShellCommand.mockResolvedValue('');

      const result = await tracker.calculateProgress(deviceId, remotePath, originalSize);

      expect(result.transferredBytes).toBe(0);
    });

    it('should use _sanitizeSerialOrTarget if available', async () => {
      mockAdbExecutor._sanitizeSerialOrTarget.mockReturnValue('sanitized-device123');
      mockAdbExecutor._executeShellCommand.mockResolvedValue('500000');

      await tracker.calculateProgress('device123', '/sdcard/file.mp4', 1000000);

      expect(mockAdbExecutor._sanitizeSerialOrTarget).toHaveBeenCalledWith('device123');
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        'sanitized-device123',
        ['stat', '-c', '%s', '/sdcard/file.mp4']
      );
    });

    it('should not call _sanitizeSerialOrTarget if not available', async () => {
      const executorWithoutSanitize = {
        _executeShellCommand: jest.fn().mockResolvedValue('500000')
      };

      const trackerWithoutSanitize = new TransferProgressTracker({
        adbExecutor: executorWithoutSanitize,
        logger: mockLogger
      });

      await trackerWithoutSanitize.calculateProgress('device123', '/sdcard/file.mp4', 1000000);

      expect(executorWithoutSanitize._executeShellCommand).toHaveBeenCalledWith(
        'device123',
        ['stat', '-c', '%s', '/sdcard/file.mp4']
      );
    });
  });

  describe('getLocalFileSize', () => {
    it('should get local file size successfully', async () => {
      const filePath = '/local/file.mp4';
      const mockStats = { size: 1000000 };

      fs.stat.mockResolvedValue(mockStats);

      const result = await tracker.getLocalFileSize(filePath);

      expect(result).toBe(1000000);
      expect(fs.stat).toHaveBeenCalledWith(filePath);
    });

    it('should handle file not found', async () => {
      const filePath = '/local/nonexistent.mp4';

      fs.stat.mockRejectedValue(new Error('File not found'));

      const result = await tracker.getLocalFileSize(filePath);

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get local file size')
      );
    });

    it('should handle permission error', async () => {
      const filePath = '/local/file.mp4';

      fs.stat.mockRejectedValue(new Error('Permission denied'));

      const result = await tracker.getLocalFileSize(filePath);

      expect(result).toBe(0);
    });

    it('should handle zero size file', async () => {
      const filePath = '/local/empty.mp4';
      const mockStats = { size: 0 };

      fs.stat.mockResolvedValue(mockStats);

      const result = await tracker.getLocalFileSize(filePath);

      expect(result).toBe(0);
    });

    it('should handle very large file size', async () => {
      const filePath = '/local/large.mp4';
      const largeSize = Number.MAX_SAFE_INTEGER;
      const mockStats = { size: largeSize };

      fs.stat.mockResolvedValue(mockStats);

      const result = await tracker.getLocalFileSize(filePath);

      expect(result).toBe(largeSize);
    });
  });

  describe('getRemoteFileSize', () => {
    it('should get remote file size successfully', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('1000000');

      const result = await tracker.getRemoteFileSize(deviceId, remotePath);

      expect(result).toBe(1000000);
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        deviceId,
        ['stat', '-c', '%s', remotePath]
      );
    });

    it('should handle shell command failure', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';

      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('Command failed'));

      const result = await tracker.getRemoteFileSize(deviceId, remotePath);

      expect(result).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get remote file size')
      );
    });

    it('should handle invalid size output', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('not-a-number');

      const result = await tracker.getRemoteFileSize(deviceId, remotePath);

      expect(result).toBe(0);
    });

    it('should handle size output with whitespace', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('  1000000  ');

      const result = await tracker.getRemoteFileSize(deviceId, remotePath);

      expect(result).toBe(1000000);
    });

    it('should handle size output with newline', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('1000000\n');

      const result = await tracker.getRemoteFileSize(deviceId, remotePath);

      expect(result).toBe(1000000);
    });

    it('should use _sanitizeSerialOrTarget if available', async () => {
      mockAdbExecutor._sanitizeSerialOrTarget.mockReturnValue('sanitized-device123');
      mockAdbExecutor._executeShellCommand.mockResolvedValue('1000000');

      await tracker.getRemoteFileSize('device123', '/sdcard/file.mp4');

      expect(mockAdbExecutor._sanitizeSerialOrTarget).toHaveBeenCalledWith('device123');
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        'sanitized-device123',
        ['stat', '-c', '%s', '/sdcard/file.mp4']
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in remote path', async () => {
      const remotePath = '/sdcard/file with spaces & special!.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('1000000');

      const result = await tracker.getRemoteFileSize('device123', remotePath);

      expect(result).toBe(1000000);
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        'device123',
        ['stat', '-c', '%s', remotePath]
      );
    });

    it('should handle very long remote path', async () => {
      const longPath = '/sdcard/' + 'a'.repeat(1000) + '.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('1000000');

      const result = await tracker.getRemoteFileSize('device123', longPath);

      expect(result).toBe(1000000);
    });

    it('should handle concurrent progress calculations', async () => {
      mockAdbExecutor._executeShellCommand.mockResolvedValue('500000');

      const promises = [
        tracker.calculateProgress('device1', '/sdcard/file1.mp4', 1000000),
        tracker.calculateProgress('device2', '/sdcard/file2.mp4', 2000000),
        tracker.calculateProgress('device3', '/sdcard/file3.mp4', 3000000)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledTimes(3);
    });
  });
});
