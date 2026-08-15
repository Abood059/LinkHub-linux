'use strict';

const DownloadSyncService = require('../../../../src/main/infrastructure/sync/DownloadSyncService');

describe('DownloadSyncService', () => {
    let downloadSyncService;
    let mockDownloadManager;
    let mockDownloadRepository;
    let mockLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Mock DownloadManager
        mockDownloadManager = {
            getActiveDownloads: jest.fn(() => new Map()),
            getDownloadEntry: jest.fn()
        };

        // Mock DownloadRepository
        mockDownloadRepository = {
            updateProgress: jest.fn(),
            deleteDownload: jest.fn()
        };

        // Mock Logger
        mockLogger = {
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn()
        };

        downloadSyncService = new DownloadSyncService(
            mockDownloadManager,
            mockDownloadRepository,
            mockLogger
        );
    });

    afterEach(() => {
        if (downloadSyncService._isRunning) {
            downloadSyncService.stop();
        }
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    describe('Constructor', () => {
        test('should throw error if downloadManager is not provided', () => {
            expect(() => new DownloadSyncService(null, mockDownloadRepository, mockLogger))
                .toThrow('downloadManager is required for DownloadSyncService');
        });

        test('should throw error if downloadRepository is not provided', () => {
            expect(() => new DownloadSyncService(mockDownloadManager, null, mockLogger))
                .toThrow('downloadRepository is required for DownloadSyncService');
        });

        test('should accept valid dependencies', () => {
            expect(() => new DownloadSyncService(mockDownloadManager, mockDownloadRepository, mockLogger))
                .not.toThrow();
        });

        test('should set default interval to 300ms', () => {
            expect(downloadSyncService._interval).toBe(300);
        });

        test('should initialize with isRunning false', () => {
            expect(downloadSyncService._isRunning).toBe(false);
        });

        test('should initialize with isSyncing false', () => {
            expect(downloadSyncService._isSyncing).toBe(false);
        });

        test('should initialize empty lastKnownValues map', () => {
            expect(downloadSyncService._lastKnownValues).toBeInstanceOf(Map);
            expect(downloadSyncService._lastKnownValues.size).toBe(0);
        });

        test('should initialize empty previousDownloadIds set', () => {
            expect(downloadSyncService._previousDownloadIds).toBeInstanceOf(Set);
            expect(downloadSyncService._previousDownloadIds.size).toBe(0);
        });
    });

    describe('start', () => {
        test('should start the service and set isRunning to true', () => {
            downloadSyncService.start();
            expect(downloadSyncService._isRunning).toBe(true);
        });

        test('should not start if already running', () => {
            downloadSyncService.start();
            const timer1 = downloadSyncService._timer;
            downloadSyncService.start();
            const timer2 = downloadSyncService._timer;
            expect(timer1).toBe(timer2);
        });

        test('should set up interval timer', () => {
            downloadSyncService.start();
            expect(downloadSyncService._timer).not.toBeNull();
        });

        test('should run sync cycle at interval', () => {
            downloadSyncService.start();
            mockDownloadManager.getActiveDownloads.mockReturnValue(new Map([
                ['dl1', { percent: 50, status: 'downloading' }]
            ]));

            jest.advanceTimersByTime(300);
            expect(mockDownloadManager.getActiveDownloads).toHaveBeenCalled();
        });
    });

    describe('stop', () => {
        test('should stop the service and set isRunning to false', () => {
            downloadSyncService.start();
            downloadSyncService.stop();
            expect(downloadSyncService._isRunning).toBe(false);
        });

        test('should not stop if not running', () => {
            downloadSyncService.stop();
            expect(downloadSyncService._isRunning).toBe(false);
            expect(() => downloadSyncService.stop()).not.toThrow();
        });

        test('should clear interval timer', () => {
            downloadSyncService.start();
            downloadSyncService.stop();
            expect(downloadSyncService._timer).toBeNull();
        });
    });

    describe('getStatus', () => {
        test('should return service status', () => {
            const status = downloadSyncService.getStatus();
            expect(status).toHaveProperty('isRunning');
            expect(status).toHaveProperty('isSyncing');
            expect(status).toHaveProperty('interval');
            expect(status).toHaveProperty('stats');
            expect(status).toHaveProperty('trackedDownloads');
        });

        test('should return correct isRunning status', () => {
            downloadSyncService.start();
            const status = downloadSyncService.getStatus();
            expect(status.isRunning).toBe(true);
        });

        test('should return tracked downloads count', () => {
            downloadSyncService._lastKnownValues.set('dl1', { percent: 50 });
            const status = downloadSyncService.getStatus();
            expect(status.trackedDownloads).toBe(1);
        });
    });

    describe('Dirty tracking', () => {
        test('should detect changes in percent', () => {
            const entry = { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 };
            downloadSyncService._lastKnownValues.set('dl1', { percent: 40, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 });

            const changes = downloadSyncService._detectChanges('dl1', entry);
            expect(changes).toEqual({ percent: 50 });
        });

        test('should detect changes in status', () => {
            const entry = { percent: 50, status: 'completed', speed: 0, downloadedBytes: 2048, eta: 0, totalSize: 2048, retryCount: 0 };
            downloadSyncService._lastKnownValues.set('dl1', { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 });

            const changes = downloadSyncService._detectChanges('dl1', entry);
            expect(changes).toEqual({ status: 'completed', speed: 0, downloadedBytes: 2048, eta: 0 });
        });

        test('should detect changes in multiple fields', () => {
            const entry = { percent: 60, status: 'downloading', speed: 2000, downloadedBytes: 1536, eta: 30, totalSize: 2048, retryCount: 0 };
            downloadSyncService._lastKnownValues.set('dl1', { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 });

            const changes = downloadSyncService._detectChanges('dl1', entry);
            expect(changes).toEqual({ percent: 60, speed: 2000, downloadedBytes: 1536, eta: 30 });
        });

        test('should return empty object if no changes', () => {
            const entry = { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 };
            downloadSyncService._lastKnownValues.set('dl1', { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 });

            const changes = downloadSyncService._detectChanges('dl1', entry);
            expect(changes).toEqual({});
        });

        test('should detect all fields on first occurrence', () => {
            const entry = { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 };
            
            const changes = downloadSyncService._detectChanges('dl1', entry);
            expect(changes).toEqual({
                percent: 50,
                status: 'downloading',
                speed: 1000,
                downloadedBytes: 1024,
                eta: 60,
                totalSize: 2048,
                retryCount: 0
            });
        });
    });

    describe('Deleted downloads handling', () => {
        test('should delete download from database when removed from memory', async () => {
            downloadSyncService._previousDownloadIds.add('dl1');
            mockDownloadManager.getActiveDownloads.mockReturnValue(new Map());

            await downloadSyncService._handleDeletedDownloads(new Set());

            expect(mockDownloadRepository.deleteDownload).toHaveBeenCalledWith('dl1');
            expect(downloadSyncService._lastKnownValues.has('dl1')).toBe(false);
        });

        test('should handle multiple deleted downloads', async () => {
            downloadSyncService._previousDownloadIds.add('dl1');
            downloadSyncService._previousDownloadIds.add('dl2');
            downloadSyncService._previousDownloadIds.add('dl3');
            mockDownloadManager.getActiveDownloads.mockReturnValue(new Map());

            await downloadSyncService._handleDeletedDownloads(new Set());

            expect(mockDownloadRepository.deleteDownload).toHaveBeenCalledTimes(3);
        });

        test('should not delete if download still exists', async () => {
            downloadSyncService._previousDownloadIds.add('dl1');
            mockDownloadManager.getActiveDownloads.mockReturnValue(new Map([['dl1', {}]]));

            await downloadSyncService._handleDeletedDownloads(new Set(['dl1']));

            expect(mockDownloadRepository.deleteDownload).not.toHaveBeenCalled();
        });

        test('should handle delete errors gracefully', async () => {
            downloadSyncService._previousDownloadIds.add('dl1');
            mockDownloadManager.getActiveDownloads.mockReturnValue(new Map());
            mockDownloadRepository.deleteDownload.mockImplementation(() => {
                throw new Error('Database error');
            });

            await downloadSyncService._handleDeletedDownloads(new Set());

            expect(downloadSyncService._lastKnownValues.has('dl1')).toBe(true); // Should not remove from tracking on error
        });
    });

    describe('Retry policy', () => {
        test('should retry on write failure', async () => {
            mockDownloadRepository.updateProgress
                .mockImplementationOnce(() => { throw new Error('DB error'); })
                .mockImplementationOnce(() => {}); // Success on retry

            const entry = { percent: 50, status: 'downloading' };
            mockDownloadManager.getDownloadEntry.mockReturnValue(entry);

            await downloadSyncService._writeChangesWithRetry('dl1', { percent: 50 });

            expect(mockDownloadRepository.updateProgress).toHaveBeenCalledTimes(2);
        });

        test('should use exponential backoff delays', async () => {
            const delays = [100, 200, 400, 800, 1600];
            let attemptCount = 0;

            mockDownloadRepository.updateProgress.mockImplementation(() => {
                attemptCount++;
                if (attemptCount < 5) {
                    throw new Error('DB error');
                }
            });

            const entry = { percent: 50, status: 'downloading' };
            mockDownloadManager.getDownloadEntry.mockReturnValue(entry);

            const startTime = Date.now();
            try {
                await downloadSyncService._writeChangesWithRetry('dl1', { percent: 50 });
            } catch (error) {
                // Expected to fail after all retries
            }
            const elapsed = Date.now() - startTime;

            // Should have waited for delays (100 + 200 + 400 + 800 = 1500ms minimum)
            expect(elapsed).toBeGreaterThanOrEqual(1500);
        });

        test('should give up after 5 retries', async () => {
            mockDownloadRepository.updateProgress.mockImplementation(() => {
                throw new Error('DB error');
            });

            const entry = { percent: 50, status: 'downloading' };
            mockDownloadManager.getDownloadEntry.mockReturnValue(entry);

            await expect(downloadSyncService._writeChangesWithRetry('dl1', { percent: 50 }))
                .rejects.toThrow();

            expect(mockDownloadRepository.updateProgress).toHaveBeenCalledTimes(5);
        });

        test('should re-read data from memory on each retry', async () => {
            mockDownloadRepository.updateProgress
                .mockImplementationOnce(() => { throw new Error('DB error'); })
                .mockImplementationOnce(() => {}); // Success on retry

            const entry1 = { percent: 50, status: 'downloading' };
            const entry2 = { percent: 60, status: 'downloading' };
            mockDownloadManager.getDownloadEntry
                .mockReturnValueOnce(entry1)
                .mockReturnValueOnce(entry2);

            await downloadSyncService._writeChangesWithRetry('dl1', { percent: 50 });

            expect(mockDownloadManager.getDownloadEntry).toHaveBeenCalledTimes(2);
        });
    });

    describe('flush', () => {
        test('should stop the service', async () => {
            downloadSyncService.start();
            await downloadSyncService.flush();
            expect(downloadSyncService._isRunning).toBe(false);
        });

        test('should wait for current sync cycle to complete', async () => {
            downloadSyncService._isSyncing = true;
            
            const promise = downloadSyncService.flush();
            
            // Simulate sync cycle completing
            setTimeout(() => {
                downloadSyncService._isSyncing = false;
            }, 100);

            await promise;
        });

        test('should timeout waiting for sync cycle', async () => {
            downloadSyncService._isSyncing = true;
            
            await expect(downloadSyncService.flush()).resolves.toBe(false);
        });

        test('should write all data ignoring dirty tracking', async () => {
            const activeDownloads = new Map([
                ['dl1', { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 }]
            ]);
            mockDownloadManager.getActiveDownloads.mockReturnValue(activeDownloads);

            await downloadSyncService.flush();

            expect(mockDownloadRepository.updateProgress).toHaveBeenCalledWith('dl1', {
                percent: 50,
                status: 'downloading',
                speed: 1000,
                downloadedBytes: 1024,
                eta: 60,
                totalSize: 2048,
                retryCount: 0
            });
        });

        test('should return true on successful flush', async () => {
            mockDownloadManager.getActiveDownloads.mockReturnValue(new Map());

            const result = await downloadSyncService.flush();
            expect(result).toBe(true);
        });

        test('should return false on flush failure', async () => {
            mockDownloadManager.getActiveDownloads.mockReturnValue(new Map([
                ['dl1', { percent: 50 }]
            ]));
            mockDownloadRepository.updateProgress.mockImplementation(() => {
                throw new Error('DB error');
            });

            const result = await downloadSyncService.flush();
            expect(result).toBe(false);
        });

        test('should respect timeout during flush', async () => {
            const activeDownloads = new Map([
                ['dl1', { percent: 50 }]
            ]);
            mockDownloadManager.getActiveDownloads.mockReturnValue(activeDownloads);
            mockDownloadRepository.updateProgress.mockImplementation(() => {
                return new Promise(resolve => setTimeout(resolve, 5000)); // Long delay
            });

            const result = await downloadSyncService.flush();
            expect(result).toBe(false);
        });
    });

    describe('Sync cycle integration', () => {
        test('should run complete sync cycle', async () => {
            const activeDownloads = new Map([
                ['dl1', { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 }]
            ]);
            mockDownloadManager.getActiveDownloads.mockReturnValue(activeDownloads);

            downloadSyncService.start();
            jest.advanceTimersByTime(300);

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockDownloadRepository.updateProgress).toHaveBeenCalled();
        });

        test('should skip cycle if already syncing', () => {
            downloadSyncService._isSyncing = true;
            downloadSyncService.start();
            jest.advanceTimersByTime(300);

            expect(mockDownloadManager.getActiveDownloads).not.toHaveBeenCalled();
        });

        test('should update statistics on successful cycle', async () => {
            const activeDownloads = new Map([
                ['dl1', { percent: 50, status: 'downloading', speed: 1000, downloadedBytes: 1024, eta: 60, totalSize: 2048, retryCount: 0 }]
            ]);
            mockDownloadManager.getActiveDownloads.mockReturnValue(activeDownloads);

            downloadSyncService.start();
            jest.advanceTimersByTime(300);

            await new Promise(resolve => setTimeout(resolve, 100));

            const status = downloadSyncService.getStatus();
            expect(status.stats.totalCycles).toBeGreaterThan(0);
        });
    });

    describe('Error logging', () => {
        test('should log errors to file on sync failure', async () => {
            mockDownloadManager.getActiveDownloads.mockImplementation(() => {
                throw new Error('Sync error');
            });

            downloadSyncService.start();
            jest.advanceTimersByTime(300);

            await new Promise(resolve => setTimeout(resolve, 100));

            const status = downloadSyncService.getStatus();
            expect(status.stats.failedWrites).toBeGreaterThan(0);
        });
    });
});
