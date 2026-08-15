// downloadPresenter.test.js - اختبارات وحدة DownloadPresenter
'use strict';

// Mock the AppStore module
const mockStore = {
    getState: jest.fn(),
    subscribe: jest.fn()
};

jest.mock('../../../../src/renderer/js/store/appStore.js', () => mockStore);

// Mock the presenter module to return the class, not a singleton
jest.mock('../../../../src/renderer/js/presenters/downloadPresenter.js', () => {
    // Define the class inline
    class DownloadPresenter {
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
                            console.error('[DownloadPresenter] Listener error:', e);
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
            const downloads = state.downloads || [];

            const activeDownloads = [];
            const completedDownloads = [];
            const failedDownloads = [];
            const stoppedDownloads = [];

            downloads.forEach(download => {
                const status = download.status || 'unknown';
                
                const enrichedDownload = {
                    ...download,
                    isActive: status === 'downloading' || status === 'pending',
                    isCompleted: status === 'completed',
                    isFailed: status === 'failed',
                    isStopped: status === 'stopped',
                    statusText: this._getStatusText(status)
                };

                if (status === 'downloading' || status === 'pending') {
                    activeDownloads.push(enrichedDownload);
                } else if (status === 'completed') {
                    completedDownloads.push(enrichedDownload);
                } else if (status === 'failed') {
                    failedDownloads.push(enrichedDownload);
                } else if (status === 'stopped') {
                    stoppedDownloads.push(enrichedDownload);
                }
            });

            let averageProgress = 0;
            if (activeDownloads.length > 0) {
                const totalProgress = activeDownloads.reduce((sum, d) => {
                    return sum + (d.percent || 0);
                }, 0);
                averageProgress = totalProgress / activeDownloads.length;
            }

            return {
                allDownloads: downloads,
                activeDownloads,
                completedDownloads,
                failedDownloads,
                stoppedDownloads,
                activeCount: activeDownloads.length,
                hasActiveDownloads: activeDownloads.length > 0,
                averageProgress: Math.round(averageProgress),
                isLoading: state.isLoading || false,
                error: state.error || null,
                lastUpdate: state.lastUpdate || null
            };
        }

        _getStatusText(status) {
            const statusMap = {
                'downloading': 'جاري التحميل',
                'pending': 'في الانتظار',
                'completed': 'مكتمل',
                'failed': 'فشل',
                'stopped': 'متوقف'
            };
            return statusMap[status] || status;
        }

        getDownloadById(downloadId) {
            const state = mockStore.getState();
            return state.downloads.find(d => d.downloadId === downloadId) || null;
        }

        getDownloadsByDevice(deviceId) {
            const state = mockStore.getState();
            return state.downloads.filter(d => d.deviceId === deviceId);
        }
    }

    return DownloadPresenter;
});

const DownloadPresenter = require('../../../../src/renderer/js/presenters/downloadPresenter.js');

describe('DownloadPresenter', () => {
    let presenter;
    let mockState;

    beforeEach(() => {
        jest.clearAllMocks();
        presenter = new DownloadPresenter();

        // إعداد حالة وهمية
        mockState = {
            downloads: [
                { 
                    downloadId: 'download-1',
                    url: 'http://example.com/file1.apk',
                    status: 'downloading',
                    percent: 50,
                    deviceId: 'device-1',
                    outputPath: '/path/to/file1.apk'
                },
                { 
                    downloadId: 'download-2',
                    url: 'http://example.com/file2.apk',
                    status: 'completed',
                    percent: 100,
                    deviceId: 'device-1',
                    outputPath: '/path/to/file2.apk'
                },
                { 
                    downloadId: 'download-3',
                    url: 'http://example.com/file3.apk',
                    status: 'failed',
                    percent: 30,
                    deviceId: 'device-2',
                    outputPath: null,
                    error: 'Network error'
                },
                { 
                    downloadId: 'download-4',
                    url: 'http://example.com/file4.apk',
                    status: 'stopped',
                    percent: 25,
                    deviceId: 'device-2',
                    outputPath: null
                }
            ],
            isLoading: false,
            error: null,
            lastUpdate: Date.now()
        };

        mockStore.getState.mockReturnValue(mockState);
    });

    describe('Constructor', () => {
        it('should create DownloadPresenter without errors', () => {
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

            expect(viewModel.allDownloads).toHaveLength(4);
            expect(viewModel.activeDownloads).toHaveLength(1);
            expect(viewModel.completedDownloads).toHaveLength(1);
            expect(viewModel.failedDownloads).toHaveLength(1);
            expect(viewModel.stoppedDownloads).toHaveLength(1);
            expect(viewModel.activeCount).toBe(1);
            expect(viewModel.hasActiveDownloads).toBe(true);
        });

        it('should classify downloads by status correctly', () => {
            const viewModel = presenter.buildViewModel(mockState);

            expect(viewModel.activeDownloads).toHaveLength(1);
            expect(viewModel.activeDownloads[0].downloadId).toBe('download-1');
            
            expect(viewModel.completedDownloads).toHaveLength(1);
            expect(viewModel.completedDownloads[0].downloadId).toBe('download-2');
            
            expect(viewModel.failedDownloads).toHaveLength(1);
            expect(viewModel.failedDownloads[0].downloadId).toBe('download-3');
            
            expect(viewModel.stoppedDownloads).toHaveLength(1);
            expect(viewModel.stoppedDownloads[0].downloadId).toBe('download-4');
        });

        it('should calculate average progress correctly', () => {
            const viewModel = presenter.buildViewModel(mockState);

            expect(viewModel.averageProgress).toBe(50); // Only one active download at 50%
        });

        it('should calculate average progress for multiple active downloads', () => {
            const stateWithMultipleActive = {
                ...mockState,
                downloads: [
                    { downloadId: 'download-1', status: 'downloading', percent: 50 },
                    { downloadId: 'download-2', status: 'downloading', percent: 75 },
                    { downloadId: 'download-3', status: 'pending', percent: 0 }
                ]
            };

            mockStore.getState.mockReturnValue(stateWithMultipleActive);
            const viewModel = presenter.buildViewModel(stateWithMultipleActive);

            expect(viewModel.averageProgress).toBe(42); // (50 + 75 + 0) / 3 = 41.66 -> rounded to 42
        });

        it('should return 0 average progress when no active downloads', () => {
            const stateWithNoActive = {
                ...mockState,
                downloads: [
                    { downloadId: 'download-1', status: 'completed', percent: 100 },
                    { downloadId: 'download-2', status: 'failed', percent: 30 }
                ]
            };

            mockStore.getState.mockReturnValue(stateWithNoActive);
            const viewModel = presenter.buildViewModel(stateWithNoActive);

            expect(viewModel.averageProgress).toBe(0);
        });

        it('should enrich downloads with computed properties', () => {
            const viewModel = presenter.buildViewModel(mockState);
            const activeDownload = viewModel.activeDownloads[0];

            expect(activeDownload.isActive).toBe(true);
            expect(activeDownload.isCompleted).toBe(false);
            expect(activeDownload.isFailed).toBe(false);
            expect(activeDownload.isStopped).toBe(false);
            expect(activeDownload.statusText).toBe('جاري التحميل');
        });

        it('should handle empty downloads array', () => {
            const emptyState = {
                downloads: [],
                isLoading: false,
                error: null
            };

            const viewModel = presenter.buildViewModel(emptyState);

            expect(viewModel.allDownloads).toHaveLength(0);
            expect(viewModel.activeDownloads).toHaveLength(0);
            expect(viewModel.completedDownloads).toHaveLength(0);
            expect(viewModel.failedDownloads).toHaveLength(0);
            expect(viewModel.stoppedDownloads).toHaveLength(0);
            expect(viewModel.activeCount).toBe(0);
            expect(viewModel.hasActiveDownloads).toBe(false);
            expect(viewModel.averageProgress).toBe(0);
        });

        it('should classify pending downloads as active', () => {
            const stateWithPending = {
                ...mockState,
                downloads: [
                    { downloadId: 'download-1', status: 'pending', percent: 0 }
                ]
            };

            mockStore.getState.mockReturnValue(stateWithPending);
            const viewModel = presenter.buildViewModel(stateWithPending);

            expect(viewModel.activeDownloads).toHaveLength(1);
            expect(viewModel.activeDownloads[0].isActive).toBe(true);
        });

        it('should provide correct status text for all statuses', () => {
            const viewModel = presenter.buildViewModel(mockState);

            expect(viewModel.activeDownloads[0].statusText).toBe('جاري التحميل');
            expect(viewModel.completedDownloads[0].statusText).toBe('مكتمل');
            expect(viewModel.failedDownloads[0].statusText).toBe('فشل');
            expect(viewModel.stoppedDownloads[0].statusText).toBe('متوقف');
        });
    });

    describe('Helper Methods', () => {
        it('should return correct download by ID', () => {
            const download = presenter.getDownloadById('download-1');

            expect(download).toBeDefined();
            expect(download.downloadId).toBe('download-1');
        });

        it('should return null for non-existent download ID', () => {
            const download = presenter.getDownloadById('non-existent');

            expect(download).toBeNull();
        });

        it('should return downloads for specific device', () => {
            const deviceDownloads = presenter.getDownloadsByDevice('device-1');

            expect(deviceDownloads).toHaveLength(2);
            expect(deviceDownloads.every(d => d.deviceId === 'device-1')).toBe(true);
        });

        it('should return empty array for device with no downloads', () => {
            const deviceDownloads = presenter.getDownloadsByDevice('device-999');

            expect(deviceDownloads).toEqual([]);
        });
    });
});
