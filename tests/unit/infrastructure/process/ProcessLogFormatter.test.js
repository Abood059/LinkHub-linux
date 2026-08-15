'use strict';

const ProcessLogFormatter = require('../../../../src/main/infrastructure/process/ProcessLogFormatter');

describe('ProcessLogFormatter', () => {
    describe('format', () => {
        test('should format array of logs with newlines', () => {
            const logs = [
                { text: 'line1', type: 'stdout' },
                { text: 'line2', type: 'stdout' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('line1\nline2');
        });

        test('should prefix stderr lines with [ERR]', () => {
            const logs = [
                { text: 'error message', type: 'stderr' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('[ERR] error message');
        });

        test('should handle mixed stdout and stderr', () => {
            const logs = [
                { text: 'info', type: 'stdout' },
                { text: 'error', type: 'stderr' },
                { text: 'more info', type: 'stdout' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('info\n[ERR] error\nmore info');
        });

        test('should return null for null input', () => {
            const result = ProcessLogFormatter.format(null);
            expect(result).toBeNull();
        });

        test('should return null for undefined input', () => {
            const result = ProcessLogFormatter.format(undefined);
            expect(result).toBeNull();
        });

        test('should return null for non-array input', () => {
            const result = ProcessLogFormatter.format('not an array');
            expect(result).toBeNull();
        });

        test('should return null for object input', () => {
            const result = ProcessLogFormatter.format({ text: 'test' });
            expect(result).toBeNull();
        });

        test('should return null for number input', () => {
            const result = ProcessLogFormatter.format(123);
            expect(result).toBeNull();
        });

        test('should return empty string for empty array', () => {
            const result = ProcessLogFormatter.format([]);
            expect(result).toBe('');
        });

        test('should handle single log entry', () => {
            const logs = [{ text: 'single line', type: 'stdout' }];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('single line');
        });

        test('should handle unknown stream type as stdout (no prefix)', () => {
            const logs = [
                { text: 'custom stream', type: 'custom' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('custom stream');
        });

        test('should handle logs without type field', () => {
            const logs = [
                { text: 'no type' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('no type');
        });

        test('should handle logs with null type', () => {
            const logs = [
                { text: 'null type', type: null }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('null type');
        });

        test('should handle logs with undefined type', () => {
            const logs = [
                { text: 'undefined type', type: undefined }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('undefined type');
        });

        test('should preserve original text including special characters', () => {
            const logs = [
                { text: 'test\ttab\r\n', type: 'stdout' }
            ];
            const result = ProcessLogFormatter.format(logs);
            // The \r is preserved in the output
            expect(result).toContain('test\ttab');
        });

        test('should handle unicode characters', () => {
            const logs = [
                { text: 'مرحبا', type: 'stdout' },
                { text: 'خطأ', type: 'stderr' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('مرحبا\n[ERR] خطأ');
        });

        test('should handle empty strings in logs', () => {
            const logs = [
                { text: '', type: 'stdout' },
                { text: 'not empty', type: 'stdout' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('\nnot empty');
        });

        test('should handle very long log lines', () => {
            const longText = 'x'.repeat(10000);
            const logs = [{ text: longText, type: 'stdout' }];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe(longText);
        });

        test('should handle multiple consecutive stderr', () => {
            const logs = [
                { text: 'error1', type: 'stderr' },
                { text: 'error2', type: 'stderr' },
                { text: 'error3', type: 'stderr' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('[ERR] error1\n[ERR] error2\n[ERR] error3');
        });

        test('should handle logs with timestamp field (ignored)', () => {
            const logs = [
                { text: 'with timestamp', type: 'stdout', timestamp: 1234567890 }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('with timestamp');
        });

        test('should be case-sensitive for type comparison', () => {
            const logs = [
                { text: 'uppercase', type: 'STDERR' }
            ];
            const result = ProcessLogFormatter.format(logs);
            expect(result).toBe('uppercase');
        });

        test('should handle log entry without text field', () => {
            const logs = [
                { type: 'stderr' }
            ];
            const result = ProcessLogFormatter.format(logs);
            // When text field is missing, entry.text is undefined, which becomes empty string
            expect(result).toBe('[ERR] ');
        });
    });

    describe('Edge Cases', () => {
        test('should filter out null entries', () => {
            const logs = [null, { text: 'valid', type: 'stdout' }];
            const result = ProcessLogFormatter.format(logs);
            // Null entries are filtered out, not thrown
            expect(result).toBe('valid');
        });

        test('should filter out undefined entries', () => {
            const logs = [undefined, { text: 'valid', type: 'stdout' }];
            const result = ProcessLogFormatter.format(logs);
            // Undefined entries are filtered out, not thrown
            expect(result).toBe('valid');
        });

        test('should handle array with non-object entries (strings/numbers)', () => {
            const logs = ['string', 123, { text: 'valid', type: 'stdout' }];
            // Strings and numbers have .text as undefined, resulting in empty strings in output
            const result = ProcessLogFormatter.format(logs);
            expect(result).toContain('valid');
        });

        test('should handle very large number of log entries', () => {
            const logs = [];
            for (let i = 0; i < 1000; i++) {
                logs.push({ text: `line ${i}`, type: i % 2 === 0 ? 'stdout' : 'stderr' });
            }
            const start = Date.now();
            const result = ProcessLogFormatter.format(logs);
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(50);
            expect(result.split('\n')).toHaveLength(1000);
        });
    });
});
