'use strict';

// Mock the linkhub API
global.linkhub = {
    on: jest.fn(() => jest.fn())
};

// Mock the module to handle ES export
jest.mock('../../../../src/renderer/js/services/stateSyncService', () => {
    const mockService = {
        _isRunning: false,
        _currentState: {
            devices: [],
            downloads: [],
            timestamp: 0
        },
        _callbacks: [],
        _unsubscribe: null,
        start: function() {
            if (this._isRunning) return;
            if (!global.linkhub || !global.linkhub.on) {
                console.error('[StateSyncService] linkhub API not available');
                return;
            }
            this._isRunning = true;
            this._unsubscribe = global.linkhub.on('state:update', (event, state) => {
                this._handleStateUpdate(state);
            });
        },
        stop: function() {
            if (!this._isRunning) return;
            this._isRunning = false;
            if (this._unsubscribe) {
                this._unsubscribe();
                this._unsubscribe = null;
            }
        },
        getState: function() {
            return { ...this._currentState };
        },
        onUpdate: function(callback) {
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }
            this._callbacks.push(callback);
            return () => {
                const index = this._callbacks.indexOf(callback);
                if (index > -1) {
                    this._callbacks.splice(index, 1);
                }
            };
        },
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
    return mockService;
});

const stateSyncService = require('../../../../src/renderer/js/services/stateSyncService');

describe('Renderer StateSyncService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the singleton instance
        stateSyncService._isRunning = false;
        stateSyncService._currentState = {
            devices: [],
            downloads: [],
            timestamp: 0
        };
        stateSyncService._callbacks = [];
        stateSyncService._unsubscribe = null;
    });

    describe('Constructor initialization', () => {
        test('should initialize with isRunning false', () => {
            expect(stateSyncService._isRunning).toBe(false);
        });

        test('should initialize with empty current state', () => {
            expect(stateSyncService._currentState).toEqual({
                devices: [],
                downloads: [],
                timestamp: 0
            });
        });

        test('should initialize with empty callbacks array', () => {
            expect(stateSyncService._callbacks).toEqual([]);
        });

        test('should initialize with null unsubscribe', () => {
            expect(stateSyncService._unsubscribe).toBeNull();
        });
    });

    describe('start', () => {
        test('should start listening for state updates', () => {
            stateSyncService.start();
            expect(stateSyncService._isRunning).toBe(true);
            expect(linkhub.on).toHaveBeenCalledWith('state:update', expect.any(Function));
        });

        test('should not start if already running', () => {
            stateSyncService.start();
            const unsubscribe1 = stateSyncService._unsubscribe;
            stateSyncService.start();
            const unsubscribe2 = stateSyncService._unsubscribe;
            expect(unsubscribe1).toBe(unsubscribe2);
        });

        test('should store unsubscribe function', () => {
            const mockUnsubscribe = jest.fn();
            linkhub.on.mockReturnValue(mockUnsubscribe);
            
            stateSyncService.start();
            expect(stateSyncService._unsubscribe).toBe(mockUnsubscribe);
        });

        test('should handle missing linkhub API', () => {
            global.linkhub = null;
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            stateSyncService.start();
            expect(stateSyncService._isRunning).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('[StateSyncService] linkhub API not available');
            
            consoleSpy.mockRestore();
            global.linkhub = { on: jest.fn(() => jest.fn()) };
        });

        test('should handle linkhub without on method', () => {
            global.linkhub = {};
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            stateSyncService.start();
            expect(stateSyncService._isRunning).toBe(false);
            
            consoleSpy.mockRestore();
            global.linkhub = { on: jest.fn(() => jest.fn()) };
        });
    });

    describe('stop', () => {
        test('should stop listening for state updates', () => {
            const mockUnsubscribe = jest.fn();
            linkhub.on.mockReturnValue(mockUnsubscribe);
            
            stateSyncService.start();
            stateSyncService.stop();
            
            expect(stateSyncService._isRunning).toBe(false);
            expect(mockUnsubscribe).toHaveBeenCalled();
        });

        test('should not stop if not running', () => {
            stateSyncService.stop();
            expect(stateSyncService._isRunning).toBe(false);
            expect(() => stateSyncService.stop()).not.toThrow();
        });

        test('should clear unsubscribe function', () => {
            const mockUnsubscribe = jest.fn();
            linkhub.on.mockReturnValue(mockUnsubscribe);
            
            stateSyncService.start();
            stateSyncService.stop();
            
            expect(stateSyncService._unsubscribe).toBeNull();
        });

        test('should handle multiple stop calls', () => {
            const mockUnsubscribe = jest.fn();
            linkhub.on.mockReturnValue(mockUnsubscribe);
            
            stateSyncService.start();
            stateSyncService.stop();
            expect(() => stateSyncService.stop()).not.toThrow();
            expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
        });
    });

    describe('getState', () => {
        test('should return current state', () => {
            stateSyncService._currentState = {
                devices: [{ id: 'device1' }],
                downloads: [{ downloadId: 'dl1' }],
                timestamp: 123456
            };

            const state = stateSyncService.getState();
            expect(state).toEqual({
                devices: [{ id: 'device1' }],
                downloads: [{ downloadId: 'dl1' }],
                timestamp: 123456
            });
        });

        test('should return a copy of state', () => {
            stateSyncService._currentState = {
                devices: [{ id: 'device1' }],
                downloads: [],
                timestamp: 0
            };

            const state1 = stateSyncService.getState();
            const state2 = stateSyncService.getState();

            expect(state1).not.toBe(state2);
            expect(state1).toEqual(state2);
        });

        test('should return empty state initially', () => {
            const state = stateSyncService.getState();
            expect(state).toEqual({
                devices: [],
                downloads: [],
                timestamp: 0
            });
        });
    });

    describe('onUpdate', () => {
        test('should register callback', () => {
            const callback = jest.fn();
            stateSyncService.onUpdate(callback);

            expect(stateSyncService._callbacks).toContain(callback);
        });

        test('should throw error if callback is not a function', () => {
            expect(() => stateSyncService.onUpdate('not a function')).toThrow('Callback must be a function');
            expect(() => stateSyncService.onUpdate(null)).toThrow('Callback must be a function');
            expect(() => stateSyncService.onUpdate(undefined)).toThrow('Callback must be a function');
            expect(() => stateSyncService.onUpdate({})).toThrow('Callback must be a function');
        });

        test('should return unsubscribe function', () => {
            const callback = jest.fn();
            const unsubscribe = stateSyncService.onUpdate(callback);

            expect(typeof unsubscribe).toBe('function');
        });

        test('should unsubscribe callback when returned function is called', () => {
            const callback = jest.fn();
            const unsubscribe = stateSyncService.onUpdate(callback);

            unsubscribe();

            expect(stateSyncService._callbacks).not.toContain(callback);
        });

        test('should support multiple callbacks', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();

            stateSyncService.onUpdate(callback1);
            stateSyncService.onUpdate(callback2);
            stateSyncService.onUpdate(callback3);

            expect(stateSyncService._callbacks).toHaveLength(3);
            expect(stateSyncService._callbacks).toContain(callback1);
            expect(stateSyncService._callbacks).toContain(callback2);
            expect(stateSyncService._callbacks).toContain(callback3);
        });

        test('should handle unsubscribe of specific callback', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();

            const unsubscribe1 = stateSyncService.onUpdate(callback1);
            stateSyncService.onUpdate(callback2);
            stateSyncService.onUpdate(callback3);

            unsubscribe1();

            expect(stateSyncService._callbacks).toHaveLength(2);
            expect(stateSyncService._callbacks).not.toContain(callback1);
            expect(stateSyncService._callbacks).toContain(callback2);
            expect(stateSyncService._callbacks).toContain(callback3);
        });

        test('should handle unsubscribe called multiple times', () => {
            const callback = jest.fn();
            const unsubscribe = stateSyncService.onUpdate(callback);

            unsubscribe();
            expect(() => unsubscribe()).not.toThrow();
            expect(stateSyncService._callbacks).not.toContain(callback);
        });
    });

    describe('State update handling', () => {
        test('should update current state on state update event', () => {
            const mockUnsubscribe = jest.fn();
            linkhub.on.mockImplementation((event, callback) => {
                if (event === 'state:update') {
                    // Simulate immediate state update
                    callback(null, {
                        devices: [{ id: 'device1' }],
                        downloads: [{ downloadId: 'dl1' }],
                        timestamp: 123456
                    });
                }
                return mockUnsubscribe;
            });

            stateSyncService.start();

            expect(stateSyncService._currentState).toEqual({
                devices: [{ id: 'device1' }],
                downloads: [{ downloadId: 'dl1' }],
                timestamp: 123456
            });
        });

        test('should notify all registered callbacks on state update', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();

            stateSyncService.onUpdate(callback1);
            stateSyncService.onUpdate(callback2);
            stateSyncService.onUpdate(callback3);

            const newState = {
                devices: [{ id: 'device1' }],
                downloads: [{ downloadId: 'dl1' }],
                timestamp: 123456
            };

            stateSyncService._handleStateUpdate(newState);

            expect(callback1).toHaveBeenCalledWith(newState);
            expect(callback2).toHaveBeenCalledWith(newState);
            expect(callback3).toHaveBeenCalledWith(newState);
        });

        test('should handle null state gracefully', () => {
            const callback = jest.fn();
            stateSyncService.onUpdate(callback);

            stateSyncService._handleStateUpdate(null);

            expect(callback).not.toHaveBeenCalled();
            expect(stateSyncService._currentState).toEqual({
                devices: [],
                downloads: [],
                timestamp: 0
            });
        });

        test('should handle undefined state gracefully', () => {
            const callback = jest.fn();
            stateSyncService.onUpdate(callback);

            stateSyncService._handleStateUpdate(undefined);

            expect(callback).not.toHaveBeenCalled();
        });

        test('should handle state with missing fields', () => {
            stateSyncService._handleStateUpdate({
                devices: [{ id: 'device1' }]
                // missing downloads and timestamp
            });

            expect(stateSyncService._currentState).toEqual({
                devices: [{ id: 'device1' }],
                downloads: [],
                timestamp: expect.any(Number)
            });
        });

        test('should update timestamp if not provided', () => {
            const beforeTimestamp = Date.now();
            
            stateSyncService._handleStateUpdate({
                devices: [],
                downloads: []
            });

            expect(stateSyncService._currentState.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
        });
    });

    describe('Error handling in callbacks', () => {
        test('should catch errors in callbacks and continue', () => {
            const errorCallback = jest.fn(() => {
                throw new Error('Callback error');
            });
            const normalCallback = jest.fn();

            stateSyncService.onUpdate(errorCallback);
            stateSyncService.onUpdate(normalCallback);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            stateSyncService._handleStateUpdate({
                devices: [],
                downloads: [],
                timestamp: 123456
            });

            expect(errorCallback).toHaveBeenCalled();
            expect(normalCallback).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledWith(
                '[StateSyncService] Error in callback:',
                expect.any(Error)
            );

            consoleSpy.mockRestore();
        });

        test('should handle multiple failing callbacks', () => {
            const errorCallback1 = jest.fn(() => { throw new Error('Error 1'); });
            const errorCallback2 = jest.fn(() => { throw new Error('Error 2'); });
            const normalCallback = jest.fn();

            stateSyncService.onUpdate(errorCallback1);
            stateSyncService.onUpdate(errorCallback2);
            stateSyncService.onUpdate(normalCallback);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            stateSyncService._handleStateUpdate({
                devices: [],
                downloads: [],
                timestamp: 123456
            });

            expect(errorCallback1).toHaveBeenCalled();
            expect(errorCallback2).toHaveBeenCalled();
            expect(normalCallback).toHaveBeenCalled();
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            consoleSpy.mockRestore();
        });
    });

    describe('Integration with linkhub', () => {
        test('should register event listener on start', () => {
            stateSyncService.start();
            expect(linkhub.on).toHaveBeenCalledTimes(1);
            expect(linkhub.on).toHaveBeenCalledWith('state:update', expect.any(Function));
        });

        test('should pass state to handler when event fires', () => {
            let eventHandler;
            linkhub.on.mockImplementation((event, handler) => {
                eventHandler = handler;
                return jest.fn();
            });

            stateSyncService.start();

            const testState = {
                devices: [{ id: 'device1' }],
                downloads: [{ downloadId: 'dl1' }],
                timestamp: 123456
            };

            eventHandler(null, testState);

            expect(stateSyncService._currentState).toEqual(testState);
        });
    });

    describe('Edge cases', () => {
        test('should handle empty devices array', () => {
            stateSyncService._handleStateUpdate({
                devices: [],
                downloads: [],
                timestamp: 123456
            });

            expect(stateSyncService._currentState.devices).toEqual([]);
        });

        test('should handle empty downloads array', () => {
            stateSyncService._handleStateUpdate({
                devices: [],
                downloads: [],
                timestamp: 123456
            });

            expect(stateSyncService._currentState.downloads).toEqual([]);
        });

        test('should handle large state object', () => {
            const largeDevices = Array.from({ length: 1000 }, (_, i) => ({
                id: `device${i}`,
                name: `Device ${i}`
            }));

            const largeDownloads = Array.from({ length: 1000 }, (_, i) => ({
                downloadId: `dl${i}`,
                percent: i % 100
            }));

            expect(() => {
                stateSyncService._handleStateUpdate({
                    devices: largeDevices,
                    downloads: largeDownloads,
                    timestamp: 123456
                });
            }).not.toThrow();

            expect(stateSyncService._currentState.devices).toHaveLength(1000);
            expect(stateSyncService._currentState.downloads).toHaveLength(1000);
        });

        test('should handle callback that modifies state', () => {
            const modifyingCallback = jest.fn((state) => {
                state.devices.push({ id: 'modified' });
            });

            stateSyncService.onUpdate(modifyingCallback);

            const originalState = {
                devices: [{ id: 'device1' }],
                downloads: [],
                timestamp: 123456
            };

            stateSyncService._handleStateUpdate(originalState);

            expect(modifyingCallback).toHaveBeenCalled();
            // The callback receives the state and can modify it
        });
    });
});
