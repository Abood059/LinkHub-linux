// src/main/domain/entities/BaseNode.js
/**
 * Pure base entity for all nodes/devices in the system.
 * Contains only immutable identity and structural data.
 * 
 * NOTE: Instances are NOT frozen to allow updates in derived classes.
 */
class BaseNode {
    constructor({ id, deviceFriendlyName, type }) {
        this._id = id;
        this._deviceFriendlyName = deviceFriendlyName;
        this._type = type;
        // No longer freezing - allows controlled updates in subclasses
    }

    // --- Read-only getters (but internal setters exist for updates) ---
    get id() {
        return this._id;
    }

    get type() {
        return this._type;
    }

    get friendlyName() {
        return this._deviceFriendlyName;
    }

    get deviceFriendlyName() {
        return this._deviceFriendlyName;
    }

    // Protected setter for controlled updates (used by Device.updateDetails)
    _setFriendlyName(name) {
        this._deviceFriendlyName = name;
    }

    toJSON() {
        return {
            id: this._id,
            deviceFriendlyName: this._deviceFriendlyName,
            type: this._type
        };
    }
}

module.exports = BaseNode;