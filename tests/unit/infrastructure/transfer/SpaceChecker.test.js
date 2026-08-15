'use strict';

const SpaceChecker = require('../../../../src/main/infrastructure/transfer/SpaceChecker');

describe('SpaceChecker', () => {
  let checker;
  let mockAdbExecutor;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn()
    };

    mockAdbExecutor = {
      _sanitizeSerialOrTarget: jest.fn((id) => id),
      _executeShellCommand: jest.fn()
    };

    checker = new SpaceChecker({
      adbExecutor: mockAdbExecutor,
      logger: mockLogger
    });
  });

  describe('Constructor', () => {
    it('should throw error when adbExecutor is not provided', () => {
      expect(() => {
        new SpaceChecker({});
      }).toThrow('adbExecutor is required for SpaceChecker');
    });

    it('should create instance with valid dependencies', () => {
      expect(checker).toBeInstanceOf(SpaceChecker);
      expect(checker._adbExecutor).toBe(mockAdbExecutor);
      expect(checker._logger).toBe(mockLogger);
    });

    it('should work without logger', () => {
      const checkerWithoutLogger = new SpaceChecker({
        adbExecutor: mockAdbExecutor
      });
      expect(checkerWithoutLogger._logger).toBeNull();
    });
  });

  describe('checkAvailableSpace', () => {
    it('should return true when enough space is available', async () => {
      const deviceId = 'device123';
      const requiredBytes = 1000000;
      const availableKb = 5000000;
      const availableBytes = availableKb * 1024;

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      const result = await checker.checkAvailableSpace(deviceId, requiredBytes);

      expect(result).toEqual({
        hasEnoughSpace: true,
        availableBytes: availableBytes,
        requiredBytes: requiredBytes
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Space check: 5120000000 bytes available, 1000000 bytes required (OK)')
      );
    });

    it('should return false when not enough space', async () => {
      const deviceId = 'device123';
      const requiredBytes = 10000000000;
      const availableKb = 5000000;
      const availableBytes = availableKb * 1024;

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      const result = await checker.checkAvailableSpace(deviceId, requiredBytes);

      expect(result).toEqual({
        hasEnoughSpace: false,
        availableBytes: availableBytes,
        requiredBytes: requiredBytes
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Space check: 5120000000 bytes available, 10000000000 bytes required (NOT OK)')
      );
    });

    it('should return false when exactly at limit', async () => {
      const deviceId = 'device123';
      const requiredBytes = 5120000000;
      const availableKb = 5000000;
      const availableBytes = availableKb * 1024;

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      const result = await checker.checkAvailableSpace(deviceId, requiredBytes);

      expect(result.hasEnoughSpace).toBe(true);
    });

    it('should handle zero required bytes', async () => {
      const deviceId = 'device123';
      const requiredBytes = 0;

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      const result = await checker.checkAvailableSpace(deviceId, requiredBytes);

      expect(result.hasEnoughSpace).toBe(true);
    });

    it('should handle negative required bytes', async () => {
      const deviceId = 'device123';
      const requiredBytes = -1000;

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      const result = await checker.checkAvailableSpace(deviceId, requiredBytes);

      expect(result.hasEnoughSpace).toBe(true);
    });

    it('should handle shell command failure', async () => {
      const deviceId = 'device123';
      const requiredBytes = 1000000;

      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('Command failed'));

      const result = await checker.checkAvailableSpace(deviceId, requiredBytes);

      expect(result).toEqual({
        hasEnoughSpace: false,
        availableBytes: 0,
        requiredBytes: requiredBytes
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get storage info')
      );
    });

    it('should use _sanitizeSerialOrTarget if available', async () => {
      mockAdbExecutor._sanitizeSerialOrTarget.mockReturnValue('sanitized-device123');
      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      await checker.checkAvailableSpace('device123', 1000000);

      expect(mockAdbExecutor._sanitizeSerialOrTarget).toHaveBeenCalledWith('device123');
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        'sanitized-device123',
        ['df', '/sdcard']
      );
    });
  });

  describe('getAvailableSpace', () => {
    it('should get available space successfully', async () => {
      const deviceId = 'device123';
      const availableKb = 5000000;
      const availableBytes = availableKb * 1024;

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      const result = await checker.getAvailableSpace(deviceId);

      expect(result).toBe(availableBytes);
    });

    it('should handle shell command failure', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('Command failed'));

      const result = await checker.getAvailableSpace(deviceId);

      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get storage info')
      );
    });
  });

  describe('getStorageInfo', () => {
    it('should get complete storage info', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      const result = await checker.getStorageInfo(deviceId);

      expect(result).toEqual({
        totalBytes: 10240000000,
        usedBytes: 5120000000,
        availableBytes: 5120000000,
        usedPercent: 50
      });
    });

    it('should handle invalid df output (missing lines)', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockResolvedValue('Filesystem  Size  Used  Available  Use%  Mounted');

      const result = await checker.getStorageInfo(deviceId);

      expect(result).toEqual({
        totalBytes: 0,
        usedBytes: 0,
        availableBytes: 0,
        usedPercent: 0
      });
    });

    it('should handle invalid df output (malformed data)', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        'invalid data line'
      );

      const result = await checker.getStorageInfo(deviceId);

      expect(result).toEqual({
        totalBytes: 0,
        usedBytes: 0,
        availableBytes: 0,
        usedPercent: 0
      });
    });

    it('should handle shell command failure', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockRejectedValue(new Error('Command failed'));

      const result = await checker.getStorageInfo(deviceId);

      expect(result).toEqual({
        totalBytes: 0,
        usedBytes: 0,
        availableBytes: 0,
        usedPercent: 0
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get storage info')
      );
    });

    it('should handle different df output formats', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem     1K-blocks    Used Available Use% Mounted on\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50% /sdcard'
      );

      const result = await checker.getStorageInfo(deviceId);

      expect(result.totalBytes).toBeGreaterThan(0);
      expect(result.usedBytes).toBeGreaterThan(0);
      expect(result.availableBytes).toBeGreaterThan(0);
    });

    it('should handle 100% usage', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  10000000  0  100%  /sdcard'
      );

      const result = await checker.getStorageInfo(deviceId);

      expect(result.usedPercent).toBe(100);
      expect(result.availableBytes).toBe(0);
    });

    it('should handle 0% usage', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  0  10000000  0%  /sdcard'
      );

      const result = await checker.getStorageInfo(deviceId);

      expect(result.usedPercent).toBe(0);
      expect(result.availableBytes).toBeGreaterThan(0);
    });

    it('should use _sanitizeSerialOrTarget if available', async () => {
      mockAdbExecutor._sanitizeSerialOrTarget.mockReturnValue('sanitized-device123');
      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      await checker.getStorageInfo('device123');

      expect(mockAdbExecutor._sanitizeSerialOrTarget).toHaveBeenCalledWith('device123');
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledWith(
        'sanitized-device123',
        ['df', '/sdcard']
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle very large storage sizes', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  1000000000  500000000  500000000  50%  /sdcard'
      );

      const result = await checker.getStorageInfo(deviceId);

      expect(result.totalBytes).toBe(1024000000000);
      expect(result.usedBytes).toBe(512000000000);
      expect(result.availableBytes).toBe(512000000000);
    });

    it('should handle concurrent space checks', async () => {
      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        'Filesystem  Size  Used  Available  Use%  Mounted\n' +
        '/dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard'
      );

      const promises = [
        checker.checkAvailableSpace('device1', 1000000),
        checker.checkAvailableSpace('device2', 2000000),
        checker.checkAvailableSpace('device3', 3000000)
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockAdbExecutor._executeShellCommand).toHaveBeenCalledTimes(3);
    });

    it('should handle whitespace in df output', async () => {
      const deviceId = 'device123';

      mockAdbExecutor._executeShellCommand.mockResolvedValue(
        '  Filesystem  Size  Used  Available  Use%  Mounted  \n' +
        '  /dev/block/dm-0  10000000  5000000  5000000  50%  /sdcard  '
      );

      const result = await checker.getStorageInfo(deviceId);

      expect(result.totalBytes).toBeGreaterThan(0);
    });
  });
});
