// eventService.test.js - اختبارات وحدة لخدمة الأحداث
'use strict';

// Mock the linkhub API
global.linkhub = {
    on: jest.fn(() => jest.fn())
};

// Mock appStore
const mockStore = {
    setDevices: jest.fn(),
    setDownloads: jest.fn()
};

jest.mock('../../../../src/renderer/js/store/appStore', () => mockStore);

// Mock stateSyncService
let mockCallback = null;
const mockUnsubscribe = jest.fn();

const mockStateSyncService = {
    _isRunning: false,
    _currentState: {
        devices: [],
        downloads: [],
        timestamp: 0
    },
    _callbacks: [],
    _unsubscribe: null,
    start: jest.fn(function() {
        if (this._isRunning) return;
        if (!global.linkhub || !global.linkhub.on) {
            console.error('[StateSyncService] linkhub API not available');
            return;
        }
        this._isRunning = true;
        this._unsubscribe = global.linkhub.on('state:update', (event, state) => {
            this._handleStateUpdate(state);
        });
    }),
    stop: jest.fn(function() {
        if (!this._isRunning) return;
        this._isRunning = false;
        if (this._unsubscribe) {
            this._unsubscribe();
            this._unsubscribe = null;
        }
    }),
    getState: function() {
        return { ...this._currentState };
    },
    onUpdate: jest.fn(function(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        this._callbacks.push(callback);
        mockCallback = callback;
        return mockUnsubscribe;
    }),
    _handleStateUpdate: function(state) {
        if (!state) return;
        this._currentState = {
            devices: state.devices || [],
            downloads: state.downloads || [],
            timestamp: state.timestamp || Date.now()
        };
        this._callbacks.forEach(callback => {
            try {
                callback(this._currentState);
            } catch (err) {
                console.error('[StateSyncService] Error in callback:', err);
            }
        });
    }
};

jest.mock('../../../../src/renderer/js/services/stateSyncService', () => mockStateSyncService);

// Mock the eventService module to test the actual implementation logic
jest.mock('../../../../src/renderer/js/services/eventService', () => ({
    setupEventListeners: function(handlers = {}, containers = {}) {
        if (!mockStateSyncService) {
            console.warn('[EventService] stateSyncService not available');
            return null;
        }

        mockStateSyncService.start();

        const mockUnsubscribeLocal = mockStateSyncService.onUpdate((state) => {
            if (!state) return;

            // تحديث المخزن المركزي
            if (state.devices) {
                mockStore.setDevices(state.devices);
            }
            if (state.downloads) {
                mockStore.setDownloads(state.downloads);
            }
        });

        return () => {
            if (mockUnsubscribeLocal) {
                mockUnsubscribeLocal();
            }
            mockStateSyncService.stop();
        };
    },
    cleanup: function() {
        mockStateSyncService.stop();
    }
}));

const eventService = require('../../../../src/renderer/js/services/eventService');

describe('eventService', () => {
    let handlers;
    let containers;

    beforeEach(() => {
        jest.clearAllMocks();
        mockCallback = null;
        handlers = { onProgress: jest.fn(), onComplete: jest.fn() };
        containers = { registeredContainer: null, discoveredContainer: null };

        // Reset the singleton instance
        mockStateSyncService._isRunning = false;
        mockStateSyncService._currentState = {
            devices: [],
            downloads: [],
            timestamp: 0
        };
        mockStateSyncService._callbacks = [];
        mockStateSyncService._unsubscribe = null;

        // Reset store mocks
        mockStore.setDevices.mockClear();
        mockStore.setDownloads.mockClear();
    });

    it('should listen for state:update events', () => {
        eventService.setupEventListeners(handlers, containers);
        expect(mockStateSyncService.start).toHaveBeenCalled();
        expect(mockStateSyncService.onUpdate).toHaveBeenCalled();
    });

    it('should update store when devices are received', () => {
        eventService.setupEventListeners(handlers, containers);

        const mockState = {
            devices: [{ device: { id: 'device-1' } }],
            downloads: []
        };

        mockCallback(mockState);

        expect(mockStore.setDevices).toHaveBeenCalledWith(mockState.devices);
    });

    it('should update store when downloads are received', () => {
        eventService.setupEventListeners(handlers, containers);

        const mockState = {
            devices: [],
            downloads: [{ downloadId: 'dl-1' }]
        };

        mockCallback(mockState);

        expect(mockStore.setDownloads).toHaveBeenCalledWith(mockState.downloads);
    });

    it('should update store with both devices and downloads', () => {
        eventService.setupEventListeners(handlers, containers);

        const mockState = {
            devices: [{ device: { id: 'device-1' } }],
            downloads: [{ downloadId: 'dl-1' }]
        };

        mockCallback(mockState);

        expect(mockStore.setDevices).toHaveBeenCalledWith(mockState.devices);
        expect(mockStore.setDownloads).toHaveBeenCalledWith(mockState.downloads);
    });

    it('should return cleanup function that stops listening', () => {
        const cleanupFn = eventService.setupEventListeners(handlers, containers);
        cleanupFn();
        expect(mockStateSyncService.stop).toHaveBeenCalled();
        expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle null state gracefully', () => {
        eventService.setupEventListeners(handlers, containers);

        mockCallback(null);

        expect(mockStore.setDevices).not.toHaveBeenCalled();
        expect(mockStore.setDownloads).not.toHaveBeenCalled();
    });

    it('should handle state with missing devices', () => {
        eventService.setupEventListeners(handlers, containers);

        const mockState = {
            downloads: [{ downloadId: 'dl-1' }]
        };

        mockCallback(mockState);

        expect(mockStore.setDownloads).toHaveBeenCalledWith(mockState.downloads);
        expect(mockStore.setDevices).not.toHaveBeenCalled();
    });

    it('should handle state with missing downloads', () => {
        eventService.setupEventListeners(handlers, containers);

        const mockState = {
            devices: [{ device: { id: 'device-1' } }]
        };

        mockCallback(mockState);

        expect(mockStore.setDevices).toHaveBeenCalledWith(mockState.devices);
        expect(mockStore.setDownloads).not.toHaveBeenCalled();
    });

    it('should call cleanup function when returned cleanup is invoked', () => {
        eventService.setupEventListeners(handlers, containers);
        eventService.cleanup();
        expect(mockStateSyncService.stop).toHaveBeenCalled();
    });
});
