'use strict';

const TransferOrchestrator = require('../../../../src/main/application/orchestrators/TransferOrchestrator');
const fs = require('fs').promises;

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn()
  }
}));

describe('TransferOrchestrator', () => {
  let orchestrator;
  let mockTransferStateManager;
  let mockAdbPushService;
  let mockSpaceChecker;
  let mockDeviceRegistry;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };

    mockTransferStateManager = {
      createTransferEntry: jest.fn(),
      getTransferEntry: jest.fn(),
      updateTransferEntry: jest.fn(),
      getActiveTransfersArray: jest.fn()
    };

    mockAdbPushService = {
      pushFile: jest.fn(),
      on: jest.fn()
    };

    mockSpaceChecker = {
      checkAvailableSpace: jest.fn()
    };

    mockDeviceRegistry = {
      getDevice: jest.fn()
    };

    orchestrator = new TransferOrchestrator({
      transferStateManager: mockTransferStateManager,
      adbPushService: mockAdbPushService,
      spaceChecker: mockSpaceChecker,
      deviceRegistry: mockDeviceRegistry,
      logger: mockLogger
    });
  });

  describe('Constructor', () => {
    it('should throw error when transferStateManager is not provided', () => {
      expect(() => {
        new TransferOrchestrator({
          adbPushService: mockAdbPushService,
          spaceChecker: mockSpaceChecker,
          deviceRegistry: mockDeviceRegistry
        });
      }).toThrow('transferStateManager is required for TransferOrchestrator');
    });

    it('should throw error when adbPushService is not provided', () => {
      expect(() => {
        new TransferOrchestrator({
          transferStateManager: mockTransferStateManager,
          spaceChecker: mockSpaceChecker,
          deviceRegistry: mockDeviceRegistry
        });
      }).toThrow('adbPushService is required for TransferOrchestrator');
    });

    it('should throw error when spaceChecker is not provided', () => {
      expect(() => {
        new TransferOrchestrator({
          transferStateManager: mockTransferStateManager,
          adbPushService: mockAdbPushService,
          deviceRegistry: mockDeviceRegistry
        });
      }).toThrow('spaceChecker is required for TransferOrchestrator');
    });

    it('should throw error when deviceRegistry is not provided', () => {
      expect(() => {
        new TransferOrchestrator({
          transferStateManager: mockTransferStateManager,
          adbPushService: mockAdbPushService,
          spaceChecker: mockSpaceChecker
        });
      }).toThrow('deviceRegistry is required for TransferOrchestrator');
    });

    it('should create instance with valid dependencies', () => {
      expect(orchestrator).toBeInstanceOf(TransferOrchestrator);
      expect(orchestrator._transferStateManager).toBe(mockTransferStateManager);
      expect(orchestrator._adbPushService).toBe(mockAdbPushService);
      expect(orchestrator._spaceChecker).toBe(mockSpaceChecker);
      expect(orchestrator._deviceRegistry).toBe(mockDeviceRegistry);
    });

    it('should setup event listeners', () => {
      expect(mockAdbPushService.on).toHaveBeenCalledWith('transferStarted', expect.any(Function));
      expect(mockAdbPushService.on).toHaveBeenCalledWith('transferComplete', expect.any(Function));
      expect(mockAdbPushService.on).toHaveBeenCalledWith('transferFailed', expect.any(Function));
    });

    it('should work without logger', () => {
      const orchestratorWithoutLogger = new TransferOrchestrator({
        transferStateManager: mockTransferStateManager,
        adbPushService: mockAdbPushService,
        spaceChecker: mockSpaceChecker,
        deviceRegistry: mockDeviceRegistry
      });
      expect(orchestratorWithoutLogger._logger).toBeNull();
    });
  });

  describe('startTransfer', () => {
    it('should start transfer successfully', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockTransferStateManager.createTransferEntry.mockReturnValue({
        transferId: 'transfer-123',
        deviceId,
        localPath
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result).toEqual({
        success: true,
        transferId: expect.any(String),
        message: 'Transfer started successfully'
      });
      expect(mockTransferStateManager.createTransferEntry).toHaveBeenCalled();
      expect(mockAdbPushService.pushFile).toHaveBeenCalledWith(localPath, deviceId, null, false);
    });

    it('should fail when device is not connected', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';

      mockDeviceRegistry.getDevice.mockReturnValue(null);

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result).toEqual({
        success: false,
        transferId: null,
        message: 'Device is not connected'
      });
    });

    it('should fail when device exists but not connected', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: false });

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result).toEqual({
        success: false,
        transferId: null,
        message: 'Device is not connected'
      });
    });

    it('should fail when file not found', async () => {
      const localPath = '/local/nonexistent.mp4';
      const deviceId = 'device123';

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockRejectedValue(new Error('ENOENT'));

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result).toEqual({
        success: false,
        transferId: null,
        message: 'File not found: /local/nonexistent.mp4'
      });
    });

    it('should fail when insufficient space', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';
      const fileSize = 10000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: false,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result).toEqual({
        success: false,
        transferId: null,
        message: 'Insufficient space on device. Available: 5000000 bytes, Required: 10000000 bytes'
      });
    });

    it('should fail when pushFile fails', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';
      const fileSize = 1000000;
      const customTransferId = 'transfer-123';

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockTransferStateManager.createTransferEntry.mockReturnValue({
        transferId: customTransferId
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: false, message: 'ADB error' });

      const result = await orchestrator.startTransfer(localPath, deviceId, { transferId: customTransferId });

      expect(result).toEqual({
        success: false,
        transferId: customTransferId,
        message: 'ADB error'
      });
      expect(mockTransferStateManager.updateTransferEntry).toHaveBeenCalledWith(
        customTransferId,
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'ADB error'
        })
      );
    });

    it('should use custom transferId when provided', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';
      const customTransferId = 'custom-transfer-id';
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      const result = await orchestrator.startTransfer(localPath, deviceId, { transferId: customTransferId });

      expect(mockTransferStateManager.createTransferEntry).toHaveBeenCalledWith(
        customTransferId,
        expect.any(Object)
      );
      expect(result.transferId).toBe(customTransferId);
    });

    it('should use custom remotePath when provided', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';
      const customRemotePath = '/sdcard/custom/path.mp4';
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      await orchestrator.startTransfer(localPath, deviceId, { remotePath: customRemotePath });

      expect(mockAdbPushService.pushFile).toHaveBeenCalledWith(
        localPath,
        deviceId,
        customRemotePath,
        false
      );
    });

    it('should use downloadId when provided', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';
      const downloadId = 'download-123';
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      await orchestrator.startTransfer(localPath, deviceId, { downloadId });

      expect(mockTransferStateManager.createTransferEntry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          downloadId
        })
      );
    });

    it('should handle unexpected errors', async () => {
      const localPath = '/local/file.mp4';
      const deviceId = 'device123';

      mockDeviceRegistry.getDevice.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result).toEqual({
        success: false,
        transferId: null,
        message: 'Unexpected error'
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('startMultipleTransfers', () => {
    it('should start transfers for multiple devices', async () => {
      const localPath = '/local/file.mp4';
      const deviceIds = ['device1', 'device2', 'device3'];
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: 'device1', isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockTransferStateManager.createTransferEntry.mockReturnValue({
        transferId: 'transfer-123'
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      const result = await orchestrator.startMultipleTransfers(localPath, deviceIds);

      expect(result.success).toBe(true);
      expect(result.transferIds).toHaveLength(3);
      expect(result.message).toContain('Started 3 transfers successfully');
    });

    it('should handle partial failures', async () => {
      const localPath = '/local/file.mp4';
      const deviceIds = ['device1', 'device2', 'device3'];
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: 'device1', isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockTransferStateManager.createTransferEntry.mockReturnValue({
        transferId: 'transfer-123'
      });
      mockAdbPushService.pushFile
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, message: 'Device offline' })
        .mockResolvedValueOnce({ success: true });

      const result = await orchestrator.startMultipleTransfers(localPath, deviceIds);

      expect(result.success).toBe(true);
      expect(result.transferIds).toHaveLength(2);
    });

    it('should fail when all transfers fail', async () => {
      const localPath = '/local/file.mp4';
      const deviceIds = ['device1', 'device2'];
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue(null);
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });

      const result = await orchestrator.startMultipleTransfers(localPath, deviceIds);

      expect(result.success).toBe(false);
      expect(result.transferIds).toHaveLength(0);
      expect(result.message).toContain('Failed to start any transfers');
    });

    it('should handle empty deviceIds array', async () => {
      const localPath = '/local/file.mp4';
      const deviceIds = [];

      const result = await orchestrator.startMultipleTransfers(localPath, deviceIds);

      expect(result.success).toBe(false);
      expect(result.transferIds).toHaveLength(0);
      expect(result.message).toContain('Failed to start any transfers');
    });

    it('should pass options to individual transfers', async () => {
      const localPath = '/local/file.mp4';
      const deviceIds = ['device1'];
      const fileSize = 1000000;
      const options = { downloadId: 'download-123', remotePath: '/sdcard/custom.mp4' };

      mockDeviceRegistry.getDevice.mockReturnValue({ id: 'device1', isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      await orchestrator.startMultipleTransfers(localPath, deviceIds, options);

      expect(mockTransferStateManager.createTransferEntry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          downloadId: 'download-123',
          remotePath: '/sdcard/custom.mp4'
        })
      );
    });
  });

  describe('startDownloadTransfer', () => {
    it('should start transfer after download', async () => {
      const downloadId = 'download-123';
      const deviceIds = ['device1'];
      const localPath = '/local/file.mp4';
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: 'device1', isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockTransferStateManager.createTransferEntry.mockReturnValue({
        transferId: 'transfer-123'
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      const result = await orchestrator.startDownloadTransfer(downloadId, deviceIds, localPath);

      expect(result.success).toBe(true);
      expect(mockTransferStateManager.createTransferEntry).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          downloadId
        })
      );
    });
  });

  describe('cancelTransfer', () => {
    it('should cancel existing transfer', async () => {
      const transferId = 'transfer-123';
      const entry = {
        transferId,
        status: 'transferring',
        remotePath: '/sdcard/file.mp4'
      };

      mockTransferStateManager.getTransferEntry.mockReturnValue(entry);
      mockTransferStateManager.updateTransferEntry.mockReturnValue(true);

      const result = await orchestrator.cancelTransfer(transferId);

      expect(result).toEqual({
        success: true,
        message: 'Transfer cancelled successfully'
      });
      expect(mockTransferStateManager.updateTransferEntry).toHaveBeenCalledWith(
        transferId,
        expect.objectContaining({
          status: 'cancelled',
          cancelledAt: expect.any(String)
        })
      );
    });

    it('should fail when transfer not found', async () => {
      const transferId = 'non-existent';

      mockTransferStateManager.getTransferEntry.mockReturnValue(null);

      const result = await orchestrator.cancelTransfer(transferId);

      expect(result).toEqual({
        success: false,
        message: 'Transfer not found'
      });
    });

    it('should handle unexpected errors', async () => {
      const transferId = 'transfer-123';

      mockTransferStateManager.getTransferEntry.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await orchestrator.cancelTransfer(transferId);

      expect(result).toEqual({
        success: false,
        message: 'Unexpected error'
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getTransferStatus', () => {
    it('should get transfer status', () => {
      const transferId = 'transfer-123';
      const entry = { transferId, status: 'transferring' };

      mockTransferStateManager.getTransferEntry.mockReturnValue(entry);

      const result = orchestrator.getTransferStatus(transferId);

      expect(result).toBe(entry);
      expect(mockTransferStateManager.getTransferEntry).toHaveBeenCalledWith(transferId);
    });

    it('should return null for non-existent transfer', () => {
      mockTransferStateManager.getTransferEntry.mockReturnValue(null);

      const result = orchestrator.getTransferStatus('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getActiveTransfers', () => {
    it('should get all active transfers', () => {
      const transfers = [
        { transferId: 'transfer-1', status: 'transferring' },
        { transferId: 'transfer-2', status: 'pending' }
      ];

      mockTransferStateManager.getActiveTransfersArray.mockReturnValue(transfers);

      const result = orchestrator.getActiveTransfers();

      expect(result).toBe(transfers);
      expect(mockTransferStateManager.getActiveTransfersArray).toHaveBeenCalled();
    });

    it('should return empty array when no transfers', () => {
      mockTransferStateManager.getActiveTransfersArray.mockReturnValue([]);

      const result = orchestrator.getActiveTransfers();

      expect(result).toEqual([]);
    });
  });

  describe('getTransfersByDevice', () => {
    it('should get transfers by device', () => {
      const deviceId = 'device123';
      const transfers = [
        { transferId: 'transfer-1', deviceId },
        { transferId: 'transfer-2', deviceId }
      ];

      mockTransferStateManager.getTransfersByDeviceId = jest.fn().mockReturnValue(transfers);

      const result = orchestrator.getTransfersByDevice(deviceId);

      expect(result).toBe(transfers);
      expect(mockTransferStateManager.getTransfersByDeviceId).toHaveBeenCalledWith(deviceId);
    });

    it('should return empty array for device with no transfers', () => {
      mockTransferStateManager.getTransfersByDeviceId = jest.fn().mockReturnValue([]);

      const result = orchestrator.getTransfersByDevice('device123');

      expect(result).toEqual([]);
    });
  });

  describe('Event handlers', () => {
    it('should handle transferStarted event', () => {
      const entry = {
        transferId: 'transfer-123',
        localPath: '/local/file.mp4',
        deviceId: 'device123',
        status: 'pending'
      };

      mockTransferStateManager.getActiveTransfersArray.mockReturnValue([entry]);
      mockTransferStateManager.updateTransferEntry.mockReturnValue(true);

      const eventHandler = mockAdbPushService.on.mock.calls.find(
        call => call[0] === 'transferStarted'
      )[1];

      eventHandler({
        localPath: '/local/file.mp4',
        deviceId: 'device123',
        totalSize: 1000000
      });

      expect(mockTransferStateManager.updateTransferEntry).toHaveBeenCalledWith(
        'transfer-123',
        expect.objectContaining({
          status: 'transferring',
          totalBytes: 1000000
        })
      );
    });

    it('should handle transferComplete event', () => {
      const entry = {
        transferId: 'transfer-123',
        localPath: '/local/file.mp4',
        deviceId: 'device123',
        status: 'transferring'
      };

      mockTransferStateManager.getActiveTransfersArray.mockReturnValue([entry]);
      mockTransferStateManager.updateTransferEntry.mockReturnValue(true);

      const eventHandler = mockAdbPushService.on.mock.calls.find(
        call => call[0] === 'transferComplete'
      )[1];

      eventHandler({
        localPath: '/local/file.mp4',
        deviceId: 'device123',
        progress: 1.0,
        transferredBytes: 1000000
      });

      expect(mockTransferStateManager.updateTransferEntry).toHaveBeenCalledWith(
        'transfer-123',
        expect.objectContaining({
          status: 'completed',
          progress: 100,
          transferredBytes: 1000000,
          completedAt: expect.any(String)
        })
      );
    });

    it('should handle transferFailed event', () => {
      const entry = {
        transferId: 'transfer-123',
        localPath: '/local/file.mp4',
        deviceId: 'device123',
        status: 'transferring'
      };

      mockTransferStateManager.getActiveTransfersArray.mockReturnValue([entry]);
      mockTransferStateManager.updateTransferEntry.mockReturnValue(true);

      const eventHandler = mockAdbPushService.on.mock.calls.find(
        call => call[0] === 'transferFailed'
      )[1];

      eventHandler({
        localPath: '/local/file.mp4',
        deviceId: 'device123',
        error: 'Network error'
      });

      expect(mockTransferStateManager.updateTransferEntry).toHaveBeenCalledWith(
        'transfer-123',
        expect.objectContaining({
          status: 'failed',
          errorMessage: 'Network error',
          failedAt: expect.any(String)
        })
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle zero file size', async () => {
      const localPath = '/local/empty.mp4';
      const deviceId = 'device123';
      const fileSize = 0;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result.success).toBe(true);
    });

    it('should handle very large file size', async () => {
      const localPath = '/local/large.mp4';
      const deviceId = 'device123';
      const fileSize = Number.MAX_SAFE_INTEGER;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: Number.MAX_SAFE_INTEGER,
        requiredBytes: fileSize
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result.success).toBe(true);
    });

    it('should handle special characters in paths', async () => {
      const localPath = '/local/file with spaces & special!.mp4';
      const deviceId = 'device123';
      const fileSize = 1000000;

      mockDeviceRegistry.getDevice.mockReturnValue({ id: deviceId, isConnected: true });
      fs.access.mockResolvedValue();
      fs.stat.mockResolvedValue({ size: fileSize });
      mockSpaceChecker.checkAvailableSpace.mockResolvedValue({
        hasEnoughSpace: true,
        availableBytes: 5000000,
        requiredBytes: fileSize
      });
      mockAdbPushService.pushFile.mockResolvedValue({ success: true });

      const result = await orchestrator.startTransfer(localPath, deviceId);

      expect(result.success).toBe(true);
    });
  });
});
