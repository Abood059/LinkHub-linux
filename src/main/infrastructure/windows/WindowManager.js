'use strict';

const { BrowserWindow } = require('electron');

/**
 * WindowManager
 * Responsible for creating, managing, and destroying BrowserWindows.
 * Uses a WindowRegistry for storage.
 * No business logic – only Electron window operations.
 */
class WindowManager {
    constructor(windowRegistry) {
        if (!windowRegistry) {
            throw new Error('WindowManager requires a WindowRegistry instance');
        }
        this._registry = windowRegistry;
    }
    
    /**
     * Create a new BrowserWindow and register it.
     * @param {string} id - Unique identifier for the window
     * @param {object} options - Electron BrowserWindow options
     * @param {string} [options.loadFile] - Path to HTML file to load
     * @param {string} [options.loadURL] - URL to load (alternative to loadFile)
     * @returns {Electron.BrowserWindow} The created window
     */
    createWindow(id, options = {}) {
        if (this._registry.has(id)) {
            throw new Error(`WindowManager: Window with id "${id}" already exists. Close it first or use a different id.`);
        }
        
        // Ensure options is an object
        if (!options || typeof options !== 'object') {
            options = {};
        }
        
        // Merge with default options (deep merge for webPreferences to preserve security defaults)
        const defaultOptions = {
            show: false,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false
            }
        };
        const finalOptions = {
            ...defaultOptions,
            ...options,
            webPreferences: {
                ...defaultOptions.webPreferences,
                ...options.webPreferences
            }
        };
        
        const browserWindow = new BrowserWindow(finalOptions);
        
        // Load content
        if (finalOptions.loadFile) {
            browserWindow.loadFile(finalOptions.loadFile);
        } else if (finalOptions.loadURL) {
            browserWindow.loadURL(finalOptions.loadURL);
        } else {
            throw new Error('WindowManager: No loadFile or loadURL provided');
        }
        
        // Register the window
        this._registry.register(id, browserWindow);
        
        // Auto-unregister when window is closed
        browserWindow.once('closed', () => {
            this._registry.unregister(id);
        });
        
        return browserWindow;
    }
    
    /**
     * Helper to create the main application window with standard settings.
     * @param {object} customOptions - Override default options
     * @returns {Electron.BrowserWindow}
     */
    createMainWindow(customOptions = {}) {
        const path = require('path');
        const fs = require('fs');
        const preloadPath = path.resolve(__dirname, '../../../preload/preload.js');
        console.log('[WindowManager] Preload path (absolute):', preloadPath);
        console.log('[WindowManager] Preload path exists:', fs.existsSync(preloadPath));

        const defaultMainOptions = {
            width: 1200,
            height: 800,
            minWidth: 900,
            minHeight: 600,
            title: 'LinkHub',
            loadFile: path.resolve(__dirname, '../../../renderer/index.html'),
            webPreferences: {
                preload: preloadPath,
                contextIsolation: true,
                nodeIntegration: false
            },
            show: false
        };
        const options = { ...defaultMainOptions, ...customOptions };
        console.log('[WindowManager] Final webPreferences:', options.webPreferences);
        
        const browserWindow = this.createWindow('main', options);
        
        // Add error handling for preload script loading
        browserWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            // Error handled silently
        });
        
        browserWindow.webContents.on('did-finish-load', () => {
            // Window loaded
        });
        
        browserWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
            // Renderer console messages handled silently
        });
        
        return browserWindow;
    }
    
    /**
     * Get a window by id.
     * @param {string} id
     * @returns {Electron.BrowserWindow|null}
     */
    getWindow(id) {
        return this._registry.get(id);
    }
    
    /**
     * Close a window by id. If force is true, destroy immediately.
     * @param {string} id
     * @param {boolean} [force=false] - If true, call destroy() instead of close()
     * @returns {boolean} true if window existed and was closed/destroyed
     */
    closeWindow(id, force = false) {
        const win = this._registry.get(id);
        if (!win) return false;
        
        if (force) {
            win.destroy();
        } else {
            win.close();
        }
        // The 'closed' event will unregister automatically
        return true;
    }
    
    /**
     * Send an IPC message to a specific window.
     * @param {string} id - Window identifier
     * @param {string} channel - IPC channel name
     * @param {any} data - Data to send
     * @returns {boolean} true if window exists and message sent
     */
    sendTo(id, channel, data) {
        const win = this._registry.get(id);
        if (win && !win.isDestroyed()) {
            win.webContents.send(channel, data);
            return true;
        }
        return false;
    }
    
    /**
     * Broadcast an IPC message to all registered windows.
     * @param {string} channel
     * @param {any} data
     */
    broadcast(channel, data) {
        const windows = this._registry.getAll();
        // Only log during startup (before main window is created)
        if (windows.length === 0) {
            console.log(`[WindowManager] broadcast called: channel="${channel}", windows count=${windows.length}, data=`, data);
        }
        for (const win of windows) {
            if (!win.isDestroyed()) {
                win.webContents.send(channel, data);
            }
        }
    }
    
    /**
     * Destroy all windows and clear registry.
     */
    destroyAllWindows() {
        for (const win of this._registry.getAll()) {
            if (!win.isDestroyed()) {
                win.destroy();
            }
        }
        this._registry.clear();
    }
}

module.exports = WindowManager;