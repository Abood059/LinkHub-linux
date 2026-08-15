const Device = require('../../../../src/main/domain/entities/Device');

describe('Device', () => {
  let device;

  beforeEach(() => {
    device = new Device({
      id: 'test-device-id',
      deviceFriendlyName: 'Test Device',
      model: 'Pixel 6',
      version: '13',
      arch: 'arm64',
      isNew: true
    });
  });

  describe('constructor', () => {
    it('should create device with given properties', () => {
      expect(device.id).toBe('test-device-id');
      expect(device.deviceFriendlyName).toBe('Test Device');
      expect(device.model).toBe('Pixel 6');
      expect(device.version).toBe('13');
      expect(device.arch).toBe('arm64');
      expect(device.isNew).toBe(true);
    });

    it('should set type to MOBILE automatically', () => {
      expect(device.type).toBe('MOBILE');
    });

    it('should use default values for model, version, arch when not provided', () => {
      const deviceWithDefaults = new Device({
        id: 'test-id',
        deviceFriendlyName: 'Test'
      });
      expect(deviceWithDefaults.model).toBe('Unknown');
      expect(deviceWithDefaults.version).toBe('Unknown');
      expect(deviceWithDefaults.arch).toBe('Unknown');
    });

    it('should default isNew to true when not provided', () => {
      const deviceWithoutIsNew = new Device({
        id: 'test-id',
        deviceFriendlyName: 'Test'
      });
      expect(deviceWithoutIsNew.isNew).toBe(true);
    });

    it('should allow setting isNew to false', () => {
      const deviceNotNew = new Device({
        id: 'test-id',
        deviceFriendlyName: 'Test',
        isNew: false
      });
      expect(deviceNotNew.isNew).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return model', () => {
      expect(device.model).toBe('Pixel 6');
    });

    it('should return version', () => {
      expect(device.version).toBe('13');
    });

    it('should return arch', () => {
      expect(device.arch).toBe('arm64');
    });

    it('should return isNew', () => {
      expect(device.isNew).toBe(true);
    });
  });

  describe('updateDetails', () => {
    it('should update model, version, arch and set isNew to false', () => {
      device.updateDetails('Pixel 8', '14', 'arm64-v8a');
      expect(device.model).toBe('Pixel 8');
      expect(device.version).toBe('14');
      expect(device.arch).toBe('arm64-v8a');
      expect(device.isNew).toBe(false);
    });

    it('should not update properties if null is passed', () => {
      device.updateDetails(null, null, null);
      expect(device.model).toBe('Pixel 6');
      expect(device.version).toBe('13');
      expect(device.arch).toBe('arm64');
      expect(device.isNew).toBe(false); // Still sets isNew to false
    });

    it('should not update properties if undefined is passed', () => {
      device.updateDetails(undefined, undefined, undefined);
      expect(device.model).toBe('Pixel 6');
      expect(device.version).toBe('13');
      expect(device.arch).toBe('arm64');
      expect(device.isNew).toBe(false); // Still sets isNew to false
    });

    it('should update only provided properties', () => {
      device.updateDetails('Pixel 8', null, null);
      expect(device.model).toBe('Pixel 8');
      expect(device.version).toBe('13');
      expect(device.arch).toBe('arm64');
    });

    it('should not update if non-string values are passed', () => {
      device.updateDetails(123, {}, []);
      expect(device.model).toBe('Pixel 6');
      expect(device.version).toBe('13');
      expect(device.arch).toBe('arm64');
    });

    it('should set isNew to false even if no properties are updated', () => {
      device.updateDetails(null, null, null);
      expect(device.isNew).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should include inherited properties from BaseNode', () => {
      const json = device.toJSON();
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('deviceFriendlyName');
      expect(json).toHaveProperty('type');
    });

    it('should include Device-specific properties', () => {
      const json = device.toJSON();
      expect(json).toHaveProperty('model');
      expect(json).toHaveProperty('version');
      expect(json).toHaveProperty('arch');
      expect(json).toHaveProperty('isNew');
    });

    it('should return correct values for all properties', () => {
      const json = device.toJSON();
      expect(json).toEqual({
        id: 'test-device-id',
        deviceFriendlyName: 'Test Device',
        type: 'MOBILE',
        model: 'Pixel 6',
        version: '13',
        arch: 'arm64',
        isNew: true
      });
    });
  });

  describe('fromJSON', () => {
    it('should reconstruct Device from JSON data', () => {
      const data = {
        id: 'reconstructed-id',
        deviceFriendlyName: 'Reconstructed Device',
        model: 'Pixel 7',
        version: '14',
        arch: 'arm64-v8a',
        isNew: false
      };
      const reconstructed = Device.fromJSON(data);
      expect(reconstructed.id).toBe('reconstructed-id');
      expect(reconstructed.deviceFriendlyName).toBe('Reconstructed Device');
      expect(reconstructed.model).toBe('Pixel 7');
      expect(reconstructed.version).toBe('14');
      expect(reconstructed.arch).toBe('arm64-v8a');
      expect(reconstructed.isNew).toBe(false);
    });

    it('should handle friendly_name as alternative to deviceFriendlyName', () => {
      const data = {
        id: 'test-id',
        friendly_name: 'Friendly Name Device',
        model: 'Pixel 5',
        version: '12',
        arch: 'x86',
        isNew: true
      };
      const reconstructed = Device.fromJSON(data);
      expect(reconstructed.deviceFriendlyName).toBe('Friendly Name Device');
    });

    it('should default deviceFriendlyName if neither provided', () => {
      const data = {
        id: 'test-id',
        model: 'Pixel 5',
        version: '12',
        arch: 'x86'
      };
      const reconstructed = Device.fromJSON(data);
      expect(reconstructed.deviceFriendlyName).toBeUndefined();
    });
  });

  describe('round-trip serialization', () => {
    it('should maintain data integrity through toJSON and fromJSON cycle', () => {
      const original = new Device({
        id: 'round-trip-id',
        deviceFriendlyName: 'Round Trip Device',
        model: 'Pixel 6',
        version: '13',
        arch: 'arm64',
        isNew: true
      });

      const json = original.toJSON();
      const reconstructed = Device.fromJSON(json);

      expect(reconstructed.id).toBe(original.id);
      expect(reconstructed.deviceFriendlyName).toBe(original.deviceFriendlyName);
      expect(reconstructed.type).toBe(original.type);
      expect(reconstructed.model).toBe(original.model);
      expect(reconstructed.version).toBe(original.version);
      expect(reconstructed.arch).toBe(original.arch);
      expect(reconstructed.isNew).toBe(original.isNew);
    });

    it('should maintain data integrity after updateDetails in round-trip', () => {
      const original = new Device({
        id: 'round-trip-id',
        deviceFriendlyName: 'Round Trip Device',
        model: 'Pixel 6',
        version: '13',
        arch: 'arm64',
        isNew: true
      });

      original.updateDetails('Pixel 8', '14', 'arm64-v8a');

      const json = original.toJSON();
      const reconstructed = Device.fromJSON(json);

      expect(reconstructed.id).toBe(original.id);
      expect(reconstructed.model).toBe('Pixel 8');
      expect(reconstructed.version).toBe('14');
      expect(reconstructed.arch).toBe('arm64-v8a');
      expect(reconstructed.isNew).toBe(false);
    });
  });
});
