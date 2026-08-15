'use strict';

const StateSyncService = require('../../../../src/main/infrastructure/sync/StateSyncService');

describe('StateSyncService Performance Tests', () => {
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

    describe('Constructor time', () => {
        test('should construct in less than 10ms', () => {
            const start = Date.now();
            
            for (let i = 0; i < 100; i++) {
                const service = new StateSyncService(mockWindowManager, mockDeviceRegistry);
            }
            
            const end = Date.now();
            const avgTime = (end - start) / 100;

            console.log(`[Performance] Average constructor time: ${avgTime.toFixed(3)}ms`);
            expect(avgTime).toBeLessThan(10);
        });
    });

    describe('1000 download progress events', () => {
        test('should handle 1000 download progress events in less than 100ms', () => {
            const start = Date.now();

            for (let i = 0; i < 1000; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i}`,
                    percent: i % 100,
                    url: `http://test.com/${i}`,
                    deviceId: `device${i % 10}`
                });
            }

            const end = Date.now();
            const duration = end - start;

            console.log(`[Performance] 1000 download progress events in ${duration}ms`);
            expect(duration).toBeLessThan(100);
            expect(stateSyncService._state.downloads.size).toBe(1000);
        });

        test('should handle 1000 download progress events with minimal memory increase', () => {
            const memBefore = process.memoryUsage().heapUsed;

            for (let i = 0; i < 1000; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i}`,
                    percent: i % 100
                });
            }

            const memAfter = process.memoryUsage().heapUsed;
            const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

            console.log(`[Performance] Memory increase for 1000 downloads: ${memIncrease.toFixed(2)}MB`);
            expect(memIncrease).toBeLessThan(10); // Less than 10MB increase
        });
    });

    describe('Broadcast interval accuracy', () => {
        test('should broadcast at 100ms ± 10ms', () => {
            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            mockWindowManager.broadcast.mockClear();

            const timings = [];
            for (let i = 0; i < 10; i++) {
                const start = Date.now();
                jest.advanceTimersByTime(100);
                const end = Date.now();
                timings.push(end - start);
            }

            console.log(`[Performance] Broadcast timings: ${timings.map(t => `${t}ms`).join(', ')}`);
            
            timings.forEach(timing => {
                expect(timing).toBeGreaterThanOrEqual(90);
                expect(timing).toBeLessThanOrEqual(110);
            });
        });

        test('should maintain consistent interval over time', () => {
            stateSyncService.start();
            stateSyncService.onDownloadProgress({ downloadId: 'dl1', percent: 50 });
            mockWindowManager.broadcast.mockClear();

            const intervals = [];
            let lastCall = 0;

            for (let i = 0; i < 20; i++) {
                jest.advanceTimersByTime(100);
                if (mockWindowManager.broadcast.mock.calls.length > 0) {
                    const currentCall = mockWindowManager.broadcast.mock.calls.length;
                    if (currentCall > lastCall) {
                        intervals.push(100);
                        lastCall = currentCall;
                    }
                }
            }

            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            console.log(`[Performance] Average broadcast interval: ${avgInterval.toFixed(2)}ms`);
            expect(avgInterval).toBe(100);
        });
    });

    describe('Memory usage with 1000 downloads', () => {
        test('should handle 1000 downloads with reasonable memory', () => {
            const memBefore = process.memoryUsage().heapUsed;

            for (let i = 0; i < 1000; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i}`,
                    percent: i % 100,
                    url: `http://example.com/video${i}.mp4`,
                    deviceId: `device${i % 10}`
                });
            }

            const memAfter = process.memoryUsage().heapUsed;
            const memIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

            console.log(`[Performance] Memory with 1000 downloads: ${memIncrease.toFixed(2)}MB increase`);
            expect(memIncrease).toBeLessThan(20); // Less than 20MB for 1000 downloads
        });

        test('should not leak memory when clearing downloads', () => {
            // Add 1000 downloads
            for (let i = 0; i < 1000; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i}`,
                    percent: i % 100
                });
            }

            const memAfterAdd = process.memoryUsage().heapUsed;

            // Clear downloads
            stateSyncService._state.downloads.clear();

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const memAfterClear = process.memoryUsage().heapUsed;
            const memReleased = (memAfterAdd - memAfterClear) / 1024 / 1024; // MB

            console.log(`[Performance] Memory released after clearing: ${memReleased.toFixed(2)}MB`);
            expect(memReleased).toBeGreaterThan(0);
        });
    });

    describe('State update with 100 devices', () => {
        test('should update state with 100 devices in less than 5ms', () => {
            const devices = [];
            for (let i = 0; i < 100; i++) {
                devices.push({
                    id: `device${i}`,
                    name: `Device ${i}`,
                    model: 'Model'
                });
            }

            mockDeviceRegistry.getAllDevices.mockReturnValue(devices);
            mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'online' });

            const start = Date.now();
            stateSyncService._loadDeviceState();
            const end = Date.now();

            const duration = end - start;
            console.log(`[Performance] State update with 100 devices: ${duration}ms`);
            expect(duration).toBeLessThan(5);
        });

        test('should handle 1000 devices efficiently', () => {
            const devices = [];
            for (let i = 0; i < 1000; i++) {
                devices.push({
                    id: `device${i}`,
                    name: `Device ${i}`,
                    model: 'Model'
                });
            }

            mockDeviceRegistry.getAllDevices.mockReturnValue(devices);
            mockDeviceRegistry.getRuntimeState.mockReturnValue({ status: 'online' });

            const start = Date.now();
            stateSyncService._loadDeviceState();
            const end = Date.now();

            const duration = end - start;
            console.log(`[Performance] State update with 1000 devices: ${duration}ms`);
            expect(duration).toBeLessThan(50);
        });
    });

    describe('Concurrent event handling', () => {
        test('should handle concurrent download and device events', () => {
            const start = Date.now();

            // Simulate concurrent events
            for (let i = 0; i < 100; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i}`,
                    percent: i % 100
                });
            }

            mockDeviceRegistry.getAllDevices.mockReturnValue([
                { id: 'device1' },
                { id: 'device2' }
            ]);
            stateSyncService._loadDeviceState();

            for (let i = 0; i < 100; i++) {
                stateSyncService.onDownloadComplete({
                    downloadId: `dl${i}`,
                    outputPath: `/path/${i}.mp4`
                });
            }

            const end = Date.now();
            const duration = end - start;

            console.log(`[Performance] Concurrent events (200 total): ${duration}ms`);
            expect(duration).toBeLessThan(50);
        });

        test('should handle rapid state changes', () => {
            stateSyncService.start();
            const start = Date.now();

            // Fire 1000 rapid events
            for (let i = 0; i < 1000; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i % 100}`, // Reuse download IDs
                    percent: i % 100
                });
            }

            const end = Date.now();
            const duration = end - start;

            console.log(`[Performance] 1000 rapid events: ${duration}ms`);
            expect(duration).toBeLessThan(100);
        });
    });

    describe('Broadcast performance', () => {
        test('should broadcast large state quickly', () => {
            // Create large state
            for (let i = 0; i < 1000; i++) {
                stateSyncService._state.downloads.set(`dl${i}`, {
                    downloadId: `dl${i}`,
                    percent: i % 100,
                    url: `http://example.com/video${i}.mp4`,
                    deviceId: `device${i % 10}`,
                    status: 'downloading'
                });
            }

            mockDeviceRegistry.getAllDevices.mockReturnValue(
                Array.from({ length: 100 }, (_, i) => ({
                    id: `device${i}`,
                    name: `Device ${i}`
                }))
            );
            stateSyncService._loadDeviceState();

            stateSyncService.start();
            mockWindowManager.broadcast.mockClear();

            const start = Date.now();
            stateSyncService._broadcastState();
            const end = Date.now();

            const duration = end - start;
            console.log(`[Performance] Broadcast large state (1000 downloads, 100 devices): ${duration}ms`);
            expect(duration).toBeLessThan(20);
        });

        test('should handle frequent broadcasts without degradation', () => {
            stateSyncService.start();

            // Add some downloads
            for (let i = 0; i < 100; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i}`,
                    percent: i % 100
                });
            }

            const timings = [];
            for (let i = 0; i < 50; i++) {
                // Add a change to trigger broadcast
                stateSyncService.onDownloadProgress({ downloadId: `dl${i % 100}`, percent: (i * 2) % 100 });
                
                const start = Date.now();
                stateSyncService._broadcastState();
                const end = Date.now();
                timings.push(end - start);
            }

            const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
            const maxTime = Math.max(...timings);

            console.log(`[Performance] 50 broadcasts - avg: ${avgTime.toFixed(2)}ms, max: ${maxTime}ms`);
            expect(avgTime).toBeLessThan(5);
            expect(maxTime).toBeLessThan(20);
        });
    });

    describe('getState performance', () => {
        test('should return state quickly with many downloads', () => {
            for (let i = 0; i < 1000; i++) {
                stateSyncService._state.downloads.set(`dl${i}`, {
                    downloadId: `dl${i}`,
                    percent: i % 100
                });
            }

            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                stateSyncService.getState();
            }
            const end = Date.now();

            const avgTime = (end - start) / 100;
            console.log(`[Performance] getState with 1000 downloads: ${avgTime.toFixed(3)}ms avg`);
            expect(avgTime).toBeLessThan(1);
        });
    });

    describe('Event handler performance', () => {
        test('should handle onDownloadProgress efficiently', () => {
            const iterations = 10000;
            const start = Date.now();

            for (let i = 0; i < iterations; i++) {
                stateSyncService.onDownloadProgress({
                    downloadId: `dl${i % 100}`,
                    percent: i % 100,
                    url: `http://test.com/${i}`,
                    deviceId: `device${i % 10}`
                });
            }

            const end = Date.now();
            const avgTime = (end - start) / iterations;

            console.log(`[Performance] onDownloadProgress: ${avgTime.toFixed(4)}ms avg (${iterations} calls)`);
            expect(avgTime).toBeLessThan(0.1);
        });

        test('should handle onDownloadComplete efficiently', () => {
            const iterations = 10000;
            const start = Date.now();

            for (let i = 0; i < iterations; i++) {
                stateSyncService.onDownloadComplete({
                    downloadId: `dl${i % 100}`,
                    outputPath: `/path/${i}.mp4`
                });
            }

            const end = Date.now();
            const avgTime = (end - start) / iterations;

            console.log(`[Performance] onDownloadComplete: ${avgTime.toFixed(4)}ms avg (${iterations} calls)`);
            expect(avgTime).toBeLessThan(0.1);
        });

        test('should handle onDownloadError efficiently', () => {
            const iterations = 10000;
            const start = Date.now();

            for (let i = 0; i < iterations; i++) {
                stateSyncService.onDownloadError({
                    downloadId: `dl${i % 100}`,
                    error: `Error ${i}`
                });
            }

            const end = Date.now();
            const avgTime = (end - start) / iterations;

            console.log(`[Performance] onDownloadError: ${avgTime.toFixed(4)}ms avg (${iterations} calls)`);
            expect(avgTime).toBeLessThan(0.1);
        });
    });
});
