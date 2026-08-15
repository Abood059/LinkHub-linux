const FileStatus = require('../../../../src/main/domain/value-objects/FileStatus');

describe('FileStatus', () => {
  let fileStatus;

  beforeEach(() => {
    fileStatus = new FileStatus();
  });

  describe('constructor with defaults', () => {
    it('should create FileStatus with default values', () => {
      expect(fileStatus.percentage).toBe(0);
      expect(fileStatus.speed).toBeNull();
      expect(fileStatus.eta).toBeNull();
      expect(fileStatus.downloadedBytes).toBe(0);
      expect(fileStatus.totalBytes).toBeNull();
      expect(fileStatus.isPaused).toBe(false);
      expect(fileStatus.state).toBe('pending');
    });
  });

  describe('constructor with custom values', () => {
    it('should create FileStatus with custom values', () => {
      const customStatus = new FileStatus({
        percentage: 50,
        speed: '1MB/s',
        eta: '10s',
        downloadedBytes: 1000000,
        totalBytes: 2000000,
        isPaused: true,
        state: 'downloading'
      });
      expect(customStatus.percentage).toBe(50);
      expect(customStatus.speed).toBe('1MB/s');
      expect(customStatus.eta).toBe('10s');
      expect(customStatus.downloadedBytes).toBe(1000000);
      expect(customStatus.totalBytes).toBe(2000000);
      expect(customStatus.isPaused).toBe(true);
      expect(customStatus.state).toBe('downloading');
    });
  });

  describe('percentage validation', () => {
    it('should clamp negative percentage to 0', () => {
      const status = new FileStatus({ percentage: -10 });
      expect(status.percentage).toBe(0);
    });

    it('should clamp percentage above 100 to 100', () => {
      const status = new FileStatus({ percentage: 150 });
      expect(status.percentage).toBe(100);
    });

    it('should accept valid percentage between 0 and 100', () => {
      const status = new FileStatus({ percentage: 75 });
      expect(status.percentage).toBe(75);
    });

    it('should accept 0 as valid percentage', () => {
      const status = new FileStatus({ percentage: 0 });
      expect(status.percentage).toBe(0);
    });

    it('should accept 100 as valid percentage', () => {
      const status = new FileStatus({ percentage: 100 });
      expect(status.percentage).toBe(100);
    });
  });

  describe('state validation', () => {
    it('should accept valid state values', () => {
      const validStates = ['pending', 'downloading', 'completed', 'failed', 'paused', 'cancelled'];
      validStates.forEach(state => {
        const status = new FileStatus({ state });
        expect(status.state).toBe(state);
      });
    });

    it('should default to pending for invalid state', () => {
      const status = new FileStatus({ state: 'invalid_state' });
      expect(status.state).toBe('pending');
    });

    it('should default to pending for null state', () => {
      const status = new FileStatus({ state: null });
      expect(status.state).toBe('pending');
    });

    it('should default to pending for undefined state', () => {
      const status = new FileStatus({ state: undefined });
      expect(status.state).toBe('pending');
    });
  });

  describe('downloadedBytes validation', () => {
    it('should clamp negative downloadedBytes to 0', () => {
      const status = new FileStatus({ downloadedBytes: -100 });
      expect(status.downloadedBytes).toBe(0);
    });

    it('should accept valid downloadedBytes', () => {
      const status = new FileStatus({ downloadedBytes: 1000000 });
      expect(status.downloadedBytes).toBe(1000000);
    });

    it('should accept 0 as valid downloadedBytes', () => {
      const status = new FileStatus({ downloadedBytes: 0 });
      expect(status.downloadedBytes).toBe(0);
    });
  });

  describe('totalBytes validation', () => {
    it('should clamp negative totalBytes to 0', () => {
      const status = new FileStatus({ totalBytes: -100 });
      expect(status.totalBytes).toBe(0);
    });

    it('should accept valid totalBytes', () => {
      const status = new FileStatus({ totalBytes: 2000000 });
      expect(status.totalBytes).toBe(2000000);
    });

    it('should accept null as valid totalBytes', () => {
      const status = new FileStatus({ totalBytes: null });
      expect(status.totalBytes).toBeNull();
    });

    it('should accept 0 as valid totalBytes', () => {
      const status = new FileStatus({ totalBytes: 0 });
      expect(status.totalBytes).toBe(0);
    });
  });

  describe('getters', () => {
    it('should return percentage', () => {
      expect(fileStatus.percentage).toBe(0);
    });

    it('should return speed', () => {
      expect(fileStatus.speed).toBeNull();
    });

    it('should return eta', () => {
      expect(fileStatus.eta).toBeNull();
    });

    it('should return downloadedBytes', () => {
      expect(fileStatus.downloadedBytes).toBe(0);
    });

    it('should return totalBytes', () => {
      expect(fileStatus.totalBytes).toBeNull();
    });

    it('should return isPaused', () => {
      expect(fileStatus.isPaused).toBe(false);
    });

    it('should return state', () => {
      expect(fileStatus.state).toBe('pending');
    });
  });

  describe('update', () => {
    it('should update percentage with validation', () => {
      fileStatus.update({ percentage: 50 });
      expect(fileStatus.percentage).toBe(50);
    });

    it('should clamp percentage on update', () => {
      fileStatus.update({ percentage: 150 });
      expect(fileStatus.percentage).toBe(100);
    });

    it('should update speed', () => {
      fileStatus.update({ speed: '2MB/s' });
      expect(fileStatus.speed).toBe('2MB/s');
    });

    it('should update eta', () => {
      fileStatus.update({ eta: '5s' });
      expect(fileStatus.eta).toBe('5s');
    });

    it('should update totalBytes with validation', () => {
      fileStatus.update({ totalBytes: 3000000 });
      expect(fileStatus.totalBytes).toBe(3000000);
    });

    it('should clamp totalBytes on update', () => {
      fileStatus.update({ totalBytes: -100 });
      expect(fileStatus.totalBytes).toBe(0);
    });

    it('should update downloadedBytes with validation', () => {
      fileStatus.update({ downloadedBytes: 1500000 });
      expect(fileStatus.downloadedBytes).toBe(1500000);
    });

    it('should clamp downloadedBytes on update', () => {
      fileStatus.update({ downloadedBytes: -100 });
      expect(fileStatus.downloadedBytes).toBe(0);
    });

    it('should clamp downloadedBytes to totalBytes if exceeds', () => {
      fileStatus.update({ totalBytes: 2000000 });
      fileStatus.update({ downloadedBytes: 3000000 });
      expect(fileStatus.downloadedBytes).toBe(2000000);
    });

    it('should update isPaused', () => {
      fileStatus.update({ isPaused: true });
      expect(fileStatus.isPaused).toBe(true);
    });

    it('should convert isPaused to boolean', () => {
      fileStatus.update({ isPaused: 1 });
      expect(fileStatus.isPaused).toBe(true);
      fileStatus.update({ isPaused: 0 });
      expect(fileStatus.isPaused).toBe(false);
    });

    it('should update state with validation', () => {
      fileStatus.update({ state: 'downloading' });
      expect(fileStatus.state).toBe('downloading');
    });

    it('should default to pending for invalid state on update', () => {
      fileStatus.update({ state: 'invalid' });
      expect(fileStatus.state).toBe('pending');
    });

    it('should update multiple properties at once', () => {
      fileStatus.update({
        percentage: 75,
        speed: '1.5MB/s',
        eta: '8s',
        downloadedBytes: 1500000,
        totalBytes: 2000000,
        isPaused: false,
        state: 'downloading'
      });
      expect(fileStatus.percentage).toBe(75);
      expect(fileStatus.speed).toBe('1.5MB/s');
      expect(fileStatus.eta).toBe('8s');
      expect(fileStatus.downloadedBytes).toBe(1500000);
      expect(fileStatus.totalBytes).toBe(2000000);
      expect(fileStatus.isPaused).toBe(false);
      expect(fileStatus.state).toBe('downloading');
    });

    it('should not update properties not provided in data', () => {
      fileStatus.update({ percentage: 50 });
      expect(fileStatus.percentage).toBe(50);
      expect(fileStatus.speed).toBeNull();
      expect(fileStatus.eta).toBeNull();
      expect(fileStatus.downloadedBytes).toBe(0);
    });

    it('should handle null data gracefully', () => {
      fileStatus.update(null);
      expect(fileStatus.percentage).toBe(0);
    });

    it('should handle undefined data gracefully', () => {
      fileStatus.update(undefined);
      expect(fileStatus.percentage).toBe(0);
    });

    it('should handle non-object data gracefully', () => {
      fileStatus.update('invalid');
      expect(fileStatus.percentage).toBe(0);
    });

    it('should not change totalBytes when null is passed (keeps previous value)', () => {
      fileStatus.update({ totalBytes: 2000000 });
      fileStatus.update({ totalBytes: null });
      expect(fileStatus.totalBytes).toBe(2000000);
    });
  });

  describe('toJSON', () => {
    it('should return object with all properties', () => {
      const json = fileStatus.toJSON();
      expect(json).toHaveProperty('percentage');
      expect(json).toHaveProperty('speed');
      expect(json).toHaveProperty('eta');
      expect(json).toHaveProperty('downloadedBytes');
      expect(json).toHaveProperty('totalBytes');
      expect(json).toHaveProperty('isPaused');
      expect(json).toHaveProperty('state');
    });

    it('should return correct values for all properties', () => {
      const json = fileStatus.toJSON();
      expect(json).toEqual({
        percentage: 0,
        speed: null,
        eta: null,
        downloadedBytes: 0,
        totalBytes: null,
        isPaused: false,
        state: 'pending'
      });
    });

    it('should return correct values after update', () => {
      fileStatus.update({
        percentage: 50,
        speed: '1MB/s',
        eta: '10s',
        downloadedBytes: 1000000,
        totalBytes: 2000000,
        isPaused: true,
        state: 'downloading'
      });
      const json = fileStatus.toJSON();
      expect(json).toEqual({
        percentage: 50,
        speed: '1MB/s',
        eta: '10s',
        downloadedBytes: 1000000,
        totalBytes: 2000000,
        isPaused: true,
        state: 'downloading'
      });
    });
  });
});
