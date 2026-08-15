const BaseFile = require('../../../../src/main/domain/entities/BaseFile');

describe('BaseFile', () => {
  let baseFile;

  beforeEach(() => {
    baseFile = new BaseFile({
      id: 'test-file-id',
      name: 'test-file',
      extension: 'mp4',
      sourceUrl: 'https://example.com/video.mp4',
      storagePath: '/storage/test-file.mp4',
      type: 'video'
    });
  });

  describe('constructor', () => {
    it('should create BaseFile with given properties', () => {
      expect(baseFile.id).toBe('test-file-id');
      expect(baseFile.name).toBe('test-file');
      expect(baseFile.extension).toBe('mp4');
      expect(baseFile.sourceUrl).toBe('https://example.com/video.mp4');
      expect(baseFile.storagePath).toBe('/storage/test-file.mp4');
      expect(baseFile.type).toBe('video');
    });

    it('should generate random UUID if id is not provided', () => {
      const fileWithoutId = new BaseFile({
        name: 'test',
        extension: 'mp4',
        type: 'video'
      });
      expect(fileWithoutId.id).toBeDefined();
      expect(typeof fileWithoutId.id).toBe('string');
      expect(fileWithoutId.id.length).toBeGreaterThan(0);
    });

    it('should use default empty string for name if not provided', () => {
      const fileWithoutName = new BaseFile({
        type: 'video'
      });
      expect(fileWithoutName.name).toBe('');
    });

    it('should use default empty string for extension if not provided', () => {
      const fileWithoutExtension = new BaseFile({
        type: 'video'
      });
      expect(fileWithoutExtension.extension).toBe('');
    });

    it('should use default empty string for sourceUrl if not provided', () => {
      const fileWithoutSourceUrl = new BaseFile({
        type: 'video'
      });
      expect(fileWithoutSourceUrl.sourceUrl).toBe('');
    });

    it('should use default null for storagePath if not provided', () => {
      const fileWithoutStoragePath = new BaseFile({
        type: 'video'
      });
      expect(fileWithoutStoragePath.storagePath).toBeNull();
    });

    it('should use default null for type if not provided', () => {
      const fileWithoutType = new BaseFile({});
      expect(fileWithoutType.type).toBeNull();
    });

    it('should create default FileStatus instance', () => {
      expect(baseFile.fileStatus).toBeDefined();
      expect(baseFile.fileStatus.constructor.name).toBe('FileStatus');
    });
  });

  describe('toJSON', () => {
    it('should return object with all properties', () => {
      const json = baseFile.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('extension');
      expect(json).toHaveProperty('sourceUrl');
      expect(json).toHaveProperty('storagePath');
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('fileStatus');
    });

    it('should include fileStatus as JSON object', () => {
      const json = baseFile.toJSON();
      expect(typeof json.fileStatus).toBe('object');
      expect(json.fileStatus).not.toBeNull();
    });

    it('should return correct values for all properties', () => {
      const json = baseFile.toJSON();
      expect(json.id).toBe('test-file-id');
      expect(json.name).toBe('test-file');
      expect(json.extension).toBe('mp4');
      expect(json.sourceUrl).toBe('https://example.com/video.mp4');
      expect(json.storagePath).toBe('/storage/test-file.mp4');
      expect(json.type).toBe('video');
    });
  });
});
