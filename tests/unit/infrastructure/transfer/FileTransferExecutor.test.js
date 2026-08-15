'use strict';

const FileTransferExecutor = require('../../../../src/main/infrastructure/transfer/FileTransferExecutor');

describe('FileTransferExecutor', () => {
  let executor;
  let mockAdbExecutor;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    mockAdbExecutor = {
      pushFile: jest.fn(),
      pullFile: jest.fn()
    };

    executor = new FileTransferExecutor({
      adbExecutor: mockAdbExecutor,
      logger: mockLogger
    });
  });

  describe('Constructor', () => {
    it('should throw error when adbExecutor is not provided', () => {
      expect(() => {
        new FileTransferExecutor({});
      }).toThrow('adbExecutor is required for FileTransferExecutor');
    });

    it('should create instance with valid dependencies', () => {
      expect(executor).toBeInstanceOf(FileTransferExecutor);
      expect(executor._adbExecutor).toBe(mockAdbExecutor);
      expect(executor._logger).toBe(mockLogger);
    });

    it('should work without logger', () => {
      const executorWithoutLogger = new FileTransferExecutor({
        adbExecutor: mockAdbExecutor
      });
      expect(executorWithoutLogger._logger).toBeNull();
    });
  });

  describe('executePush', () => {
    it('should execute push successfully', async () => {
      const deviceId = 'device123';
      const localPath = '/local/file.mp4';
      const remotePath = '/sdcard/file.mp4';
      const mockResult = { success: true, message: 'Push successful' };

      mockAdbExecutor.pushFile.mockResolvedValue(mockResult);

      const result = await executor.executePush(deviceId, localPath, remotePath);

      expect(mockAdbExecutor.pushFile).toHaveBeenCalledWith(deviceId, localPath, remotePath);
      expect(result).toEqual(mockResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[FileTransferExecutor] Push executed: ${localPath} -> ${remotePath} (${deviceId})`
      );
    });

    it('should handle push failure', async () => {
      const deviceId = 'device123';
      const localPath = '/local/file.mp4';
      const remotePath = '/sdcard/file.mp4';
      const error = new Error('ADB connection failed');

      mockAdbExecutor.pushFile.mockRejectedValue(error);

      const result = await executor.executePush(deviceId, localPath, remotePath);

      expect(result).toEqual({
        success: false,
        message: 'ADB connection failed'
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `[FileTransferExecutor] Push failed: ${error.message}`
      );
    });

    it('should handle push with null error message', async () => {
      const deviceId = 'device123';
      const localPath = '/local/file.mp4';
      const remotePath = '/sdcard/file.mp4';
      const error = new Error();

      mockAdbExecutor.pushFile.mockRejectedValue(error);

      const result = await executor.executePush(deviceId, localPath, remotePath);

      expect(result).toEqual({
        success: false,
        message: ''
      });
    });

    it('should work without logger on success', async () => {
      const executorWithoutLogger = new FileTransferExecutor({
        adbExecutor: mockAdbExecutor
      });

      const mockResult = { success: true, message: 'Push successful' };
      mockAdbExecutor.pushFile.mockResolvedValue(mockResult);

      const result = await executorWithoutLogger.executePush('device123', '/local/file.mp4', '/sdcard/file.mp4');

      expect(result).toEqual(mockResult);
    });

    it('should work without logger on failure', async () => {
      const executorWithoutLogger = new FileTransferExecutor({
        adbExecutor: mockAdbExecutor
      });

      mockAdbExecutor.pushFile.mockRejectedValue(new Error('Error'));

      const result = await executorWithoutLogger.executePush('device123', '/local/file.mp4', '/sdcard/file.mp4');

      expect(result.success).toBe(false);
    });
  });

  describe('executePull', () => {
    it('should execute pull successfully', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const localPath = '/local/file.mp4';
      const mockResult = { success: true, message: 'Pull successful' };

      mockAdbExecutor.pullFile.mockResolvedValue(mockResult);

      const result = await executor.executePull(deviceId, remotePath, localPath);

      expect(mockAdbExecutor.pullFile).toHaveBeenCalledWith(deviceId, remotePath, localPath);
      expect(result).toEqual(mockResult);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[FileTransferExecutor] Pull executed: ${remotePath} -> ${localPath} (${deviceId})`
      );
    });

    it('should handle pull failure', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';
      const localPath = '/local/file.mp4';
      const error = new Error('Device offline');

      mockAdbExecutor.pullFile.mockRejectedValue(error);

      const result = await executor.executePull(deviceId, remotePath, localPath);

      expect(result).toEqual({
        success: false,
        message: 'Device offline'
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        `[FileTransferExecutor] Pull failed: ${error.message}`
      );
    });

    it('should handle pull with empty paths', async () => {
      const mockResult = { success: true, message: 'Pull successful' };
      mockAdbExecutor.pullFile.mockResolvedValue(mockResult);

      const result = await executor.executePull('', '', '');

      expect(mockAdbExecutor.pullFile).toHaveBeenCalledWith('', '', '');
      expect(result).toEqual(mockResult);
    });

    it('should work without logger on pull success', async () => {
      const executorWithoutLogger = new FileTransferExecutor({
        adbExecutor: mockAdbExecutor
      });

      const mockResult = { success: true, message: 'Pull successful' };
      mockAdbExecutor.pullFile.mockResolvedValue(mockResult);

      const result = await executorWithoutLogger.executePull('device123', '/sdcard/file.mp4', '/local/file.mp4');

      expect(result).toEqual(mockResult);
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent push operations', async () => {
      const mockResult = { success: true, message: 'Push successful' };
      mockAdbExecutor.pushFile.mockResolvedValue(mockResult);

      const promises = [
        executor.executePush('device1', '/local/file1.mp4', '/sdcard/file1.mp4'),
        executor.executePush('device2', '/local/file2.mp4', '/sdcard/file2.mp4'),
        executor.executePush('device3', '/local/file3.mp4', '/sdcard/file3.mp4')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockAdbExecutor.pushFile).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent pull operations', async () => {
      const mockResult = { success: true, message: 'Pull successful' };
      mockAdbExecutor.pullFile.mockResolvedValue(mockResult);

      const promises = [
        executor.executePull('device1', '/sdcard/file1.mp4', '/local/file1.mp4'),
        executor.executePull('device2', '/sdcard/file2.mp4', '/local/file2.mp4'),
        executor.executePull('device3', '/sdcard/file3.mp4', '/local/file3.mp4')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockAdbExecutor.pullFile).toHaveBeenCalledTimes(3);
    });

    it('should handle special characters in paths', async () => {
      const mockResult = { success: true, message: 'Push successful' };
      mockAdbExecutor.pushFile.mockResolvedValue(mockResult);

      const localPath = '/local/file with spaces & special!.mp4';
      const remotePath = '/sdcard/file with spaces & special!.mp4';

      const result = await executor.executePush('device123', localPath, remotePath);

      expect(mockAdbExecutor.pushFile).toHaveBeenCalledWith('device123', localPath, remotePath);
      expect(result.success).toBe(true);
    });

    it('should handle very long paths', async () => {
      const mockResult = { success: true, message: 'Push successful' };
      mockAdbExecutor.pushFile.mockResolvedValue(mockResult);

      const longPath = '/local/' + 'a'.repeat(1000) + '.mp4';

      const result = await executor.executePush('device123', longPath, longPath);

      expect(mockAdbExecutor.pushFile).toHaveBeenCalledWith('device123', longPath, longPath);
      expect(result.success).toBe(true);
    });
  });
});
