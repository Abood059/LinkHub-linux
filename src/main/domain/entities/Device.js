// src/main/domain/entities/Device.js
const BaseNode = require('./BaseNode');

/**
 * Pure device entity.
 * Contains immutable definitional data but allows controlled updates
 * for device details (model, version, arch) after connection.
 */
class Device extends BaseNode {
    constructor({
        id,
        deviceFriendlyName,
        model,
        version,
        arch,
        isFavorite,
        isTrusted,
        customName
    }) {
        super({
            id,
            deviceFriendlyName,
            type: 'MOBILE'
        });

        this._model = model || 'Unknown';
        this._version = version || 'Unknown';
        this._arch = arch || 'Unknown';
        this._isFavorite = isFavorite ?? false;
        this._isTrusted = isTrusted ?? true;
        this._customName = customName || null;

        // No freeze - allows updateDetails
    }

    // --- Read-only getters ---
    get model() {
        return this._model;
    }

    get version() {
        return this._version;
    }

    get arch() {
        return this._arch;
    }


    get isFavorite() {
        return this._isFavorite;
    }

    get isTrusted() {
        return this._isTrusted;
    }

    get customName() {
        return this._customName;
    }

    /**
     * Update device details after obtaining real information from ADB.
     * @param {string} model - Device model
     * @param {string} version - Android version
     * @param {string} arch - CPU architecture
     */
    updateDetails(model, version, arch) {
        if (model && typeof model === 'string') this._model = model;
        if (version && typeof version === 'string') this._version = version;
        if (arch && typeof arch === 'string') this._arch = arch;
    }

    /**
     * Set device favorite status.
     * @param {boolean} isFavorite - Favorite status
     */
    setFavorite(isFavorite) {
        this._isFavorite = isFavorite;
    }

    /**
     * Set device trusted status.
     * @param {boolean} isTrusted - Trusted status
     */
    setTrusted(isTrusted) {
        this._isTrusted = isTrusted;
    }

    /**
     * Set device custom name.
     * @param {string} customName - Custom name
     */
    setCustomName(customName) {
        this._customName = customName;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            model: this._model,
            version: this._version,
            arch: this._arch,
            isFavorite: this._isFavorite,
            isTrusted: this._isTrusted,
            customName: this._customName
        };
    }

    static fromJSON(data) {
        return new Device({
            id: data.id,
            deviceFriendlyName: data.deviceFriendlyName || data.friendly_name,
            model: data.model,
            version: data.version,
            arch: data.arch,
            isFavorite: data.isFavorite,
            isTrusted: data.isTrusted,
            customName: data.customName || data.custom_name
        });
    }
}

module.exports = Device;