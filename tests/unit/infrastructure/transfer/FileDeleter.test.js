'use strict';

const FileDeleter = require('../../../../src/main/infrastructure/transfer/FileDeleter');
const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    unlink: jest.fn()
  }
}));

describe('FileDeleter', () => {
  let deleter;
  let mockAdbExecutor;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    mockAdbExecutor = {
      _sanitizeSerialOrTarget: jest.fn((id) => id),
      _executeShellCommand: jest.fn()
    };

    deleter = new FileDeleter({
      adbExecutor: mockAdbExecutor,
      logger: mockLogger
    });
  });

  describe('Constructor', () => {
    it('should throw error when adbExecutor is not provided', () => {
      expect(() => {
        new FileDeleter({});
      }).toThrow('adbExecutor is required for FileDeleter');
    });

    it('should create instance with valid dependencies', () => {
      expect(deleter).toBeInstanceOf(FileDeleter);
      expect(deleter._adbExecutor).toBe(mockAdbExecutor);
      expect(deleter._logger).toBe(mockLogger);
    });

    it('should work without logger', () => {
      const deleterWithoutLogger = new FileDeleter({
        adbExecutor: mockAdbExecutor
      });
      expect(deleterWithoutLogger._logger).toBeNull();
    });
  });

  describe('deleteRemoteFile', () => {
    it('should delete remote file successfully', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('');

      const result = await deleter.deleteRemoteFile(deviceId, remotePath);

      expect(result).toEqual({
        success: true,
        message: 'Remote file deleted successfully: /sdcard/file.mp4'
      });
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        deviceId,
        ['rm', '-f', remotePath]
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[FileDeleter] Remote file deleted: ${remotePath} (${deviceId})`
      );
    });

    it('should handle shell command failure', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/file.mp4';

      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('Permission denied'));

      const result = await deleter.deleteRemoteFile(deviceId, remotePath);

      expect(result).toEqual({
        success: false,
        message: 'Permission denied'
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete remote file')
      );
    });

    it('should handle file not found on remote device', async () => {
      const deviceId = 'device123';
      const remotePath = '/sdcard/nonexistent.mp4';

      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('No such file'));

      const result = await deleter.deleteRemoteFile(deviceId, remotePath);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No such file');
    });

    it('should use _sanitizeSerialOrTarget if available', async () => {
      mockAdbExecutor._sanitizeSerialOrTarget.mockReturnValue('sanitized-device123');
      mockAdbExecutor._executeShellCommand.mockResolvedValue('');

      await deleter.deleteRemoteFile('device123', '/sdcard/file.mp4');

      expect(mockAdbExecutor._sanitizeSerialOrTarget).toHaveBeenCalledWith('device123');
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        'sanitized-device123',
        ['rm', '-f', '/sdcard/file.mp4']
      );
    });

    it('should not call _sanitizeSerialOrTarget if not available', async () => {
      const executorWithoutSanitize = {
        _executeShellCommand: jest.fn().mockResolvedValue('')
      };

      const deleterWithoutSanitize = new FileDeleter({
        adbExecutor: executorWithoutSanitize,
        logger: mockLogger
      });

      await deleterWithoutSanitize.deleteRemoteFile('device123', '/sdcard/file.mp4');

      expect(executorWithoutSanitize._executeShellCommand).toHaveBeenCalledWith(
        'device123',
        ['rm', '-f', '/sdcard/file.mp4']
      );
    });

    it('should work without logger on success', async () => {
      const deleterWithoutLogger = new FileDeleter({
        adbExecutor: mockAdbExecutor
      });

      mockAdbExecutor._executeShellCommand.mockResolvedValue('');

      const result = await deleterWithoutLogger.deleteRemoteFile('device123', '/sdcard/file.mp4');

      expect(result.success).toBe(true);
    });

    it('should work without logger on failure', async () => {
      const deleterWithoutLogger = new FileDeleter({
        adbExecutor: mockAdbExecutor
      });

      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('Error'));

      const result = await deleterWithoutLogger.deleteRemoteFile('device123', '/sdcard/file.mp4');

      expect(result.success).toBe(false);
    });
  });

  describe('deleteLocalFile', () => {
    it('should delete local file successfully', async () => {
      const localPath = '/local/file.mp4';

      fs.unlink.mockResolvedValue();

      const result = await deleter.deleteLocalFile(localPath);

      expect(result).toEqual({
        success: true,
        message: 'Local file deleted successfully: /local/file.mp4'
      });
      expect(fs.unlink).toHaveBeenCalledWith(localPath);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[FileDeleter] Local file deleted: ${localPath}`
      );
    });

    it('should handle file not found', async () => {
      const localPath = '/local/nonexistent.mp4';

      fs.unlink.mockRejectedValue(new Error('ENOENT: no such file'));

      const result = await deleter.deleteLocalFile(localPath);

      expect(result).toEqual({
        success: false,
        message: 'ENOENT: no such file'
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete local file')
      );
    });

    it('should handle permission error', async () => {
      const localPath = '/local/file.mp4';

      fs.unlink.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await deleter.deleteLocalFile(localPath);

      expect(result.success).toBe(false);
      expect(result.message).toContain('permission denied');
    });

    it('should handle directory instead of file', async () => {
      const localPath = '/local/directory';

      fs.unlink.mockRejectedValue(new Error('EISDIR: illegal operation on a directory'));

      const result = await deleter.deleteLocalFile(localPath);

      expect(result.success).toBe(false);
    });

    it('should work without logger on success', async () => {
      const deleterWithoutLogger = new FileDeleter({
        adbExecutor: mockAdbExecutor
      });

      fs.unlink.mockResolvedValue();

      const result = await deleterWithoutLogger.deleteLocalFile('/local/file.mp4');

      expect(result.success).toBe(true);
    });

    it('should work without logger on failure', async () => {
      const deleterWithoutLogger = new FileDeleter({
        adbExecutor: mockAdbExecutor
      });

      fs.unlink.mockRejectedValue(new Error('Error'));

      const result = await deleterWithoutLogger.deleteLocalFile('/local/file.mp4');

      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in remote path', async () => {
      const remotePath = '/sdcard/file with spaces & special!.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('');

      const result = await deleter.deleteRemoteFile('device123', remotePath);

      expect(result.success).toBe(true);
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        'device123',
        ['rm', '-f', remotePath]
      );
    });

    it('should handle special characters in local path', async () => {
      const localPath = '/local/file with spaces & special!.mp4';

      fs.unlink.mockResolvedValue();

      const result = await deleter.deleteLocalFile(localPath);

      expect(result.success).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith(localPath);
    });

    it('should handle very long remote path', async () => {
      const longPath = '/sdcard/' + 'a'.repeat(1000) + '.mp4';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('');

      const result = await deleter.deleteRemoteFile('device123', longPath);

      expect(result.success).toBe(true);
    });

    it('should handle very long local path', async () => {
      const longPath = '/local/' + 'a'.repeat(1000) + '.mp4';

      fs.unlink.mockResolvedValue();

      const result = await deleter.deleteLocalFile(longPath);

      expect(result.success).toBe(true);
    });

    it('should handle empty path for remote file', async () => {
      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('No such file'));

      const result = await deleter.deleteRemoteFile('device123', '');

      expect(result.success).toBe(false);
    });

    it('should handle empty path for local file', async () => {
      fs.unlink.mockRejectedValue(new Error('ENOENT'));

      const result = await deleter.deleteLocalFile('');

      expect(result.success).toBe(false);
    });

    it('should handle concurrent remote deletions', async () => {
      mockAdbExecutor._executeShellCommand.mockResolvedValue('');

      const promises = [
        deleter.deleteRemoteFile('device1', '/sdcard/file1.mp4'),
        deleter.deleteRemoteFile('device2', '/sdcard/file2.mp4'),
        deleter.deleteRemoteFile('device3', '/sdcard/file3.mp4')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent local deletions', async () => {
      fs.unlink.mockResolvedValue();

      const promises = [
        deleter.deleteLocalFile('/local/file1.mp4'),
        deleter.deleteLocalFile('/local/file2.mp4'),
        deleter.deleteLocalFile('/local/file3.mp4')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(fs.unlink).toHaveBeenCalledTimes(3);
    });
  });
});
