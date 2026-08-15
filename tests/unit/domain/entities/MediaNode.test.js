const MediaNode = require('../../../../src/main/domain/entities/MediaNode');

describe('MediaNode', () => {
  let mediaNode;

  beforeEach(() => {
    mediaNode = new MediaNode({
      id: 'test-media-id',
      deviceFriendlyName: 'Test Media Node'
    });
  });

  describe('constructor', () => {
    it('should create MediaNode with given properties', () => {
      expect(mediaNode.id).toBe('test-media-id');
      expect(mediaNode.deviceFriendlyName).toBe('Test Media Node');
    });

    it('should set type to MEDIA_NODE automatically', () => {
      expect(mediaNode.type).toBe('MEDIA_NODE');
    });

    it('should initialize activeTasks as empty array', () => {
      expect(mediaNode.activeTasks).toEqual([]);
      expect(Array.isArray(mediaNode.activeTasks)).toBe(true);
    });

    it('should inherit from BaseNode', () => {
      expect(mediaNode.id).toBeDefined();
      expect(mediaNode.type).toBeDefined();
      expect(mediaNode.deviceFriendlyName).toBeDefined();
    });
  });

  describe('addTask', () => {
    it('should add task to activeTasks', () => {
      const task = { url: 'https://example.com/video.mp4', progress: 0 };
      mediaNode.addTask(task);
      expect(mediaNode.activeTasks).toHaveLength(1);
      expect(mediaNode.activeTasks[0]).toEqual(task);
    });

    it('should add multiple tasks', () => {
      const task1 = { url: 'https://example.com/video1.mp4', progress: 0 };
      const task2 = { url: 'https://example.com/video2.mp4', progress: 50 };
      mediaNode.addTask(task1);
      mediaNode.addTask(task2);
      expect(mediaNode.activeTasks).toHaveLength(2);
      expect(mediaNode.activeTasks[0]).toEqual(task1);
      expect(mediaNode.activeTasks[1]).toEqual(task2);
    });

    it('should allow adding any type of task object', () => {
      const task = { id: 'task-123', type: 'download' };
      mediaNode.addTask(task);
      expect(mediaNode.activeTasks).toHaveLength(1);
      expect(mediaNode.activeTasks[0]).toEqual(task);
    });
  });

  describe('toJSON', () => {
    it('should return object with inherited properties from BaseNode', () => {
      const json = mediaNode.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('deviceFriendlyName');
      expect(json).toHaveProperty('type');
    });

    it('should return correct values for inherited properties', () => {
      const json = mediaNode.toJSON();
      expect(json.id).toBe('test-media-id');
      expect(json.deviceFriendlyName).toBe('Test Media Node');
      expect(json.type).toBe('MEDIA_NODE');
    });

    it('should not include activeTasks in JSON (as per implementation)', () => {
      const json = mediaNode.toJSON();
      expect(json).not.toHaveProperty('activeTasks');
    });
  });

  describe('fromJSON', () => {
    it('should reconstruct MediaNode from JSON data', () => {
      const data = {
        id: 'reconstructed-id',
        deviceFriendlyName: 'Reconstructed Media Node'
      };
      const reconstructed = MediaNode.fromJSON(data);
      expect(reconstructed.id).toBe('reconstructed-id');
      expect(reconstructed.deviceFriendlyName).toBe('Reconstructed Media Node');
      expect(reconstructed.type).toBe('MEDIA_NODE');
      expect(reconstructed.activeTasks).toEqual([]);
    });

    it('should create new MediaNode with provided data', () => {
      const data = {
        id: 'new-id',
        deviceFriendlyName: 'New Node'
      };
      const newNode = MediaNode.fromJSON(data);
      expect(newNode).toBeInstanceOf(MediaNode);
    });
  });

  describe('round-trip serialization', () => {
    it('should maintain data integrity through toJSON and fromJSON cycle', () => {
      const original = new MediaNode({
        id: 'round-trip-id',
        deviceFriendlyName: 'Round Trip Media Node'
      });

      const json = original.toJSON();
      const reconstructed = MediaNode.fromJSON(json);

      expect(reconstructed.id).toBe(original.id);
      expect(reconstructed.deviceFriendlyName).toBe(original.deviceFriendlyName);
      expect(reconstructed.type).toBe(original.type);
      expect(reconstructed.activeTasks).toEqual([]);
    });
  });

  describe('activeTasks isolation from toJSON', () => {
    it('should not include activeTasks in toJSON output', () => {
      mediaNode.addTask({ url: 'https://example.com/video.mp4', progress: 0 });
      mediaNode.addTask({ url: 'https://example.com/video2.mp4', progress: 50 });

      const json = mediaNode.toJSON();
      expect(json).not.toHaveProperty('activeTasks');
    });

    it('should maintain activeTasks separately from serialization', () => {
      mediaNode.addTask({ url: 'https://example.com/video.mp4', progress: 0 });
      mediaNode.addTask({ url: 'https://example.com/video2.mp4', progress: 50 });

      const json = mediaNode.toJSON();
      expect(mediaNode.activeTasks).toHaveLength(2);
      expect(json).not.toHaveProperty('activeTasks');

      const reconstructed = MediaNode.fromJSON(json);
      expect(reconstructed.activeTasks).toEqual([]);
      expect(reconstructed.activeTasks).not.toEqual(mediaNode.activeTasks);
    });
  });
});
