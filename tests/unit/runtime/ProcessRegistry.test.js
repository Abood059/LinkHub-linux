const ProcessRegistry = require('../../../src/main/runtime/processes/ProcessRegistry');

describe('ProcessRegistry', () => {
  let processRegistry;

  beforeEach(() => {
    processRegistry = new ProcessRegistry();
  });

  describe('constructor', () => {
    it('should create empty registry', () => {
      const retrieved = processRegistry.get('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('register', () => {
    it('should register a process with given ID and data', () => {
      const processData = { name: 'test-process', pid: 12345 };
      processRegistry.register('proc-1', processData);
      const retrieved = processRegistry.get('proc-1');
      expect(retrieved.name).toBe('test-process');
      expect(retrieved.pid).toBe(12345);
    });

    it('should protect stored data from external modifications', () => {
      const processData = { name: 'test-process', pid: 12345 };
      processRegistry.register('proc-1', processData);
      
      const retrieved = processRegistry.get('proc-1');
      retrieved.name = 'modified-name';
      
      const retrievedAgain = processRegistry.get('proc-1');
      expect(retrievedAgain.name).toBe('test-process');
    });

    it('should not modify the original process data object', () => {
      const processData = { name: 'test-process', pid: 12345 };
      processRegistry.register('proc-1', processData);
      processData.name = 'modified-original';
      
      const retrieved = processRegistry.get('proc-1');
      expect(retrieved.name).toBe('test-process');
    });

    it('should allow registering multiple processes', () => {
      processRegistry.register('proc-1', { name: 'process-1' });
      processRegistry.register('proc-2', { name: 'process-2' });
      processRegistry.register('proc-3', { name: 'process-3' });
      expect(processRegistry.get('proc-1')).not.toBeNull();
      expect(processRegistry.get('proc-2')).not.toBeNull();
      expect(processRegistry.get('proc-3')).not.toBeNull();
    });

    it('should overwrite existing process with same ID', () => {
      processRegistry.register('proc-1', { name: 'process-1' });
      processRegistry.register('proc-1', { name: 'process-2' });
      const retrieved = processRegistry.get('proc-1');
      expect(retrieved.name).toBe('process-2');
    });

    it('should copy all properties from processData', () => {
      const processData = {
        name: 'test-process',
        pid: 12345,
        status: 'running',
        startTime: new Date()
      };
      processRegistry.register('proc-1', processData);
      const retrieved = processRegistry.get('proc-1');
      expect(retrieved.name).toBe('test-process');
      expect(retrieved.pid).toBe(12345);
      expect(retrieved.status).toBe('running');
      expect(retrieved.startTime).toEqual(processData.startTime);
    });
  });

  describe('unregister', () => {
    it('should remove registered process', () => {
      processRegistry.register('proc-1', { name: 'process-1' });
      const result = processRegistry.unregister('proc-1');
      expect(result).toBe(true);
      expect(processRegistry.get('proc-1')).toBeNull();
    });

    it('should return false if process does not exist', () => {
      const result = processRegistry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should not affect other processes when removing one', () => {
      processRegistry.register('proc-1', { name: 'process-1' });
      processRegistry.register('proc-2', { name: 'process-2' });
      processRegistry.unregister('proc-1');
      expect(processRegistry.get('proc-1')).toBeNull();
      expect(processRegistry.get('proc-2')).not.toBeNull();
    });
  });

  describe('get', () => {
    it('should return registered process data', () => {
      const processData = { name: 'test-process', pid: 12345 };
      processRegistry.register('proc-1', processData);
      const retrieved = processRegistry.get('proc-1');
      expect(retrieved.name).toBe('test-process');
      expect(retrieved.pid).toBe(12345);
    });

    it('should return null if process does not exist', () => {
      const retrieved = processRegistry.get('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should return object that cannot affect stored data when modified', () => {
      const processData = { name: 'test-process', pid: 12345 };
      processRegistry.register('proc-1', processData);
      
      const retrieved = processRegistry.get('proc-1');
      retrieved.name = 'modified';
      retrieved.pid = 99999;
      
      const retrievedAgain = processRegistry.get('proc-1');
      expect(retrievedAgain.name).toBe('test-process');
      expect(retrievedAgain.pid).toBe(12345);
    });
  });

  describe('updateStatus', () => {
    it('should update status of existing process', () => {
      processRegistry.register('proc-1', { name: 'process-1', status: 'running' });
      const result = processRegistry.updateStatus('proc-1', 'completed');
      expect(result).toBe(true);
      const updated = processRegistry.get('proc-1');
      expect(updated.status).toBe('completed');
    });

    it('should return false if process does not exist', () => {
      const result = processRegistry.updateStatus('non-existent', 'completed');
      expect(result).toBe(false);
    });

    it('should keep other properties unchanged when updating status', () => {
      processRegistry.register('proc-1', { name: 'process-1', pid: 12345, status: 'running' });
      processRegistry.updateStatus('proc-1', 'completed');
      const updated = processRegistry.get('proc-1');
      expect(updated.name).toBe('process-1');
      expect(updated.pid).toBe(12345);
      expect(updated.status).toBe('completed');
    });

    it('should protect updated data from external modifications', () => {
      processRegistry.register('proc-1', { name: 'process-1', status: 'running' });
      processRegistry.updateStatus('proc-1', 'completed');
      
      const updated = processRegistry.get('proc-1');
      updated.status = 'modified';
      
      const retrievedAgain = processRegistry.get('proc-1');
      expect(retrievedAgain.status).toBe('completed');
    });

    it('should allow multiple status updates', () => {
      processRegistry.register('proc-1', { name: 'process-1', status: 'pending' });
      processRegistry.updateStatus('proc-1', 'running');
      processRegistry.updateStatus('proc-1', 'paused');
      processRegistry.updateStatus('proc-1', 'completed');
      const updated = processRegistry.get('proc-1');
      expect(updated.status).toBe('completed');
    });
  });
});
