'use strict';

const LoggerContext = require('../../../../src/main/infrastructure/logging/LoggerContext');

describe('LoggerContext', () => {
    let mockLogger;

    beforeEach(() => {
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            fatal: jest.fn(),
            report: jest.fn()
        };
    });

    describe('Constructor', () => {
        test('should store logger and source correctly', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            expect(context._logger).toBe(mockLogger);
            expect(context._source).toBe('TestSource');
        });

        test('should freeze the instance', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            expect(Object.isFrozen(context)).toBe(true);
        });

        test('should handle null logger', () => {
            const context = new LoggerContext(null, 'TestSource');
            expect(context._logger).toBeNull();
        });

        test('should handle undefined logger', () => {
            const context = new LoggerContext(undefined, 'TestSource');
            expect(context._logger).toBeUndefined();
        });

        test('should handle null source', () => {
            const context = new LoggerContext(mockLogger, null);
            expect(context._source).toBeNull();
        });

        test('should handle undefined source', () => {
            const context = new LoggerContext(mockLogger, undefined);
            expect(context._source).toBeUndefined();
        });

        test('should handle empty string source', () => {
            const context = new LoggerContext(mockLogger, '');
            expect(context._source).toBe('');
        });
    });

    describe('info', () => {
        test('should call logger.info with source in options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.info('Test message');
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test message',
                { source: 'TestSource' }
            );
        });

        test('should merge additional options with source', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            const options = { metadata: { key: 'value' }, level: 'debug' };
            context.info('Test message', options);
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test message',
                { metadata: { key: 'value' }, level: 'debug', source: 'TestSource' }
            );
        });

        test('should not modify original options object', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            const options = { key: 'value' };
            context.info('Test message', options);
            
            expect(options).toEqual({ key: 'value' });
        });

        test('should handle empty options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.info('Test message', {});
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test message',
                { source: 'TestSource' }
            );
        });

        test('should handle null options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.info('Test message', null);
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test message',
                { source: 'TestSource' }
            );
        });

        test('should handle undefined options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.info('Test message');
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test message',
                { source: 'TestSource' }
            );
        });

        test('should handle options with source key (source should be overridden)', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.info('Test message', { source: 'OtherSource' });
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test message',
                { source: 'TestSource' }
            );
        });

        test('should return result from logger.info', () => {
            mockLogger.info.mockReturnValue('logged');
            const context = new LoggerContext(mockLogger, 'TestSource');
            const result = context.info('Test message');
            
            expect(result).toBe('logged');
        });
    });

    describe('warn', () => {
        test('should call logger.warn with source in options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.warn('Warning message');
            
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Warning message',
                { source: 'TestSource' }
            );
        });

        test('should merge additional options with source', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            const options = { metadata: { key: 'value' } };
            context.warn('Warning message', options);
            
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Warning message',
                { metadata: { key: 'value' }, source: 'TestSource' }
            );
        });

        test('should handle empty options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.warn('Warning message', {});
            
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Warning message',
                { source: 'TestSource' }
            );
        });

        test('should return result from logger.warn', () => {
            mockLogger.warn.mockReturnValue('warned');
            const context = new LoggerContext(mockLogger, 'TestSource');
            const result = context.warn('Warning message');
            
            expect(result).toBe('warned');
        });
    });

    describe('error', () => {
        test('should call logger.error with source in options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.error('Error message');
            
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error message',
                { source: 'TestSource' }
            );
        });

        test('should merge additional options with source', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            const options = { metadata: { key: 'value' }, error: new Error('test') };
            context.error('Error message', options);
            
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error message',
                { metadata: { key: 'value' }, error: new Error('test'), source: 'TestSource' }
            );
        });

        test('should handle empty options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.error('Error message', {});
            
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error message',
                { source: 'TestSource' }
            );
        });

        test('should return result from logger.error', () => {
            mockLogger.error.mockReturnValue('errored');
            const context = new LoggerContext(mockLogger, 'TestSource');
            const result = context.error('Error message');
            
            expect(result).toBe('errored');
        });
    });

    describe('fatal', () => {
        test('should call logger.fatal with source in options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.fatal('Fatal message');
            
            expect(mockLogger.fatal).toHaveBeenCalledWith(
                'Fatal message',
                { source: 'TestSource' }
            );
        });

        test('should merge additional options with source', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            const options = { metadata: { key: 'value' } };
            context.fatal('Fatal message', options);
            
            expect(mockLogger.fatal).toHaveBeenCalledWith(
                'Fatal message',
                { metadata: { key: 'value' }, source: 'TestSource' }
            );
        });

        test('should handle empty options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.fatal('Fatal message', {});
            
            expect(mockLogger.fatal).toHaveBeenCalledWith(
                'Fatal message',
                { source: 'TestSource' }
            );
        });

        test('should return result from logger.fatal', () => {
            mockLogger.fatal.mockReturnValue('fatal');
            const context = new LoggerContext(mockLogger, 'TestSource');
            const result = context.fatal('Fatal message');
            
            expect(result).toBe('fatal');
        });
    });

    describe('report', () => {
        test('should call logger.report with source in options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.report({ type: 'TEST', message: 'Test report' });
            
            expect(mockLogger.report).toHaveBeenCalledWith(
                { type: 'TEST', message: 'Test report', source: 'TestSource' }
            );
        });

        test('should merge additional options with source', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            const options = { type: 'TEST', metadata: { key: 'value' } };
            context.report(options);
            
            expect(mockLogger.report).toHaveBeenCalledWith(
                { type: 'TEST', metadata: { key: 'value' }, source: 'TestSource' }
            );
        });

        test('should handle empty options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.report({});
            
            expect(mockLogger.report).toHaveBeenCalledWith(
                { source: 'TestSource' }
            );
        });

        test('should handle null options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.report(null);
            
            expect(mockLogger.report).toHaveBeenCalledWith(
                { source: 'TestSource' }
            );
        });

        test('should handle undefined options', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.report();
            
            expect(mockLogger.report).toHaveBeenCalledWith(
                { source: 'TestSource' }
            );
        });

        test('should handle options with source key (source should be overridden)', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            context.report({ source: 'OtherSource', type: 'TEST' });
            
            expect(mockLogger.report).toHaveBeenCalledWith(
                { source: 'TestSource', type: 'TEST' }
            );
        });

        test('should return result from logger.report', () => {
            mockLogger.report.mockReturnValue('reported');
            const context = new LoggerContext(mockLogger, 'TestSource');
            const result = context.report({ type: 'TEST' });
            
            expect(result).toBe('reported');
        });
    });

    describe('Edge Cases', () => {
        test('should throw error when calling method with null logger', () => {
            const context = new LoggerContext(null, 'TestSource');
            expect(() => context.info('Test')).toThrow();
        });

        test('should throw error when calling method with undefined logger', () => {
            const context = new LoggerContext(undefined, 'TestSource');
            expect(() => context.info('Test')).toThrow();
        });

        test('should handle logger that throws', () => {
            const throwingLogger = {
                info: jest.fn(() => { throw new Error('Logger error'); })
            };
            const context = new LoggerContext(throwingLogger, 'TestSource');
            expect(() => context.info('Test')).toThrow('Logger error');
        });

        test('should handle complex metadata objects', () => {
            const context = new LoggerContext(mockLogger, 'TestSource');
            const complexMetadata = {
                nested: { deep: { value: 123 } },
                array: [1, 2, 3]
            };
            context.info('Test', { metadata: complexMetadata });
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test',
                { metadata: complexMetadata, source: 'TestSource' }
            );
        });

        test('should handle special characters in source', () => {
            const context = new LoggerContext(mockLogger, 'Source-With-Special_Chars.123');
            context.info('Test');
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test',
                { source: 'Source-With-Special_Chars.123' }
            );
        });

        test('should handle unicode in source', () => {
            const context = new LoggerContext(mockLogger, 'المصدر-测试');
            context.info('Test');
            
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Test',
                { source: 'المصدر-测试' }
            );
        });
    });
});
