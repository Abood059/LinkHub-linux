'use strict';

const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('StateSyncService Security Tests', () => {
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

    describe('Pass-through malicious data', () => {
        test('should pass through malicious data in URL', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                url: '<script>alert("xss")</script>'
            };

            stateSyncService.onDownloadProgress(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.url).toBe('<script>alert("xss")</script>');
        });

        test('should pass through malicious data in download complete', () => {
            const maliciousData = {
                downloadId: 'dl1',
                outputPath: '/path/<script>alert(1)</script>.mp4'
            };

            stateSyncService.onDownloadComplete(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.outputPath).toContain('<script>alert(1)</script>');
        });

        test('should pass through malicious data in download error', () => {
            const maliciousData = {
                downloadId: 'dl1',
                error: '<img src=x onerror=alert(1)>'
            };

            stateSyncService.onDownloadError(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.error).toContain('<img src=x onerror=alert(1)>');
        });
    });

    describe('Prototype pollution', () => {
        test('should not be vulnerable to prototype pollution in download data', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                __proto__: { polluted: true }
            };

            stateSyncService.onDownloadProgress(maliciousData);
            
            expect(Object.prototype.polluted).toBeUndefined();
        });

        test('should handle constructor pollution attempt', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                constructor: { polluted: true }
            };

            stateSyncService.onDownloadProgress(maliciousData);
            
            expect(Object.constructor.polluted).toBeUndefined();
        });

        test('should handle prototype in nested objects', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                nested: {
                    __proto__: { polluted: true }
                }
            };

            stateSyncService.onDownloadProgress(maliciousData);
            
            expect(Object.prototype.polluted).toBeUndefined();
        });
    });

    describe('Command injection in deviceId', () => {
        test('should pass through command injection attempts in deviceId', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                deviceId: 'device1; rm -rf /'
            };

            stateSyncService.onDownloadProgress(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.deviceId).toBe('device1; rm -rf /');
        });

        test('should pass through pipe command in deviceId', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                deviceId: 'device1 | cat /etc/passwd'
            };

            stateSyncService.onDownloadProgress(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.deviceId).toBe('device1 | cat /etc/passwd');
        });

        test('should pass through backtick command in deviceId', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                deviceId: 'device1`whoami`'
            };

            stateSyncService.onDownloadProgress(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.deviceId).toBe('device1`whoami`');
        });
    });

    describe('XSS in download URL', () => {
        test('should pass through XSS in URL', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                url: 'javascript:alert(document.cookie)'
            };

            stateSyncService.onDownloadProgress(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.url).toBe('javascript:alert(document.cookie)');
        });

        test('should pass through data URL with script', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                url: 'data:text/html,<script>alert(1)</script>'
            };

            stateSyncService.onDownloadProgress(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.url).toBe('data:text/html,<script>alert(1)</script>');
        });

        test('should pass through onerror in URL', () => {
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                url: 'http://evil.com/<img src=x onerror=alert(1)>'
            };

            stateSyncService.onDownloadProgress(maliciousData);
            const download = stateSyncService._state.downloads.get('dl1');

            expect(download.url).toContain('onerror=alert(1)');
        });
    });

    describe('Large payload handling (DoS prevention)', () => {
        test('should handle large download object', () => {
            const largeData = {
                downloadId: 'dl1',
                percent: 50,
                largeField: 'x'.repeat(1000000) // 1MB string
            };

            expect(() => {
                stateSyncService.onDownloadProgress(largeData);
            }).not.toThrow();
        });

        test('should handle many downloads', () => {
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

        test('should handle large device array', () => {
            const largeDevices = [];
            for (let i = 0; i < 10000; i++) {
                largeDevices.push({ id: `device${i}`, name: `Device ${i}` });
            }

            mockDeviceRegistry.getAllDevices.mockReturnValue(largeDevices);

            expect(() => {
                stateSyncService._loadDeviceState();
            }).not.toThrow();
        });

        test('should handle deep nested object', () => {
            let deepObj = { value: 'deep' };
            for (let i = 0; i < 1000; i++) {
                deepObj = { nested: deepObj };
            }

            const data = {
                downloadId: 'dl1',
                percent: 50,
                deep: deepObj
            };

            expect(() => {
                stateSyncService.onDownloadProgress(data);
            }).not.toThrow();
        });
    });

    describe('Null/undefined validation for required parameters', () => {
        test('should handle null downloadId gracefully', () => {
            stateSyncService.onDownloadProgress({ downloadId: null, percent: 50 });
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle undefined downloadId gracefully', () => {
            stateSyncService.onDownloadProgress({ downloadId: undefined, percent: 50 });
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle null data in download progress', () => {
            stateSyncService.onDownloadProgress(null);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle undefined data in download progress', () => {
            stateSyncService.onDownloadProgress(undefined);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle null in download complete', () => {
            stateSyncService.onDownloadComplete(null);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle null in download error', () => {
            stateSyncService.onDownloadError(null);
            expect(stateSyncService._hasChanges).toBe(false);
        });

        test('should handle null in download stopped', () => {
            stateSyncService.onDownloadStopped(null);
            expect(stateSyncService._hasChanges).toBe(false);
        });
    });

    describe('State isolation (no cross-contamination)', () => {
        test('should not cross-contaminate downloads', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50, url: 'url1' });
            stateSyncService.onDownloadProgress({ downloadId: 'dl2', percent: 30, url: 'url2' });

            const dl1 = stateSyncService._state.downloads.get('dl1');
            const dl2 = stateSyncService._state.downloads.get('dl2');

            expect(dl1.percent).toBe(50);
            expect(dl2.percent).toBe(30);
            expect(dl1.url).toBe('url1');
            expect(dl2.url).toBe('url2');
        });

        test('should not cross-contaminate devices and downloads', () => {
            mockDeviceRegistry.getAllDevices.mockReturnValue([{ id: 'device1' }]);
            stateSyncService._loadDeviceState();

            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });

            expect(stateSyncService._state.devices).toHaveLength(1);
            expect(stateSyncService._state.downloads.size).toBe(1);
        });

        test('should isolate download states', () => {
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            stateSyncService.onDownloadComplete({ downloadId: 'dl2', outputPath: '/path' });
            stateSyncService.onDownloadError({ downloadId: 'dl3', error: 'error' });

            expect(stateSyncService._state.downloads.get('dl1').status).toBe('downloading');
            expect(stateSyncService._state.downloads.get('dl2').status).toBe('completed');
            expect(stateSyncService._state.downloads.get('dl3').status).toBe('failed');
        });
    });

    describe('Special characters and encoding', () => {
        test('should handle unicode in downloadId', () => {
            const data = { downloadId: 'تحميل-١', percent: 50 };
            stateSyncService.onDownloadProgress(data);

            expect(stateSyncService._state.downloads.has('تحميل-١')).toBe(true);
        });

        test('should handle special characters in deviceId', () => {
            const data = { downloadId: 'dl1', percent: 50, deviceId: 'device@#$%^&*()' };
            stateSyncService.onDownloadProgress(data);

            expect(stateSyncService._state.downloads.get('dl1').deviceId).toBe('device@#$%^&*()');
        });

        test('should handle null bytes in strings', () => {
            const data = { downloadId: 'dl\x00test', percent: 50 };
            stateSyncService.onDownloadProgress(data);

            expect(stateSyncService._state.downloads.has('dl\x00test')).toBe(true);
        });
    });

    describe('Broadcast security', () => {
        test('should broadcast malicious data in URL as-is', () => {
            stateSyncService.start();
            const maliciousData = {
                downloadId: 'dl1',
                percent: 50,
                url: '<script>alert(1)</script>'
            };

            stateSyncService.onDownloadProgress(maliciousData);
            mockWindowManager.broadcast.mockClear();

            jest.advanceTimersByTime(100);

            const broadcastedState = mockWindowManager.broadcast.mock.calls[0][1];
            expect(broadcastedState.downloads[0].url).toBe('<script>alert(1)</script>');
        });
    });
});
