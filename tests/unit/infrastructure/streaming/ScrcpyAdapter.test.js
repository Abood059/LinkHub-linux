'use strict';

const ScrcpyAdapter = require('../../../../src/main/infrastructure/streaming/ScrcpyAdapter');

describe('ScrcpyAdapter', () => {
    let mockProcessSupervisor;
    let mockLogger;
    let mockToolPathResolver;
    let adapter;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockProcessSupervisor = {
            startManagedProcess: jest.fn(),
            stopManagedProcess: jest.fn(),
            getProcessStatus: jest.fn()
        };
        
        mockLogger = {
            warn: jest.fn()
        };
        
        mockToolPathResolver = {
            getScrcpyPath: jest.fn(() => '/custom/path/scrcpy')
        };
        
        adapter = new ScrcpyAdapter({
            processSupervisor: mockProcessSupervisor,
            logger: mockLogger,
            toolPathResolver: mockToolPathResolver
        });
    });

    describe('Constructor', () => {
        test('should store processSupervisor', () => {
            expect(adapter._processSupervisor).toBe(mockProcessSupervisor);
        });

        test('should store logger', () => {
            expect(adapter._logger).toBe(mockLogger);
        });

        test('should store toolPathResolver', () => {
            expect(adapter._toolPathResolver).toBe(mockToolPathResolver);
        });

        test('should use toolPathResolver for scrcpyPath when provided', () => {
            expect(adapter._scrcpyPath).toBe('/custom/path/scrcpy');
            expect(mockToolPathResolver.getScrcpyPath).toHaveBeenCalled();
        });

        test('should use explicit scrcpyPath when provided', () => {
            const adapterWithExplicitPath = new ScrcpyAdapter({
                processSupervisor: mockProcessSupervisor,
                scrcpyPath: '/explicit/path/scrcpy'
            });
            
            expect(adapterWithExplicitPath._scrcpyPath).toBe('/explicit/path/scrcpy');
        });

        test('should use fallback scrcpy when neither toolPathResolver nor scrcpyPath provided', () => {
            const adapterWithoutResolver = new ScrcpyAdapter({
                processSupervisor: mockProcessSupervisor
            });
            
            expect(adapterWithoutResolver._scrcpyPath).toBe('scrcpy');
        });

        test('should log warning when using fallback path', () => {
            const adapterWithoutResolver = new ScrcpyAdapter({
                processSupervisor: mockProcessSupervisor,
                logger: mockLogger
            });
            
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No toolPathResolver provided')
            );
        });

        test('should not log warning when toolPathResolver is provided', () => {
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should initialize _activeProcesses as empty Map', () => {
            expect(adapter._activeProcesses).toBeInstanceOf(Map);
            expect(adapter._activeProcesses.size).toBe(0);
        });

        test('should prioritize explicit scrcpyPath over toolPathResolver', () => {
            const adapterWithBoth = new ScrcpyAdapter({
                processSupervisor: mockProcessSupervisor,
                scrcpyPath: '/explicit/path/scrcpy',
                toolPathResolver: mockToolPathResolver
            });
            
            expect(adapterWithBoth._scrcpyPath).toBe('/explicit/path/scrcpy');
            // The implementation may still call toolPathResolver, but should use explicit path
            // So we just verify the path is correct
        });

        test('should handle null logger', () => {
            const adapterWithoutLogger = new ScrcpyAdapter({
                processSupervisor: mockProcessSupervisor,
                logger: null
            });
            
            expect(adapterWithoutLogger._logger).toBeNull();
        });
    });

    describe('startMirroring', () => {
        test('should throw error if adbTarget is not provided', () => {
            expect(() => adapter.startMirroring(null)).toThrow('must be a non-empty string');
            expect(() => adapter.startMirroring(undefined)).toThrow('must be a non-empty string');
            expect(() => adapter.startMirroring('')).toThrow('must be a non-empty string');
        });

        test('should call startManagedProcess with correct arguments', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1', { fullscreen: true, bitrate: '8M' });
            
            expect(mockProcessSupervisor.startManagedProcess).toHaveBeenCalledWith({
                processId: 'scrcpy:device1',
                binPath: adapter._scrcpyPath,
                args: ['-s', 'device1', '--fullscreen', '--bit-rate', '8M'],
                type: 'scrcpy',
                metadata: { adbTarget: 'device1' }
            });
        });

        test('should build correct args without options', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            
            expect(mockProcessSupervisor.startManagedProcess).toHaveBeenCalledWith({
                processId: 'scrcpy:device1',
                binPath: adapter._scrcpyPath,
                args: ['-s', 'device1'],
                type: 'scrcpy',
                metadata: { adbTarget: 'device1' }
            });
        });

        test('should build correct args with fullscreen only', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1', { fullscreen: true });
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            expect(callArgs).toContain('--fullscreen');
            expect(callArgs).not.toContain('--bit-rate');
        });

        test('should build correct args with bitrate only', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1', { bitrate: '8M' });
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            expect(callArgs).not.toContain('--fullscreen');
            expect(callArgs).toContain('--bit-rate');
            expect(callArgs).toContain('8M');
        });

        test('should convert bitrate to string', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1', { bitrate: 8000000 });
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            expect(callArgs).toContain('8000000');
        });

        test('should store processId in _activeProcesses', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const processId = adapter.startMirroring('device1');
            
            expect(adapter._activeProcesses.get('device1')).toBe(processId);
            expect(processId).toBe('scrcpy:device1');
        });

        test('should set up exit event handler', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            
            expect(mockChildProcess.once).toHaveBeenCalledWith('exit', expect.any(Function));
        });

        test('should remove from _activeProcesses on exit', async () => {
            const mockChildProcess = { once: jest.fn((event, handler) => {
                if (event === 'exit') setTimeout(() => handler(), 10);
            }) };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            expect(adapter._activeProcesses.has('device1')).toBe(true);
            
            // Wait for exit handler to fire
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(adapter._activeProcesses.has('device1')).toBe(false);
        });

        test('should set up error event handler', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            
            expect(mockChildProcess.once).toHaveBeenCalledWith('error', expect.any(Function));
        });

        test('should remove from _activeProcesses on error', async () => {
            const mockChildProcess = { once: jest.fn((event, handler) => {
                if (event === 'error') setTimeout(() => handler(), 10);
            }) };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            expect(adapter._activeProcesses.has('device1')).toBe(true);
            
            // Wait for error handler to fire
            await new Promise(resolve => setTimeout(resolve, 20));
            expect(adapter._activeProcesses.has('device1')).toBe(false);
        });

        test('should throw error if mirroring already active for device', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            mockProcessSupervisor.getProcessStatus.mockReturnValue({
                status: 'RUNNING'
            });
            
            adapter.startMirroring('device1');
            
            expect(() => adapter.startMirroring('device1')).toThrow('Screen mirroring is already active for this device');
        });

        test('should clean up old process if it is not running', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            mockProcessSupervisor.getProcessStatus.mockReturnValue({
                status: 'EXITED'
            });
            
            adapter.startMirroring('device1');
            adapter._activeProcesses.set('device1', 'old-process-id');
            
            // Should not throw, should clean up and start new
            expect(() => adapter.startMirroring('device1')).not.toThrow();
        });

        test('should clean up old process if getProcessStatus returns null', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            mockProcessSupervisor.getProcessStatus.mockReturnValue(null);
            
            adapter.startMirroring('device1');
            adapter._activeProcesses.set('device1', 'old-process-id');
            
            // Should not throw, should clean up and start new
            expect(() => adapter.startMirroring('device1')).not.toThrow();
        });

        test('should handle null childProcess from startManagedProcess', () => {
            mockProcessSupervisor.startManagedProcess.mockReturnValue(null);
            
            expect(() => adapter.startMirroring('device1')).not.toThrow();
        });

        test('should handle childProcess without once method', () => {
            mockProcessSupervisor.startManagedProcess.mockReturnValue({});
            
            expect(() => adapter.startMirroring('device1')).not.toThrow();
        });

        test('should return processId', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const processId = adapter.startMirroring('device1');
            
            expect(processId).toBe('scrcpy:device1');
        });

        test('should handle special characters in adbTarget', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const processId = adapter.startMirroring('192.168.1.10:5555');
            
            expect(processId).toBe('scrcpy:192.168.1.10:5555');
            expect(mockProcessSupervisor.startManagedProcess).toHaveBeenCalledWith({
                processId: 'scrcpy:192.168.1.10:5555',
                binPath: adapter._scrcpyPath,
                args: ['-s', '192.168.1.10:5555'],
                type: 'scrcpy',
                metadata: { adbTarget: '192.168.1.10:5555' }
            });
        });
    });

    describe('stopMirroring', () => {
        test('should call stopManagedProcess with correct processId', () => {
            adapter._activeProcesses.set('device1', 'scrcpy:device1');
            
            const result = adapter.stopMirroring('device1');
            
            expect(mockProcessSupervisor.stopManagedProcess).toHaveBeenCalledWith('scrcpy:device1');
        });

        test('should remove from _activeProcesses', () => {
            adapter._activeProcesses.set('device1', 'scrcpy:device1');
            
            adapter.stopMirroring('device1');
            
            expect(adapter._activeProcesses.has('device1')).toBe(false);
        });

        test('should return true for successful stop', () => {
            adapter._activeProcesses.set('device1', 'scrcpy:device1');
            
            const result = adapter.stopMirroring('device1');
            
            expect(result).toBe(true);
        });

        test('should return false if no active mirroring for device', () => {
            const result = adapter.stopMirroring('device1');
            
            expect(result).toBe(false);
            expect(mockProcessSupervisor.stopManagedProcess).not.toHaveBeenCalled();
        });

        test('should return false if device not in _activeProcesses', () => {
            adapter._activeProcesses.set('device2', 'scrcpy:device2');
            
            const result = adapter.stopMirroring('device1');
            
            expect(result).toBe(false);
        });

        test('should handle empty adbTarget', () => {
            const result = adapter.stopMirroring('');
            
            expect(result).toBe(false);
        });

        test('should handle null adbTarget', () => {
            const result = adapter.stopMirroring(null);
            
            expect(result).toBe(false);
        });
    });

    describe('Resilience Tests', () => {
        test('should handle process crash via exit handler', (done) => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            expect(adapter._activeProcesses.has('device1')).toBe(true);
            
            // Manually trigger the exit handler
            const exitHandler = mockChildProcess.once.mock.calls.find(call => call[0] === 'exit')[1];
            exitHandler();
            
            expect(adapter._activeProcesses.has('device1')).toBe(false);
            done();
        });

        test('should handle process error via error handler', (done) => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            expect(adapter._activeProcesses.has('device1')).toBe(true);
            
            // Manually trigger the error handler
            const errorHandler = mockChildProcess.once.mock.calls.find(call => call[0] === 'error')[1];
            errorHandler();
            
            expect(adapter._activeProcesses.has('device1')).toBe(false);
            done();
        });

        test('should handle multiple devices simultaneously', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            adapter.startMirroring('device2');
            adapter.startMirroring('device3');
            
            expect(adapter._activeProcesses.size).toBe(3);
        });

        test('should stop one device without affecting others', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1');
            adapter.startMirroring('device2');
            
            adapter.stopMirroring('device1');
            
            expect(adapter._activeProcesses.has('device1')).toBe(false);
            expect(adapter._activeProcesses.has('device2')).toBe(true);
        });

        test('should handle restart of same device after cleanup', () => {
            const mockChildProcess = { once: jest.fn((event, handler) => {
                if (event === 'exit') setTimeout(() => handler(), 10);
            }) };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            mockProcessSupervisor.getProcessStatus.mockReturnValue({ status: 'EXITED' });
            
            adapter.startMirroring('device1');
            
            return new Promise(resolve => setTimeout(resolve, 20)).then(() => {
                // Process should be cleaned up
                expect(adapter._activeProcesses.has('device1')).toBe(false);
                
                // Should be able to start again
                expect(() => adapter.startMirroring('device1')).not.toThrow();
            });
        });
    });

    describe('Edge Cases', () => {
        test('should handle very long adbTarget', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const longTarget = 'a'.repeat(1000);
            
            expect(() => adapter.startMirroring(longTarget)).not.toThrow();
        });

        test('should handle special characters in adbTarget', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const specialTarget = 'device-1_test.123:5555';
            
            expect(() => adapter.startMirroring(specialTarget)).not.toThrow();
        });

        test('should handle unicode in adbTarget', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const unicodeTarget = '设备-テスト';
            
            expect(() => adapter.startMirroring(unicodeTarget)).not.toThrow();
        });

        test('should handle zero bitrate', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1', { bitrate: 0 });
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            // Zero is falsy, so bitrate won't be added to args
            expect(callArgs).not.toContain('--bit-rate');
        });

        test('should handle very high bitrate', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            adapter.startMirroring('device1', { bitrate: 100000000 });
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            expect(callArgs).toContain('100000000');
        });
    });

    describe('Security Tests', () => {
        test('should reject adbTarget with semicolon (command injection)', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device1;rm -rf /';
            expect(() => adapter.startMirroring(target)).toThrow('contains dangerous characters');
        });

        test('should reject adbTarget with ampersand (command injection)', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device1&malicious';
            expect(() => adapter.startMirroring(target)).toThrow('contains dangerous characters');
        });

        test('should reject adbTarget with pipe (command injection)', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device1|cat /etc/passwd';
            expect(() => adapter.startMirroring(target)).toThrow('contains dangerous characters');
        });

        test('should reject adbTarget with backtick (command injection)', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device1`malicious`';
            expect(() => adapter.startMirroring(target)).toThrow('contains dangerous characters');
        });

        test('should reject adbTarget with dollar sign (command injection)', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device1$(malicious)';
            expect(() => adapter.startMirroring(target)).toThrow('contains dangerous characters');
        });

        test('should reject adbTarget with parentheses (command injection)', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device1(malicious)';
            expect(() => adapter.startMirroring(target)).toThrow('contains dangerous characters');
        });

        test('should reject adbTarget with redirect (command injection)', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device1>/etc/passwd';
            expect(() => adapter.startMirroring(target)).toThrow('contains dangerous characters');
        });

        test('should accept valid adbTarget with hyphens and underscores', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device-1_test.123';
            adapter.startMirroring(target);
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            expect(callArgs).toContain(target);
        });

        test('should accept valid adbTarget with colons (IP addresses)', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = '192.168.1.10:5555';
            adapter.startMirroring(target);
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            expect(callArgs).toContain(target);
        });

        test('should trim whitespace from adbTarget', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = '  device1  ';
            adapter.startMirroring(target);
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            expect(callArgs).toContain('device1');
        });

        test('should reject null adbTarget', () => {
            expect(() => adapter.startMirroring(null)).toThrow('must be a non-empty string');
        });

        test('should reject undefined adbTarget', () => {
            expect(() => adapter.startMirroring(undefined)).toThrow('must be a non-empty string');
        });

        test('should reject empty string adbTarget', () => {
            expect(() => adapter.startMirroring('')).toThrow('must be a non-empty string');
        });

        test('should sanitize adbTarget in stopMirroring', () => {
            const maliciousTarget = 'device1;rm -rf /';
            expect(() => adapter.stopMirroring(maliciousTarget)).toThrow('contains dangerous characters');
        });

        test('should not split adbTarget into separate arguments', () => {
            const mockChildProcess = { once: jest.fn() };
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockChildProcess);
            
            const target = 'device1 with spaces';
            adapter.startMirroring(target);
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].args;
            // Target should be a single argument after -s
            const targetIndex = callArgs.indexOf('-s') + 1;
            expect(callArgs[targetIndex]).toBe(target);
        });
    });
});
