const AudioFile = require('../../../../src/main/domain/entities/AudioFile');

describe('AudioFile', () => {
  let audioFile;

  beforeEach(() => {
    audioFile = new AudioFile({
      id: 'test-audio-id',
      name: 'test-audio',
      extension: 'mp3',
      sourceUrl: 'https://example.com/audio.mp3',
      storagePath: '/storage/test-audio.mp3',
      formatId: '140',
      abr: 192,
      codec: 'mp3',
      fileSizeApprox: 5000000
    });
  });

  describe('constructor', () => {
    it('should create AudioFile with given properties', () => {
      expect(audioFile.id).toBe('test-audio-id');
      expect(audioFile.name).toBe('test-audio');
      expect(audioFile.extension).toBe('mp3');
      expect(audioFile.sourceUrl).toBe('https://example.com/audio.mp3');
      expect(audioFile.storagePath).toBe('/storage/test-audio.mp3');
      expect(audioFile.formatId).toBe('140');
      expect(audioFile.abr).toBe(192);
      expect(audioFile.codec).toBe('mp3');
      expect(audioFile.fileSizeApprox).toBe(5000000);
    });

    it('should set type to audio automatically', () => {
      expect(audioFile.type).toBe('audio');
    });

    it('should inherit from BaseFile', () => {
      expect(audioFile.fileStatus).toBeDefined();
      expect(audioFile.fileStatus.constructor.name).toBe('FileStatus');
    });

    it('should use default values for audio-specific properties when not provided', () => {
      const audioWithDefaults = new AudioFile({
        name: 'test',
        extension: 'mp3'
      });
      expect(audioWithDefaults.formatId).toBe('');
      expect(audioWithDefaults.abr).toBeNull();
      expect(audioWithDefaults.codec).toBe('');
      expect(audioWithDefaults.fileSizeApprox).toBeNull();
    });

    it('should generate random UUID if id is not provided', () => {
      const audioWithoutId = new AudioFile({
        name: 'test',
        extension: 'mp3'
      });
      expect(audioWithoutId.id).toBeDefined();
      expect(typeof audioWithoutId.id).toBe('string');
      expect(audioWithoutId.id.length).toBeGreaterThan(0);
    });
  });

  describe('audio-specific properties', () => {
    it('should store formatId', () => {
      expect(audioFile.formatId).toBe('140');
    });

    it('should store abr', () => {
      expect(audioFile.abr).toBe(192);
    });

    it('should store codec', () => {
      expect(audioFile.codec).toBe('mp3');
    });

    it('should store fileSizeApprox', () => {
      expect(audioFile.fileSizeApprox).toBe(5000000);
    });
  });

  describe('toJSON', () => {
    it('should include all audio-specific properties in JSON', () => {
      const json = audioFile.toJSON();
      expect(json).toHaveProperty('formatId');
      expect(json).toHaveProperty('abr');
      expect(json).toHaveProperty('codec');
      expect(json).toHaveProperty('fileSizeApprox');
    });

    it('should return correct values for audio-specific properties', () => {
      const json = audioFile.toJSON();
      expect(json.formatId).toBe('140');
      expect(json.abr).toBe(192);
      expect(json.codec).toBe('mp3');
      expect(json.fileSizeApprox).toBe(5000000);
    });

    it('should include inherited properties from BaseFile', () => {
      const json = audioFile.toJSON();
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
    it('should reconstruct AudioFile from JSON data', () => {
      const json = audioFile.toJSON();
      const reconstructed = AudioFile.fromJSON(json);
      expect(reconstructed.id).toBe(audioFile.id);
      expect(reconstructed.name).toBe(audioFile.name);
      expect(reconstructed.extension).toBe(audioFile.extension);
      expect(reconstructed.sourceUrl).toBe(audioFile.sourceUrl);
      expect(reconstructed.storagePath).toBe(audioFile.storagePath);
      expect(reconstructed.type).toBe('audio');
      expect(reconstructed.formatId).toBe(audioFile.formatId);
      expect(reconstructed.abr).toBe(audioFile.abr);
      expect(reconstructed.codec).toBe(audioFile.codec);
      expect(reconstructed.fileSizeApprox).toBe(audioFile.fileSizeApprox);
    });

    it('should handle partial JSON data with defaults', () => {
      const partialData = {
        id: 'partial-id',
        name: 'partial',
        extension: 'mp3'
      };
      const reconstructed = AudioFile.fromJSON(partialData);
      expect(reconstructed.id).toBe('partial-id');
      expect(reconstructed.name).toBe('partial');
      expect(reconstructed.extension).toBe('mp3');
      expect(reconstructed.formatId).toBe('');
      expect(reconstructed.abr).toBeNull();
      expect(reconstructed.codec).toBe('');
      expect(reconstructed.fileSizeApprox).toBeNull();
    });
  });

  describe('round-trip serialization', () => {
    it('should maintain data integrity through toJSON and fromJSON cycle', () => {
      const original = new AudioFile({
        id: 'round-trip-id',
        name: 'round-trip-audio',
        extension: 'mp3',
        sourceUrl: 'https://example.com/audio.mp3',
        storagePath: '/storage/audio.mp3',
        formatId: '140',
        abr: 192,
        codec: 'mp3',
        fileSizeApprox: 5000000
      });

      const json = original.toJSON();
      const reconstructed = AudioFile.fromJSON(json);

      expect(reconstructed.id).toBe(original.id);
      expect(reconstructed.name).toBe(original.name);
      expect(reconstructed.extension).toBe(original.extension);
      expect(reconstructed.sourceUrl).toBe(original.sourceUrl);
      expect(reconstructed.storagePath).toBe(original.storagePath);
      expect(reconstructed.type).toBe(original.type);
      expect(reconstructed.formatId).toBe(original.formatId);
      expect(reconstructed.abr).toBe(original.abr);
      expect(reconstructed.codec).toBe(original.codec);
      expect(reconstructed.fileSizeApprox).toBe(original.fileSizeApprox);
    });
  });
});
