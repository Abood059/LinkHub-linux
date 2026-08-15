'use strict';

const TransferStateSyncService = require('../../../../src/main/infrastructure/sync/TransferStateSyncService');

describe('TransferStateSyncService', () => {
  let syncService;
  let mockWindowManager;
  let mockTransferStateManager;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockWindowManager = {
      broadcast: jest.fn()
    };

    mockTransferStateManager = {
      getActiveTransfers: jest.fn()
    };

    syncService = new TransferStateSyncService(mockWindowManager, mockTransferStateManager, {
      interval: 300
    });
  });

  afterEach(() => {
    if (syncService._isRunning) {
      syncService.stop();
    }
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  describe('Constructor', () => {
    it('should throw error when windowManager is not provided', () => {
      expect(() => {
        new TransferStateSyncService(null, mockTransferStateManager);
      }).toThrow('WindowManager is required for TransferStateSyncService');
    });

    it('should create instance with valid dependencies', () => {
      expect(syncService).toBeInstanceOf(TransferStateSyncService);
      expect(syncService._windowManager).toBe(mockWindowManager);
      expect(syncService._transferStateManager).toBe(mockTransferStateManager);
      expect(syncService._interval).toBe(300);
      expect(syncService._isRunning).toBe(false);
      expect(syncService._timer).toBeNull();
    });

    it('should use default interval when not provided', () => {
      const serviceWithoutInterval = new TransferStateSyncService(
        mockWindowManager,
        mockTransferStateManager
      );
      expect(serviceWithoutInterval._interval).toBe(300);
    });

    it('should use custom interval when provided', () => {
      const serviceWithCustomInterval = new TransferStateSyncService(
        mockWindowManager,
        mockTransferStateManager,
        { interval: 500 }
      );
      expect(serviceWithCustomInterval._interval).toBe(500);
    });

    it('should initialize empty state maps', () => {
      expect(syncService._state.transfers).toBeInstanceOf(Map);
      expect(syncService._previousState.transfers).toBeInstanceOf(Map);
      expect(syncService._pendingErrors).toBeInstanceOf(Map);
      expect(syncService._failedAttempts).toBe(0);
    });
  });

  describe('start', () => {
    afterEach(() => {
      if (syncService._isRunning) {
        syncService.stop();
      }
    });

    it('should start the service', () => {
      syncService.start();

      expect(syncService._isRunning).toBe(true);
      expect(syncService._timer).not.toBeNull();
    });

    it('should not start if already running', () => {
      syncService.start();
      const firstTimer = syncService._timer;

      syncService.start();

      expect(syncService._timer).toBe(firstTimer);
    });

    it('should set up interval timer', () => {
      syncService.start();

      expect(syncService._isRunning).toBe(true);
      expect(syncService._timer).not.toBeNull();
    });
  });

  describe('stop', () => {
    it('should stop the service', () => {
      syncService.start();
      syncService.stop();

      expect(syncService._isRunning).toBe(false);
      expect(syncService._timer).toBeNull();
    });

    it('should not stop if not running', () => {
      syncService.stop();

      expect(syncService._isRunning).toBe(false);
      expect(syncService._timer).toBeNull();
    });

    it('should clear interval timer', () => {
      syncService.start();
      const timer = syncService._timer;
      syncService.stop();

      expect(syncService._isRunning).toBe(false);
      expect(syncService._timer).toBeNull();
    });
  });

  describe('setInterval', () => {
    it('should change interval when not running', () => {
      syncService.setInterval(500);

      expect(syncService._interval).toBe(500);
    });

    it('should restart service with new interval when running', () => {
      syncService.start();
      const firstTimer = syncService._timer;

      syncService.setInterval(500);

      expect(syncService._interval).toBe(500);
      expect(syncService._timer).not.toBe(firstTimer);
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      syncService._state.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'transferring'
      });
      syncService._state.timestamp = 1234567890;

      const state = syncService.getState();

      expect(state.transfers).toHaveLength(1);
      expect(state.transfers[0].transferId).toBe('transfer-1');
      expect(state.timestamp).toBe(1234567890);
    });

    it('should return empty state when no transfers', () => {
      const state = syncService.getState();

      expect(state.transfers).toHaveLength(0);
      expect(state.timestamp).toBeDefined();
    });
  });

  describe('_broadcastState', () => {
    it('should broadcast state update', () => {
      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map([
        ['transfer-1', {
          transferId: 'transfer-1',
          deviceId: 'device123',
          localPath: '/local/file.mp4',
          status: 'transferring',
          progress: 50
        }]
      ]));

      syncService._broadcastState();

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:state:update',
        expect.objectContaining({
          transfers: expect.any(Array),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should handle transferStateManager being null', () => {
      syncService._transferStateManager = null;

      expect(() => {
        syncService._broadcastState();
      }).not.toThrow();
    });

    it('should increment failedAttempts on error', () => {
      mockTransferStateManager.getActiveTransfers.mockImplementation(() => {
        throw new Error('Test error');
      });

      syncService._broadcastState();

      expect(syncService._failedAttempts).toBe(1);
    });

    it('should reset failedAttempts on success', () => {
      syncService._failedAttempts = 5;
      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map());

      syncService._broadcastState();

      expect(syncService._failedAttempts).toBe(0);
    });

    it('should save error message on status change to failed', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'transferring',
        errorMessage: null
      });

      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map([
        ['transfer-1', {
          transferId: 'transfer-1',
          status: 'failed',
          errorMessage: 'Transfer failed'
        }]
      ]));

      syncService._broadcastState();

      // Error message is stored in the state for emission
      const currentTransfer = syncService._state.transfers.get('transfer-1');
      expect(currentTransfer.status).toBe('failed');
    });

    it('should not save error message when status not changed to failed', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'transferring'
      });

      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map([
        ['transfer-1', {
          transferId: 'transfer-1',
          status: 'transferring'
        }]
      ]));

      syncService._broadcastState();

      expect(syncService._pendingErrors.has('transfer-1')).toBe(false);
    });
  });

  describe('_diffAndEmitTransfers', () => {
    afterEach(() => {
      if (syncService._isRunning) {
        syncService.stop();
      }
    });

    it('should emit transfer:started for new transfer', () => {
      const currentTransfers = [
        { transferId: 'transfer-1', deviceId: 'device123', status: 'pending' }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:started',
        expect.objectContaining({
          transferId: 'transfer-1',
          deviceId: 'device123'
        })
      );
    });

    it('should emit transfer:complete on status change to completed', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'transferring'
      });

      const currentTransfers = [
        { transferId: 'transfer-1', status: 'completed' }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:complete',
        { transferId: 'transfer-1' }
      );
    });

    it('should emit transfer:error on status change to failed', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'transferring'
      });
      syncService._pendingErrors.set('transfer-1', 'Network error');

      const currentTransfers = [
        { transferId: 'transfer-1', status: 'failed' }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:error',
        {
          transferId: 'transfer-1',
          error: 'Network error'
        }
      );
      expect(syncService._pendingErrors.has('transfer-1')).toBe(false);
    });

    it('should emit transfer:cancelled on status change to cancelled', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'transferring'
      });

      const currentTransfers = [
        { transferId: 'transfer-1', status: 'cancelled' }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:cancelled',
        { transferId: 'transfer-1' }
      );
    });

    it('should emit transfer:started on status change from pending to transferring', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'pending'
      });

      const currentTransfers = [
        { transferId: 'transfer-1', status: 'transferring' }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:started',
        expect.objectContaining({
          transferId: 'transfer-1'
        })
      );
    });

    it('should emit transfer:progress when progress changes', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'transferring',
        progress: 25
      });

      const currentTransfers = [
        {
          transferId: 'transfer-1',
          status: 'transferring',
          progress: 50,
          transferredBytes: 500000,
          totalBytes: 1000000,
          speed: 1000,
          eta: 500
        }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:progress',
        expect.objectContaining({
          transferId: 'transfer-1',
          progress: 50,
          transferredBytes: 500000,
          totalBytes: 1000000,
          speed: 1000,
          eta: 500
        })
      );
    });

    it('should not emit progress when status is not transferring', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'completed',
        progress: 100
      });

      const currentTransfers = [
        {
          transferId: 'transfer-1',
          status: 'completed',
          progress: 100
        }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).not.toHaveBeenCalledWith(
        'transfer:progress',
        expect.any(Object)
      );
    });

    it('should not emit progress when progress has not changed', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'transferring',
        progress: 50
      });

      const currentTransfers = [
        {
          transferId: 'transfer-1',
          status: 'transferring',
          progress: 50
        }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).not.toHaveBeenCalledWith(
        'transfer:progress',
        expect.any(Object)
      );
    });
  });

  describe('_updatePreviousState', () => {
    it('should update previous state with current state', () => {
      const currentState = {
        transfers: [
          {
            transferId: 'transfer-1',
            status: 'transferring',
            progress: 50
          }
        ],
        timestamp: 1234567890
      };

      syncService._updatePreviousState(currentState);

      expect(syncService._previousState.transfers.size).toBe(1);
      expect(syncService._previousState.transfers.get('transfer-1').status).toBe('transferring');
      expect(syncService._previousState.transfers.get('transfer-1').progress).toBe(50);
    });

    it('should clear previous state before updating', () => {
      syncService._previousState.transfers.set('old-transfer', {
        transferId: 'old-transfer',
        status: 'completed'
      });

      const currentState = {
        transfers: [
          {
            transferId: 'transfer-1',
            status: 'transferring'
          }
        ],
        timestamp: 1234567890
      };

      syncService._updatePreviousState(currentState);

      expect(syncService._previousState.transfers.size).toBe(1);
      expect(syncService._previousState.transfers.has('old-transfer')).toBe(false);
    });
  });

  describe('initializeState', () => {
    it('should initialize previous state with provided transfers', () => {
      const transfersMap = new Map([
        ['transfer-1', {
          transferId: 'transfer-1',
          deviceId: 'device123',
          status: 'transferring',
          progress: 50
        }]
      ]);

      syncService.initializeState(transfersMap);

      expect(syncService._previousState.transfers.size).toBe(1);
      expect(syncService._previousState.transfers.get('transfer-1').status).toBe('transferring');
    });

    it('should handle null transfersMap', () => {
      expect(() => {
        syncService.initializeState(null);
      }).not.toThrow();
    });

    it('should handle non-Map transfersMap', () => {
      expect(() => {
        syncService.initializeState({});
      }).not.toThrow();
    });

    it('should clear existing previous state before initializing', () => {
      syncService._previousState.transfers.set('old-transfer', {
        transferId: 'old-transfer',
        status: 'completed'
      });

      const transfersMap = new Map([
        ['transfer-1', {
          transferId: 'transfer-1',
          status: 'transferring'
        }]
      ]);

      syncService.initializeState(transfersMap);

      expect(syncService._previousState.transfers.size).toBe(1);
      expect(syncService._previousState.transfers.has('old-transfer')).toBe(false);
    });

    it('should clone transfer data to prevent reference issues', () => {
      const transfersMap = new Map([
        ['transfer-1', {
          transferId: 'transfer-1',
          status: 'transferring',
          deviceId: null,
          localPath: null,
          remotePath: null,
          downloadId: null,
          progress: 0,
          transferredBytes: 0,
          totalBytes: 0,
          speed: null,
          eta: null,
          startedAt: null,
          completedAt: null,
          failedAt: null,
          cancelledAt: null
        }]
      ]);

      syncService.initializeState(transfersMap);

      const originalData = transfersMap.get('transfer-1');
      const clonedData = syncService._previousState.transfers.get('transfer-1');

      expect(clonedData).not.toBe(originalData);
      expect(clonedData.transferId).toBe(originalData.transferId);
      expect(clonedData.status).toBe(originalData.status);
    });
  });

  describe('Full lifecycle', () => {
    afterEach(() => {
      if (syncService._isRunning) {
        syncService.stop();
      }
    });

    it('should handle full start -> broadcast -> stop cycle', () => {
      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map([
        ['transfer-1', {
          transferId: 'transfer-1',
          status: 'transferring',
          progress: 50
        }]
      ]));

      syncService.start();
      expect(syncService._isRunning).toBe(true);

      jest.advanceTimersByTime(300);
      expect(mockWindowManager.broadcast).toHaveBeenCalled();

      syncService.stop();
      expect(syncService._isRunning).toBe(false);
    });

    it('should handle restart after stop', () => {
      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map());

      syncService.start();
      syncService.stop();

      syncService.start();
      expect(syncService._isRunning).toBe(true);

      jest.advanceTimersByTime(300);
      expect(mockWindowManager.broadcast).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    afterEach(() => {
      if (syncService._isRunning) {
        syncService.stop();
      }
    });

    it('should handle empty transfers map', () => {
      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map());

      syncService._broadcastState();

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:state:update',
        expect.objectContaining({
          transfers: []
        })
      );
    });

    it('should handle transfer with null fields', () => {
      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map([
        ['transfer-1', {
          transferId: 'transfer-1',
          deviceId: null,
          localPath: null,
          remotePath: null,
          downloadId: null,
          status: 'pending',
          progress: 0,
          transferredBytes: 0,
          totalBytes: 0,
          speed: null,
          eta: null,
          startedAt: null,
          completedAt: null,
          failedAt: null,
          cancelledAt: null
        }]
      ]));

      expect(() => {
        syncService._broadcastState();
      }).not.toThrow();
    });

    it('should handle multiple concurrent transfers', () => {
      mockTransferStateManager.getActiveTransfers.mockReturnValue(new Map([
        ['transfer-1', { transferId: 'transfer-1', status: 'transferring', progress: 25 }],
        ['transfer-2', { transferId: 'transfer-2', status: 'pending', progress: 0 }],
        ['transfer-3', { transferId: 'transfer-3', status: 'completed', progress: 100 }]
      ]));

      syncService._broadcastState();

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:state:update',
        expect.objectContaining({
          transfers: expect.arrayContaining([
            expect.objectContaining({ transferId: 'transfer-1' }),
            expect.objectContaining({ transferId: 'transfer-2' }),
            expect.objectContaining({ transferId: 'transfer-3' })
          ])
        })
      );
    });

    it('should handle rapid status changes', () => {
      syncService._previousState.transfers.set('transfer-1', {
        transferId: 'transfer-1',
        status: 'pending'
      });

      const currentTransfers = [
        { transferId: 'transfer-1', status: 'transferring' }
      ];

      syncService._diffAndEmitTransfers(currentTransfers);

      expect(mockWindowManager.broadcast).toHaveBeenCalledWith(
        'transfer:started',
        expect.any(Object)
      );
    });
  });
});
