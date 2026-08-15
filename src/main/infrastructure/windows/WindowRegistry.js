'use strict';

/**
 * WindowRegistry
 * Responsible for storing and retrieving BrowserWindow instances.
 * No window creation or lifecycle logic – pure storage.
 */
class WindowRegistry {
    constructor() {
        this._windows = new Map(); // key: string (windowId), value: BrowserWindow
    }
    
    /**
     * Register a window with a unique identifier.
     * @param {string} id - Unique window identifier
     * @param {Electron.BrowserWindow} window - BrowserWindow instance
     * @throws {Error} if id or window is invalid
     */
    register(id, window) {
        if (!id || typeof id !== 'string') {
            throw new Error('WindowRegistry: Invalid window id');
        }
        if (!window || typeof window !== 'object') {
            throw new Error('WindowRegistry: Invalid window object');
        }
        if (this._windows.has(id)) {
            // Optionally warn but allow override? We'll unregister first.
            console.warn(`WindowRegistry: Overwriting existing window with id ${id}`);
        }
        this._windows.set(id, window);
    }
    
    /**
     * Remove a window from registry.
     * @param {string} id
     * @returns {boolean} true if existed and removed
     */
    unregister(id) {
        return this._windows.delete(id);
    }
    
    /**
     * Retrieve a window by id.
     * @param {string} id
     * @returns {Electron.BrowserWindow|null}
     */
    get(id) {
        return this._windows.get(id) || null;
    }
    
    /**
     * Check if a window id exists.
     * @param {string} id
     * @returns {boolean}
     */
    has(id) {
        return this._windows.has(id);
    }
    
    /**
     * Get all registered window instances.
     * @returns {Electron.BrowserWindow[]}
     */
    getAll() {
        return Array.from(this._windows.values());
    }
    
    /**
     * Clear all windows from registry (does not destroy them).
     */
    clear() {
        this._windows.clear();
    }
}

module.exports = WindowRegistry;