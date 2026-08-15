'use strict';

const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('StateSyncService Integration Tests', () => {
    let stateSyncService;
    let mockWindowManager;
    let mockDeviceRegistry;
    let mockYtdlpAdapter;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Mock WindowManager with realistic behavior
        mockWindowManager = {
            broadcast: jest.fn(),
            _windows: new Map(),
            sendTo: jest.fn((windowId, channel, data) => {
                const window = mockWindowManager._windows.get(windowId);
                if (window && window.webContents) {
                    window.webContents.send(channel, data);
                    return true;
                }
                return false;
            })
        };

        // Mock DeviceRegistry with realistic behavior
        mockDeviceRegistry = {
            _devices: new Map(),
            _runtimeStates: new Map(),
            
            addDevice(device) {
                this._devices.set(device.id, device);
            },
            
            removeDevice(deviceId) {
                this._devices.delete(deviceId);
                this._runtimeStates.delete(deviceId);
            },
            
            getAllDevices() {
                return Array.from(this._devices.values());
            },
            
            getRuntimeState(deviceId) {
                return this._runtimeStates.get(deviceId) || {};
            },
            
            setRuntimeState(deviceId, state) {
                this._runtimeStates.set(deviceId, state);
            }
        };

        // Mock YtdlpAdapter
        mockYtdlpAdapter = {
            _downloads: new Map(),
            _counter: 0,
            
            startDownload(options) {
                const downloadId = `dl_${this._counter++}`;
                this._downloads.set(downloadId, {
                    downloadId,
                    url: options.url,
                    deviceId: options.deviceId,
                    status: 'downloading',
                    percent: 0
                });
                return downloadId;
            },
            
            updateProgress(downloadId, percent) {
                const download = this._downloads.get(downloadId);
                if (download) {
                    download.percent = percent;
                }
            },
            
            completeDownload(downloadId, outputPath) {
                const download = this._downloads.get(downloadId);
                if (download) {
                    download.status = 'completed';
                    download.outputPath = outputPath;
                    download.percent = 100;
                }
            },
            
            failDownload(downloadId, error) {
                const download = this._downloads.get(downloadId);
                if (download) {
                    download.status = 'failed';
                    download.error = error;
                }
            }
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

    describe('Full flow: YtdlpAdapter → StateSyncService → WindowManager → Renderer', () => {
        test('should handle complete download flow', () => {
            stateSyncService.start();

            // Simulate YtdlpAdapter starting a download
            const downloadId = mockYtdlpAdapter.startDownload({
                url: 'http://example.com/video.mp4',
                deviceId: 'device1'
            });

            // Simulate progress updates
            mockYtdlpAdapter.updateProgress(downloadId, 25);
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(downloadId));

            mockYtdlpAdapter.updateProgress(downloadId, 50);
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(downloadId));

            mockYtdlpAdapter.updateProgress(downloadId, 75);
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(downloadId));

            // Complete download
            mockYtdlpAdapter.completeDownload(downloadId, '/path/to/video.mp4');
            stateSyncService.onDownloadComplete(mockYtdlpAdapter._downloads.get(downloadId));

            // Advance timer to trigger broadcast
            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            // Verify broadcast was called
            expect(mockWindowManager.broadcast).toHaveBeenCalledWith('state:update', expect.any(Object));

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.downloads).toHaveLength(1);
            expect(broadcastedState.downloads[0].status).toBe('completed');
            expect(broadcastedState.downloads[0].percent).toBe(100);
        });

        test('should handle failed download flow', () => {
            stateSyncService.start();

            const downloadId = mockYtdlpAdapter.startDownload({
                url: 'http://example.com/video.mp4',
                deviceId: 'device1'
            });

            mockYtdlpAdapter.updateProgress(downloadId, 50);
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(downloadId));

            mockYtdlpAdapter.failDownload(downloadId, 'Network error');
            stateSyncService.onDownloadError(mockYtdlpAdapter._downloads.get(downloadId));

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            expect(mockWindowManager.broadcast).toHaveBeenCalled();

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.downloads[0].status).toBe('failed');
            expect(broadcastedState.downloads[0].error).toBe('Network error');
        });
    });

    describe('Device state change flow: container → StateSyncService → Renderer', () => {
        test('should handle device pairing flow', () => {
            mockDeviceRegistry.addDevice({
                id: 'device1',
                name: 'Device 1',
                model: 'Samsung'
            });
            mockDeviceRegistry.setRuntimeState('device1', { status: 'paired' });

            stateSyncService.start();
            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            expect(mockWindowManager.broadcast).toHaveBeenCalled();

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.devices).toHaveLength(1);
            expect(broadcastedState.devices[0].device.id).toBe('device1');
            expect(broadcastedState.devices[0].runtimeState.status).toBe('paired');
        });

        test('should handle device removal flow', () => {
            mockDeviceRegistry.addDevice({ id: 'device1', name: 'Device 1' });
            mockDeviceRegistry.setRuntimeState('device1', { status: 'online' });

            stateSyncService.start();
            jest.advanceTimersByTime(100);

            // Remove device
            mockDeviceRegistry.removeDevice('device1');
            stateSyncService.onDeviceRemoved();

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.devices).toHaveLength(0);
        });

        test('should handle device state change', () => {
            mockDeviceRegistry.addDevice({ id: 'device1', name: 'Device 1' });
            mockDeviceRegistry.setRuntimeState('device1', { status: 'online' });

            stateSyncService.start();
            jest.advanceTimersByTime(100);

            // Change device state
            mockDeviceRegistry.setRuntimeState('device1', { status: 'offline' });
            stateSyncService.onDeviceStateChanged();

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.devices[0].runtimeState.status).toBe('offline');
        });
    });

    describe('Multiple downloads concurrent updates', () => {
        test('should handle multiple concurrent downloads', () => {
            stateSyncService.start();

            // Start 5 concurrent downloads
            const downloadIds = [];
            for (let i = 0; i < 5; i++) {
                const downloadId = mockYtdlpAdapter.startDownload({
                    url: `http://example.com/video${i}.mp4`,
                    deviceId: 'device1'
                });
                downloadIds.push(downloadId);
            }

            // Update progress for all downloads
            downloadIds.forEach((downloadId, index) => {
                mockYtdlpAdapter.updateProgress(downloadId, index * 20);
                stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(downloadId));
            });

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.downloads).toHaveLength(5);
        });

        test('should handle downloads at different stages', () => {
            stateSyncService.start();

            const dl1 = mockYtdlpAdapter.startDownload({ url: 'url1', deviceId: 'device1' });
            const dl2 = mockYtdlpAdapter.startDownload({ url: 'url2', deviceId: 'device1' });
            const dl3 = mockYtdlpAdapter.startDownload({ url: 'url3', deviceId: 'device1' });

            // dl1: downloading
            mockYtdlpAdapter.updateProgress(dl1, 50);
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(dl1));

            // dl2: completed
            mockYtdlpAdapter.completeDownload(dl2, '/path2.mp4');
            stateSyncService.onDownloadComplete(mockYtdlpAdapter._downloads.get(dl2));

            // dl3: failed
            mockYtdlpAdapter.failDownload(dl3, 'Error');
            stateSyncService.onDownloadError(mockYtdlpAdapter._downloads.get(dl3));

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.downloads).toHaveLength(3);
            expect(broadcastedState.downloads.find(d => d.downloadId === dl1).status).toBe('downloading');
            expect(broadcastedState.downloads.find(d => d.downloadId === dl2).status).toBe('completed');
            expect(broadcastedState.downloads.find(d => d.downloadId === dl3).status).toBe('failed');
        });
    });

    describe('Device and download updates simultaneously', () => {
        test('should handle concurrent device and download updates', () => {
            mockDeviceRegistry.addDevice({ id: 'device1', name: 'Device 1' });
            mockDeviceRegistry.setRuntimeState('device1', { status: 'online' });

            stateSyncService.start();

            // Add device
            stateSyncService.onDevicePaired();

            // Start download
            const downloadId = mockYtdlpAdapter.startDownload({
                url: 'http://example.com/video.mp4',
                deviceId: 'device1'
            });
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(downloadId));

            // Update device state
            mockDeviceRegistry.setRuntimeState('device1', { status: 'busy' });
            stateSyncService.onDeviceStateChanged();

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.devices).toHaveLength(1);
            expect(broadcastedState.devices[0].runtimeState.status).toBe('busy');
            expect(broadcastedState.downloads).toHaveLength(1);
        });
    });

    describe('State consistency across multiple broadcasts', () => {
        test('should maintain state consistency across broadcasts', () => {
            stateSyncService.start();

            // Add initial download
            const dl1 = mockYtdlpAdapter.startDownload({ url: 'url1', deviceId: 'device1' });
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(dl1));

            // First broadcast
            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);
            const state1 = mockWindowManager.broadcast.mock.calls[0][1];

            // Update download
            mockYtdlpAdapter.updateProgress(dl1, 50);
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(dl1));

            // Second broadcast
            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);
            const state2 = mockWindowManager.broadcast.mock.calls[0][1];

            // Verify consistency
            expect(state1.downloads.length).toBe(state2.downloads.length);
            expect(state1.downloads[0].downloadId).toBe(state2.downloads[0].downloadId);
            expect(state2.downloads[0].percent).toBe(50);
            expect(state2.timestamp).toBeGreaterThan(state1.timestamp);
        });

        test('should not lose data between broadcasts', () => {
            stateSyncService.start();

            // Add multiple downloads
            for (let i = 0; i < 10; i++) {
                const dl = mockYtdlpAdapter.startDownload({ url: `url${i}`, deviceId: 'device1' });
                stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(dl));
            }

            // First broadcast
            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);
            const state1 = mockWindowManager.broadcast.mock.calls[0][1];

            // Update some downloads
            const downloadIds = Array.from(mockYtdlpAdapter._downloads.keys());
            downloadIds.slice(0, 5).forEach((id, i) => {
                mockYtdlpAdapter.updateProgress(id, i * 20);
                stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(id));
            });

            // Second broadcast
            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);
            const state2 = mockWindowManager.broadcast.mock.calls[0][1];

            expect(state2.downloads).toHaveLength(10);
        });
    });

    describe('Service lifecycle (start → update → stop)', () => {
        test('should handle full lifecycle', () => {
            // Start
            stateSyncService.start();
            expect(stateSyncService._isRunning).toBe(true);

            // Update
            mockDeviceRegistry.addDevice({ id: 'device1', name: 'Device 1' });
            stateSyncService.onDevicePaired();

            const dl = mockYtdlpAdapter.startDownload({ url: 'url', deviceId: 'device1' });
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(dl));

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalled();

            // Stop
            stateSyncService.stop();
            expect(stateSyncService._isRunning).toBe(false);
            expect(stateSyncService._timer).toBeNull();
        });

        test('should handle restart after stop', () => {
            stateSyncService.start();
            stateSyncService.stop();

            stateSyncService.start();
            expect(stateSyncService._isRunning).toBe(true);
            expect(stateSyncService._timer).not.toBeNull();

            const dl = mockYtdlpAdapter.startDownload({ url: 'url', deviceId: 'device1' });
            stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(dl));

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);
            expect(mockWindowManager.broadcast).toHaveBeenCalled();
        });
    });

    describe('Integration with DeviceRegistry', () => {
        test('should integrate with DeviceRegistry.getAllDevices', () => {
            mockDeviceRegistry.addDevice({ id: 'device1', name: 'Device 1' });
            mockDeviceRegistry.addDevice({ id: 'device2', name: 'Device 2' });

            stateSyncService.start();
            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const state = mockWindowManager.broadcast.mock.calls[0][1];
            expect(state.devices).toHaveLength(2);
        });

        test('should integrate with DeviceRegistry.getRuntimeState', () => {
            mockDeviceRegistry.addDevice({ id: 'device1', name: 'Device 1' });
            mockDeviceRegistry.setRuntimeState('device1', { status: 'online', battery: 80 });

            stateSyncService.start();
            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const state = mockWindowManager.broadcast.mock.calls[0][1];
            expect(state.devices[0].runtimeState.status).toBe('online');
            expect(state.devices[0].runtimeState.battery).toBe(80);
        });
    });

    describe('Integration with YtdlpAdapter', () => {
        test('should integrate with YtdlpAdapter download lifecycle', () => {
            stateSyncService.start();

            const downloadId = mockYtdlpAdapter.startDownload({
                url: 'http://example.com/video.mp4',
                deviceId: 'device1'
            });

            // Progress
            for (let i = 0; i <= 100; i += 10) {
                mockYtdlpAdapter.updateProgress(downloadId, i);
                stateSyncService.onDownloadProgress(mockYtdlpAdapter._downloads.get(downloadId));
            }

            // Complete
            mockYtdlpAdapter.completeDownload(downloadId, '/path/video.mp4');
            stateSyncService.onDownloadComplete(mockYtdlpAdapter._downloads.get(downloadId));

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const state = mockWindowManager.broadcast.mock.calls[0][1];
            expect(state.downloads[0].status).toBe('completed');
            expect(state.downloads[0].percent).toBe(100);
        });

        test('should handle YtdlpAdapter error states', () => {
            stateSyncService.start();

            const downloadId = mockYtdlpAdapter.startDownload({
                url: 'http://example.com/video.mp4',
                deviceId: 'device1'
            });

            mockYtdlpAdapter.failDownload(downloadId, 'Download failed');
            stateSyncService.onDownloadError(mockYtdlpAdapter._downloads.get(downloadId));

            mockWindowManager.broadcast.mockClear();
            jest.advanceTimersByTime(100);

            const state = mockWindowManager.broadcast.mock.calls[0][1];
            expect(state.downloads[0].status).toBe('failed');
            expect(state.downloads[0].error).toBe('Download failed');
        });
    });
});
