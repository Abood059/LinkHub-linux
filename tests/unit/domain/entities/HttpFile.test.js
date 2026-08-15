const HttpFile = require('../../../../src/main/domain/entities/HttpFile');

describe('HttpFile', () => {
  let httpFile;

  beforeEach(() => {
    httpFile = new HttpFile({
      id: 'test-http-id',
      url: 'https://example.com/file.mp4',
      fileName: 'file.mp4',
      storagePath: '/storage/file.mp4',
      mimeType: 'video/mp4',
      status: 'pending'
    });
  });

  describe('constructor', () => {
    it('should create HttpFile with given properties', () => {
      expect(httpFile.id).toBe('test-http-id');
      expect(httpFile.url).toBe('https://example.com/file.mp4');
      expect(httpFile.fileName).toBe('file.mp4');
      expect(httpFile.storagePath).toBe('/storage/file.mp4');
      expect(httpFile.mimeType).toBe('video/mp4');
      expect(httpFile.status).toBe('pending');
    });

    it('should generate random UUID if id is not provided', () => {
      const fileWithoutId = new HttpFile({
        url: 'https://example.com/file.mp4'
      });
      expect(fileWithoutId.id).toBeDefined();
      expect(typeof fileWithoutId.id).toBe('string');
      expect(fileWithoutId.id.length).toBeGreaterThan(0);
    });

    it('should use default empty string for url if not provided', () => {
      const fileWithoutUrl = new HttpFile({});
      expect(fileWithoutUrl.url).toBe('');
    });

    it('should use default empty string for fileName if not provided', () => {
      const fileWithoutFileName = new HttpFile({});
      expect(fileWithoutFileName.fileName).toBe('');
    });

    it('should use default empty string for storagePath if not provided', () => {
      const fileWithoutStoragePath = new HttpFile({});
      expect(fileWithoutStoragePath.storagePath).toBe('');
    });

    it('should use default empty string for mimeType if not provided', () => {
      const fileWithoutMimeType = new HttpFile({});
      expect(fileWithoutMimeType.mimeType).toBe('');
    });

    it('should default status to pending if not provided', () => {
      const fileWithoutStatus = new HttpFile({});
      expect(fileWithoutStatus.status).toBe('pending');
    });

    it('should create default FileStatus when no fileStatus data provided', () => {
      const fileWithoutFileStatus = new HttpFile({
        url: 'https://example.com/file.mp4'
      });
      expect(fileWithoutFileStatus.fileStatus).toBeDefined();
      expect(fileWithoutFileStatus.fileStatus.constructor.name).toBe('FileStatus');
    });

    it('should create FileStatus with fileStatus data when provided', () => {
      const fileWithFileStatus = new HttpFile({
        url: 'https://example.com/file.mp4',
        fileStatus: {
          percentage: 50,
          downloadedBytes: 1000000,
          speed: '1MB/s',
          eta: '10s',
          totalBytes: 2000000,
          isPaused: true
        }
      });
      expect(fileWithFileStatus.fileStatus.percentage).toBe(50);
      expect(fileWithFileStatus.fileStatus.downloadedBytes).toBe(1000000);
      expect(fileWithFileStatus.fileStatus.speed).toBe('1MB/s');
      expect(fileWithFileStatus.fileStatus.eta).toBe('10s');
      expect(fileWithFileStatus.fileStatus.totalBytes).toBe(2000000);
      expect(fileWithFileStatus.fileStatus.isPaused).toBe(true);
    });

    it('should use legacy progress, downloadedBytes, speed, eta, sizeBytes properties if fileStatus not provided', () => {
      const fileWithLegacyProps = new HttpFile({
        url: 'https://example.com/file.mp4',
        progress: 75,
        downloadedBytes: 1500000,
        speed: '2MB/s',
        eta: '5s',
        sizeBytes: 2000000
      });
      expect(fileWithLegacyProps.fileStatus.percentage).toBe(75);
      expect(fileWithLegacyProps.fileStatus.downloadedBytes).toBe(1500000);
      expect(fileWithLegacyProps.fileStatus.speed).toBe('2MB/s');
      expect(fileWithLegacyProps.fileStatus.eta).toBe('5s');
      expect(fileWithLegacyProps.fileStatus.totalBytes).toBe(2000000);
    });

    it('should prioritize fileStatus over legacy properties', () => {
      const fileWithBoth = new HttpFile({
        url: 'https://example.com/file.mp4',
        fileStatus: {
          percentage: 50,
          downloadedBytes: 1000000
        },
        progress: 75,
        downloadedBytes: 1500000
      });
      expect(fileWithBoth.fileStatus.percentage).toBe(50);
      expect(fileWithBoth.fileStatus.downloadedBytes).toBe(1000000);
    });
  });

  describe('updateProgress', () => {
    it('should update fileStatus with progress data', () => {
      httpFile.updateProgress({
        progress: 25,
        downloadedBytes: 500000,
        speed: '500KB/s',
        eta: '20s',
        totalBytes: 2000000
      });
      expect(httpFile.fileStatus.percentage).toBe(25);
      expect(httpFile.fileStatus.downloadedBytes).toBe(500000);
      expect(httpFile.fileStatus.speed).toBe('500KB/s');
      expect(httpFile.fileStatus.eta).toBe('20s');
      expect(httpFile.fileStatus.totalBytes).toBe(2000000);
    });

    it('should not update if progressData is null', () => {
      httpFile.updateProgress(null);
      expect(httpFile.fileStatus.percentage).toBe(0);
    });

    it('should not update if progressData is undefined', () => {
      httpFile.updateProgress(undefined);
      expect(httpFile.fileStatus.percentage).toBe(0);
    });

    it('should update only provided progress properties', () => {
      httpFile.updateProgress({
        progress: 50,
        downloadedBytes: 1000000
      });
      expect(httpFile.fileStatus.percentage).toBe(50);
      expect(httpFile.fileStatus.downloadedBytes).toBe(1000000);
      expect(httpFile.fileStatus.speed).toBe('');
    });
  });

  describe('setStatus', () => {
    it('should update status', () => {
      httpFile.setStatus('downloading');
      expect(httpFile.status).toBe('downloading');
    });

    it('should allow setting to completed', () => {
      httpFile.setStatus('completed');
      expect(httpFile.status).toBe('completed');
    });

    it('should allow setting to failed', () => {
      httpFile.setStatus('failed');
      expect(httpFile.status).toBe('failed');
    });

    it('should allow setting to cancelled', () => {
      httpFile.setStatus('cancelled');
      expect(httpFile.status).toBe('cancelled');
    });
  });

  describe('isCompleted', () => {
    it('should return true when status is completed', () => {
      httpFile.setStatus('completed');
      expect(httpFile.isCompleted()).toBe(true);
    });

    it('should return false when status is not completed', () => {
      expect(httpFile.isCompleted()).toBe(false);
      httpFile.setStatus('downloading');
      expect(httpFile.isCompleted()).toBe(false);
    });
  });

  describe('isFailed', () => {
    it('should return true when status is failed', () => {
      httpFile.setStatus('failed');
      expect(httpFile.isFailed()).toBe(true);
    });

    it('should return false when status is not failed', () => {
      expect(httpFile.isFailed()).toBe(false);
      httpFile.setStatus('downloading');
      expect(httpFile.isFailed()).toBe(false);
    });
  });

  describe('isCancelled', () => {
    it('should return true when status is cancelled', () => {
      httpFile.setStatus('cancelled');
      expect(httpFile.isCancelled()).toBe(true);
    });

    it('should return false when status is not cancelled', () => {
      expect(httpFile.isCancelled()).toBe(false);
      httpFile.setStatus('downloading');
      expect(httpFile.isCancelled()).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return true when status is downloading', () => {
      httpFile.setStatus('downloading');
      expect(httpFile.isActive()).toBe(true);
    });

    it('should return true when status is pending', () => {
      httpFile.setStatus('pending');
      expect(httpFile.isActive()).toBe(true);
    });

    it('should return false when status is completed', () => {
      httpFile.setStatus('completed');
      expect(httpFile.isActive()).toBe(false);
    });

    it('should return false when status is failed', () => {
      httpFile.setStatus('failed');
      expect(httpFile.isActive()).toBe(false);
    });

    it('should return false when status is cancelled', () => {
      httpFile.setStatus('cancelled');
      expect(httpFile.isActive()).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should return object with all properties', () => {
      const json = httpFile.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('url');
      expect(json).toHaveProperty('fileName');
      expect(json).toHaveProperty('storagePath');
      expect(json).toHaveProperty('mimeType');
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('fileStatus');
    });

    it('should include fileStatus as JSON object', () => {
      const json = httpFile.toJSON();
      expect(typeof json.fileStatus).toBe('object');
      expect(json.fileStatus).not.toBeNull();
    });

    it('should return correct values for all properties', () => {
      const json = httpFile.toJSON();
      expect(json.id).toBe('test-http-id');
      expect(json.url).toBe('https://example.com/file.mp4');
      expect(json.fileName).toBe('file.mp4');
      expect(json.storagePath).toBe('/storage/file.mp4');
      expect(json.mimeType).toBe('video/mp4');
      expect(json.status).toBe('pending');
    });
  });

  describe('state consistency', () => {
    it('should document that status and fileStatus.state are independent', () => {
      // HttpFile.status and fileStatus.state are separate properties
      // Changing one does not automatically update the other
      httpFile.setStatus('completed');
      expect(httpFile.status).toBe('completed');
      expect(httpFile.fileStatus.state).toBe('pending'); // Unchanged
      
      httpFile.fileStatus.update({ state: 'completed' });
      expect(httpFile.fileStatus.state).toBe('completed');
      expect(httpFile.status).toBe('completed'); // Unchanged
    });

    it('should document that status change does not auto-update fileStatus.percentage', () => {
      httpFile.setStatus('completed');
      expect(httpFile.status).toBe('completed');
      expect(httpFile.fileStatus.percentage).toBe(0); // Not automatically set to 100
    });

    it('should allow manual synchronization of status and fileStatus', () => {
      // To maintain consistency, both must be updated manually
      httpFile.setStatus('completed');
      httpFile.fileStatus.update({ state: 'completed', percentage: 100 });
      
      expect(httpFile.status).toBe('completed');
      expect(httpFile.fileStatus.state).toBe('completed');
      expect(httpFile.fileStatus.percentage).toBe(100);
    });
  });
});
