'use strict';

const TransferStateManager = require('../../../../src/main/infrastructure/transfer/TransferStateManager');

describe('TransferStateManager', () => {
  let manager;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn()
    };

    manager = new TransferStateManager({
      logger: mockLogger
    });
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(manager).toBeInstanceOf(TransferStateManager);
      expect(manager._logger).toBe(mockLogger);
      expect(manager._transfers).toBeInstanceOf(Map);
    });

    it('should work without logger', () => {
      const managerWithoutLogger = new TransferStateManager({});
      expect(managerWithoutLogger._logger).toBeNull();
    });

    it('should initialize with empty transfers map', () => {
      expect(manager.getActiveTransfersCount()).toBe(0);
    });
  });

  describe('createTransferEntry', () => {
    it('should create transfer entry with all fields', () => {
      const transferId = 'transfer-123';
      const data = {
        deviceId: 'device123',
        localPath: '/local/file.mp4',
        remotePath: '/sdcard/file.mp4',
        downloadId: 'download-123',
        status: 'pending',
        progress: 0,
        transferredBytes: 0,
        totalBytes: 1000000,
        speed: 1000,
        eta: 100,
        startedAt: new Date().toISOString(),
        completedAt: null,
        failedAt: null,
        cancelledAt: null,
        errorMessage: null
      };

      const entry = manager.createTransferEntry(transferId, data);

      expect(entry.transferId).toBe(transferId);
      expect(entry.deviceId).toBe(data.deviceId);
      expect(entry.localPath).toBe(data.localPath);
      expect(entry.remotePath).toBe(data.remotePath);
      expect(entry.downloadId).toBe(data.downloadId);
      expect(entry.status).toBe(data.status);
      expect(entry.progress).toBe(data.progress);
      expect(entry.transferredBytes).toBe(data.transferredBytes);
      expect(entry.totalBytes).toBe(data.totalBytes);
      expect(entry.speed).toBe(data.speed);
      expect(entry.eta).toBe(data.eta);
      expect(entry.startedAt).toBe(data.startedAt);
      expect(entry.completedAt).toBe(data.completedAt);
      expect(entry.failedAt).toBe(data.failedAt);
      expect(entry.cancelledAt).toBe(data.cancelledAt);
      expect(entry.errorMessage).toBe(data.errorMessage);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[TransferStateManager] Created transfer entry: ${transferId}`
      );
    });

    it('should generate UUID when transferId not provided', () => {
      const data = {
        deviceId: 'device123',
        localPath: '/local/file.mp4'
      };

      const entry = manager.createTransferEntry(null, data);

      expect(entry.transferId).toBeDefined();
      expect(entry.transferId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should use default values for missing fields', () => {
      const transferId = 'transfer-123';
      const data = {};

      const entry = manager.createTransferEntry(transferId, data);

      expect(entry.transferId).toBe(transferId);
      expect(entry.deviceId).toBeNull();
      expect(entry.localPath).toBeNull();
      expect(entry.remotePath).toBeNull();
      expect(entry.downloadId).toBeNull();
      expect(entry.status).toBe('pending');
      expect(entry.progress).toBe(0);
      expect(entry.transferredBytes).toBe(0);
      expect(entry.totalBytes).toBe(0);
      expect(entry.speed).toBeNull();
      expect(entry.eta).toBeNull();
      expect(entry.startedAt).toBeNull();
      expect(entry.completedAt).toBeNull();
      expect(entry.failedAt).toBeNull();
      expect(entry.cancelledAt).toBeNull();
      expect(entry.errorMessage).toBeNull();
    });

    it('should store entry in transfers map', () => {
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123' };

      manager.createTransferEntry(transferId, data);

      expect(manager._transfers.has(transferId)).toBe(true);
    });

    it('should increment active transfers count', () => {
      const data = { deviceId: 'device123' };

      manager.createTransferEntry('transfer-1', data);
      expect(manager.getActiveTransfersCount()).toBe(1);

      manager.createTransferEntry('transfer-2', data);
      expect(manager.getActiveTransfersCount()).toBe(2);
    });

    it('should work without logger', () => {
      const managerWithoutLogger = new TransferStateManager({});
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123' };

      const entry = managerWithoutLogger.createTransferEntry(transferId, data);

      expect(entry.transferId).toBe(transferId);
    });
  });

  describe('getTransferEntry', () => {
    it('should get existing transfer entry', () => {
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123', localPath: '/local/file.mp4' };

      manager.createTransferEntry(transferId, data);
      const entry = manager.getTransferEntry(transferId);

      expect(entry).toBeDefined();
      expect(entry.transferId).toBe(transferId);
      expect(entry.deviceId).toBe(data.deviceId);
    });

    it('should return null for non-existent transfer', () => {
      const entry = manager.getTransferEntry('non-existent');

      expect(entry).toBeNull();
    });

    it('should return null for empty transferId', () => {
      const entry = manager.getTransferEntry('');

      expect(entry).toBeNull();
    });

    it('should return null for null transferId', () => {
      const entry = manager.getTransferEntry(null);

      expect(entry).toBeNull();
    });
  });

  describe('updateTransferEntry', () => {
    it('should update existing transfer entry', () => {
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123', status: 'pending' };

      manager.createTransferEntry(transferId, data);

      const updates = { status: 'transferring', progress: 50 };
      const result = manager.updateTransferEntry(transferId, updates);

      expect(result).toBe(true);

      const entry = manager.getTransferEntry(transferId);
      expect(entry.status).toBe('transferring');
      expect(entry.progress).toBe(50);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[TransferStateManager] Updated transfer entry: ${transferId}`
      );
    });

    it('should return false for non-existent transfer', () => {
      const updates = { status: 'transferring' };
      const result = manager.updateTransferEntry('non-existent', updates);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `[TransferStateManager] Transfer not found: non-existent`
      );
    });

    it('should update multiple fields at once', () => {
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123' };

      manager.createTransferEntry(transferId, data);

      const updates = {
        status: 'completed',
        progress: 100,
        transferredBytes: 1000000,
        completedAt: new Date().toISOString()
      };
      manager.updateTransferEntry(transferId, updates);

      const entry = manager.getTransferEntry(transferId);
      expect(entry.status).toBe('completed');
      expect(entry.progress).toBe(100);
      expect(entry.transferredBytes).toBe(1000000);
      expect(entry.completedAt).toBeDefined();
    });

    it('should preserve unupdated fields', () => {
      const transferId = 'transfer-123';
      const data = {
        deviceId: 'device123',
        localPath: '/local/file.mp4',
        status: 'pending',
        progress: 0
      };

      manager.createTransferEntry(transferId, data);

      const updates = { status: 'transferring' };
      manager.updateTransferEntry(transferId, updates);

      const entry = manager.getTransferEntry(transferId);
      expect(entry.status).toBe('transferring');
      expect(entry.deviceId).toBe('device123');
      expect(entry.localPath).toBe('/local/file.mp4');
      expect(entry.progress).toBe(0);
    });

    it('should work without logger', () => {
      const managerWithoutLogger = new TransferStateManager({});
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123' };

      managerWithoutLogger.createTransferEntry(transferId, data);
      const result = managerWithoutLogger.updateTransferEntry(transferId, { status: 'transferring' });

      expect(result).toBe(true);
    });
  });

  describe('removeTransferEntry', () => {
    it('should remove existing transfer entry', () => {
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123' };

      manager.createTransferEntry(transferId, data);
      expect(manager._transfers.has(transferId)).toBe(true);

      const result = manager.removeTransferEntry(transferId);

      expect(result).toBe(true);
      expect(manager._transfers.has(transferId)).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `[TransferStateManager] Removed transfer entry: ${transferId}`
      );
    });

    it('should return false for non-existent transfer', () => {
      const result = manager.removeTransferEntry('non-existent');

      expect(result).toBe(false);
    });

    it('should decrement active transfers count', () => {
      const data = { deviceId: 'device123' };

      manager.createTransferEntry('transfer-1', data);
      manager.createTransferEntry('transfer-2', data);
      expect(manager.getActiveTransfersCount()).toBe(2);

      manager.removeTransferEntry('transfer-1');
      expect(manager.getActiveTransfersCount()).toBe(1);
    });

    it('should work without logger', () => {
      const managerWithoutLogger = new TransferStateManager({});
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123' };

      managerWithoutLogger.createTransferEntry(transferId, data);
      const result = managerWithoutLogger.removeTransferEntry(transferId);

      expect(result).toBe(true);
    });
  });

  describe('getActiveTransfers', () => {
    it('should return transfers map', () => {
      const data = { deviceId: 'device123' };

      manager.createTransferEntry('transfer-1', data);
      manager.createTransferEntry('transfer-2', data);

      const transfers = manager.getActiveTransfers();

      expect(transfers).toBeInstanceOf(Map);
      expect(transfers.size).toBe(2);
    });

    it('should return empty map when no transfers', () => {
      const transfers = manager.getActiveTransfers();

      expect(transfers).toBeInstanceOf(Map);
      expect(transfers.size).toBe(0);
    });
  });

  describe('getActiveTransfersArray', () => {
    it('should return transfers as array', () => {
      const data = { deviceId: 'device123' };

      manager.createTransferEntry('transfer-1', data);
      manager.createTransferEntry('transfer-2', data);

      const transfers = manager.getActiveTransfersArray();

      expect(Array.isArray(transfers)).toBe(true);
      expect(transfers).toHaveLength(2);
    });

    it('should return empty array when no transfers', () => {
      const transfers = manager.getActiveTransfersArray();

      expect(Array.isArray(transfers)).toBe(true);
      expect(transfers).toHaveLength(0);
    });

    it('should contain all fields in array entries', () => {
      const transferId = 'transfer-123';
      const data = {
        deviceId: 'device123',
        localPath: '/local/file.mp4',
        status: 'pending'
      };

      manager.createTransferEntry(transferId, data);
      const transfers = manager.getActiveTransfersArray();

      expect(transfers[0].transferId).toBe(transferId);
      expect(transfers[0].deviceId).toBe(data.deviceId);
      expect(transfers[0].localPath).toBe(data.localPath);
      expect(transfers[0].status).toBe(data.status);
    });
  });

  describe('getTransfersByDeviceId', () => {
    it('should return transfers for specific device', () => {
      const data1 = { deviceId: 'device1' };
      const data2 = { deviceId: 'device2' };
      const data3 = { deviceId: 'device1' };

      manager.createTransferEntry('transfer-1', data1);
      manager.createTransferEntry('transfer-2', data2);
      manager.createTransferEntry('transfer-3', data3);

      const device1Transfers = manager.getTransfersByDeviceId('device1');

      expect(device1Transfers).toHaveLength(2);
      expect(device1Transfers.every(t => t.deviceId === 'device1')).toBe(true);
    });

    it('should return empty array for device with no transfers', () => {
      const transfers = manager.getTransfersByDeviceId('device1');

      expect(transfers).toHaveLength(0);
    });

    it('should handle null deviceId', () => {
      const data = { deviceId: null };

      manager.createTransferEntry('transfer-1', data);

      const transfers = manager.getTransfersByDeviceId(null);

      expect(transfers).toHaveLength(1);
    });
  });

  describe('getTransfersByDownloadId', () => {
    it('should return transfers for specific download', () => {
      const data1 = { downloadId: 'download1' };
      const data2 = { downloadId: 'download2' };
      const data3 = { downloadId: 'download1' };

      manager.createTransferEntry('transfer-1', data1);
      manager.createTransferEntry('transfer-2', data2);
      manager.createTransferEntry('transfer-3', data3);

      const download1Transfers = manager.getTransfersByDownloadId('download1');

      expect(download1Transfers).toHaveLength(2);
      expect(download1Transfers.every(t => t.downloadId === 'download1')).toBe(true);
    });

    it('should return empty array for download with no transfers', () => {
      const transfers = manager.getTransfersByDownloadId('download1');

      expect(transfers).toHaveLength(0);
    });

    it('should handle null downloadId', () => {
      const data = { downloadId: null };

      manager.createTransferEntry('transfer-1', data);

      const transfers = manager.getTransfersByDownloadId(null);

      expect(transfers).toHaveLength(1);
    });
  });

  describe('getActiveTransfersCount', () => {
    it('should return correct count', () => {
      const data = { deviceId: 'device123' };

      expect(manager.getActiveTransfersCount()).toBe(0);

      manager.createTransferEntry('transfer-1', data);
      expect(manager.getActiveTransfersCount()).toBe(1);

      manager.createTransferEntry('transfer-2', data);
      expect(manager.getActiveTransfersCount()).toBe(2);

      manager.removeTransferEntry('transfer-1');
      expect(manager.getActiveTransfersCount()).toBe(1);
    });
  });

  describe('clearAllTransfers', () => {
    it('should clear all transfers', () => {
      const data = { deviceId: 'device123' };

      manager.createTransferEntry('transfer-1', data);
      manager.createTransferEntry('transfer-2', data);
      manager.createTransferEntry('transfer-3', data);

      expect(manager.getActiveTransfersCount()).toBe(3);

      manager.clearAllTransfers();

      expect(manager.getActiveTransfersCount()).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[TransferStateManager] Cleared all transfers (3 entries)'
      );
    });

    it('should handle clearing empty transfers', () => {
      manager.clearAllTransfers();

      expect(manager.getActiveTransfersCount()).toBe(0);
    });

    it('should work without logger', () => {
      const managerWithoutLogger = new TransferStateManager({});
      const data = { deviceId: 'device123' };

      managerWithoutLogger.createTransferEntry('transfer-1', data);
      managerWithoutLogger.clearAllTransfers();

      expect(managerWithoutLogger.getActiveTransfersCount()).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent operations', async () => {
      const data = { deviceId: 'device123' };

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(manager.createTransferEntry(`transfer-${i}`, data)));
      }

      await Promise.all(promises);

      expect(manager.getActiveTransfersCount()).toBe(100);
    });

    it('should handle special characters in transferId', () => {
      const transferId = 'transfer-with-special-chars_!@#$%';
      const data = { deviceId: 'device123' };

      const entry = manager.createTransferEntry(transferId, data);

      expect(entry.transferId).toBe(transferId);
      expect(manager.getTransferEntry(transferId)).toBeDefined();
    });

    it('should handle very long transferId', () => {
      const transferId = 'transfer-' + 'a'.repeat(1000);
      const data = { deviceId: 'device123' };

      const entry = manager.createTransferEntry(transferId, data);

      expect(entry.transferId).toBe(transferId);
      expect(manager.getTransferEntry(transferId)).toBeDefined();
    });

    it('should handle updating with empty object', () => {
      const transferId = 'transfer-123';
      const data = { deviceId: 'device123', status: 'pending' };

      manager.createTransferEntry(transferId, data);
      const result = manager.updateTransferEntry(transferId, {});

      expect(result).toBe(true);
      const entry = manager.getTransferEntry(transferId);
      expect(entry.status).toBe('pending');
    });

    it('should handle creating with null data', () => {
      const transferId = 'transfer-123';

      const entry = manager.createTransferEntry(transferId, {});

      expect(entry).toBeDefined();
      expect(entry.transferId).toBe(transferId);
    });
  });
});
