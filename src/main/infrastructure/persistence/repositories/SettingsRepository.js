// src/main/infrastructure/persistence/repositories/SettingsRepository.js
'use strict';

const BaseRepository = require('./BaseRepository');

/**
 * SettingsRepository
 *
 * Handles all application settings database operations.
 * Extends BaseRepository with settings-specific methods.
 * Note: Currently not integrated into the main system.
 */
class SettingsRepository extends BaseRepository {
    constructor(db) {
        super(db);
        this._table = 'app_settings';
    }

    /**
     * Get a setting by key
     * @param {string} key - Setting key
     * @returns {string|null} Setting value or null if not found
     */
    getSetting(key) {
        const row = this.executeQueryOne(
            `SELECT value FROM ${this._table} WHERE key = ?`,
            [key]
        );
        return row ? row.value : null;
    }

    /**
     * Set a setting (insert or update)
     * @param {string} key - Setting key
     * @param {string} value - Setting value
     * @returns {Object} The updated/inserted setting
     */
    setSetting(key, value) {
        const existing = this.executeQueryOne(
            `SELECT key FROM ${this._table} WHERE key = ?`,
            [key]
        );

        if (existing) {
            this.executeStatement(
                `UPDATE ${this._table} SET value = ?, updated_at = datetime('now') WHERE key = ?`,
                [value, key]
            );
        } else {
            this.insert(this._table, { key, value });
        }

        return { key, value };
    }

    /**
     * Delete a setting
     * @param {string} key - Setting key
     * @returns {boolean} True if deleted, false if not found
     */
    deleteSetting(key) {
        const result = this.executeStatement(
            `DELETE FROM ${this._table} WHERE key = ?`,
            [key]
        );
        return result.changes > 0;
    }

    /**
     * Get all settings
     * @returns {Object} Object with all key-value pairs
     */
    getAllSettings() {
        const rows = this.executeQuery(`SELECT key, value FROM ${this._table}`);
        const settings = {};
        for (const row of rows) {
            settings[row.key] = row.value;
        }
        return settings;
    }

    /**
     * Get multiple settings by keys
     * @param {Array} keys - Array of setting keys
     * @returns {Object} Object with key-value pairs for the requested keys
     */
    getSettings(keys) {
        const settings = {};
        for (const key of keys) {
            const value = this.getSetting(key);
            if (value !== null) {
                settings[key] = value;
            }
        }
        return settings;
    }

    /**
     * Set multiple settings at once
     * @param {Object} settings - Object with key-value pairs
     * @returns {void}
     */
    setSettings(settings) {
        for (const [key, value] of Object.entries(settings)) {
            this.setSetting(key, value);
        }
    }
}

module.exports = SettingsRepository;
