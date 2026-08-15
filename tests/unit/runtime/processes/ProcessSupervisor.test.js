const ProcessSupervisor = require('../../../../src/main/runtime/processes/ProcessSupervisor');

describe('ProcessSupervisor', () => {
  let processSupervisor;
  let mockProcessManager;
  let mockProcessRegistry;
  let mockLogger;

  beforeEach(() => {
    mockProcessManager = {
      execute: jest.fn(),
      terminate: jest.fn(),
      getProcessStatus: jest.fn(),
      executeQuickTaskArray: jest.fn(),
      executeAndWatch: jest.fn()
    };

    mockProcessRegistry = {
      register: jest.fn(),
      unregister: jest.fn(),
      get: jest.fn(),
      updateStatus: jest.fn()
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    processSupervisor = new ProcessSupervisor({
      processManager: mockProcessManager,
      processRegistry: mockProcessRegistry,
      logger: mockLogger
    });
  });

  describe('startManagedProcess', () => {
    it('should register process in registry with STARTING status', () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test',
        args: ['--arg1'],
        type: 'generic',
        metadata: { key: 'value' }
      };

      processSupervisor.startManagedProcess(processConfig);

      expect(mockProcessRegistry.register).toHaveBeenCalledWith('proc-1', {
        id: 'proc-1',
        type: 'generic',
        metadata: { key: 'value' },
        status: 'STARTING',
        startedAt: expect.any(Number)
      });
    });

    it('should call processManager.execute with correct parameters', () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test',
        args: ['--arg1'],
        type: 'generic',
        onData: jest.fn(),
        maxBufferSize: 100
      };

      processSupervisor.startManagedProcess(processConfig);

      expect(mockProcessManager.execute).toHaveBeenCalledWith(
        'proc-1',
        '/usr/bin/test',
        ['--arg1'],
        'generic',
        processConfig.onData,
        100
      );
    });

    it('should update status to RUNNING after successful execution', () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test'
      };

      mockProcessManager.execute.mockReturnValue({ success: true });

      processSupervisor.startManagedProcess(processConfig);

      expect(mockProcessRegistry.updateStatus).toHaveBeenCalledWith('proc-1', 'RUNNING');
    });

    it('should throw error if processId is missing', () => {
      const processConfig = {
        binPath: '/usr/bin/test'
      };

      expect(() => processSupervisor.startManagedProcess(processConfig)).toThrow('processId is required');
      expect(mockProcessRegistry.register).not.toHaveBeenCalled();
      expect(mockProcessManager.execute).not.toHaveBeenCalled();
    });

    it('should throw error if binPath is missing', () => {
      const processConfig = {
        processId: 'proc-1'
      };

      expect(() => processSupervisor.startManagedProcess(processConfig)).toThrow('binPath is required');
      expect(mockProcessRegistry.register).not.toHaveBeenCalled();
      expect(mockProcessManager.execute).not.toHaveBeenCalled();
    });

    it('should update status to FAILED if processManager.execute throws error', () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test'
      };

      mockProcessManager.execute.mockImplementation(() => {
        throw new Error('Execution failed');
      });

      expect(() => processSupervisor.startManagedProcess(processConfig)).toThrow('Execution failed');
      expect(mockProcessRegistry.updateStatus).toHaveBeenCalledWith('proc-1', 'FAILED');
    });

    it('should return result from processManager.execute on success', () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test'
      };

      const expectedResult = { pid: 12345, success: true };
      mockProcessManager.execute.mockReturnValue(expectedResult);

      const result = processSupervisor.startManagedProcess(processConfig);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('stopManagedProcess', () => {
    it('should return true if process exists and termination succeeds', () => {
      mockProcessRegistry.get.mockReturnValue({ id: 'proc-1', status: 'RUNNING' });
      mockProcessManager.terminate.mockReturnValue(true);

      const result = processSupervisor.stopManagedProcess('proc-1');

      expect(result).toBe(true);
      expect(mockProcessManager.terminate).toHaveBeenCalledWith('proc-1');
    });

    it('should return false if process does not exist', () => {
      mockProcessRegistry.get.mockReturnValue(null);

      const result = processSupervisor.stopManagedProcess('proc-1');

      expect(result).toBe(false);
      expect(mockProcessManager.terminate).not.toHaveBeenCalled();
    });

    it('should call processManager.terminate with correct processId', () => {
      mockProcessRegistry.get.mockReturnValue({ id: 'proc-1', status: 'RUNNING' });
      mockProcessManager.terminate.mockReturnValue(true);

      processSupervisor.stopManagedProcess('proc-1');

      expect(mockProcessManager.terminate).toHaveBeenCalledWith('proc-1');
    });
  });

  describe('getProcessStatus', () => {
    it('should return null if process does not exist', () => {
      mockProcessRegistry.get.mockReturnValue(null);

      const result = processSupervisor.getProcessStatus('proc-1');

      expect(result).toBeNull();
      expect(mockProcessManager.getProcessStatus).not.toHaveBeenCalled();
    });

    it('should return merged status from registry and manager', () => {
      const registryState = {
        id: 'proc-1',
        type: 'generic',
        status: 'RUNNING',
        startedAt: 1234567890
      };

      const managerStatus = {
        pid: 12345,
        status: 'RUNNING',
        cpuUsage: 10.5
      };

      mockProcessRegistry.get.mockReturnValue(registryState);
      mockProcessManager.getProcessStatus.mockReturnValue(managerStatus);

      const result = processSupervisor.getProcessStatus('proc-1');

      expect(result).toEqual({
        ...registryState,
        status: 'RUNNING',
        process: managerStatus
      });
    });

    it('should use registry status if manager status is not available', () => {
      const registryState = {
        id: 'proc-1',
        type: 'generic',
        status: 'STARTING',
        startedAt: 1234567890
      };

      mockProcessRegistry.get.mockReturnValue(registryState);
      mockProcessManager.getProcessStatus.mockReturnValue(null);

      const result = processSupervisor.getProcessStatus('proc-1');

      expect(result).toEqual({
        ...registryState,
        status: 'STARTING',
        process: null
      });
    });

    it('should prefer manager status over registry status when available', () => {
      const registryState = {
        id: 'proc-1',
        type: 'generic',
        status: 'STARTING',
        startedAt: 1234567890
      };

      const managerStatus = {
        pid: 12345,
        status: 'RUNNING'
      };

      mockProcessRegistry.get.mockReturnValue(registryState);
      mockProcessManager.getProcessStatus.mockReturnValue(managerStatus);

      const result = processSupervisor.getProcessStatus('proc-1');

      expect(result.status).toBe('RUNNING');
      expect(result.process).toEqual(managerStatus);
    });
  });

  describe('executeQuickTaskArray', () => {
    it('should call processManager.executeQuickTaskArray with correct parameters', async () => {
      const binPath = '/usr/bin/test';
      const args = ['--arg1', '--arg2'];
      const options = { timeout: 5000 };

      mockProcessManager.executeQuickTaskArray.mockResolvedValue({ success: true });

      await processSupervisor.executeQuickTaskArray(binPath, args, options);

      expect(mockProcessManager.executeQuickTaskArray).toHaveBeenCalledWith(binPath, args, options);
    });

    it('should throw error if binPath is missing', async () => {
      await expect(processSupervisor.executeQuickTaskArray(null, ['--arg1']))
        .rejects.toThrow('binPath is required');
    });

    it('should return result from processManager.executeQuickTaskArray', async () => {
      const expectedResult = { output: 'test output', success: true };
      mockProcessManager.executeQuickTaskArray.mockResolvedValue(expectedResult);

      const result = await processSupervisor.executeQuickTaskArray('/usr/bin/test', ['--arg1']);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('executeAndWatch', () => {
    it('should register process in registry with RUNNING status', async () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test',
        args: ['--arg1'],
        type: 'watch',
        metadata: { key: 'value' }
      };

      mockProcessManager.executeAndWatch.mockResolvedValue({ success: true });

      await processSupervisor.executeAndWatch(processConfig, 'success', 5000);

      expect(mockProcessRegistry.register).toHaveBeenCalledWith('proc-1', {
        id: 'proc-1',
        type: 'watch',
        metadata: { key: 'value' },
        status: 'RUNNING',
        startedAt: expect.any(Number)
      });
    });

    it('should call processManager.executeAndWatch with correct parameters', async () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test',
        args: ['--arg1']
      };

      mockProcessManager.executeAndWatch.mockResolvedValue({ success: true });

      await processSupervisor.executeAndWatch(processConfig, 'success', 5000);

      expect(mockProcessManager.executeAndWatch).toHaveBeenCalledWith(
        'proc-1',
        '/usr/bin/test',
        ['--arg1'],
        'success',
        5000
      );
    });

    it('should update status to EXITED if result.success is true', async () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test'
      };

      mockProcessManager.executeAndWatch.mockResolvedValue({ success: true });

      await processSupervisor.executeAndWatch(processConfig, 'success', 5000);

      expect(mockProcessRegistry.updateStatus).toHaveBeenCalledWith('proc-1', 'EXITED');
    });

    it('should update status to FAILED if result.success is false', async () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test'
      };

      mockProcessManager.executeAndWatch.mockResolvedValue({ success: false });

      await processSupervisor.executeAndWatch(processConfig, 'success', 5000);

      expect(mockProcessRegistry.updateStatus).toHaveBeenCalledWith('proc-1', 'FAILED');
    });

    it('should throw error if processId is missing', async () => {
      const processConfig = {
        binPath: '/usr/bin/test'
      };

      await expect(processSupervisor.executeAndWatch(processConfig, 'success', 5000))
        .rejects.toThrow('processId is required');
    });

    it('should throw error if binPath is missing', async () => {
      const processConfig = {
        processId: 'proc-1'
      };

      await expect(processSupervisor.executeAndWatch(processConfig, 'success', 5000))
        .rejects.toThrow('binPath is required');
    });

    it('should update status to FAILED if processManager.executeAndWatch throws error', async () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test'
      };

      mockProcessManager.executeAndWatch.mockRejectedValue(new Error('Watch failed'));

      await expect(processSupervisor.executeAndWatch(processConfig, 'success', 5000))
        .rejects.toThrow('Watch failed');

      expect(mockProcessRegistry.updateStatus).toHaveBeenCalledWith('proc-1', 'FAILED');
    });

    it('should return result from processManager.executeAndWatch on success', async () => {
      const processConfig = {
        processId: 'proc-1',
        binPath: '/usr/bin/test'
      };

      const expectedResult = { output: 'test', success: true };
      mockProcessManager.executeAndWatch.mockResolvedValue(expectedResult);

      const result = await processSupervisor.executeAndWatch(processConfig, 'success', 5000);

      expect(result).toEqual(expectedResult);
    });
  });
});
