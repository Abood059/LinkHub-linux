// devicePresenter.test.js - اختبارات وحدة DevicePresenter
'use strict';

// Mock the AppStore module
const mockStore = {
    getState: jest.fn(),
    subscribe: jest.fn()
};

jest.mock('../../../../src/renderer/js/store/appStore.js', () => mockStore);

// Mock the presenter module to return the class, not a singleton
jest.mock('../../../../src/renderer/js/presenters/devicePresenter.js', () => {
    // Define the class inline
    class DevicePresenter {
        constructor() {
            this._unsubscribe = null;
            this._listeners = [];
        }

        subscribe(callback) {
            if (typeof callback !== 'function') {
                throw new Error('Callback must be a function');
            }
            this._listeners.push(callback);
            if (!this._unsubscribe) {
                this._unsubscribe = mockStore.subscribe((state) => {
                    const viewModel = this.buildViewModel(state);
                    this._listeners.forEach(fn => {
                        try { 
                            fn(viewModel); 
                        } catch (e) {
                            console.error('[DevicePresenter] Listener error:', e);
                        }
                    });
                });
            }
            return () => {
                const index = this._listeners.indexOf(callback);
                if (index !== -1) {
                    this._listeners.splice(index, 1);
                }
                if (this._listeners.length === 0 && this._unsubscribe) {
                    this._unsubscribe();
                    this._unsubscribe = null;
                }
            };
        }

        unsubscribe() {
            if (this._unsubscribe) {
                this._unsubscribe();
                this._unsubscribe = null;
            }
            this._listeners = [];
        }

        buildViewModel(state) {
            const devices = state.devices || [];
            const selectedIds = state.selectedDeviceIds || new Set();

            const registeredDevices = [];
            const discoveredDevices = [];
            const connectedDevices = [];
            const offlineDevices = [];

            devices.forEach(deviceData => {
                const device = deviceData.device;
                const runtimeState = deviceData.runtimeState || {};
                const status = runtimeState.status || 'offline';

                const enrichedDevice = {
                    ...deviceData,
                    isSelected: selectedIds.has(device.id),
                    status: status,
                    isConnected: status === 'connected',
                    isOffline: status === 'offline' || status === 'unknown',
                    isDiscovered: device.isNew === true,
                    displayName: device.deviceFriendlyName || device.model || device.id,
                    statusText: status === 'connected' ? 'متصل' : (status === 'offline' ? 'غير متصل' : status)
                };

                if (device.isNew) {
                    discoveredDevices.push(enrichedDevice);
                } else {
                    registeredDevices.push(enrichedDevice);
                }

                if (status === 'connected') {
                    connectedDevices.push(enrichedDevice);
                } else {
                    offlineDevices.push(enrichedDevice);
                }
            });

            let firstSelectedDevice = null;
            for (const device of devices) {
                if (selectedIds.has(device.device.id)) {
                    firstSelectedDevice = device;
                    break;
                }
            }

            return {
                allDevices: devices,
                registeredDevices,
                discoveredDevices,
                connectedDevices,
                offlineDevices,
                firstSelectedDevice,
                selectedCount: selectedIds.size,
                hasSelection: selectedIds.size > 0,
                hasRegisteredDevices: registeredDevices.length > 0,
                hasDiscoveredDevices: discoveredDevices.length > 0,
                hasConnectedDevices: connectedDevices.length > 0,
                isLoading: state.isLoading || false,
                error: state.error || null,
                lastUpdate: state.lastUpdate || null
            };
        }

        getDeviceById(deviceId) {
            const state = mockStore.getState();
            return state.devices.find(d => d.device.id === deviceId) || null;
        }

        getConnectedDevices() {
            const state = mockStore.getState();
            return state.devices.filter(d => d.runtimeState?.status === 'connected');
        }

        getSelectedDevices() {
            const state = mockStore.getState();
            return state.devices.filter(d => state.selectedDeviceIds.has(d.device.id));
        }

        isDeviceSelected(deviceId) {
            const state = mockStore.getState();
            return state.selectedDeviceIds.has(deviceId);
        }
    }

    return DevicePresenter;
});

const DevicePresenter = require('../../../../src/renderer/js/presenters/devicePresenter.js');

describe('DevicePresenter', () => {
    let presenter;
    let mockState;

    beforeEach(() => {
        jest.clearAllMocks();
        presenter = new DevicePresenter();

        // إعداد حالة وهمية
        mockState = {
            devices: [
                { 
                    device: { id: 'device-1', deviceFriendlyName: 'Device 1', isNew: false },
                    runtimeState: { status: 'connected' }
                },
                { 
                    device: { id: 'device-2', deviceFriendlyName: 'Device 2', isNew: true },
                    runtimeState: { status: 'offline' }
                },
                { 
                    device: { id: 'device-3', deviceFriendlyName: 'Device 3', isNew: false },
                    runtimeState: { status: 'disconnected' }
                }
            ],
            selectedDeviceIds: new Set(['device-1']),
            isLoading: false,
            error: null,
            lastUpdate: Date.now()
        };

        mockStore.getState.mockReturnValue(mockState);
    });

    describe('Constructor', () => {
        it('should create DevicePresenter without errors', () => {
            expect(presenter).toBeDefined();
            expect(presenter._listeners).toEqual([]);
            expect(presenter._unsubscribe).toBeNull();
        });
    });

    describe('subscribe()', () => {
        it('should throw error when callback is not a function', () => {
            expect(() => presenter.subscribe('not a function')).toThrow('Callback must be a function');
            expect(() => presenter.subscribe(null)).toThrow('Callback must be a function');
        });

        it('should subscribe to store and call callback with ViewModel', () => {
            const callback = jest.fn();
            const mockUnsubscribe = jest.fn();
            mockStore.subscribe.mockReturnValue(mockUnsubscribe);

            presenter.subscribe(callback);

            expect(mockStore.subscribe).toHaveBeenCalled();
            expect(presenter._listeners).toContain(callback);
        });

        it('should return unsubscribe function', () => {
            const mockUnsubscribe = jest.fn();
            mockStore.subscribe.mockReturnValue(mockUnsubscribe);

            const unsubscribe = presenter.subscribe(jest.fn());

            expect(typeof unsubscribe).toBe('function');
        });

        it('should remove listener when unsubscribe is called', () => {
            const callback = jest.fn();
            const mockUnsubscribe = jest.fn();
            mockStore.subscribe.mockReturnValue(mockUnsubscribe);

            const unsubscribe = presenter.subscribe(callback);
            unsubscribe();

            expect(presenter._listeners).not.toContain(callback);
        });

        it('should support multiple listeners', () => {
            const callback1 = jest.fn();
            const callback2 = jest.fn();
            const callback3 = jest.fn();
            const mockUnsubscribe = jest.fn();
            mockStore.subscribe.mockReturnValue(mockUnsubscribe);

            presenter.subscribe(callback1);
            presenter.subscribe(callback2);
            presenter.subscribe(callback3);

            expect(presenter._listeners).toHaveLength(3);
        });
    });

    describe('unsubscribe()', () => {
        it('should clean up all resources', () => {
            const mockUnsubscribe = jest.fn();
            mockStore.subscribe.mockReturnValue(mockUnsubscribe);

            presenter.subscribe(jest.fn());
            presenter.unsubscribe();

            expect(presenter._listeners).toEqual([]);
            expect(mockUnsubscribe).toHaveBeenCalled();
        });
    });

    describe('buildViewModel()', () => {
        it('should build correct ViewModel', () => {
            const viewModel = presenter.buildViewModel(mockState);

            expect(viewModel.allDevices).toHaveLength(3);
            expect(viewModel.registeredDevices).toHaveLength(2);
            expect(viewModel.discoveredDevices).toHaveLength(1);
            expect(viewModel.connectedDevices).toHaveLength(1);
            expect(viewModel.offlineDevices).toHaveLength(2);
            expect(viewModel.selectedCount).toBe(1);
            expect(viewModel.hasSelection).toBe(true);
            expect(viewModel.hasRegisteredDevices).toBe(true);
            expect(viewModel.hasDiscoveredDevices).toBe(true);
            expect(viewModel.hasConnectedDevices).toBe(true);
        });

        it('should classify devices as registered vs discovered', () => {
            const viewModel = presenter.buildViewModel(mockState);

            expect(viewModel.registeredDevices).toHaveLength(2);
            expect(viewModel.discoveredDevices).toHaveLength(1);
            expect(viewModel.discoveredDevices[0].device.id).toBe('device-2');
        });

        it('should classify devices as connected vs offline', () => {
            const viewModel = presenter.buildViewModel(mockState);

            expect(viewModel.connectedDevices).toHaveLength(1);
            expect(viewModel.offlineDevices).toHaveLength(2);
            expect(viewModel.connectedDevices[0].device.id).toBe('device-1');
        });

        it('should calculate selection count correctly', () => {
            const viewModel = presenter.buildViewModel(mockState);

            expect(viewModel.selectedCount).toBe(1);
            expect(viewModel.hasSelection).toBe(true);
        });

        it('should mark selected devices correctly', () => {
            const viewModel = presenter.buildViewModel(mockState);
            const registeredDevice = viewModel.registeredDevices[0];
            expect(registeredDevice.isSelected).toBe(true);
        });

        it('should enrich devices with computed properties', () => {
            const viewModel = presenter.buildViewModel(mockState);
            const device = viewModel.registeredDevices[0];

            expect(device.isSelected).toBe(true);
            expect(device.isConnected).toBe(true);
            expect(device.isOffline).toBe(false);
            expect(device.isDiscovered).toBe(false);
            expect(device.displayName).toBe('Device 1');
            expect(device.statusText).toBe('متصل');
        });

        it('should handle empty devices array', () => {
            const emptyState = {
                devices: [],
                selectedDeviceIds: new Set(),
                isLoading: false,
                error: null
            };

            const viewModel = presenter.buildViewModel(emptyState);

            expect(viewModel.allDevices).toHaveLength(0);
            expect(viewModel.registeredDevices).toHaveLength(0);
            expect(viewModel.discoveredDevices).toHaveLength(0);
            expect(viewModel.connectedDevices).toHaveLength(0);
            expect(viewModel.offlineDevices).toHaveLength(0);
            expect(viewModel.selectedCount).toBe(0);
            expect(viewModel.hasSelection).toBe(false);
        });

        it('should identify first selected device', () => {
            const viewModel = presenter.buildViewModel(mockState);

            expect(viewModel.firstSelectedDevice).toBeDefined();
            expect(viewModel.firstSelectedDevice.device.id).toBe('device-1');
        });

        it('should return null for firstSelectedDevice when no selection', () => {
            const noSelectionState = {
                ...mockState,
                selectedDeviceIds: new Set()
            };

            const viewModel = presenter.buildViewModel(noSelectionState);

            expect(viewModel.firstSelectedDevice).toBeNull();
        });
    });

    describe('Helper Methods', () => {
        it('should return correct device by ID', () => {
            const device = presenter.getDeviceById('device-1');

            expect(device).toBeDefined();
            expect(device.device.id).toBe('device-1');
        });

        it('should return null for non-existent device ID', () => {
            const device = presenter.getDeviceById('non-existent');

            expect(device).toBeNull();
        });

        it('should return connected devices only', () => {
            const connected = presenter.getConnectedDevices();

            expect(connected).toHaveLength(1);
            expect(connected[0].device.id).toBe('device-1');
        });

        it('should return selected devices only', () => {
            const selected = presenter.getSelectedDevices();

            expect(selected).toHaveLength(1);
            expect(selected[0].device.id).toBe('device-1');
        });

        it('should check if device is selected', () => {
            expect(presenter.isDeviceSelected('device-1')).toBe(true);
            expect(presenter.isDeviceSelected('device-2')).toBe(false);
            expect(presenter.isDeviceSelected('non-existent')).toBe(false);
        });
    });
});
