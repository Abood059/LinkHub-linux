'use strict';

const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('StateSyncService', () => {
    let stateSyncService;
    let mockWindowManager;
    let mockDeviceRegistry;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Mock WindowManager
        mockWindowManager = {
            broadcast: jest.fn()
        };

        // Mock DeviceRegistry
        mockDeviceRegistry = {
            getAllDevices: jest.fn(() => []),
            getRuntimeState: jest.fn(() => ({}))
        };

        stateSyncService = new StateSyncService(mockWindowManager, mockDeviceRegistry);
    });

    afterEach(() => {
        if (stateSyncService._isRunning) {
            stateSyncService.stop();
        }
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    describe('Constructor', () => {
        test('should throw error if windowManager is not provided', () => {
            expect(() => new StateSyncService(null, mockDeviceRegistry))
                .toThrow('WindowManager is required for StateSyncService');
        });

        test('should throw error if windowManager is undefined', () => {
            expect(() => new StateSyncService(undefined, mockDeviceRegistry))
                .toThrow('WindowManager is required for StateSyncService');
        });

        test('should throw error if deviceRegistry is not provided', () => {
            expect(() => new StateSyncService(mockWindowManager, null))
                .toThrow('DeviceRegistry is required for StateSyncService');
        });

        test('should throw error if deviceRegistry is undefined', () => {
            expect(() => new StateSyncService(mockWindowManager, undefined))
                .toThrow('DeviceRegistry is required for StateSyncService');
        });

        test('should accept valid dependencies', () => {
            expect(() => new StateSyncService(mockWindowManager, mockDeviceRegistry))
                .not.toThrow();
        });

        test('should set default interval to 100ms', () => {
            expect(stateSyncService._interval).toBe(100);
        });

        test('should accept custom interval option', () => {
            const service = new StateSyncService(mockWindowManager, mockDeviceRegistry, { interval: 200 });
            expect(service._interval).toBe(200);
        });

        test('should initialize state with empty devices and downloads map', () => {
            expect(stateSyncService._state.devices).toEqual([]);
            expect(stateSyncService._state.downloads).toBeInstanceOf(Map);
            expect(stateSyncService._state.downloads.size).toBe(0);
        });

        test('should initialize with isRunning false', () => {
            expect(stateSyncService._isRunning).toBe(false);
        });

        test('should initialize with hasChanges false', () => {
            expect(stateSyncService._hasChanges).toBe(false);
        });
    });

    describe('start', () => {
        test('should start the service and set isRunning to true', () => {
            stateSyncService.start();
            expect(stateSyncService._isRunning).toBe(true);
        });

        test('should not start if already running', () => {
            stateSyncService.start();
            const timer1 = stateSyncService._timer;
            stateSyncService.start();
            const timer2 = stateSyncService._timer;
            expect(timer1).toBe(timer2);
        });

        test('should set up interval timer', () => {
            stateSyncService.start();
            expect(stateSyncService._timer).not.toBeNull();
        });

        test('should load initial device state on start', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue([
                { id: 'device1', name: 'Device 1' }
            ]);

            stateSyncService.start();
            expect(mockDeviceRegistry.getAllDevices).toHaveBeenCalled();
        });

        test('should set hasChanges to true after loading initial state', () => {
            stateSyncService.start();
            expect(stateSyncService._hasChanges).toBe(true);
        });

        test('should broadcast state at interval', () => {
            stateSyncService.start();
            mockWindowManager.broadcast.mockClear();

            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalledWith('state:update', expect.any(Object));
        });

        test('should not broadcast if no changes', () => {
            stateSyncService.start();
            mockWindowManager.broadcast.mockClear();
            stateSyncService._hasChanges = false;

            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).not.toHaveBeenCalled();
        });
    });

    describe('stop', () => {
        test('should stop the service and set isRunning to false', () => {
            stateSyncService.start();
            stateSyncService.stop();
            expect(stateSyncService._isRunning).toBe(false);
        });

        test('should not stop if not running', () => {
            stateSyncService.stop();
            expect(stateSyncService._isRunning).toBe(false);
            expect(() => stateSyncService.stop()).not.toThrow();
        });

        test('should clear interval timer', () => {
            stateSyncService.start();
            stateSyncService.stop();
            expect(stateSyncService._timer).toBeNull();
        });

        test('should handle multiple stop calls', () => {
            stateSyncService.start();
            stateSyncService.stop();
            expect(() => stateSyncService.stop()).not.toThrow();
        });
    });

    describe('setInterval', () => {
        test('should update interval value', () => {
            stateSyncService.setInterval(200);
            expect(stateSyncService._interval).toBe(200);
        });

        test('should restart service if running', () => {
            stateSyncService.start();
            const oldTimer = stateSyncService._timer;
            
            stateSyncService.setInterval(200);
            
            expect(stateSyncService._timer).not.toBe(oldTimer);
            expect(stateSyncService._isRunning).toBe(true);
        });

        test('should not restart service if not running', () => {
            stateSyncService.setInterval(200);
            expect(stateSyncService._isRunning).toBe(false);
            expect(stateSyncService._timer).toBeNull();
        });
    });

    describe('getState', () => {
        test('should return state with devices array', () => {
            stateSyncService._state.devices = [{ id: 'device1' }];
            const state = stateSyncService.getState();
            expect(state.devices).toEqual([{ id: 'device1' }]);
        });

        test('should return state with downloads as array', () => {
            stateSyncService._state.downloads.set('dl1', { downloadId: 'dl1', percent: 50 });
            const state = stateSyncService.getState();
            expect(state.downloads).toEqual([{ downloadId: 'dl1', percent: 50 }]);
        });

        test('should return state with timestamp', () => {
            const timestamp = Date.now();
            stateSyncService._state.timestamp = timestamp;
            const state = stateSyncService.getState();
            expect(state.timestamp).toBe(timestamp);
        });

        test('should return downloads as array not Map', () => {
            stateSyncService._state.downloads.set('dl1', { downloadId: 'dl1' });
            const state = stateSyncService.getState();
            expect(Array.isArray(state.downloads)).toBe(true);
        });
    });

    describe('onDownloadProgress', () => {
        test('should handle download progress event', () => {
            const data = { downloadId: 'dl1', percent: 50, url: 'http://test.com', deviceId: 'dev1' };
            stateSyncService.onDownloadProgress(data);

            expect(stateSyncService._state.downloads.has('dl1')).toBe(true);
            expect(stateSyncService._state.downloads.get('dl1').percent).toBe(50);
            expect(stateSyncService._hasChanges).toBe(true);
        });

        test('should create new download entry if not exists', () => {
            const data = { downloadId: 'dl1', percent: 50 };
            stateSyncService.onDownloadProgress(data);

            expect(stateSyncService._state.downloads.get('dl1').status).toBe('downloading');
        });

        test('should update existing download entry', () => {
            stateSyncService._state.downloads.set('dl1', { downloadId: 'dl1', percent: 30 });
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 60 });

            expect(stateSyncService._state.downloads.get('dl1').percent).toBe(60);
        });

        test('should handle missing data', () => {
            stateSyncService.onDownloadProgress(null);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle missing downloadId', () => {
            stateSyncService.onDownloadProgress({ percent: 50 });
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should preserve existing fields when updating', () => {
            stateSyncService._state.downloads.set('dl1', { 
                downloadId: 'dl1', 
                url: 'http://old.com',
                deviceId: 'dev1'
            });
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });

            expect(stateSyncService._state.downloads.get('dl1').url).toBe('http://old.com');
            expect(stateSyncService._state.downloads.get('dl1').deviceId).toBe('dev1');
        });
    });

    describe('onDownloadComplete', () => {
        test('should handle download complete event', () => {
            const data = { downloadId: 'dl1', outputPath: '/path/to/file.mp4' };
            stateSyncService.onDownloadComplete(data);

            expect(stateSyncService._state.downloads.get('dl1').status).toBe('completed');
            expect(stateSyncService._state.downloads.get('dl1').outputPath).toBe('/path/to/file.mp4');
            expect(stateSyncService._state.downloads.get('dl1').percent).toBe(100);
            expect(stateSyncService._hasChanges).toBe(true);
        });

        test('should create new download entry if not exists', () => {
            const data = { downloadId: 'dl1', outputPath: '/path' };
            stateSyncService.onDownloadComplete(data);

            expect(stateSyncService._state.downloads.get('dl1').status).toBe('completed');
        });

        test('should handle missing data', () => {
            stateSyncService.onDownloadComplete(null);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle missing downloadId', () => {
            stateSyncService.onDownloadComplete({ outputPath: '/path' });
            expect(stateSyncService._hasChanges).toBe(false);
        });
    });

    describe('onDownloadError', () => {
        test('should handle download error event', () => {
            const data = { downloadId: 'dl1', error: 'Network error' };
            stateSyncService.onDownloadError(data);

            expect(stateSyncService._state.downloads.get('dl1').status).toBe('failed');
            expect(stateSyncService._state.downloads.get('dl1').error).toBe('Network error');
            expect(stateSyncService._hasChanges).toBe(true);
        });

        test('should create new download entry if not exists', () => {
            const data = { downloadId: 'dl1', error: 'Error' };
            stateSyncService.onDownloadError(data);

            expect(stateSyncService._state.downloads.get('dl1').status).toBe('failed');
        });

        test('should handle missing data', () => {
            stateSyncService.onDownloadError(null);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle missing downloadId', () => {
            stateSyncService.onDownloadError({ error: 'Error' });
            expect(stateSyncService._hasChanges).toBe(false);
        });
    });

    describe('onDownloadStopped', () => {
        test('should handle download stopped event', () => {
            stateSyncService._state.downloads.set('dl1', { downloadId: 'dl1', status: 'downloading' });
            stateSyncService.onDownloadStopped({ downloadId: 'dl1' });

            expect(stateSyncService._state.downloads.get('dl1').status).toBe('stopped');
            expect(stateSyncService._hasChanges).toBe(true);
        });

        test('should not create new download if not exists', () => {
            stateSyncService.onDownloadStopped({ downloadId: 'dl1' });
            expect(stateSyncService._state.downloads.has('dl1')).toBe(false);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle missing data', () => {
            stateSyncService.onDownloadStopped(null);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle missing downloadId', () => {
            stateSyncService.onDownloadStopped({});
            expect(stateSyncService._hasChanges).toBe(false);
        });
    });

    describe('onDeviceStateChanged', () => {
        test('should reload device state', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue([{ id: 'device1' }]);
            stateSyncService.onDeviceStateChanged();
            expect(mockDeviceRegistry.getAllDevices).toHaveBeenCalled();
            expect(stateSyncService._hasChanges).toBe(true);
        });

        test('should handle missing data', () => {
            stateSyncService.onDeviceStateChanged(null);
            expect(mockDeviceRegistry.getAllDevices).toHaveBeenCalled();
        });
    });

    describe('onDevicePaired', () => {
        test('should reload device state', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue([{ id: 'device1' }]);
            stateSyncService.onDevicePaired();
            expect(mockDeviceRegistry.getAllDevices).toHaveBeenCalled();
            expect(stateSyncService._hasChanges).toBe(true);
        });
    });

    describe('onDeviceRemoved', () => {
        test('should reload device state', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue([]);
            stateSyncService.onDeviceRemoved();
            expect(mockDeviceRegistry.getAllDevices).toHaveBeenCalled();
            expect(stateSyncService._hasChanges).toBe(true);
        });
    });

    describe('Dirty flag mechanism', () => {
        test('should only broadcast when changes exist', () => {
            stateSyncService.start();
            mockWindowManager.broadcast.mockClear();
            stateSyncService._hasChanges = false;

            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).not.toHaveBeenCalled();

            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalled();
        });

        test('should reset dirty flag after broadcast', () => {
            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            
            jest.advanceTimersByTime(100);
            expect(stateSyncService._hasChanges).toBe(false);
        });
    });

    describe('Interval timing', () => {
        test('should broadcast every 100ms by default', () => {
            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            mockWindowManager.broadcast.mockClear();

            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalledTimes(1);

            // Add another change to trigger second broadcast
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 60 });
            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalledTimes(2);
        });

        test('should broadcast at custom interval', () => {
            const service = new StateSyncService(mockWindowManager, mockDeviceRegistry, { interval: 200 });
            service.start();
            service.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            mockWindowManager.broadcast.mockClear();

            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).not.toHaveBeenCalled();

            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalledTimes(1);

            service.stop();
        });
    });

    describe('State accumulation', () => {
        test('should accumulate multiple downloads', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            stateSyncService.onDownloadProgress({ downloadId: 'dl2', percent: 30 });
            stateSyncService.onDownloadProgress({ downloadId: 'dl3', percent: 70 });

            expect(stateSyncService._state.downloads.size).toBe(3);
        });

        test('should accumulate devices from registry', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue([
                { id: 'device1' },
                { id: 'device2' },
                { id: 'device3' }
            ]);
            mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'online' });

            stateSyncService._loadDeviceState();

            expect(stateSyncService._state.devices).toHaveLength(3);
        });
    });

    describe('Multiple rapid events before broadcast', () => {
        test('should handle rapid download events', () => {
            stateSyncService.start();
            mockWindowManager.broadcast.mockClear();

            // Fire 10 rapid events
            for (let i = 0; i < 10; i++) {
                stateSyncService.onDownloadProgress({ downloadId: `dl${i}`, percent: i * 10 });
            }

            // Should only broadcast once after interval
            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalledTimes(1);

            const state = mockWindowManager.broadcast.mock.calls[0][1];
            expect(state.downloads).toHaveLength(10);
        });
    });

    describe('Broadcast state format', () => {
        test('should broadcast with correct channel', () => {
            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            mockWindowManager.broadcast.mockClear();

            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalledWith('state:update', expect.any(Object));
        });

        test('should update timestamp on broadcast', () => {
            stateSyncService.start();
            const oldTimestamp = stateSyncService._state.timestamp;
            
            jest.advanceTimersByTime(100);
            expect(stateSyncService._state.timestamp).toBeGreaterThan(oldTimestamp);
        });
    });
});
