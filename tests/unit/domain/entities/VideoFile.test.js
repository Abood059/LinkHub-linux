const VideoFile = require('../../../../src/main/domain/entities/VideoFile');

describe('VideoFile', () => {
  let videoFile;

  beforeEach(() => {
    videoFile = new VideoFile({
      id: 'test-video-id',
      name: 'test-video',
      extension: 'mp4',
      sourceUrl: 'https://example.com/video.mp4',
      storagePath: '/storage/test-video.mp4',
      formatId: '137',
      resolution: '1920x1080',
      fps: 30,
      codec: 'h264',
      width: 1920,
      height: 1080,
      fileSizeApprox: 50000000
    });
  });

  describe('constructor', () => {
    it('should create VideoFile with given properties', () => {
      expect(videoFile.id).toBe('test-video-id');
      expect(videoFile.name).toBe('test-video');
      expect(videoFile.extension).toBe('mp4');
      expect(videoFile.sourceUrl).toBe('https://example.com/video.mp4');
      expect(videoFile.storagePath).toBe('/storage/test-video.mp4');
      expect(videoFile.formatId).toBe('137');
      expect(videoFile.resolution).toBe('1920x1080');
      expect(videoFile.fps).toBe(30);
      expect(videoFile.codec).toBe('h264');
      expect(videoFile.width).toBe(1920);
      expect(videoFile.height).toBe(1080);
      expect(videoFile.fileSizeApprox).toBe(50000000);
    });

    it('should set type to video automatically', () => {
      expect(videoFile.type).toBe('video');
    });

    it('should inherit from BaseFile', () => {
      expect(videoFile.fileStatus).toBeDefined();
      expect(videoFile.fileStatus.constructor.name).toBe('FileStatus');
    });

    it('should use default values for video-specific properties when not provided', () => {
      const videoWithDefaults = new VideoFile({
        name: 'test',
        extension: 'mp4'
      });
      expect(videoWithDefaults.formatId).toBe('');
      expect(videoWithDefaults.resolution).toBe('');
      expect(videoWithDefaults.fps).toBeNull();
      expect(videoWithDefaults.codec).toBe('');
      expect(videoWithDefaults.width).toBeNull();
      expect(videoWithDefaults.height).toBeNull();
      expect(videoWithDefaults.fileSizeApprox).toBeNull();
    });

    it('should generate random UUID if id is not provided', () => {
      const videoWithoutId = new VideoFile({
        name: 'test',
        extension: 'mp4'
      });
      expect(videoWithoutId.id).toBeDefined();
      expect(typeof videoWithoutId.id).toBe('string');
      expect(videoWithoutId.id.length).toBeGreaterThan(0);
    });
  });

  describe('video-specific properties', () => {
    it('should store formatId', () => {
      expect(videoFile.formatId).toBe('137');
    });

    it('should store resolution', () => {
      expect(videoFile.resolution).toBe('1920x1080');
    });

    it('should store fps', () => {
      expect(videoFile.fps).toBe(30);
    });

    it('should store codec', () => {
      expect(videoFile.codec).toBe('h264');
    });

    it('should store width', () => {
      expect(videoFile.width).toBe(1920);
    });

    it('should store height', () => {
      expect(videoFile.height).toBe(1080);
    });

    it('should store fileSizeApprox', () => {
      expect(videoFile.fileSizeApprox).toBe(50000000);
    });
  });

  describe('toJSON', () => {
    it('should include all video-specific properties in JSON', () => {
      const json = videoFile.toJSON();
      expect(json).toHaveProperty('formatId');
      expect(json).toHaveProperty('resolution');
      expect(json).toHaveProperty('fps');
      expect(json).toHaveProperty('codec');
      expect(json).toHaveProperty('width');
      expect(json).toHaveProperty('height');
      expect(json).toHaveProperty('fileSizeApprox');
    });

    it('should return correct values for video-specific properties', () => {
      const json = videoFile.toJSON();
      expect(json.formatId).toBe('137');
      expect(json.resolution).toBe('1920x1080');
      expect(json.fps).toBe(30);
      expect(json.codec).toBe('h264');
      expect(json.width).toBe(1920);
      expect(json.height).toBe(1080);
      expect(json.fileSizeApprox).toBe(50000000);
    });

    it('should include inherited properties from BaseFile', () => {
      const json = videoFile.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('extension');
      expect(json).toHaveProperty('sourceUrl');
      expect(json).toHaveProperty('storagePath');
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('fileStatus');
    });
  });

  describe('fromJSON', () => {
    it('should reconstruct VideoFile from JSON data', () => {
      const json = videoFile.toJSON();
      const reconstructed = VideoFile.fromJSON(json);
      expect(reconstructed.id).toBe(videoFile.id);
      expect(reconstructed.name).toBe(videoFile.name);
      expect(reconstructed.extension).toBe(videoFile.extension);
      expect(reconstructed.sourceUrl).toBe(videoFile.sourceUrl);
      expect(reconstructed.storagePath).toBe(videoFile.storagePath);
      expect(reconstructed.type).toBe('video');
      expect(reconstructed.formatId).toBe(videoFile.formatId);
      expect(reconstructed.resolution).toBe(videoFile.resolution);
      expect(reconstructed.fps).toBe(videoFile.fps);
      expect(reconstructed.codec).toBe(videoFile.codec);
      expect(reconstructed.width).toBe(videoFile.width);
      expect(reconstructed.height).toBe(videoFile.height);
      expect(reconstructed.fileSizeApprox).toBe(videoFile.fileSizeApprox);
    });

    it('should handle partial JSON data with defaults', () => {
      const partialData = {
        id: 'partial-id',
        name: 'partial',
        extension: 'mp4'
      };
      const reconstructed = VideoFile.fromJSON(partialData);
      expect(reconstructed.id).toBe('partial-id');
      expect(reconstructed.name).toBe('partial');
      expect(reconstructed.extension).toBe('mp4');
      expect(reconstructed.formatId).toBe('');
      expect(reconstructed.resolution).toBe('');
      expect(reconstructed.fps).toBeNull();
      expect(reconstructed.codec).toBe('');
      expect(reconstructed.width).toBeNull();
      expect(reconstructed.height).toBeNull();
      expect(reconstructed.fileSizeApprox).toBeNull();
    });
  });

  describe('round-trip serialization', () => {
    it('should maintain data integrity through toJSON and fromJSON cycle', () => {
      const original = new VideoFile({
        id: 'round-trip-id',
        name: 'round-trip-video',
        extension: 'mp4',
        sourceUrl: 'https://example.com/video.mp4',
        storagePath: '/storage/video.mp4',
        formatId: '137',
        resolution: '1920x1080',
        fps: 30,
        codec: 'h264',
        width: 1920,
        height: 1080,
        fileSizeApprox: 50000000
      });

      const json = original.toJSON();
      const reconstructed = VideoFile.fromJSON(json);

      expect(reconstructed.id).toBe(original.id);
      expect(reconstructed.name).toBe(original.name);
      expect(reconstructed.extension).toBe(original.extension);
      expect(reconstructed.sourceUrl).toBe(original.sourceUrl);
      expect(reconstructed.storagePath).toBe(original.storagePath);
      expect(reconstructed.type).toBe(original.type);
      expect(reconstructed.formatId).toBe(original.formatId);
      expect(reconstructed.resolution).toBe(original.resolution);
      expect(reconstructed.fps).toBe(original.fps);
      expect(reconstructed.codec).toBe(original.codec);
      expect(reconstructed.width).toBe(original.width);
      expect(reconstructed.height).toBe(original.height);
      expect(reconstructed.fileSizeApprox).toBe(original.fileSizeApprox);
    });
  });
});
