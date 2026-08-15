const BaseNode = require('../../../../src/main/domain/entities/BaseNode');

describe('BaseNode', () => {
  let baseNode;

  beforeEach(() => {
    baseNode = new BaseNode({
      id: 'test-id',
      deviceFriendlyName: 'Test Node',
      type: 'TEST_TYPE'
    });
  });

  describe('constructor', () => {
    it('should create a BaseNode with given properties', () => {
      expect(baseNode.id).toBe('test-id');
      expect(baseNode.deviceFriendlyName).toBe('Test Node');
      expect(baseNode.type).toBe('TEST_TYPE');
    });

    it('should accept null/undefined id (though typically passed)', () => {
      const nodeWithNullId = new BaseNode({
        id: null,
        deviceFriendlyName: 'Test',
        type: 'TEST'
      });
      expect(nodeWithNullId.id).toBeNull();
    });
  });

  describe('getters', () => {
    it('should return id through getter', () => {
      expect(baseNode.id).toBe('test-id');
    });

    it('should return type through getter', () => {
      expect(baseNode.type).toBe('TEST_TYPE');
    });

    it('should return friendlyName through getter', () => {
      expect(baseNode.friendlyName).toBe('Test Node');
    });

    it('should return deviceFriendlyName through getter', () => {
      expect(baseNode.deviceFriendlyName).toBe('Test Node');
    });
  });

  describe('toJSON', () => {
    it('should return object with id, deviceFriendlyName, and type', () => {
      const json = baseNode.toJSON();
      expect(json).toEqual({
        id: 'test-id',
        deviceFriendlyName: 'Test Node',
        type: 'TEST_TYPE'
      });
    });

    it('should not include internal properties', () => {
      const json = baseNode.toJSON();
      expect(json).not.toHaveProperty('_id');
      expect(json).not.toHaveProperty('_deviceFriendlyName');
      expect(json).not.toHaveProperty('_type');
    });
  });

  describe('_setFriendlyName (protected setter)', () => {
    it('should update deviceFriendlyName', () => {
      baseNode._setFriendlyName('Updated Name');
      expect(baseNode.deviceFriendlyName).toBe('Updated Name');
    });
  });
});
