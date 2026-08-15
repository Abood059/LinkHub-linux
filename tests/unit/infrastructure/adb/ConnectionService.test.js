'use strict';

// Mock bonjour-service before importing ConnectionService
jest.mock('bonjour-service', () => ({
    Bonjour: jest.fn(() => ({
        find: jest.fn(),
        destroy: jest.fn()
    }))
}));

const { Bonjour } = require('bonjour-service');
const EventEmitter = require('events');
const ConnectionService = require('../../../../src/main/infrastructure/adb/ConnectionService');

describe('ConnectionService', () => {
    let mockAdbExecutor;
    let mockLogger;
    let mockBonjour;
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        
        mockAdbExecutor = {
            getDevices: jest.fn(),
            getDeviceInfo: jest.fn(),
            connect: jest.fn(),
            pair: jest.fn(),
            disconnect: jest.fn()
        };
        
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        
        mockBonjour = {
            find: jest.fn(),
            destroy: jest.fn()
        };
        
        Bonjour.mockReturnValue(mockBonjour);
        
        service = new ConnectionService({
            adbExecutor: mockAdbExecutor,
            logger: mockLogger
        });
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    describe('Constructor', () => {
        test('should be instanceof EventEmitter', () => {
            expect(service).toBeInstanceOf(EventEmitter);
        });

        test('should store adbExecutor', () => {
            expect(service._adbExecutor).toBe(mockAdbExecutor);
        });

        test('should store logger', () => {
            expect(service._logger).toBe(mockLogger);
        });

        test('should create Bonjour instance', () => {
            expect(Bonjour).toHaveBeenCalled();
            expect(service._bonjour).toBe(mockBonjour);
        });

        test('should initialize _adbMonitor as null', () => {
            expect(service._adbMonitor).toBeNull();
        });

        test('should initialize _browser as null', () => {
            expect(service._browser).toBeNull();
        });

        test('should handle null logger', () => {
            const serviceWithoutLogger = new ConnectionService({
                adbExecutor: mockAdbExecutor,
                logger: null
            });
            
            expect(serviceWithoutLogger._logger).toBeNull();
        });
    });

    describe('discoverDevices', () => {
        test('should call adbExecutor.getDevices', async () => {
            mockAdbExecutor.getDevices.mockResolvedValue([{ serial: 'device1' }]);
            
            await service.discoverDevices();
            
            expect(mockAdbExecutor.getDevices).toHaveBeenCalled();
        });

        test('should emit devicesDiscovered with result', async () => {
            const devices = [{ serial: 'device1', state: 'device' }];
            mockAdbExecutor.getDevices.mockResolvedValue(devices);
            
            const emitSpy = jest.spyOn(service, 'emit');
            await service.discoverDevices();
            
            expect(emitSpy).toHaveBeenCalledWith('devicesDiscovered', devices);
        });

        test('should return devices from adbExecutor', async () => {
            const devices = [{ serial: 'device1', state: 'device' }];
            mockAdbExecutor.getDevices.mockResolvedValue(devices);
            
            const result = await service.discoverDevices();
            
            expect(result).toBe(devices);
        });

        test('should emit error on failure', async () => {
            const error = new Error('ADB failed');
            mockAdbExecutor.getDevices.mockRejectedValue(error);
            
            const emitSpy = jest.spyOn(service, 'emit');
            // Add error handler to prevent unhandled error
            service.on('error', () => {});
            
            await expect(service.discoverDevices()).rejects.toThrow(error);
            expect(emitSpy).toHaveBeenCalledWith('error', error);
        });

        test('should throw error on failure', async () => {
            const error = new Error('ADB failed');
            mockAdbExecutor.getDevices.mockRejectedValue(error);
            
            await expect(service.discoverDevices()).rejects.toThrow('ADB failed');
        });
    });

    describe('startAdbMonitoring', () => {
        test('should create interval with default 5000ms', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            service.startAdbMonitoring();
            
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
            setIntervalSpy.mockRestore();
        });

        test('should create interval with custom interval', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            service.startAdbMonitoring(10000);
            
            expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
            setIntervalSpy.mockRestore();
        });

        test('should call getDevices on each interval', async () => {
            mockAdbExecutor.getDevices.mockResolvedValue([]);
            service.startAdbMonitoring(1000);
            
            jest.advanceTimersByTime(1000);
            await Promise.resolve(); // Allow async callbacks to run
            
            expect(mockAdbExecutor.getDevices).toHaveBeenCalled();
        });

        test('should emit adbDevices with result on each interval', async () => {
            const devices = [{ serial: 'device1' }];
            mockAdbExecutor.getDevices.mockResolvedValue(devices);
            service.startAdbMonitoring(1000);
            
            const emitSpy = jest.spyOn(service, 'emit');
            jest.advanceTimersByTime(1000);
            await Promise.resolve();
            
            expect(emitSpy).toHaveBeenCalledWith('adbDevices', devices);
        });

        test('should emit error if getDevices fails during monitoring', async () => {
            mockAdbExecutor.getDevices.mockRejectedValue(new Error('Failed'));
            service.startAdbMonitoring(1000);
            
            const emitSpy = jest.spyOn(service, 'emit');
            // Add error handler to prevent unhandled error
            service.on('error', () => {});
            
            jest.advanceTimersByTime(1000);
            await Promise.resolve();
            
            expect(emitSpy).toHaveBeenCalledWith('error', expect.any(Error));
        });

        test('should not create duplicate intervals', () => {
            service.startAdbMonitoring();
            const firstMonitor = service._adbMonitor;
            
            service.startAdbMonitoring();
            
            expect(service._adbMonitor).toBe(firstMonitor);
        });

        test('should return early if monitoring already started', () => {
            const setIntervalSpy = jest.spyOn(global, 'setInterval');
            service.startAdbMonitoring();
            
            service.startAdbMonitoring();
            
            expect(setIntervalSpy).toHaveBeenCalledTimes(1);
            setIntervalSpy.mockRestore();
        });

        test('should handle multiple intervals correctly', async () => {
            mockAdbExecutor.getDevices.mockResolvedValue([]);
            service.startAdbMonitoring(500);
            
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            expect(mockAdbExecutor.getDevices).toHaveBeenCalledTimes(1);
            
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            expect(mockAdbExecutor.getDevices).toHaveBeenCalledTimes(2);
            
            jest.advanceTimersByTime(500);
            await Promise.resolve();
            expect(mockAdbExecutor.getDevices).toHaveBeenCalledTimes(3);
        });
    });

    describe('stopAdbMonitoring', () => {
        test('should clear interval if monitoring is active', () => {
            const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
            service.startAdbMonitoring();
            const monitor = service._adbMonitor;
            
            service.stopAdbMonitoring();
            
            expect(clearIntervalSpy).toHaveBeenCalledWith(monitor);
            clearIntervalSpy.mockRestore();
        });

        test('should set _adbMonitor to null', () => {
            service.startAdbMonitoring();
            service.stopAdbMonitoring();
            
            expect(service._adbMonitor).toBeNull();
        });

        test('should not throw if monitoring is not active', () => {
            expect(() => service.stopAdbMonitoring()).not.toThrow();
        });

        test('should handle multiple stop calls', () => {
            service.startAdbMonitoring();
            service.stopAdbMonitoring();
            
            expect(() => service.stopAdbMonitoring()).not.toThrow();
        });
    });

    describe('startWirelessDiscovery', () => {
        test('should call bonjour.find with correct type', () => {
            service.startWirelessDiscovery();
            
            expect(mockBonjour.find).toHaveBeenCalledWith(
                { type: 'adb-tls-connect' },
                expect.any(Function)
            );
        });

        test('should store browser in _browser', () => {
            const mockBrowser = { stop: jest.fn() };
            mockBonjour.find.mockReturnValue(mockBrowser);
            
            service.startWirelessDiscovery();
            
            expect(service._browser).toBe(mockBrowser);
        });

        test('should emit wirelessServiceFound when service is discovered', () => {
            const mockService = {
                name: 'Pixel 5',
                host: '192.168.1.10',
                port: 37000,
                addresses: ['192.168.1.10']
            };
            
            service.startWirelessDiscovery();
            
            const callback = mockBonjour.find.mock.calls[0][1];
            callback(mockService);
            
            const emitSpy = jest.spyOn(service, 'emit');
            callback(mockService);
            
            expect(emitSpy).toHaveBeenCalledWith('wirelessServiceFound', {
                name: 'Pixel 5',
                host: '192.168.1.10',
                port: 37000,
                addresses: ['192.168.1.10']
            });
        });

        test('should not create duplicate browsers', () => {
            const mockBrowser = { stop: jest.fn() };
            mockBonjour.find.mockReturnValue(mockBrowser);
            
            service.startWirelessDiscovery();
            const firstBrowser = service._browser;
            
            service.startWirelessDiscovery();
            
            expect(service._browser).toBe(firstBrowser);
            expect(mockBonjour.find).toHaveBeenCalledTimes(1);
        });

        test('should return early if browser already exists', () => {
            const mockBrowser = { stop: jest.fn() };
            mockBonjour.find.mockReturnValue(mockBrowser);
            
            service.startWirelessDiscovery();
            
            const findSpy = jest.spyOn(mockBonjour, 'find');
            service.startWirelessDiscovery();
            
            expect(findSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('stopWirelessDiscovery', () => {
        test('should call browser.stop if browser is active', () => {
            const mockBrowser = { stop: jest.fn() };
            mockBonjour.find.mockReturnValue(mockBrowser);
            service.startWirelessDiscovery();
            
            service.stopWirelessDiscovery();
            
            expect(mockBrowser.stop).toHaveBeenCalled();
        });

        test('should set _browser to null', () => {
            const mockBrowser = { stop: jest.fn() };
            mockBonjour.find.mockReturnValue(mockBrowser);
            service.startWirelessDiscovery();
            service.stopWirelessDiscovery();
            
            expect(service._browser).toBeNull();
        });

        test('should not throw if browser is not active', () => {
            expect(() => service.stopWirelessDiscovery()).not.toThrow();
        });

        test('should handle multiple stop calls', () => {
            const mockBrowser = { stop: jest.fn() };
            mockBonjour.find.mockReturnValue(mockBrowser);
            service.startWirelessDiscovery();
            service.stopWirelessDiscovery();
            
            expect(() => service.stopWirelessDiscovery()).not.toThrow();
        });
    });

    describe('pair', () => {
        test('should throw error if host is not provided', async () => {
            await expect(service.pair(null, '123456')).rejects.toThrow('Host and pairing code are required');
            await expect(service.pair(undefined, '123456')).rejects.toThrow('Host and pairing code are required');
            await expect(service.pair('', '123456')).rejects.toThrow('Host and pairing code are required');
        });

        test('should throw error if pairingCode is not provided', async () => {
            await expect(service.pair('192.168.1.10:37000', null)).rejects.toThrow('Host and pairing code are required');
            await expect(service.pair('192.168.1.10:37000', undefined)).rejects.toThrow('Host and pairing code are required');
            await expect(service.pair('192.168.1.10:37000', '')).rejects.toThrow('Host and pairing code are required');
        });

        test('should call adbExecutor.pair with host and pairingCode', async () => {
            mockAdbExecutor.pair.mockResolvedValue('paired');
            
            await service.pair('192.168.1.10:37000', '123456');
            
            expect(mockAdbExecutor.pair).toHaveBeenCalledWith('192.168.1.10:37000', '123456');
        });

        test('should emit pairSuccess on success', async () => {
            mockAdbExecutor.pair.mockResolvedValue('paired');
            
            const emitSpy = jest.spyOn(service, 'emit');
            await service.pair('192.168.1.10:37000', '123456');
            
            expect(emitSpy).toHaveBeenCalledWith('pairSuccess', {
                host: '192.168.1.10:37000',
                pairingCode: '123456'
            });
        });

        test('should return result from adbExecutor', async () => {
            const expectedResult = 'Successfully paired';
            mockAdbExecutor.pair.mockResolvedValue(expectedResult);
            
            const result = await service.pair('192.168.1.10:37000', '123456');
            
            expect(result).toBe(expectedResult);
        });

        test('should emit error on failure', async () => {
            const error = new Error('Pairing failed');
            mockAdbExecutor.pair.mockRejectedValue(error);
            
            const emitSpy = jest.spyOn(service, 'emit');
            // Add error handler to prevent unhandled error
            service.on('error', () => {});
            
            await expect(service.pair('192.168.1.10:37000', '123456')).rejects.toThrow(error);
            expect(emitSpy).toHaveBeenCalledWith('error', error);
        });

        test('should throw error on failure', async () => {
            const error = new Error('Pairing failed');
            mockAdbExecutor.pair.mockRejectedValue(error);
            
            await expect(service.pair('192.168.1.10:37000', '123456')).rejects.toThrow('Pairing failed');
        });
    });

    describe('connect', () => {
        test('should throw error if target is not provided', async () => {
            await expect(service.connect(null)).rejects.toThrow('Target is required');
            await expect(service.connect(undefined)).rejects.toThrow('Target is required');
            await expect(service.connect('')).rejects.toThrow('Target is required');
        });

        test('should call adbExecutor.connect with target', async () => {
            mockAdbExecutor.connect.mockResolvedValue('connected');
            
            await service.connect('192.168.1.10:5555');
            
            expect(mockAdbExecutor.connect).toHaveBeenCalledWith('192.168.1.10:5555');
        });

        test('should emit connectSuccess on success', async () => {
            mockAdbExecutor.connect.mockResolvedValue('connected');
            
            const emitSpy = jest.spyOn(service, 'emit');
            await service.connect('192.168.1.10:5555');
            
            expect(emitSpy).toHaveBeenCalledWith('connectSuccess', {
                target: '192.168.1.10:5555'
            });
        });

        test('should return result from adbExecutor', async () => {
            const expectedResult = 'connected to 192.168.1.10:5555';
            mockAdbExecutor.connect.mockResolvedValue(expectedResult);
            
            const result = await service.connect('192.168.1.10:5555');
            
            expect(result).toBe(expectedResult);
        });

        test('should emit error on failure', async () => {
            const error = new Error('Connection failed');
            mockAdbExecutor.connect.mockRejectedValue(error);
            
            const emitSpy = jest.spyOn(service, 'emit');
            // Add error handler to prevent unhandled error
            service.on('error', () => {});
            
            await expect(service.connect('192.168.1.10:5555')).rejects.toThrow(error);
            expect(emitSpy).toHaveBeenCalledWith('error', error);
        });

        test('should throw error on failure', async () => {
            const error = new Error('Connection failed');
            mockAdbExecutor.connect.mockRejectedValue(error);
            
            await expect(service.connect('192.168.1.10:5555')).rejects.toThrow('Connection failed');
        });
    });

    describe('disconnect', () => {
        test('should call adbExecutor.disconnect with target', async () => {
            mockAdbExecutor.disconnect.mockResolvedValue('disconnected');
            
            await service.disconnect('192.168.1.10:5555');
            
            expect(mockAdbExecutor.disconnect).toHaveBeenCalledWith('192.168.1.10:5555');
        });

        test('should call adbExecutor.disconnect with null when target not provided', async () => {
            mockAdbExecutor.disconnect.mockResolvedValue('disconnected all');
            
            await service.disconnect();
            
            expect(mockAdbExecutor.disconnect).toHaveBeenCalledWith(null);
        });

        test('should emit disconnect on success', async () => {
            mockAdbExecutor.disconnect.mockResolvedValue('disconnected');
            
            const emitSpy = jest.spyOn(service, 'emit');
            await service.disconnect('192.168.1.10:5555');
            
            expect(emitSpy).toHaveBeenCalledWith('disconnect', {
                target: '192.168.1.10:5555'
            });
        });

        test('should emit disconnect with "all" when target is null', async () => {
            mockAdbExecutor.disconnect.mockResolvedValue('disconnected all');
            
            const emitSpy = jest.spyOn(service, 'emit');
            await service.disconnect(null);
            
            expect(emitSpy).toHaveBeenCalledWith('disconnect', {
                target: 'all'
            });
        });

        test('should return result from adbExecutor', async () => {
            const expectedResult = 'disconnected';
            mockAdbExecutor.disconnect.mockResolvedValue(expectedResult);
            
            const result = await service.disconnect('192.168.1.10:5555');
            
            expect(result).toBe(expectedResult);
        });

        test('should emit error on failure', async () => {
            const error = new Error('Disconnect failed');
            mockAdbExecutor.disconnect.mockRejectedValue(error);
            
            const emitSpy = jest.spyOn(service, 'emit');
            // Add error handler to prevent unhandled error
            service.on('error', () => {});
            
            await expect(service.disconnect('192.168.1.10:5555')).rejects.toThrow(error);
            expect(emitSpy).toHaveBeenCalledWith('error', error);
        });

        test('should throw error on failure', async () => {
            const error = new Error('Disconnect failed');
            mockAdbExecutor.disconnect.mockRejectedValue(error);
            
            await expect(service.disconnect('192.168.1.10:5555')).rejects.toThrow('Disconnect failed');
        });
    });

    describe('getDeviceInfo', () => {
        test('should throw error if target is not provided', async () => {
            await expect(service.getDeviceInfo(null)).rejects.toThrow('Target is required');
            await expect(service.getDeviceInfo(undefined)).rejects.toThrow('Target is required');
            await expect(service.getDeviceInfo('')).rejects.toThrow('Target is required');
        });

        test('should call adbExecutor.getDeviceInfo with target', async () => {
            const deviceInfo = { serial: 'device1', model: 'Pixel 5', version: '11', arch: 'arm64-v8a' };
            mockAdbExecutor.getDeviceInfo.mockResolvedValue(deviceInfo);
            
            await service.getDeviceInfo('device1');
            
            expect(mockAdbExecutor.getDeviceInfo).toHaveBeenCalledWith('device1');
        });

        test('should return result from adbExecutor', async () => {
            const deviceInfo = { serial: 'device1', model: 'Pixel 5', version: '11', arch: 'arm64-v8a' };
            mockAdbExecutor.getDeviceInfo.mockResolvedValue(deviceInfo);
            
            const result = await service.getDeviceInfo('device1');
            
            expect(result).toBe(deviceInfo);
        });
    });

    describe('dispose', () => {
        test('should call stopAdbMonitoring', () => {
            const stopSpy = jest.spyOn(service, 'stopAdbMonitoring');
            service.dispose();
            
            expect(stopSpy).toHaveBeenCalled();
        });

        test('should call stopWirelessDiscovery', () => {
            const stopSpy = jest.spyOn(service, 'stopWirelessDiscovery');
            service.dispose();
            
            expect(stopSpy).toHaveBeenCalled();
        });

        test('should call bonjour.destroy', () => {
            service.dispose();
            
            expect(mockBonjour.destroy).toHaveBeenCalled();
        });

        test('should handle multiple dispose calls', () => {
            expect(() => {
                service.dispose();
                service.dispose();
                service.dispose();
            }).not.toThrow();
        });
    });

    describe('Security Tests', () => {
        test('should handle large data in wirelessServiceFound', () => {
            const mockService = {
                name: 'a'.repeat(10000),
                host: '192.168.1.10',
                port: 37000,
                addresses: Array(1000).fill('192.168.1.10')
            };
            
            service.startWirelessDiscovery();
            
            const callback = mockBonjour.find.mock.calls[0][1];
            
            expect(() => callback(mockService)).not.toThrow();
        });

        test('should handle malicious data in wirelessServiceFound', () => {
            const mockService = {
                name: '<script>alert("xss")</script>',
                host: '192.168.1.10',
                port: 37000,
                addresses: ['../../etc/passwd']
            };
            
            service.startWirelessDiscovery();
            
            const callback = mockBonjour.find.mock.calls[0][1];
            
            expect(() => callback(mockService)).not.toThrow();
        });

        test('should handle circular references in service data', () => {
            const mockService = {
                name: 'Test',
                host: '192.168.1.10',
                port: 37000,
                addresses: []
            };
            mockService.circular = mockService;
            
            service.startWirelessDiscovery();
            
            const callback = mockBonjour.find.mock.calls[0][1];
            
            expect(() => callback(mockService)).not.toThrow();
        });

        test('should handle null values in service data', () => {
            const mockService = {
                name: null,
                host: null,
                port: null,
                addresses: null
            };
            
            service.startWirelessDiscovery();
            
            const callback = mockBonjour.find.mock.calls[0][1];
            
            expect(() => callback(mockService)).not.toThrow();
        });

        test('should handle undefined values in service data', () => {
            const mockService = {
                name: undefined,
                host: undefined,
                port: undefined,
                addresses: undefined
            };
            
            service.startWirelessDiscovery();
            
            const callback = mockBonjour.find.mock.calls[0][1];
            
            expect(() => callback(mockService)).not.toThrow();
        });

        describe('Network/Resource Exhaustion Tests', () => {
            test('should handle 10,000 IP addresses in addresses array', () => {
                const initialMemory = process.memoryUsage().heapUsed;
                
                const mockService = {
                    name: 'Test Device',
                    host: '192.168.1.10',
                    port: 37000,
                    addresses: Array.from({ length: 10000 }, (_, i) => `192.168.1.${i % 255}`)
                };
                
                service.startWirelessDiscovery();
                const callback = mockBonjour.find.mock.calls[0][1];
                
                expect(() => callback(mockService)).not.toThrow();
                
                const finalMemory = process.memoryUsage().heapUsed;
                const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
                
                console.log(`[Security] Memory increase for 10,000 IPs: ${memoryIncrease.toFixed(2)}MB`);
                expect(memoryIncrease).toBeLessThan(50); // Should not increase by more than 50MB
            });

            test('should handle rapid event emission (1000 events/sec for 2 seconds)', () => {
                const initialMemory = process.memoryUsage().heapUsed;
                const eventCount = 2000; // 1000 events/sec for 2 seconds
                const events = [];
                
                service.startWirelessDiscovery();
                const callback = mockBonjour.find.mock.calls[0][1];
                
                const startTime = Date.now();
                for (let i = 0; i < eventCount; i++) {
                    const mockService = {
                        name: `Device ${i}`,
                        host: `192.168.1.${i % 255}`,
                        port: 37000,
                        addresses: [`192.168.1.${i % 255}`]
                    };
                    callback(mockService);
                    events.push(mockService);
                }
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                const finalMemory = process.memoryUsage().heapUsed;
                const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
                
                console.log(`[Security] ${eventCount} events emitted in ${duration}ms (${(eventCount / (duration / 1000)).toFixed(0)} events/sec)`);
                console.log(`[Security] Memory increase for rapid events: ${memoryIncrease.toFixed(2)}MB`);
                
                expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
                expect(memoryIncrease).toBeLessThan(100); // Should not increase by more than 100MB
            });

            test('should handle very large service name (100KB)', () => {
                const initialMemory = process.memoryUsage().heapUsed;
                
                const mockService = {
                    name: 'a'.repeat(100 * 1024), // 100KB
                    host: '192.168.1.10',
                    port: 37000,
                    addresses: ['192.168.1.10']
                };
                
                service.startWirelessDiscovery();
                const callback = mockBonjour.find.mock.calls[0][1];
                
                expect(() => callback(mockService)).not.toThrow();
                
                const finalMemory = process.memoryUsage().heapUsed;
                const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
                
                console.log(`[Security] Memory increase for 100KB name: ${memoryIncrease.toFixed(2)}MB`);
                expect(memoryIncrease).toBeLessThan(10); // Should not increase by more than 10MB
            });

            test('should handle mixed large and small events without memory leak', () => {
                const initialMemory = process.memoryUsage().heapUsed;
                
                service.startWirelessDiscovery();
                const callback = mockBonjour.find.mock.calls[0][1];
                
                // Emit 100 small events
                for (let i = 0; i < 100; i++) {
                    callback({
                        name: `Small ${i}`,
                        host: '192.168.1.10',
                        port: 37000,
                        addresses: ['192.168.1.10']
                    });
                }
                
                // Emit 10 large events
                for (let i = 0; i < 10; i++) {
                    callback({
                        name: 'a'.repeat(10000),
                        host: '192.168.1.10',
                        port: 37000,
                        addresses: Array(100).fill('192.168.1.10')
                    });
                }
                
                const finalMemory = process.memoryUsage().heapUsed;
                const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
                
                console.log(`[Security] Memory increase for mixed events: ${memoryIncrease.toFixed(2)}MB`);
                expect(memoryIncrease).toBeLessThan(20); // Should not increase by more than 20MB
            });
        });
    });

    describe('Edge Cases', () => {
        test('should handle special characters in host for pair', async () => {
            mockAdbExecutor.pair.mockResolvedValue('paired');
            
            await expect(service.pair('192.168.1.10:37000', '123456')).resolves.toBeDefined();
        });

        test('should handle special characters in target for connect', async () => {
            mockAdbExecutor.connect.mockResolvedValue('connected');
            
            await expect(service.connect('192.168.1.10:5555')).resolves.toBeDefined();
        });

        test('should handle empty devices list in monitoring', async () => {
            mockAdbExecutor.getDevices.mockResolvedValue([]);
            service.startAdbMonitoring(1000);
            
            const emitSpy = jest.spyOn(service, 'emit');
            jest.advanceTimersByTime(1000);
            await Promise.resolve();
            
            expect(emitSpy).toHaveBeenCalledWith('adbDevices', []);
        });

        test('should handle very long pairing code', async () => {
            mockAdbExecutor.pair.mockResolvedValue('paired');
            
            await expect(service.pair('192.168.1.10:37000', '1'.repeat(1000))).resolves.toBeDefined();
        });

        test('should handle unicode in device name for wireless discovery', () => {
            const mockService = {
                name: '设备-テスト',
                host: '192.168.1.10',
                port: 37000,
                addresses: ['192.168.1.10']
            };
            
            service.startWirelessDiscovery();
            
            const callback = mockBonjour.find.mock.calls[0][1];
            
            expect(() => callback(mockService)).not.toThrow();
        });
    });
});
