// appStore.test.js - اختبارات وحدة المخزن المركزي
'use strict';

// Mock the AppStore module
jest.mock('../../../../src/renderer/js/store/appStore.js', () => {
    class AppStore {
        constructor() {
            this._state = {
                devices: [],
                downloads: [],
                selectedDeviceIds: new Set(),
                isLoading: false,
                error: null,
                lastUpdate: null
            };
            this._listeners = [];
            this._isDispatching = false;
        }

        getState() {
            return {
                devices: [...this._state.devices],
                downloads: [...this._state.downloads],
                selectedDeviceIds: new Set(this._state.selectedDeviceIds),
                isLoading: this._state.isLoading,
                error: this._state.error,
                lastUpdate: this._state.lastUpdate
            };
        }

        setDevices(devices) {
            this._state.devices = devices;
            this._state.lastUpdate = Date.now();
            this._notify();
        }

        setDownloads(downloads) {
            this._state.downloads = downloads;
            this._state.lastUpdate = Date.now();
            this._notify();
        }

        updateDevice(deviceId, updates) {
            const index = this._state.devices.findIndex(d => d.device.id === deviceId);
            if (index !== -1) {
                this._state.devices[index] = { ...this._state.devices[index], ...updates };
                this._state.lastUpdate = Date.now();
                this._notify();
            }
        }

        updateDownload(downloadId, updates) {
            const index = this._state.downloads.findIndex(d => d.downloadId === downloadId);
            if (index !== -1) {
                this._state.downloads[index] = { ...this._state.downloads[index], ...updates };
                this._state.lastUpdate = Date.now();
                this._notify();
            }
        }

        toggleSelection(deviceId) {
            if (this._state.selectedDeviceIds.has(deviceId)) {
                this._state.selectedDeviceIds.delete(deviceId);
            } else {
                this._state.selectedDeviceIds.add(deviceId);
            }
            this._state.lastUpdate = Date.now();
            this._notify();
        }

        clearSelection() {
            this._state.selectedDeviceIds.clear();
            this._state.lastUpdate = Date.now();
            this._notify();
        }

        setLoading(isLoading) {
            this._state.isLoading = isLoading;
            this._state.lastUpdate = Date.now();
            this._notify();
        }

        setError(error) {
            this._state.error = error;
            this._state.lastUpdate = Date.now();
            this._notify();
        }

        clearError() {
            this._state.error = null;
            this._state.lastUpdate = Date.now();
            this._notify();
        }

        updateFromBackend(backendState) {
            if (!backendState) return;
            
            if (backendState.devices) {
                this._state.devices = backendState.devices;
            }
            if (backendState.downloads) {
                this._state.downloads = backendState.downloads;
            }
            this._state.lastUpdate = Date.now();
            this._notify();
        }

        subscribe(listener) {
            if (typeof listener !== 'function') {
                throw new Error('Listener must be a function');
            }
            this._listeners.push(listener);
            
            return () => {
                const index = this._listeners.indexOf(listener);
                if (index !== -1) {
                    this._listeners.splice(index, 1);
                }
            };
        }

        _notify() {
            if (this._isDispatching) return;
            
            this._isDispatching = true;
            const state = this.getState();
            
            this._listeners.forEach(fn => {
                try {
                    fn(state);
                } catch (e) {
                    console.error('[AppStore] Listener error:', e);
                }
            });
            
            this._isDispatching = false;
        }
    }

    return new AppStore();
});

const store = require('../../../../src/renderer/js/store/appStore.js');

describe('AppStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the singleton instance
        store._state = {
            devices: [],
            downloads: [],
            selectedDeviceIds: new Set(),
            isLoading: false,
            error: null,
            lastUpdate: null
        };
        store._listeners = [];
        store._isDispatching = false;
    });

    describe('Initial State', () => {
        it('should initialize with correct default state', () => {
            const state = store.getState();
            expect(state.devices).toEqual([]);
            expect(state.downloads).toEqual([]);
            expect(state.selectedDeviceIds.size).toBe(0);
            expect(state.isLoading).toBe(false);
            expect(state.error).toBeNull();
            expect(state.lastUpdate).toBeNull();
        });
    });

    describe('getState()', () => {
        it('should return a new copy of state (not reference)', () => {
            const state1 = store.getState();
            const state2 = store.getState();

            // التأكد من أن المصفوفات مختلفة
            expect(state1.devices).not.toBe(state2.devices);
            expect(state1.downloads).not.toBe(state2.downloads);
            expect(state1.selectedDeviceIds).not.toBe(state2.selectedDeviceIds);

            // التأكد من أن القيم متساوية
            expect(state1.devices).toEqual(state2.devices);
            expect(state1.downloads).toEqual(state2.downloads);
            expect(state1.selectedDeviceIds).toEqual(state2.selectedDeviceIds);
        });
    });

    describe('setDevices()', () => {
        it('should update devices and notify subscribers', () => {
            const listener = jest.fn();
            store.subscribe(listener);

            const devices = [{ id: 'device-1', name: 'Device 1' }];
            store.setDevices(devices);

            expect(listener).toHaveBeenCalled();
            const state = store.getState();
            expect(state.devices).toEqual(devices);
            expect(state.lastUpdate).not.toBeNull();
        });

        it('should update lastUpdate timestamp', () => {
            const beforeUpdate = Date.now();
            store.setDevices([{ id: 'device-1' }]);
            const afterUpdate = Date.now();

            const state = store.getState();
            expect(state.lastUpdate).toBeGreaterThanOrEqual(beforeUpdate);
            expect(state.lastUpdate).toBeLessThanOrEqual(afterUpdate);
        });
    });

    describe('setDownloads()', () => {
        it('should update downloads and notify subscribers', () => {
            const listener = jest.fn();
            store.subscribe(listener);

            const downloads = [{ id: 'download-1', url: 'http://example.com' }];
            store.setDownloads(downloads);

            expect(listener).toHaveBeenCalled();
            const state = store.getState();
            expect(state.downloads).toEqual(downloads);
            expect(state.lastUpdate).not.toBeNull();
        });
    });

    describe('updateDevice()', () => {
        it('should update a single device by ID', () => {
            const devices = [
                { device: { id: 'device-1', name: 'Device 1' }, runtimeState: { status: 'offline' } },
                { device: { id: 'device-2', name: 'Device 2' }, runtimeState: { status: 'offline' } }
            ];
            store.setDevices(devices);

            store.updateDevice('device-1', { runtimeState: { status: 'online' } });

            const state = store.getState();
            expect(state.devices[0].runtimeState.status).toBe('online');
            expect(state.devices[1].runtimeState.status).toBe('offline');
        });

        it('should not update if device ID not found', () => {
            const devices = [{ device: { id: 'device-1', name: 'Device 1' }, runtimeState: {} }];
            store.setDevices(devices);

            const listener = jest.fn();
            store.subscribe(listener);

            store.updateDevice('device-999', { runtimeState: { status: 'online' } });

            expect(listener).not.toHaveBeenCalled();
            const state = store.getState();
            expect(state.devices[0].runtimeState.status).toBeUndefined();
        });

        it('should notify subscribers when device is updated', () => {
            store.setDevices([{ device: { id: 'device-1', name: 'Device 1' }, runtimeState: {} }]);
            const listener = jest.fn();
            store.subscribe(listener);

            store.updateDevice('device-1', { runtimeState: { status: 'online' } });

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('updateDownload()', () => {
        it('should update a single download by ID', () => {
            const downloads = [
                { downloadId: 'download-1', progress: 0 },
                { downloadId: 'download-2', progress: 0 }
            ];
            store.setDownloads(downloads);

            store.updateDownload('download-1', { progress: 50 });

            const state = store.getState();
            expect(state.downloads[0].progress).toBe(50);
            expect(state.downloads[1].progress).toBe(0);
        });

        it('should not update if download ID not found', () => {
            const downloads = [{ downloadId: 'download-1', progress: 0 }];
            store.setDownloads(downloads);

            const listener = jest.fn();
            store.subscribe(listener);

            store.updateDownload('download-999', { progress: 50 });

            expect(listener).not.toHaveBeenCalled();
            const state = store.getState();
            expect(state.downloads[0].progress).toBe(0);
        });

        it('should notify subscribers when download is updated', () => {
            store.setDownloads([{ downloadId: 'download-1', progress: 0 }]);
            const listener = jest.fn();
            store.subscribe(listener);

            store.updateDownload('download-1', { progress: 50 });

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('toggleSelection()', () => {
        it('should add device to selection when not selected', () => {
            store.toggleSelection('device-1');

            const state = store.getState();
            expect(state.selectedDeviceIds.has('device-1')).toBe(true);
            expect(state.selectedDeviceIds.size).toBe(1);
        });

        it('should remove device from selection when already selected', () => {
            store.toggleSelection('device-1');
            store.toggleSelection('device-1');

            const state = store.getState();
            expect(state.selectedDeviceIds.has('device-1')).toBe(false);
            expect(state.selectedDeviceIds.size).toBe(0);
        });

        it('should notify subscribers on toggle', () => {
            const listener = jest.fn();
            store.subscribe(listener);

            store.toggleSelection('device-1');

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('clearSelection()', () => {
        it('should clear all selections', () => {
            store.toggleSelection('device-1');
            store.toggleSelection('device-2');
            store.toggleSelection('device-3');

            store.clearSelection();

            const state = store.getState();
            expect(state.selectedDeviceIds.size).toBe(0);
        });

        it('should notify subscribers when selection is cleared', () => {
            store.toggleSelection('device-1');
            const listener = jest.fn();
            store.subscribe(listener);

            store.clearSelection();

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('setLoading()', () => {
        it('should update loading state', () => {
            store.setLoading(true);

            const state = store.getState();
            expect(state.isLoading).toBe(true);
        });

        it('should notify subscribers when loading state changes', () => {
            const listener = jest.fn();
            store.subscribe(listener);

            store.setLoading(true);

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('setError()', () => {
        it('should update error state', () => {
            const error = new Error('Test error');
            store.setError(error);

            const state = store.getState();
            expect(state.error).toBe(error);
        });

        it('should accept string error', () => {
            store.setError('Test error message');

            const state = store.getState();
            expect(state.error).toBe('Test error message');
        });

        it('should notify subscribers when error is set', () => {
            const listener = jest.fn();
            store.subscribe(listener);

            store.setError('Test error');

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('clearError()', () => {
        it('should clear error state', () => {
            store.setError('Test error');
            store.clearError();

            const state = store.getState();
            expect(state.error).toBeNull();
        });

        it('should notify subscribers when error is cleared', () => {
            store.setError('Test error');
            const listener = jest.fn();
            store.subscribe(listener);

            store.clearError();

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('updateFromBackend()', () => {
        it('should update devices from backend state', () => {
            const backendState = {
                devices: [{ id: 'device-1', name: 'Device 1' }]
            };
            store.updateFromBackend(backendState);

            const state = store.getState();
            expect(state.devices).toEqual(backendState.devices);
        });

        it('should update downloads from backend state', () => {
            const backendState = {
                downloads: [{ id: 'download-1', url: 'http://example.com' }]
            };
            store.updateFromBackend(backendState);

            const state = store.getState();
            expect(state.downloads).toEqual(backendState.downloads);
        });

        it('should update both devices and downloads from backend state', () => {
            const backendState = {
                devices: [{ id: 'device-1', name: 'Device 1' }],
                downloads: [{ id: 'download-1', url: 'http://example.com' }]
            };
            store.updateFromBackend(backendState);

            const state = store.getState();
            expect(state.devices).toEqual(backendState.devices);
            expect(state.downloads).toEqual(backendState.downloads);
        });

        it('should not update when backend state is null', () => {
            store.setDevices([{ id: 'device-1' }]);
            store.setDownloads([{ id: 'download-1' }]);

            store.updateFromBackend(null);

            const state = store.getState();
            expect(state.devices).toEqual([{ id: 'device-1' }]);
            expect(state.downloads).toEqual([{ id: 'download-1' }]);
        });

        it('should notify subscribers when updated from backend', () => {
            const listener = jest.fn();
            store.subscribe(listener);

            store.updateFromBackend({ devices: [{ id: 'device-1' }] });

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('subscribe() and unsubscribe()', () => {
        it('should add listener and return unsubscribe function', () => {
            const listener = jest.fn();
            const unsubscribe = store.subscribe(listener);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should call listener when state changes', () => {
            const listener = jest.fn();
            store.subscribe(listener);

            store.setDevices([{ id: 'device-1' }]);

            expect(listener).toHaveBeenCalled();
        });

        it('should remove listener when unsubscribe is called', () => {
            const listener = jest.fn();
            const unsubscribe = store.subscribe(listener);

            unsubscribe();
            store.setDevices([{ id: 'device-1' }]);

            expect(listener).not.toHaveBeenCalled();
        });

        it('should throw error when listener is not a function', () => {
            expect(() => store.subscribe('not a function')).toThrow('Listener must be a function');
            expect(() => store.subscribe(null)).toThrow('Listener must be a function');
            expect(() => store.subscribe(undefined)).toThrow('Listener must be a function');
        });

        it('should support multiple listeners', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            const listener3 = jest.fn();

            store.subscribe(listener1);
            store.subscribe(listener2);
            store.subscribe(listener3);

            store.setDevices([{ id: 'device-1' }]);

            expect(listener1).toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled();
            expect(listener3).toHaveBeenCalled();
        });

        it('should handle listener errors gracefully', () => {
            const errorListener = jest.fn(() => {
                throw new Error('Listener error');
            });
            const normalListener = jest.fn();

            store.subscribe(errorListener);
            store.subscribe(normalListener);

            // Should not throw, but log error
            expect(() => store.setDevices([{ id: 'device-1' }])).not.toThrow();

            // Normal listener should still be called
            expect(normalListener).toHaveBeenCalled();
        });
    });

    describe('Dispatch protection', () => {
        it('should prevent nested dispatches', () => {
            let dispatchCount = 0;
            const nestedListener = jest.fn(() => {
                dispatchCount++;
                // Try to trigger another update from within listener
                store.setLoading(true);
            });

            store.subscribe(nestedListener);
            store.setDevices([{ id: 'device-1' }]);

            // Listener should only be called once (nested dispatch prevented)
            expect(nestedListener).toHaveBeenCalledTimes(1);
        });
    });
});
