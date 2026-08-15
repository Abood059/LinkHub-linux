// src/main/infrastructure/persistence/repositories/BaseRepository.js
'use strict';

/**
 * BaseRepository
 *
 * Provides common CRUD operations for all repositories.
 * Handles database connection management and error handling.
 */
class BaseRepository {
    constructor(db) {
        if (!db) {
            throw new Error('Database connection is required');
        }
        this._db = db;
    }

    /**
     * Get the database connection
     */
    get db() {
        return this._db;
    }

    /**
     * Ensure the database connection is open before operations
     * @throws {Error} If the database connection is not open
     */
    _ensureConnectionOpen() {
        if (!this._db || !this._db.open) {
            throw new Error('The database connection is not open');
        }
    }

    /**
     * Find a record by ID
     * @param {string} table - Table name
     * @param {string} id - Record ID
     * @returns {Object|null} The record or null if not found
     */
    findById(table, id) {
        try {
            this._ensureConnectionOpen();
            const stmt = this._db.prepare(`SELECT * FROM ${table} WHERE id = ?`);
            const row = stmt.get(id);
            return row || null;
        } catch (error) {
            console.error(`[BaseRepository] Error finding by ID in ${table}:`, error);
            throw error;
        }
    }

    /**
     * Find all records in a table
     * @param {string} table - Table name
     * @returns {Array} Array of records
     */
    findAll(table) {
        try {
            this._ensureConnectionOpen();
            const stmt = this._db.prepare(`SELECT * FROM ${table}`);
            return stmt.all();
        } catch (error) {
            console.error(`[BaseRepository] Error finding all in ${table}:`, error);
            throw error;
        }
    }

    /**
     * Insert a new record
     * @param {string} table - Table name
     * @param {Object} data - Data to insert
     * @returns {Object} The inserted record
     */
    insert(table, data) {
        try {
            this._ensureConnectionOpen();
            const keys = Object.keys(data);
            const values = Object.values(data);
            const placeholders = keys.map(() => '?').join(', ');
            const columns = keys.join(', ');

            const stmt = this._db.prepare(
                `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`
            );
            const result = stmt.run(...values);

            // Return the inserted record
            return this.findById(table, data.id);
        } catch (error) {
            console.error(`[BaseRepository] Error inserting into ${table}:`, error);
            throw error;
        }
    }

    /**
     * Update a record by ID
     * @param {string} table - Table name
     * @param {string} id - Record ID
     * @param {Object} data - Data to update
     * @returns {Object|null} The updated record or null if not found
     */
    update(table, id, data) {
        try {
            this._ensureConnectionOpen();
            // Exclude 'id' from data as it's only used in WHERE clause
            const { id: _, ...dataWithoutId } = data;
            const keys = Object.keys(dataWithoutId);
            const values = Object.values(dataWithoutId);
            const setClause = keys.map(key => `${key} = ?`).join(', ');

            const stmt = this._db.prepare(
                `UPDATE ${table} SET ${setClause}, updated_at = datetime('now') WHERE id = ?`
            );
            const result = stmt.run(...values, id);

            if (result.changes === 0) {
                return null;
            }

            return this.findById(table, id);
        } catch (error) {
            console.error(`[BaseRepository] Error updating in ${table}:`, error);
            throw error;
        }
    }

    /**
     * Delete a record by ID
     * @param {string} table - Table name
     * @param {string} id - Record ID
     * @returns {boolean} True if deleted, false if not found
     */
    delete(table, id) {
        try {
            this._ensureConnectionOpen();
            const stmt = this._db.prepare(`DELETE FROM ${table} WHERE id = ?`);
            const result = stmt.run(id);
            return result.changes > 0;
        } catch (error) {
            console.error(`[BaseRepository] Error deleting from ${table}:`, error);
            throw error;
        }
    }

    /**
     * Execute a custom query
     * @param {string} query - SQL query
     * @param {Array} params - Query parameters
     * @returns {Array} Query results
     */
    executeQuery(query, params = []) {
        try {
            this._ensureConnectionOpen();
            const stmt = this._db.prepare(query);
            return stmt.all(...params);
        } catch (error) {
            console.error('[BaseRepository] Error executing query:', error);
            throw error;
        }
    }

    /**
     * Execute a custom query that returns a single row
     * @param {string} query - SQL query
     * @param {Array} params - Query parameters
     * @returns {Object|null} Single row or null
     */
    executeQueryOne(query, params = []) {
        try {
            this._ensureConnectionOpen();
            const stmt = this._db.prepare(query);
            return stmt.get(...params) || null;
        } catch (error) {
            console.error('[BaseRepository] Error executing query (one):', error);
            throw error;
        }
    }

    /**
     * Execute a custom statement (INSERT, UPDATE, DELETE)
     * @param {string} query - SQL query
     * @param {Array} params - Query parameters
     * @returns {Object} Result object with changes info
     */
    executeStatement(query, params = []) {
        try {
            this._ensureConnectionOpen();
            const stmt = this._db.prepare(query);
            return stmt.run(...params);
        } catch (error) {
            console.error('[BaseRepository] Error executing statement:', error);
            throw error;
        }
    }
}

module.exports = BaseRepository;
