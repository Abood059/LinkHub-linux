/**
 * preload.js
 * 
 * Safe bridge between renderer process and main process.
 * Exposes a limited, secure API via contextBridge.
 * 
 * NO business logic, NO direct access to Node.js APIs.
 */

const { contextBridge, ipcRenderer } = require('electron');

// ============================================================================
// 1. Devices API
// ============================================================================

const devicesAPI = {
    /**
     * Get all registered devices with their runtime state.
     * @returns {Promise<Array>}
     */
    getAll: () => ipcRenderer.invoke('device:list'),
    
    /**
     * Get a single device by ID.
     * @param {string} deviceId
     * @returns {Promise<Object|null>}
     */
    get: (deviceId) => ipcRenderer.invoke('device:get', deviceId),
    
    /**
     * Pair with a wireless device.
     * @param {string} host - e.g., "192.168.1.10:37000"
     * @param {string} pairingCode - 6-digit code
     * @returns {Promise<string[]>}
     */
    pair: (host, pairingCode) => ipcRenderer.invoke('device:pair', host, pairingCode),
    
    /**
     * Connect to a device (USB serial or TCP/IP host:port).
     * @param {string} target - e.g., "emulator-5554" or "192.168.1.10:5555"
     * @param {string|null} friendlyName - Optional display name
     * @returns {Promise<Object>}
     */
    connect: (target, friendlyName = null) => ipcRenderer.invoke('device:connect', target, friendlyName),
    
    /**
     * Disconnect from a device.
     * @param {string} deviceId - Device ID to disconnect
     * @returns {Promise<Object>}
     */
    disconnect: (deviceId) => ipcRenderer.invoke('device:disconnect', deviceId),

    /**
     * Set device favorite status.
     * @param {string} deviceId - Device ID
     * @param {boolean} isFavorite - Favorite status
     * @returns {Promise<Object>}
     */
    setFavorite: (deviceId, isFavorite) => ipcRenderer.invoke('device:setFavorite', deviceId, isFavorite),

    /**
     * Set device trusted status.
     * @param {string} deviceId - Device ID
     * @param {boolean} isTrusted - Trusted status
     * @returns {Promise<Object>}
     */
    setTrusted: (deviceId, isTrusted) => ipcRenderer.invoke('device:setTrusted', deviceId, isTrusted),

    /**
     * Set device custom name.
     * @param {string} deviceId - Device ID
     * @param {string} customName - Custom name
     * @returns {Promise<Object>}
     */
    setCustomName: (deviceId, customName) => ipcRenderer.invoke('device:setCustomName', deviceId, customName),

    /**
     * Get favorite devices.
     * @returns {Promise<Array>}
     */
    getFavorites: () => ipcRenderer.invoke('device:getFavorites'),

    /**
     * Get trusted devices.
     * @returns {Promise<Array>}
     */
    getTrusted: () => ipcRenderer.invoke('device:getTrusted'),

    /**
     * Start screen mirroring for a connected device.
     * @param {string} deviceId
     * @param {Object} options - e.g., { fullscreen: boolean, bitrate: number }
     * @returns {Promise<string>} processId
     */
    stream: {
        start: (deviceId, options = {}) => ipcRenderer.invoke('device:stream:start', deviceId, options),
        stop: (deviceId) => ipcRenderer.invoke('device:stream:stop', deviceId)
    }
};

// ============================================================================
// 2. Downloads API
// ============================================================================

const downloadsAPI = {
    /**
     * Inspect a URL: get available formats and metadata.
     * @param {string} url
     * @returns {Promise<Object>}
     */
    inspect: (url) => {
        return ipcRenderer.invoke('download:inspect', url);
    },
    
    /**
     * Start downloading a specific format.
     * @param {string} url
     * @param {string} formatId
     * @param {string|null} deviceId - Optional device ID for saving location
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    start: (url, formatId, deviceId = null, options = {}) => {
        return ipcRenderer.invoke('download:start', url, formatId, deviceId, options);
    },
    
    /**
     * Stop an ongoing download by process ID.
     * @param {string} processId
     * @returns {Promise<boolean>}
     */
    stop: (processId) => ipcRenderer.invoke('download:stop', processId),

    /**
     * Resume a stopped download.
     * @param {string} processId
     * @param {string} url
     * @param {string} formatId
     * @param {string|null} deviceId
     * @param {Object} options
     * @returns {Promise<Object>}
     */
    resume: (processId, url, formatId, deviceId = null, options = {}) => {
        return ipcRenderer.invoke('download:resume', processId, url, formatId, deviceId, options);
    },

    /**
     * Get lightweight metadata (title, duration, thumbnail).
     * @param {string} url
     * @returns {Promise<Object>}
     */
    metadata: (url) => ipcRenderer.invoke('download:metadata', url),

    /**
     * Transfer a downloaded file to a device.
     * @param {string} localPath - Path to the local file
     * @param {string} deviceId - Target device ID
     * @returns {Promise<Object>}
     */
    transferToDevice: (localPath, deviceId) =>
        ipcRenderer.invoke('download:transferToDevice', localPath, deviceId),

    /**
     * Delete a download from history.
     * @param {string} downloadId - Download ID
     * @returns {Promise<boolean>}
     */
    delete: (downloadId) => ipcRenderer.invoke('download:delete', downloadId),

    /**
     * Delete all downloads from history.
     * @returns {Promise<number>}
     */
    deleteAll: () => ipcRenderer.invoke('download:deleteAll'),

    /**
     * Delete downloads before a specific date.
     * @param {string} date - Date string (ISO format)
     * @returns {Promise<number>}
     */
    deleteBeforeDate: (date) => ipcRenderer.invoke('download:deleteBeforeDate', date),

    /**
     * Get download history.
     * @returns {Promise<Array>}
     */
    getHistory: () => ipcRenderer.invoke('download:getHistory'),

    /**
     * Find existing download by URL and formatId.
     * @param {string} url
     * @param {string} formatId
     * @returns {Promise<Object|null>}
     */
    findExisting: (url, formatId) => ipcRenderer.invoke('download:findExisting', url, formatId),

    /**
     * Get all active downloads.
     * @returns {Promise<Map|Array>}
     */
    getActive: () => ipcRenderer.invoke('download:active'),

    /**
     * Delete a download from memory.
     * @param {string} processId - Process ID
     * @returns {Promise<boolean>}
     */
    deleteFromMemory: (processId) => ipcRenderer.invoke('download:deleteFromMemory', processId),

    /**
     * Get download details from database.
     * @param {string} downloadId - Download ID
     * @returns {Promise<Object|null>}
     */
    getDetails: (downloadId) => ipcRenderer.invoke('download:getDetails', downloadId)
};

// ============================================================================
// 3. Transfer API
// ============================================================================

const transferAPI = {
    /**
     * Start transferring a file to a device.
     * @param {string} localPath - Path to the local file
     * @param {string} deviceId - Target device ID
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    startFile: (localPath, deviceId, options = {}) =>
        ipcRenderer.invoke('transfer:startFile', localPath, deviceId, options),

    /**
     * Start transferring a file to multiple devices.
     * @param {string} localPath - Path to the local file
     * @param {Array<string>} deviceIds - Target device IDs
     * @param {Object} options - Additional options
     * @returns {Promise<Object>}
     */
    startMultiple: (localPath, deviceIds, options = {}) =>
        ipcRenderer.invoke('transfer:startMultiple', localPath, deviceIds, options),

    /**
     * Start transferring a downloaded file to devices.
     * @param {string} downloadId - Download ID
     * @param {Array<string>} deviceIds - Target device IDs
     * @param {string} localPath - Path to the local file
     * @returns {Promise<Object>}
     */
    startDownload: (downloadId, deviceIds, localPath) =>
        ipcRenderer.invoke('transfer:startDownload', downloadId, deviceIds, localPath),

    /**
     * Cancel a transfer.
     * @param {string} transferId - Transfer ID
     * @returns {Promise<Object>}
     */
    cancel: (transferId) => ipcRenderer.invoke('transfer:cancel', transferId),

    /**
     * Get transfer status.
     * @param {string} transferId - Transfer ID
     * @returns {Promise<Object>}
     */
    getStatus: (transferId) => ipcRenderer.invoke('transfer:getStatus', transferId),

    /**
     * Get all active transfers.
     * @returns {Promise<Map|Array>}
     */
    getActive: () => ipcRenderer.invoke('transfer:getActive'),

    /**
     * Get transfers for a specific device.
     * @param {string} deviceId - Device ID
     * @returns {Promise<Array>}
     */
    getByDevice: (deviceId) => ipcRenderer.invoke('transfer:getByDevice', deviceId)
};

// ============================================================================
// 4. File Picker API
// ============================================================================

const fileAPI = {
    /**
     * Open file picker to select a single file.
     * @param {Object} options - Dialog options
     * @returns {Promise<Object>}
     */
    pick: (options = {}) => ipcRenderer.invoke('file:pick', options),

    /**
     * Open file picker to select multiple files.
     * @param {Object} options - Dialog options
     * @returns {Promise<Object>}
     */
    pickMultiple: (options = {}) => ipcRenderer.invoke('file:pickMultiple', options),

    /**
     * Open directory picker.
     * @param {Object} options - Dialog options
     * @returns {Promise<Object>}
     */
    pickDirectory: (options = {}) => ipcRenderer.invoke('file:pickDirectory', options),

    /**
     * Open save dialog.
     * @param {Object} options - Dialog options
     * @returns {Promise<Object>}
     */
    save: (options = {}) => ipcRenderer.invoke('file:save', options)
};

// ============================================================================
// 5. Event listening (for runtime → UI events)
// ============================================================================

/**
 * Generic event listener system.
 * Allows renderer to subscribe to any IPC message sent from main process.
 * 
 * Usage:
 *   linkhub.on('device:stateChanged', (event, data) => { ... });
 *   linkhub.off('device:stateChanged', callback);
 */
const eventAPI = {
    /**
     * Register a listener for an IPC message from main process.
     * @param {string} channel - Channel name (e.g., 'device:stateChanged')
     * @param {Function} callback - Function that receives (event, ...args)
     * @returns {Function} - Unsubscribe function
     */
    on: (channel, callback) => {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        const wrappedCallback = (event, ...args) => {
            callback(event, ...args);
        };
        ipcRenderer.on(channel, wrappedCallback);
        // Return unsubscribe function
        return () => {
            ipcRenderer.removeListener(channel, wrappedCallback);
        };
    },
    
    /**
     * Remove a specific listener.
     * @param {string} channel
     * @param {Function} callback - The original callback function
     */
    off: (channel, callback) => {
        ipcRenderer.removeListener(channel, callback);
    },
    
    /**
     * Remove all listeners for a channel.
     * @param {string} channel
     */
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
};

// ============================================================================
// 6. Debug API (for debugging purposes)
// ============================================================================

const debugAPI = {
    /**
     * Log device data to main process terminal
     * @param {Object} deviceData - Device data to log
     * @returns {Promise<Object>}
     */
    logDeviceData: (deviceData) => ipcRenderer.invoke('debug:logDeviceData', deviceData)
};

// ============================================================================
// 4. Expose the unified API to renderer
// ============================================================================

try {
    contextBridge.exposeInMainWorld('linkhub', {
        devices: devicesAPI,
        downloads: downloadsAPI,
        transfer: transferAPI,
        file: fileAPI,
        debug: debugAPI,
        on: eventAPI.on,
        off: eventAPI.off,
        removeAllListeners: eventAPI.removeAllListeners
    });
} catch (err) {
    // Failed to expose linkhub
}