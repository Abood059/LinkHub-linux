// src/main/infrastructure/persistence/repositories/DeviceRepository.js
'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * DeviceRepository
 *
 * Handles all device-related database operations.
 * Extends BaseRepository with device-specific methods.
 */
class DeviceRepository extends BaseRepository {
    constructor(db) {
        super(db);
        this._table = 'devices';
        this._fieldMapping = {
            deviceFriendlyName: 'device_friendly_name',
            isFavorite: 'is_favorite',
            isTrusted: 'is_trusted',
            videoTransferred: 'video_transferred',
            customName: 'custom_name'
        };
    }

    /**
     * Map domain object (CamelCase) to database format (Snake_case)
     * @param {Object} data - Domain object with CamelCase keys
     * @returns {Object} Database object with Snake_case keys
     */
    _mapToDbFormat(data) {
        const dbData = {};
        // Fields to exclude from database storage
        const excludedFields = ['type', 'createdAt', 'updatedAt'];
        
        for (const [key, value] of Object.entries(data)) {
            // Skip excluded fields
            if (excludedFields.includes(key)) continue;
            
            const dbKey = this._fieldMapping[key] || key;
            // Convert boolean to integer for SQLite
            if (typeof value === 'boolean') {
                dbData[dbKey] = value ? 1 : 0;
            } else {
                dbData[dbKey] = value;
            }
        }
        return dbData;
    }

    /**
     * Map database object (Snake_case) to domain format (CamelCase)
     * @param {Object} data - Database object with Snake_case keys
     * @returns {Object} Domain object with CamelCase keys
     */
    _mapFromDbFormat(data) {
        if (!data) return null;
        const domainData = {};
        const reverseMapping = Object.fromEntries(
            Object.entries(this._fieldMapping).map(([k, v]) => [v, k])
        );
        for (const [key, value] of Object.entries(data)) {
            const domainKey = reverseMapping[key] || key;
            // Convert integer to boolean for specific fields
            if (key === 'is_favorite' || key === 'is_trusted') {
                domainData[domainKey] = value === 1;
            } else {
                domainData[domainKey] = value;
            }
        }
        return domainData;
    }

    /**
     * Insert a new device
     * @param {Object} device - Device object to insert (CamelCase format)
     * @returns {Object} The inserted device (CamelCase format)
     */
    insertDevice(device) {
        const dbData = this._mapToDbFormat(device);
        const result = this.insert(this._table, dbData);
        return this._mapFromDbFormat(result);
    }

    /**
     * Update an existing device
     * @param {string} deviceId - Device ID
     * @param {Object} data - Data to update (CamelCase format)
     * @returns {Object|null} The updated device (CamelCase format) or null if not found
     */
    updateDevice(deviceId, data) {
        const dbData = this._mapToDbFormat(data);
        const result = this.update(this._table, deviceId, dbData);
        return this._mapFromDbFormat(result);
    }

    /**
     * Delete a device
     * @param {string} deviceId - Device ID
     * @returns {boolean} True if deleted, false if not found
     */
    deleteDevice(deviceId) {
        return this.delete(this._table, deviceId);
    }

    /**
     * Find a device by ID
     * @param {string} deviceId - Device ID
     * @returns {Object|null} The device (CamelCase format) or null if not found
     */
    findDeviceById(deviceId) {
        const result = this.findById(this._table, deviceId);
        return this._mapFromDbFormat(result);
    }

    /**
     * Find all devices (only favorites)
     * @returns {Array} Array of favorite devices (CamelCase format)
     */
    findAllDevices() {
        const results = this.executeQuery(
            `SELECT * FROM ${this._table} WHERE is_favorite = 1 ORDER BY created_at DESC`
        );
        return results.map(row => this._mapFromDbFormat(row));
    }

    /**
     * Find favorite devices
     * @returns {Array} Array of favorite devices (CamelCase format)
     */
    findFavoriteDevices() {
        const results = this.executeQuery(
            `SELECT * FROM ${this._table} WHERE is_favorite = 1 ORDER BY created_at DESC`
        );
        return results.map(row => this._mapFromDbFormat(row));
    }

    /**
     * Find trusted devices
     * @returns {Array} Array of trusted devices (CamelCase format)
     */
    findTrustedDevices() {
        const results = this.executeQuery(
            `SELECT * FROM ${this._table} WHERE is_trusted = 1 ORDER BY created_at DESC`
        );
        return results.map(row => this._mapFromDbFormat(row));
    }

    /**
     * Find untrusted devices
     * @returns {Array} Array of untrusted devices (CamelCase format)
     */
    findUntrustedDevices() {
        const results = this.executeQuery(
            `SELECT * FROM ${this._table} WHERE is_trusted = 0 ORDER BY created_at DESC`
        );
        return results.map(row => this._mapFromDbFormat(row));
    }

    /**
     * Update device favorite status
     * @param {string} deviceId - Device ID
     * @param {boolean} isFavorite - Favorite status
     * @returns {Object|null} The updated device (CamelCase format) or null if not found
     */
    updateFavorite(deviceId, isFavorite) {
        const result = this.update(this._table, deviceId, { is_favorite: isFavorite ? 1 : 0 });
        return this._mapFromDbFormat(result);
    }

    /**
     * Update device trusted status
     * @param {string} deviceId - Device ID
     * @param {boolean} isTrusted - Trusted status
     * @returns {Object|null} The updated device (CamelCase format) or null if not found
     */
    updateTrusted(deviceId, isTrusted) {
        const result = this.update(this._table, deviceId, { is_trusted: isTrusted ? 1 : 0 });
        return this._mapFromDbFormat(result);
    }

    /**
     * Update device video transferred count
     * @param {string} deviceId - Device ID
     * @param {number} count - Video transferred count
     * @returns {Object|null} The updated device (CamelCase format) or null if not found
     */
    updateVideoTransferred(deviceId, count) {
        const result = this.update(this._table, deviceId, { video_transferred: count });
        return this._mapFromDbFormat(result);
    }

    /**
     * Update device custom name
     * @param {string} deviceId - Device ID
     * @param {string} customName - Custom name
     * @returns {Object|null} The updated device (CamelCase format) or null if not found
     */
    updateCustomName(deviceId, customName) {
        const result = this.update(this._table, deviceId, { custom_name: customName });
        return this._mapFromDbFormat(result);
    }

}

module.exports = DeviceRepository;
