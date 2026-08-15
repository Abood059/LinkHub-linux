'use strict';

// Mock electron-log/main
jest.mock('electron-log/main', () => ({
    initialize: jest.fn(),
    transports: {
        file: {
            level: null,
            maxSize: null,
            resolvePathFn: null
        }
    },
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

const ErrorCentralService = require('../../../../src/main/infrastructure/logging/ErrorCentralService');
const log = require('electron-log/main');
const {
    LOG_LEVELS,
    LOG_TYPES,
    SEVERITY
} = require('../../../../src/main/infrastructure/logging/logging.constants');

describe('ErrorCentralService', () => {
    let service;
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock console.error to prevent noise in test output
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        service = new ErrorCentralService();
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    describe('Constructor', () => {
        test('should initialize with _initialized false', () => {
            expect(service._initialized).toBe(false);
        });

        test('should initialize with _globalHandlersRegistered false', () => {
            expect(service._globalHandlersRegistered).toBe(false);
        });
    });

    describe('init', () => {
        test('should set _initialized to true', () => {
            service.init();
            expect(service._initialized).toBe(true);
        });

        test('should set _globalHandlersRegistered to true', () => {
            service.init();
            expect(service._globalHandlersRegistered).toBe(true);
        });

        test('should call log.initialize', () => {
            service.init();
            expect(log.initialize).toHaveBeenCalled();
        });

        test('should set log.transports.file.level to info', () => {
            service.init();
            expect(log.transports.file.level).toBe('info');
        });

        test('should set log.transports.file.maxSize to default 5MB', () => {
            service.init();
            expect(log.transports.file.maxSize).toBe(5 * 1024 * 1024);
        });

        test('should set custom maxSize from options', () => {
            service.init({ maxSize: 10 * 1024 * 1024 });
            expect(log.transports.file.maxSize).toBe(10 * 1024 * 1024);
        });

        test('should set resolvePathFn from options', () => {
            service.init({ logFilePath: '/custom/path.log' });
            expect(typeof log.transports.file.resolvePathFn).toBe('function');
        });

        test('should call _registerGlobalHandlers during init', () => {
            const registerSpy = jest.spyOn(service, '_registerGlobalHandlers').mockImplementation();
            service.init();
            expect(registerSpy).toHaveBeenCalled();
            registerSpy.mockRestore();
        });

        test('should not initialize twice', () => {
            service.init();
            const firstInitialized = service._initialized;
            service.init();
            expect(service._initialized).toBe(firstInitialized);
            expect(log.initialize).toHaveBeenCalledTimes(1);
        });

        test('should handle initialization errors gracefully', () => {
            log.initialize.mockImplementation(() => {
                throw new Error('Init failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            expect(() => service.init()).not.toThrow();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('info', () => {
        test('should call report with correct severity', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.info('test message');
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                severity: SEVERITY.LOW
            });
            reportSpy.mockRestore();
        });

        test('should use custom severity from options', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.info('test message', { severity: SEVERITY.HIGH });
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                severity: SEVERITY.HIGH
            });
            reportSpy.mockRestore();
        });

        test('should pass additional options to report', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.info('test message', { type: LOG_TYPES.ADB, source: 'test' });
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                type: LOG_TYPES.ADB,
                source: 'test',
                severity: SEVERITY.LOW
            });
            reportSpy.mockRestore();
        });
    });

    describe('warn', () => {
        test('should call report with MEDIUM severity', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.warn('test message');
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                severity: SEVERITY.MEDIUM
            });
            reportSpy.mockRestore();
        });

        test('should use custom severity from options', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.warn('test message', { severity: SEVERITY.HIGH });
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                severity: SEVERITY.HIGH
            });
            reportSpy.mockRestore();
        });
    });

    describe('error', () => {
        test('should call report with HIGH severity', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.error('test message');
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                severity: SEVERITY.HIGH
            });
            reportSpy.mockRestore();
        });

        test('should use custom severity from options', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.error('test message', { severity: SEVERITY.CRITICAL });
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                severity: SEVERITY.CRITICAL
            });
            reportSpy.mockRestore();
        });
    });

    describe('fatal', () => {
        test('should call report with CRITICAL severity', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.fatal('test message');
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                severity: SEVERITY.CRITICAL
            });
            reportSpy.mockRestore();
        });

        test('should not allow overriding severity', () => {
            const reportSpy = jest.spyOn(service, 'report').mockImplementation();
            service.fatal('test message', { severity: SEVERITY.LOW });
            expect(reportSpy).toHaveBeenCalledWith({
                message: 'test message',
                severity: SEVERITY.CRITICAL
            });
            reportSpy.mockRestore();
        });
    });

    describe('report', () => {
        beforeEach(() => {
            service.init();
        });

        test('should call log.info for LOW severity', () => {
            service.report({
                message: 'test',
                severity: SEVERITY.LOW
            });
            expect(log.info).toHaveBeenCalled();
            expect(log.warn).not.toHaveBeenCalled();
            expect(log.error).not.toHaveBeenCalled();
        });

        test('should call log.warn for MEDIUM severity', () => {
            service.report({
                message: 'test',
                severity: SEVERITY.MEDIUM
            });
            expect(log.warn).toHaveBeenCalled();
            expect(log.info).not.toHaveBeenCalled();
            expect(log.error).not.toHaveBeenCalled();
        });

        test('should call log.error for HIGH severity', () => {
            service.report({
                message: 'test',
                severity: SEVERITY.HIGH
            });
            expect(log.error).toHaveBeenCalled();
            expect(log.info).not.toHaveBeenCalled();
            expect(log.warn).not.toHaveBeenCalled();
        });

        test('should call log.error for CRITICAL severity', () => {
            service.report({
                message: 'test',
                severity: SEVERITY.CRITICAL
            });
            expect(log.error).toHaveBeenCalled();
        });

        test('should format log line correctly', () => {
            service.report({
                message: 'test message',
                type: LOG_TYPES.GENERAL,
                severity: SEVERITY.LOW,
                source: 'TEST',
                metadata: null,
                error: null
            });
            const logCall = log.info.mock.calls[0][0];
            expect(logCall).toContain('[TEST]');
            expect(logCall).toContain('[GENERAL]');
            expect(logCall).toContain('[LOW]');
            expect(logCall).toContain('test message');
        });

        test('should handle metadata object', () => {
            service.report({
                message: 'test',
                metadata: { key: 'value' }
            });
            const logCall = log.info.mock.calls[0][0];
            expect(logCall).toContain('key');
            expect(logCall).toContain('value');
        });

        test('should handle error with stack', () => {
            const error = new Error('test error');
            service.report({
                message: 'test',
                error: error
            });
            const logCall = log.info.mock.calls[0][0];
            expect(logCall).toContain('test error');
        });

        test('should handle report errors gracefully', () => {
            log.info.mockImplementation(() => {
                throw new Error('Log failed');
            });
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            expect(() => service.report({ message: 'test' })).not.toThrow();
            consoleErrorSpy.mockRestore();
        });

        test('should use default values for missing options', () => {
            service.report({});
            const logCall = log.info.mock.calls[0][0];
            expect(logCall).toContain('[GENERAL]');
            expect(logCall).toContain('[LOW]');
            expect(logCall).toContain('[UNKNOWN]');
        });
    });

    describe('_safeStringify (Circular Reference Handling)', () => {
        test('should handle circular references', () => {
            const obj = {};
            obj.self = obj;
            const result = service._safeStringify(obj);
            expect(result).toContain('[Circular Reference]');
        });

        test('should handle nested circular references', () => {
            const obj1 = {};
            const obj2 = { ref: obj1 };
            obj1.ref = obj2;
            const result = service._safeStringify(obj1);
            expect(result).toContain('[Circular Reference]');
        });

        test('should handle normal objects', () => {
            const obj = { key: 'value', num: 123 };
            const result = service._safeStringify(obj);
            expect(result).toContain('key');
            expect(result).toContain('value');
        });

        test('should handle arrays', () => {
            const arr = [1, 2, 3];
            const result = service._safeStringify(arr);
            expect(result).toContain('1');
            expect(result).toContain('2');
            expect(result).toContain('3');
        });

        test('should handle primitive values', () => {
            expect(service._safeStringify('string')).toBe('"string"');
            expect(service._safeStringify(123)).toBe('123');
            expect(service._safeStringify(true)).toBe('true');
            expect(service._safeStringify(null)).toBe('null');
        });

        test('should handle objects with throwing getters', () => {
            const obj = {};
            Object.defineProperty(obj, 'circular', {
                get() {
                    throw new Error('Getter error');
                },
                enumerable: true
            });
            const result = service._safeStringify(obj);
            // The current implementation catches the error and returns '[Serialization Failed]'
            expect(result).toBe('[Serialization Failed]');
        });
    });

    describe('_extractErrorStack', () => {
        test('should extract stack from Error object', () => {
            const error = new Error('test error');
            const result = service._extractErrorStack(error);
            expect(result).toContain('test error');
            expect(result).toContain('Error:');
        });

        test('should handle error with cause', () => {
            const cause = new Error('cause error');
            const error = new Error('main error');
            error.cause = cause;
            const result = service._extractErrorStack(error);
            expect(result).toContain('main error');
            expect(result).toContain('cause error');
            expect(result).toContain('CAUSE:');
        });

        test('should return empty string for non-Error', () => {
            const result = service._extractErrorStack('not an error');
            expect(result).toBe('');
        });

        test('should return empty string for null', () => {
            const result = service._extractErrorStack(null);
            expect(result).toBe('');
        });

        test('should return empty string for undefined', () => {
            const result = service._extractErrorStack(undefined);
            expect(result).toBe('');
        });

        test('should handle error without stack', () => {
            const error = { message: 'error without stack' };
            const result = service._extractErrorStack(error);
            expect(result).toBe('');
        });

        test('should handle extraction errors gracefully', () => {
            const error = new Error('test');
            Object.defineProperty(error, 'stack', {
                get() {
                    throw new Error('Stack access error');
                }
            });
            const result = service._extractErrorStack(error);
            expect(result).toBe('');
        });
    });

    describe('_normalizeMetadata', () => {
        test('should return empty string for null', () => {
            const result = service._normalizeMetadata(null);
            expect(result).toBe('');
        });

        test('should return empty string for undefined', () => {
            const result = service._normalizeMetadata(undefined);
            expect(result).toBe('');
        });

        test('should convert number to string', () => {
            const result = service._normalizeMetadata(123);
            expect(result).toBe('123');
        });

        test('should convert boolean to string', () => {
            const result = service._normalizeMetadata(true);
            expect(result).toBe('true');
        });

        test('should stringify object', () => {
            const result = service._normalizeMetadata({ key: 'value' });
            expect(result).toContain('key');
            expect(result).toContain('value');
        });

        test('should handle objects with throwing getters', () => {
            const obj = {};
            Object.defineProperty(obj, 'bad', {
                get() {
                    throw new Error('Parse error');
                },
                enumerable: true
            });
            const result = service._normalizeMetadata(obj);
            // The current implementation catches the error and returns '[Serialization Failed]'
            expect(result).toBe('[Serialization Failed]');
        });
    });

    describe('_resolveLevel', () => {
        test('should return ERROR for CRITICAL severity', () => {
            expect(service._resolveLevel(SEVERITY.CRITICAL)).toBe(LOG_LEVELS.ERROR);
        });

        test('should return ERROR for HIGH severity', () => {
            expect(service._resolveLevel(SEVERITY.HIGH)).toBe(LOG_LEVELS.ERROR);
        });

        test('should return WARN for MEDIUM severity', () => {
            expect(service._resolveLevel(SEVERITY.MEDIUM)).toBe(LOG_LEVELS.WARN);
        });

        test('should return INFO for LOW severity', () => {
            expect(service._resolveLevel(SEVERITY.LOW)).toBe(LOG_LEVELS.INFO);
        });

        test('should return INFO for unknown severity', () => {
            expect(service._resolveLevel('UNKNOWN')).toBe(LOG_LEVELS.INFO);
        });
    });

    describe('Global Handlers', () => {
        test('should have _registerGlobalHandlers method', () => {
            expect(typeof service._registerGlobalHandlers).toBe('function');
        });

        test('should register uncaughtException handler', () => {
            const newService = new ErrorCentralService();
            const onSpy = jest.spyOn(process, 'on');
            newService._registerGlobalHandlers();
            expect(onSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
            onSpy.mockRestore();
        });

        test('should register unhandledRejection handler', () => {
            const newService = new ErrorCentralService();
            const onSpy = jest.spyOn(process, 'on');
            newService._registerGlobalHandlers();
            expect(onSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
            onSpy.mockRestore();
        });
    });

    describe('createLogger', () => {
        test('should return LoggerContext instance', () => {
            const logger = service.createLogger('TEST_SOURCE');
            expect(logger).toBeDefined();
            expect(logger._source).toBe('TEST_SOURCE');
        });

        test('should pass service to LoggerContext', () => {
            const logger = service.createLogger('TEST_SOURCE');
            expect(logger._logger).toBe(service);
        });
    });

    describe('Performance Tests', () => {
        beforeEach(() => {
            service.init();
        });

        test('should complete 1000 report calls in less than 1000ms', () => {
            const start = Date.now();
            for (let i = 0; i < 1000; i++) {
                service.report({
                    message: `test ${i}`,
                    severity: SEVERITY.LOW
                });
            }
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(1000);
        });

        test('should handle circular reference metadata efficiently', () => {
            const obj = {};
            obj.self = obj;
            const start = Date.now();
            for (let i = 0; i < 1000; i++) {
                service.report({
                    message: 'test',
                    metadata: obj
                });
            }
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(1000);
        });

        test('should handle large metadata objects efficiently', () => {
            const largeObj = {};
            for (let i = 0; i < 100; i++) {
                largeObj[`key${i}`] = `value${i}`;
            }
            const start = Date.now();
            for (let i = 0; i < 100; i++) {
                service.report({
                    message: 'test',
                    metadata: largeObj
                });
            }
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(100);
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            service.init();
        });

        test('should handle empty message', () => {
            service.report({ message: '' });
            expect(log.info).toHaveBeenCalled();
        });

        test('should handle null message', () => {
            service.report({ message: null });
            expect(log.info).toHaveBeenCalled();
        });

        test('should handle very long message', () => {
            const longMessage = 'x'.repeat(10000);
            service.report({ message: longMessage });
            expect(log.info).toHaveBeenCalled();
        });

        test('should handle unicode characters in message', () => {
            service.report({ message: 'مرحبا' });
            expect(log.info).toHaveBeenCalled();
        });

        test('should handle special characters in message', () => {
            service.report({ message: 'test\t\n\r' });
            expect(log.info).toHaveBeenCalled();
        });

        test('should handle metadata with nested objects', () => {
            const metadata = {
                level1: {
                    level2: {
                        level3: 'value'
                    }
                }
            };
            service.report({ message: 'test', metadata });
            expect(log.info).toHaveBeenCalled();
        });

        test('should handle metadata with arrays', () => {
            const metadata = { items: [1, 2, 3] };
            service.report({ message: 'test', metadata });
            expect(log.info).toHaveBeenCalled();
        });

        test('should handle error without message', () => {
            const error = new Error();
            service.report({ message: 'test', error });
            expect(log.info).toHaveBeenCalled();
        });

        test('should handle custom error object', () => {
            const error = { name: 'CustomError', message: 'custom' };
            service.report({ message: 'test', error });
            expect(log.info).toHaveBeenCalled();
        });
    });
});
