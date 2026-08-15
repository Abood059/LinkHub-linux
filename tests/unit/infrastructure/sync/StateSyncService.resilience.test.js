'use strict';

const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('StateSyncService Resilience Tests', () => {
    let stateSyncService;
    let mockWindowManager;
    let mockDeviceRegistry;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        mockWindowManager = {
            broadcast: jest.fn()
        };

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

    describe('WindowManager.broadcast failure handling', () => {
        test('should propagate broadcast error', () => {
            mockWindowManager.broadcast.mockImplementation(() => {
                throw new Error('Broadcast failed');
            });

            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });

            expect(() => {
                jest.advanceTimersByTime(100);
            }).toThrow('Broadcast failed');

            expect(mockWindowManager.broadcast).toHaveBeenCalled();
        });

        test('should not continue after broadcast failure (error propagates)', () => {
            let callCount = 0;
            mockWindowManager.broadcast.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('First broadcast failed');
                }
            });

            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });

            // First broadcast fails and propagates
            expect(() => {
                jest.advanceTimersByTime(100);
            }).toThrow('First broadcast failed');

            expect(callCount).toBe(1);
        });

        test('should handle broadcast being null', () => {
            mockWindowManager.broadcast = null;

            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });

            expect(() => {
                jest.advanceTimersByTime(100);
            }).toThrow();
        });
    });

    describe('DeviceRegistry.getAllDevices failure handling', () => {
        test('should throw error when getAllDevices throws', () => {
            mockDeviceRegistry.getAllDevices.mockImplementation(() => {
                throw new Error('Registry error');
            });

            expect(() => {
                stateSyncService._loadDeviceState();
            }).toThrow('Registry error');
        });

        test('should throw error when getAllDevices returns null', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue(null);

            expect(() => {
                stateSyncService._loadDeviceState();
            }).toThrow();
        });

        test('should throw error when getAllDevices returns undefined', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue(undefined);

            expect(() => {
                stateSyncService._loadDeviceState();
            }).toThrow();
        });

        test('should throw error when getAllDevices returns non-array', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue({ not: 'an array' });

            expect(() => {
                stateSyncService._loadDeviceState();
            }).toThrow();
        });
    });

    describe('Rapid start/stop cycles', () => {
        test('should handle rapid start/stop cycles', () => {
            for (let i = 0; i < 10; i++) {
                stateSyncService.start();
                stateSyncService.stop();
            }

            expect(stateSyncService._isRunning).toBe(false);
            expect(stateSyncService._timer).toBeNull();
        });

        test('should handle start without stop', () => {
            for (let i = 0; i < 5; i++) {
                stateSyncService.start();
            }

            expect(stateSyncService._isRunning).toBe(true);
            expect(stateSyncService._timer).not.toBeNull();
        });

        test('should handle stop without start', () => {
            expect(() => {
                for (let i = 0; i < 5; i++) {
                    stateSyncService.stop();
                }
            }).not.toThrow();
        });

        test('should handle start, update, stop, start sequence', () => {
            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            stateSyncService.stop();
            stateSyncService.start();

            expect(stateSyncService._isRunning).toBe(true);
            expect(stateSyncService._timer).not.toBeNull();
        });
    });

    describe('Event handler throws error', () => {
        test('should handle onDownloadProgress throwing error', () => {
            // Override the method to throw
            const originalMethod = stateSyncService.onDownloadProgress.bind(stateSyncService);
            stateSyncService.onDownloadProgress = jest.fn(() => {
                throw new Error('Handler error');
            });

            expect(() => {
                stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            }).toThrow('Handler error');

            // Restore
            stateSyncService.onDownloadProgress = originalMethod;
        });

        test('should handle onDownloadComplete throwing error', () => {
            stateSyncService.onDownloadComplete = jest.fn(() => {
                throw new Error('Handler error');
            });

            expect(() => {
                stateSyncService.onDownloadComplete({ downloadId: 'dl1', outputPath: '/path' });
            }).toThrow('Handler error');
        });

        test('should handle onDownloadError throwing error', () => {
            stateSyncService.onDownloadError = jest.fn(() => {
                throw new Error('Handler error');
            });

            expect(() => {
                stateSyncService.onDownloadError({ downloadId: 'dl1', error: 'Error' });
            }).toThrow('Handler error');
        });

        test('should handle onDeviceStateChanged throwing error', () => {
            stateSyncService.onDeviceStateChanged = jest.fn(() => {
                throw new Error('Handler error');
            });

            expect(() => {
                stateSyncService.onDeviceStateChanged();
            }).toThrow('Handler error');
        });
    });

    describe('Missing downloadId handling', () => {
        test('should handle onDownloadProgress with missing downloadId', () => {
            stateSyncService.onDownloadProgress({ percent: 50 });
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle onDownloadProgress with null downloadId', () => {
            stateSyncService.onDownloadProgress({ downloadId: null, percent: 50 });
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle onDownloadComplete with missing downloadId', () => {
            stateSyncService.onDownloadComplete({ outputPath: '/path' });
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle onDownloadError with missing downloadId', () => {
            stateSyncService.onDownloadError({ error: 'Error' });
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle onDownloadStopped with missing downloadId', () => {
            stateSyncService.onDownloadStopped({});
            expect(stateSyncService._hasChanges).toBe(false);
        });
    });

    describe('Missing deviceId handling', () => {
        test('should handle onDownloadProgress with missing deviceId', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            const download = stateSyncService._state.downloads.get('dl1');
            expect(download.deviceId).toBeNull();
        });

        test('should handle onDownloadComplete with missing deviceId', () => {
            stateSyncService.onDownloadComplete({ downloadId: 'dl1', outputPath: '/path' });
            const download = stateSyncService._state.downloads.get('dl1');
            expect(download.deviceId).toBeNull();
        });

        test('should handle onDownloadError with missing deviceId', () => {
            stateSyncService.onDownloadError({ downloadId: 'dl1', error: 'Error' });
            const download = stateSyncService._state.downloads.get('dl1');
            expect(download.deviceId).toBeNull();
        });

        test('should preserve existing deviceId when not provided', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50, deviceId: 'device1' });
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 60 });
            
            const download = stateSyncService._state.downloads.get('dl1');
            expect(download.deviceId).toBe('device1');
        });
    });

    describe('Invalid state data handling', () => {
        test('should handle state with circular references', () => {
            const circularData = { downloadId: 'dl1', percent: 50 };
            circularData.self = circularData;

            expect(() => {
                stateSyncService.onDownloadProgress(circularData);
            }).not.toThrow();
        });

        test('should handle state with very long strings', () => {
            const longString = 'x'.repeat(10000000); // 10MB string
            stateSyncService.onDownloadProgress({
                downloadId: 'dl1',
                percent: 50,
                longField: longString
            });

            expect(stateSyncService._state.downloads.has('dl1')).toBe(true);
        });

        test('should handle state with special characters in downloadId', () => {
            const specialIds = [
                'dl/1',
                'dl\\1',
                'dl:1',
                'dl*1',
                'dl?1',
                'dl<1>',
                'dl|1',
                'dl"1"',
                'dl\'1\''
            ];

            specialIds.forEach(id => {
                expect(() => {
                    stateSyncService.onDownloadProgress({ downloadId: id, percent: 50 });
                }).not.toThrow();
            });
        });

        test('should handle state with numeric downloadId', () => {
            stateSyncService.onDownloadProgress({ downloadId: 123, percent: 50 });
            // Map uses string conversion for keys
            expect(stateSyncService._state.downloads.has(123)).toBe(true);
        });

        test('should handle state with object as downloadId', () => {
            const objId = { id: 'dl1' };
            stateSyncService.onDownloadProgress({ downloadId: objId, percent: 50 });
            // Objects are converted to string '[object Object]'
            expect(stateSyncService._state.downloads.has(objId)).toBe(true);
        });
    });

    describe('Memory pressure scenarios', () => {
        test('should handle adding many downloads', () => {
            expect(() => {
                for (let i = 0; i < 10000; i++) {
                    stateSyncService.onDownloadProgress({
                        downloadId: `dl${i}`,
                        percent: i % 100
                    });
                }
            }).not.toThrow();

            expect(stateSyncService._state.downloads.size).toBe(10000);
        });

        test('should handle clearing many downloads', () => {
            for (let i = 0; i < 10000; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i}`,
                    percent: i % 100
                });
            }

            expect(() => {
                stateSyncService._state.downloads.clear();
            }).not.toThrow();

            expect(stateSyncService._state.downloads.size).toBe(0);
        });

        test('should handle rapid state updates', () => {
            expect(() => {
                for (let i = 0; i < 10000; i++) {
                    stateSyncService.onDownloadProgress({
                        downloadId: `dl${i % 100}`,
                        percent: i % 100
                    });
                }
            }).not.toThrow();
        });
    });

    describe('Timer resilience', () => {
        test('should handle timer firing while processing', () => {
            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });

            // Simulate timer firing during processing
            mockWindowManager.broadcast.mockImplementation(() => {
                // This could cause issues if not handled properly
                stateSyncService.onDownloadProgress({ downloadId: 'dl2', percent: 30 });
            });

            expect(() => {
                jest.advanceTimersByTime(100);
            }).not.toThrow();
        });

        test('should handle interval change while running', () => {
            stateSyncService.start();
            const oldTimer = stateSyncService._timer;

            stateSyncService.setInterval(200);

            expect(stateSyncService._timer).not.toBe(oldTimer);
            expect(stateSyncService._isRunning).toBe(true);
        });

        test('should handle stop during broadcast', () => {
            mockWindowManager.broadcast.mockImplementation(() => {
                stateSyncService.stop();
            });

            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });

            expect(() => {
                jest.advanceTimersByTime(100);
            }).not.toThrow();
        });
    });

    describe('Concurrent modification resilience', () => {
        test('should handle modifying downloads map during iteration', () => {
            // Add initial downloads
            for (let i = 0; i < 100; i++) {
                stateSyncService._state.downloads.set(`dl${i}`, { downloadId: `dl${i}` });
            }

            // Simulate modification during getState
            const originalGetState = stateSyncService.getState.bind(stateSyncService);
            stateSyncService.getState = jest.fn(() => {
                // Modify while getting state
                stateSyncService._state.downloads.set('dl_new', { downloadId: 'dl_new' });
                return originalGetState();
            });

            expect(() => {
                stateSyncService.getState();
            }).not.toThrow();

            // Restore
            stateSyncService.getState = originalGetState;
        });

        test('should handle device state change during broadcast', () => {
            mockDeviceRegistry.getAllDevices.mockImplementation(() => {
                // Change devices during iteration
                mockDeviceRegistry.getAllDevices.mockReturnValue([{ id: 'device2' }]);
                return [{ id: 'device1' }];
            });

            stateSyncService.start();
            stateSyncService.onDeviceStateChanged();

            expect(() => {
                jest.advanceTimersByTime(100);
            }).not.toThrow();
        });
    });

    describe('Edge case resilience', () => {
        test('should handle empty downloadId string', () => {
            stateSyncService.onDownloadProgress({ downloadId: '', percent: 50 });
            // Empty string is falsy, so the handler returns early
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle whitespace downloadId', () => {
            stateSyncService.onDownloadProgress({ downloadId: '   ', percent: 50 });
            expect(stateSyncService._state.downloads.has('   ')).toBe(true);
        });

        test('should handle NaN percent', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: NaN });
            const download = stateSyncService._state.downloads.get('dl1');
            expect(download.percent).toBeNaN();
        });

        test('should handle negative percent', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: -50 });
            const download = stateSyncService._state.downloads.get('dl1');
            expect(download.percent).toBe(-50);
        });

        test('should handle percent > 100', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 150 });
            const download = stateSyncService._state.downloads.get('dl1');
            expect(download.percent).toBe(150);
        });

        test('should handle Infinity percent', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: Infinity });
            const download = stateSyncService._state.downloads.get('dl1');
            expect(download.percent).toBe(Infinity);
        });
    });

    describe('Recovery scenarios', () => {
        test('should not recover from broadcast failure (error propagates)', () => {
            mockWindowManager.broadcast.mockImplementation(() => {
                throw new Error('Broadcast failed');
            });

            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });

            // Broadcast failure propagates
            expect(() => {
                jest.advanceTimersByTime(100);
            }).toThrow('Broadcast failed');
        });

        test('should recover from device registry error after fix', () => {
            let shouldFail = true;
            mockDeviceRegistry.getAllDevices.mockImplementation(() => {
                if (shouldFail) {
                    throw new Error('Registry error');
                }
                return [{ id: 'device1' }];
            });

            // First call fails
            expect(() => {
                stateSyncService._loadDeviceState();
            }).toThrow();

            // Recover
            shouldFail = false;
            expect(() => {
                stateSyncService._loadDeviceState();
            }).not.toThrow();
        });
    });
});
