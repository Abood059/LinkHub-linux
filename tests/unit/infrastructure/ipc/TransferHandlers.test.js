'use strict';

const TransferHandlers = require('../../../../src/main/infrastructure/ipc/TransferHandlers');

describe('TransferHandlers', () => {
  let handlers;
  let mockTransferOrchestrator;
  let mockIpcMain;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTransferOrchestrator = {
      startTransfer: jest.fn(),
      startMultipleTransfers: jest.fn(),
      startDownloadTransfer: jest.fn(),
      cancelTransfer: jest.fn(),
      getTransferStatus: jest.fn(),
      getActiveTransfers: jest.fn(),
      getTransfersByDevice: jest.fn()
    };

    mockIpcMain = {
      handle: jest.fn()
    };

    handlers = new TransferHandlers(mockTransferOrchestrator);
  });

  describe('Constructor', () => {
    it('should throw error when transferOrchestrator is not provided', () => {
      expect(() => {
        new TransferHandlers(null);
      }).toThrow('TransferOrchestrator is required for TransferHandlers');
    });

    it('should create instance with valid dependencies', () => {
      expect(handlers).toBeInstanceOf(TransferHandlers);
      expect(handlers._transferOrchestrator).toBe(mockTransferOrchestrator);
    });
  });

  describe('register', () => {
    it('should register all IPC channels', () => {
      handlers.register(mockIpcMain);

      expect(mockIpcMain.handle).toHaveBeenCalledWith('transfer:startFile', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transfer:startMultiple', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transfer:startDownload', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transfer:cancel', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transfer:getStatus', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transfer:getActive', expect.any(Function));
      expect(mockIpcMain.handle).toHaveBeenCalledWith('transfer:getByDevice', expect.any(Function));
    });

    it('should throw error when ipcMain is not valid', () => {
      expect(() => {
        handlers.register(null);
      }).toThrow('Valid ipcMain instance required');
    });

    it('should throw error when ipcMain has no handle method', () => {
      expect(() => {
        handlers.register({});
      }).toThrow('Valid ipcMain instance required');
    });
  });

  describe('transfer:startFile handler', () => {
    it('should handle transfer:startFile successfully', async () => {
      mockTransferOrchestrator.startTransfer.mockResolvedValue({
        success: true,
        transferId: 'transfer-123',
        message: 'Transfer started'
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      const result = await handler(null, '/local/file.mp4', 'device123', {});

      expect(result).toEqual({
        success: true,
        transferId: 'transfer-123',
        message: 'Transfer started'
      });
      expect(mockTransferOrchestrator.startTransfer).toHaveBeenCalledWith(
        '/local/file.mp4',
        'device123',
        {}
      );
    });

    it('should throw error when localPath is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      await expect(handler(null, null, 'device123')).rejects.toThrow('localPath is required');
    });

    it('should throw error when localPath is empty string', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      await expect(handler(null, '', 'device123')).rejects.toThrow('localPath is required');
    });

    it('should throw error when deviceId is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      await expect(handler(null, '/local/file.mp4', null)).rejects.toThrow('deviceId is required');
    });

    it('should throw error when deviceId is empty string', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      await expect(handler(null, '/local/file.mp4', '')).rejects.toThrow('deviceId is required');
    });

    it('should pass options to orchestrator', async () => {
      mockTransferOrchestrator.startTransfer.mockResolvedValue({
        success: true,
        transferId: 'transfer-123'
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      const options = { transferId: 'custom-id', remotePath: '/sdcard/file.mp4' };
      await handler(null, '/local/file.mp4', 'device123', options);

      expect(mockTransferOrchestrator.startTransfer).toHaveBeenCalledWith(
        '/local/file.mp4',
        'device123',
        options
      );
    });

    it('should handle orchestrator errors', async () => {
      mockTransferOrchestrator.startTransfer.mockRejectedValue(new Error('Orchestrator error'));

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      await expect(handler(null, '/local/file.mp4', 'device123')).rejects.toThrow('Orchestrator error');
    });
  });

  describe('transfer:startMultiple handler', () => {
    it('should handle transfer:startMultiple successfully', async () => {
      mockTransferOrchestrator.startMultipleTransfers.mockResolvedValue({
        success: true,
        transferIds: ['transfer-1', 'transfer-2'],
        message: 'Started 2 transfers successfully'
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startMultiple'
      )[1];

      const result = await handler(null, '/local/file.mp4', ['device1', 'device2'], {});

      expect(result).toEqual({
        success: true,
        transferIds: ['transfer-1', 'transfer-2'],
        message: 'Started 2 transfers successfully'
      });
      expect(mockTransferOrchestrator.startMultipleTransfers).toHaveBeenCalledWith(
        '/local/file.mp4',
        ['device1', 'device2'],
        {}
      );
    });

    it('should throw error when localPath is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startMultiple'
      )[1];

      await expect(handler(null, null, ['device1'])).rejects.toThrow('localPath is required');
    });

    it('should throw error when deviceIds is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startMultiple'
      )[1];

      await expect(handler(null, '/local/file.mp4', null)).rejects.toThrow('deviceIds is required and must be a non-empty array');
    });

    it('should throw error when deviceIds is not an array', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startMultiple'
      )[1];

      await expect(handler(null, '/local/file.mp4', 'device1')).rejects.toThrow('deviceIds is required and must be a non-empty array');
    });

    it('should throw error when deviceIds is empty array', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startMultiple'
      )[1];

      await expect(handler(null, '/local/file.mp4', [])).rejects.toThrow('deviceIds is required and must be a non-empty array');
    });

    it('should pass options to orchestrator', async () => {
      mockTransferOrchestrator.startMultipleTransfers.mockResolvedValue({
        success: true,
        transferIds: ['transfer-1']
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startMultiple'
      )[1];

      const options = { downloadId: 'download-123' };
      await handler(null, '/local/file.mp4', ['device1'], options);

      expect(mockTransferOrchestrator.startMultipleTransfers).toHaveBeenCalledWith(
        '/local/file.mp4',
        ['device1'],
        options
      );
    });
  });

  describe('transfer:startDownload handler', () => {
    it('should handle transfer:startDownload successfully', async () => {
      mockTransferOrchestrator.startDownloadTransfer.mockResolvedValue({
        success: true,
        transferIds: ['transfer-1'],
        message: 'Started 1 transfer successfully'
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startDownload'
      )[1];

      const result = await handler(null, 'download-123', ['device1'], '/local/file.mp4');

      expect(result).toEqual({
        success: true,
        transferIds: ['transfer-1'],
        message: 'Started 1 transfer successfully'
      });
      expect(mockTransferOrchestrator.startDownloadTransfer).toHaveBeenCalledWith(
        'download-123',
        ['device1'],
        '/local/file.mp4'
      );
    });

    it('should throw error when downloadId is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startDownload'
      )[1];

      await expect(handler(null, null, ['device1'], '/local/file.mp4')).rejects.toThrow('downloadId is required');
    });

    it('should throw error when downloadId is empty string', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startDownload'
      )[1];

      await expect(handler(null, '', ['device1'], '/local/file.mp4')).rejects.toThrow('downloadId is required');
    });

    it('should throw error when deviceIds is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startDownload'
      )[1];

      await expect(handler(null, 'download-123', null, '/local/file.mp4')).rejects.toThrow('deviceIds is required and must be a non-empty array');
    });

    it('should throw error when deviceIds is empty array', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startDownload'
      )[1];

      await expect(handler(null, 'download-123', [], '/local/file.mp4')).rejects.toThrow('deviceIds is required and must be a non-empty array');
    });

    it('should throw error when localPath is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startDownload'
      )[1];

      await expect(handler(null, 'download-123', ['device1'], null)).rejects.toThrow('localPath is required');
    });

    it('should throw error when localPath is empty string', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startDownload'
      )[1];

      await expect(handler(null, 'download-123', ['device1'], '')).rejects.toThrow('localPath is required');
    });
  });

  describe('transfer:cancel handler', () => {
    it('should handle transfer:cancel successfully', async () => {
      mockTransferOrchestrator.cancelTransfer.mockResolvedValue({
        success: true,
        message: 'Transfer cancelled successfully'
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:cancel'
      )[1];

      const result = await handler(null, 'transfer-123');

      expect(result).toEqual({
        success: true,
        message: 'Transfer cancelled successfully'
      });
      expect(mockTransferOrchestrator.cancelTransfer).toHaveBeenCalledWith('transfer-123');
    });

    it('should throw error when transferId is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:cancel'
      )[1];

      await expect(handler(null, null)).rejects.toThrow('transferId is required');
    });

    it('should throw error when transferId is empty string', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:cancel'
      )[1];

      await expect(handler(null, '')).rejects.toThrow('transferId is required');
    });

    it('should handle orchestrator errors', async () => {
      mockTransferOrchestrator.cancelTransfer.mockRejectedValue(new Error('Orchestrator error'));

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:cancel'
      )[1];

      await expect(handler(null, 'transfer-123')).rejects.toThrow('Orchestrator error');
    });
  });

  describe('transfer:getStatus handler', () => {
    it('should handle transfer:getStatus successfully', async () => {
      const mockStatus = {
        transferId: 'transfer-123',
        status: 'transferring',
        progress: 50
      };
      mockTransferOrchestrator.getTransferStatus.mockReturnValue(mockStatus);

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getStatus'
      )[1];

      const result = await handler(null, 'transfer-123');

      expect(result).toBe(mockStatus);
      expect(mockTransferOrchestrator.getTransferStatus).toHaveBeenCalledWith('transfer-123');
    });

    it('should throw error when transferId is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getStatus'
      )[1];

      await expect(handler(null, null)).rejects.toThrow('transferId is required');
    });

    it('should throw error when transferId is empty string', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getStatus'
      )[1];

      await expect(handler(null, '')).rejects.toThrow('transferId is required');
    });

    it('should return null for non-existent transfer', async () => {
      mockTransferOrchestrator.getTransferStatus.mockReturnValue(null);

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getStatus'
      )[1];

      const result = await handler(null, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('transfer:getActive handler', () => {
    it('should handle transfer:getActive successfully', async () => {
      const mockTransfers = [
        { transferId: 'transfer-1', status: 'transferring' },
        { transferId: 'transfer-2', status: 'pending' }
      ];
      mockTransferOrchestrator.getActiveTransfers.mockReturnValue(mockTransfers);

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getActive'
      )[1];

      const result = await handler(null);

      expect(result).toBe(mockTransfers);
      expect(mockTransferOrchestrator.getActiveTransfers).toHaveBeenCalled();
    });

    it('should return empty array when no active transfers', async () => {
      mockTransferOrchestrator.getActiveTransfers.mockReturnValue([]);

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getActive'
      )[1];

      const result = await handler(null);

      expect(result).toEqual([]);
    });

    it('should not require any parameters', async () => {
      mockTransferOrchestrator.getActiveTransfers.mockReturnValue([]);

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getActive'
      )[1];

      const result = await handler(null);

      expect(result).toEqual([]);
    });
  });

  describe('transfer:getByDevice handler', () => {
    it('should handle transfer:getByDevice successfully', async () => {
      const mockTransfers = [
        { transferId: 'transfer-1', deviceId: 'device123' },
        { transferId: 'transfer-2', deviceId: 'device123' }
      ];
      mockTransferOrchestrator.getTransfersByDevice.mockReturnValue(mockTransfers);

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getByDevice'
      )[1];

      const result = await handler(null, 'device123');

      expect(result).toBe(mockTransfers);
      expect(mockTransferOrchestrator.getTransfersByDevice).toHaveBeenCalledWith('device123');
    });

    it('should throw error when deviceId is missing', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getByDevice'
      )[1];

      await expect(handler(null, null)).rejects.toThrow('deviceId is required');
    });

    it('should throw error when deviceId is empty string', async () => {
      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getByDevice'
      )[1];

      await expect(handler(null, '')).rejects.toThrow('deviceId is required');
    });

    it('should return empty array for device with no transfers', async () => {
      mockTransferOrchestrator.getTransfersByDevice.mockReturnValue([]);

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:getByDevice'
      )[1];

      const result = await handler(null, 'device123');

      expect(result).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in paths', async () => {
      mockTransferOrchestrator.startTransfer.mockResolvedValue({
        success: true,
        transferId: 'transfer-123'
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      const specialPath = '/local/file with spaces & special!.mp4';
      await handler(null, specialPath, 'device123');

      expect(mockTransferOrchestrator.startTransfer).toHaveBeenCalledWith(
        specialPath,
        'device123',
        {}
      );
    });

    it('should handle very long deviceIds array', async () => {
      mockTransferOrchestrator.startMultipleTransfers.mockResolvedValue({
        success: true,
        transferIds: []
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startMultiple'
      )[1];

      const manyDevices = Array.from({ length: 100 }, (_, i) => `device${i}`);
      await handler(null, '/local/file.mp4', manyDevices);

      expect(mockTransferOrchestrator.startMultipleTransfers).toHaveBeenCalledWith(
        '/local/file.mp4',
        manyDevices,
        {}
      );
    });

    it('should handle concurrent IPC calls', async () => {
      mockTransferOrchestrator.startTransfer.mockResolvedValue({
        success: true,
        transferId: 'transfer-123'
      });

      handlers.register(mockIpcMain);

      const handler = mockIpcMain.handle.mock.calls.find(
        call => call[0] === 'transfer:startFile'
      )[1];

      const promises = [
        handler(null, '/local/file1.mp4', 'device1'),
        handler(null, '/local/file2.mp4', 'device2'),
        handler(null, '/local/file3.mp4', 'device3')
      ];

      await Promise.all(promises);

      expect(mockTransferOrchestrator.startTransfer).toHaveBeenCalledTimes(3);
    });
  });
});
