'use strict';

const ProcessEntity = require('../../../../src/main/infrastructure/process/ProcessEntity');

describe('ProcessEntity', () => {
    describe('Constructor', () => {
        test('should set pid from options', () => {
            const entity = new ProcessEntity({ pid: 12345 });
            expect(entity.pid).toBe(12345);
        });

        test('should default pid to null when not provided', () => {
            const entity = new ProcessEntity();
            expect(entity.pid).toBeNull();
        });

        test('should set type from options', () => {
            const entity = new ProcessEntity({ type: 'adb' });
            expect(entity.type).toBe('adb');
        });

        test('should default type to generic when not provided', () => {
            const entity = new ProcessEntity();
            expect(entity.type).toBe('generic');
        });

        test('should set serial from options', () => {
            const entity = new ProcessEntity({ serial: 'device123' });
            expect(entity.serial).toBe('device123');
        });

        test('should default serial to null when not provided', () => {
            const entity = new ProcessEntity();
            expect(entity.serial).toBeNull();
        });

        test('should set status to RUNNING', () => {
            const entity = new ProcessEntity();
            expect(entity.status).toBe('RUNNING');
        });

        test('should set exitCode to null initially', () => {
            const entity = new ProcessEntity();
            expect(entity.exitCode).toBeNull();
        });

        test('should initialize _logs as empty array', () => {
            const entity = new ProcessEntity();
            expect(entity._logs).toEqual([]);
        });

        test('should set maxBufferSize from options when valid', () => {
            const entity = new ProcessEntity({ maxBufferSize: 500 });
            expect(entity.maxBufferSize).toBe(500);
        });

        test('should default maxBufferSize to 100 when not provided', () => {
            const entity = new ProcessEntity();
            expect(entity.maxBufferSize).toBe(100);
        });

        test('should default maxBufferSize to 100 when invalid (negative)', () => {
            const entity = new ProcessEntity({ maxBufferSize: -10 });
            expect(entity.maxBufferSize).toBe(100);
        });

        test('should default maxBufferSize to 100 when invalid (zero)', () => {
            const entity = new ProcessEntity({ maxBufferSize: 0 });
            expect(entity.maxBufferSize).toBe(100);
        });

        test('should floor maxBufferSize when decimal', () => {
            const entity = new ProcessEntity({ maxBufferSize: 150.7 });
            expect(entity.maxBufferSize).toBe(150);
        });

        test('should initialize _pendingStdout as empty string', () => {
            const entity = new ProcessEntity();
            expect(entity._pendingStdout).toBe('');
        });

        test('should initialize _pendingStderr as empty string', () => {
            const entity = new ProcessEntity();
            expect(entity._pendingStderr).toBe('');
        });
    });

    describe('addLog', () => {
        test('should add log entry with text, type, and timestamp', () => {
            const entity = new ProcessEntity();
            entity.addLog('test message\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe('test message');
            expect(logs[0].type).toBe('stdout');
            expect(typeof logs[0].timestamp).toBe('number');
        });

        test('should split text ending with \\n into separate log entries', () => {
            const entity = new ProcessEntity();
            entity.addLog('line1\nline2\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].text).toBe('line1');
            expect(logs[1].text).toBe('line2');
        });

        test('should store text without \\n in pending buffer', () => {
            const entity = new ProcessEntity();
            entity.addLog('incomplete', 'stdout');
            expect(entity._pendingStdout).toBe('incomplete');
            expect(entity.getLogs()).toHaveLength(0);
        });

        test('should combine pending buffer with new chunk', () => {
            const entity = new ProcessEntity();
            entity.addLog('first', 'stdout');
            entity.addLog(' second\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe('first second');
        });

        test('should handle stderr stream type', () => {
            const entity = new ProcessEntity();
            entity.addLog('error message\n', 'stderr');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].type).toBe('stderr');
            expect(logs[0].text).toBe('error message');
        });

        test('should store stderr in pending buffer when no newline', () => {
            const entity = new ProcessEntity();
            entity.addLog('partial error', 'stderr');
            expect(entity._pendingStderr).toBe('partial error');
            expect(entity._pendingStdout).toBe('');
        });

        test('should handle multiple consecutive newlines', () => {
            const entity = new ProcessEntity();
            entity.addLog('line1\n\nline3\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(3);
            expect(logs[0].text).toBe('line1');
            expect(logs[1].text).toBe('');
            expect(logs[2].text).toBe('line3');
        });

        test('should handle empty string', () => {
            const entity = new ProcessEntity();
            entity.addLog('', 'stdout');
            expect(entity._pendingStdout).toBe('');
            expect(entity.getLogs()).toHaveLength(0);
        });

        test('should handle null text by converting to string', () => {
            const entity = new ProcessEntity();
            entity.addLog(null, 'stdout');
            expect(entity._pendingStdout).toBe('null');
        });

        test('should handle undefined text by converting to string', () => {
            const entity = new ProcessEntity();
            entity.addLog(undefined, 'stdout');
            expect(entity._pendingStdout).toBe('undefined');
        });

        test('should handle number by converting to string', () => {
            const entity = new ProcessEntity();
            entity.addLog(123, 'stdout');
            expect(entity._pendingStdout).toBe('123');
        });

        test('should enforce maxBufferSize by removing oldest logs', () => {
            const entity = new ProcessEntity({ maxBufferSize: 3 });
            entity.addLog('line1\n', 'stdout');
            entity.addLog('line2\n', 'stdout');
            entity.addLog('line3\n', 'stdout');
            entity.addLog('line4\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(3);
            expect(logs[0].text).toBe('line2');
            expect(logs[1].text).toBe('line3');
            expect(logs[2].text).toBe('line4');
        });

        test('should handle stream type other than stdout/stderr as stdout', () => {
            const entity = new ProcessEntity();
            entity.addLog('test\n', 'custom');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].type).toBe('custom');
        });
    });

    describe('flushPendingLogs', () => {
        test('should add pending stdout to logs', () => {
            const entity = new ProcessEntity();
            entity.addLog('pending', 'stdout');
            entity.flushPendingLogs();
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe('pending');
            expect(logs[0].type).toBe('stdout');
        });

        test('should add pending stderr to logs', () => {
            const entity = new ProcessEntity();
            entity.addLog('error', 'stderr');
            entity.flushPendingLogs();
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe('error');
            expect(logs[0].type).toBe('stderr');
        });

        test('should add both pending stdout and stderr to logs', () => {
            const entity = new ProcessEntity();
            entity.addLog('stdout pending', 'stdout');
            entity.addLog('stderr pending', 'stderr');
            entity.flushPendingLogs();
            const logs = entity.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].text).toBe('stdout pending');
            expect(logs[1].text).toBe('stderr pending');
        });

        test('should clear pending buffers after flushing', () => {
            const entity = new ProcessEntity();
            entity.addLog('pending', 'stdout');
            entity.flushPendingLogs();
            expect(entity._pendingStdout).toBe('');
            expect(entity._pendingStderr).toBe('');
        });

        test('should do nothing when no pending logs', () => {
            const entity = new ProcessEntity();
            entity.flushPendingLogs();
            expect(entity.getLogs()).toHaveLength(0);
        });

        test('should handle empty pending buffers', () => {
            const entity = new ProcessEntity();
            entity._pendingStdout = '';
            entity._pendingStderr = '';
            entity.flushPendingLogs();
            expect(entity.getLogs()).toHaveLength(0);
        });
    });

    describe('markAsExited', () => {
        test('should flush pending logs before marking', () => {
            const entity = new ProcessEntity();
            entity.addLog('pending', 'stdout');
            entity.markAsExited(0);
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe('pending');
        });

        test('should change status to EXITED', () => {
            const entity = new ProcessEntity();
            entity.markAsExited(0);
            expect(entity.status).toBe('EXITED');
        });

        test('should set exitCode to provided value', () => {
            const entity = new ProcessEntity();
            entity.markAsExited(42);
            expect(entity.exitCode).toBe(42);
        });

        test('should handle zero exit code', () => {
            const entity = new ProcessEntity();
            entity.markAsExited(0);
            expect(entity.exitCode).toBe(0);
        });

        test('should handle negative exit code', () => {
            const entity = new ProcessEntity();
            entity.markAsExited(-15);
            expect(entity.exitCode).toBe(-15);
        });

        test('should handle null exit code', () => {
            const entity = new ProcessEntity();
            entity.markAsExited(null);
            expect(entity.exitCode).toBeNull();
        });
    });

    describe('markAsFailed', () => {
        test('should flush pending logs before marking', () => {
            const entity = new ProcessEntity();
            entity.addLog('pending', 'stdout');
            entity.markAsFailed('error');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].text).toBe('pending');
        });

        test('should change status to FAILED', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed();
            expect(entity.status).toBe('FAILED');
        });

        test('should set exitCode to -1', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed();
            expect(entity.exitCode).toBe(-1);
        });

        test('should add error message to logs as stderr', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed('Process failed');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe('Process failed');
            expect(logs[0].type).toBe('stderr');
        });

        test('should handle null error message', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed(null);
            const logs = entity.getLogs();
            expect(logs).toHaveLength(0);
        });

        test('should handle undefined error message', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed(undefined);
            const logs = entity.getLogs();
            expect(logs).toHaveLength(0);
        });

        test('should convert error message to string', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed(123);
            const logs = entity.getLogs();
            expect(logs[0].text).toBe('123');
        });
    });

    describe('getLogs', () => {
        test('should return shallow copy of logs', () => {
            const entity = new ProcessEntity();
            entity.addLog('line1\n', 'stdout');
            const logs1 = entity.getLogs();
            const logs2 = entity.getLogs();
            expect(logs1).not.toBe(logs2);
            expect(logs1).toEqual(logs2);
        });

        test('should return empty array when no logs', () => {
            const entity = new ProcessEntity();
            expect(entity.getLogs()).toEqual([]);
        });

        test('should not allow modification of internal _logs via returned array', () => {
            const entity = new ProcessEntity();
            entity.addLog('line1\n', 'stdout');
            const logs = entity.getLogs();
            logs.push({ text: 'fake' });
            expect(entity.getLogs()).toHaveLength(1);
        });
    });

    describe('Performance Tests', () => {
        test('should add 10000 logs in less than 250ms', () => {
            const entity = new ProcessEntity({ maxBufferSize: 10000 });
            const start = Date.now();
            for (let i = 0; i < 10000; i++) {
                entity.addLog(`line ${i}\n`, 'stdout');
            }
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(250);
        });

        test('should enforce maxBufferSize during bulk additions', () => {
            const entity = new ProcessEntity({ maxBufferSize: 100 });
            for (let i = 0; i < 1000; i++) {
                entity.addLog(`line ${i}\n`, 'stdout');
            }
            expect(entity.getLogs()).toHaveLength(100);
        });

        test('should handle mixed newline and non-newline additions efficiently', () => {
            const entity = new ProcessEntity({ maxBufferSize: 10000 });
            const start = Date.now();
            for (let i = 0; i < 10000; i++) {
                if (i % 2 === 0) {
                    entity.addLog(`line ${i}\n`, 'stdout');
                } else {
                    entity.addLog(`partial ${i}`, 'stdout');
                }
            }
            entity.flushPendingLogs();
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(100);
        });

        test('should handle getLogs efficiently with large buffer', () => {
            const entity = new ProcessEntity({ maxBufferSize: 10000 });
            for (let i = 0; i < 10000; i++) {
                entity.addLog(`line ${i}\n`, 'stdout');
            }
            const start = Date.now();
            const logs = entity.getLogs();
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(10);
            expect(logs).toHaveLength(10000);
        });
    });

    describe('Edge Cases', () => {
        test('should handle very long log lines', () => {
            const entity = new ProcessEntity();
            const longLine = 'x'.repeat(10000);
            entity.addLog(longLine + '\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe(longLine);
        });

        test('should handle unicode characters', () => {
            const entity = new ProcessEntity();
            entity.addLog('مرحبا\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs[0].text).toBe('مرحبا');
        });

        test('should handle special characters', () => {
            const entity = new ProcessEntity();
            entity.addLog('test\t\r\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs[0].text).toBe('test\t\r');
        });

        test('should handle consecutive calls to markAsExited', () => {
            const entity = new ProcessEntity();
            entity.markAsExited(0);
            entity.markAsExited(1);
            expect(entity.exitCode).toBe(1);
        });

        test('should handle consecutive calls to markAsFailed', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed('error1');
            entity.markAsFailed('error2');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].text).toBe('error1');
            expect(logs[1].text).toBe('error2');
        });

        test('should handle calling markAsExited after markAsFailed', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed('error');
            entity.markAsExited(0);
            expect(entity.status).toBe('EXITED');
            expect(entity.exitCode).toBe(0);
        });

        test('should handle calling markAsFailed after markAsExited', () => {
            const entity = new ProcessEntity();
            entity.markAsExited(0);
            entity.markAsFailed('error');
            expect(entity.status).toBe('FAILED');
            expect(entity.exitCode).toBe(-1);
        });

        test('should handle maxBufferSize of 1', () => {
            const entity = new ProcessEntity({ maxBufferSize: 1 });
            entity.addLog('line1\n', 'stdout');
            entity.addLog('line2\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe('line2');
        });

        test('should handle very large maxBufferSize', () => {
            const entity = new ProcessEntity({ maxBufferSize: 1000000 });
            expect(entity.maxBufferSize).toBe(1000000);
        });

        test('should handle maxBufferSize as string number', () => {
            const entity = new ProcessEntity({ maxBufferSize: '50' });
            expect(entity.maxBufferSize).toBe(100); // Should default to 100 for non-numeric
        });

        test('should handle maxBufferSize as Infinity', () => {
            const entity = new ProcessEntity({ maxBufferSize: Infinity });
            expect(entity.maxBufferSize).toBe(100); // Should default to 100 for non-finite
        });

        test('should handle maxBufferSize as NaN', () => {
            const entity = new ProcessEntity({ maxBufferSize: NaN });
            expect(entity.maxBufferSize).toBe(100); // Should default to 100 for NaN
        });

        test('should handle maxBufferSize as decimal that floors to 0', () => {
            const entity = new ProcessEntity({ maxBufferSize: 0.9 });
            expect(entity.maxBufferSize).toBe(0); // Actually floors to 0, not 100
        });

        test('should handle chunk ending with multiple newlines', () => {
            const entity = new ProcessEntity();
            entity.addLog('line1\n\n\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(3);
            expect(logs[0].text).toBe('line1');
            expect(logs[1].text).toBe('');
            expect(logs[2].text).toBe('');
        });

        test('should handle chunk with only newlines', () => {
            const entity = new ProcessEntity();
            entity.addLog('\n\n\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(3);
            logs.forEach(log => expect(log.text).toBe(''));
        });

        test('should handle object converted to string', () => {
            const entity = new ProcessEntity();
            entity.addLog({ key: 'value' }, 'stdout');
            expect(entity._pendingStdout).toBe('[object Object]');
        });

        test('should handle array converted to string', () => {
            const entity = new ProcessEntity();
            entity.addLog(['a', 'b'], 'stdout');
            expect(entity._pendingStdout).toBe('a,b');
        });

        test('should handle boolean converted to string', () => {
            const entity = new ProcessEntity();
            entity.addLog(true, 'stdout');
            expect(entity._pendingStdout).toBe('true');
        });

        test('should handle mixed stream types in sequence', () => {
            const entity = new ProcessEntity();
            entity.addLog('stdout line\n', 'stdout');
            entity.addLog('stderr line\n', 'stderr');
            entity.addLog('stdout line2\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(3);
            expect(logs[0].type).toBe('stdout');
            expect(logs[1].type).toBe('stderr');
            expect(logs[2].type).toBe('stdout');
        });

        test('should handle flushPendingLogs called multiple times', () => {
            const entity = new ProcessEntity();
            entity.addLog('pending1', 'stdout');
            entity.flushPendingLogs();
            entity.addLog('pending2', 'stdout');
            entity.flushPendingLogs();
            const logs = entity.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].text).toBe('pending1');
            expect(logs[1].text).toBe('pending2');
        });

        test('should handle markAsExited without pending logs', () => {
            const entity = new ProcessEntity();
            entity.markAsExited(0);
            expect(entity.getLogs()).toHaveLength(0);
        });

        test('should handle markAsFailed without pending logs', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed('error');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1);
            expect(logs[0].text).toBe('error');
        });

        test('should handle markAsFailed with empty string error', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed('');
            const logs = entity.getLogs();
            // Empty string is falsy, so no log is added
            expect(logs).toHaveLength(0);
        });

        test('should handle markAsFailed with object error', () => {
            const entity = new ProcessEntity();
            entity.markAsFailed({ message: 'error' });
            const logs = entity.getLogs();
            expect(logs[0].text).toBe('[object Object]');
        });

        test('should handle maxBufferSize exactly at limit', () => {
            const entity = new ProcessEntity({ maxBufferSize: 5 });
            for (let i = 0; i < 5; i++) {
                entity.addLog(`line${i}\n`, 'stdout');
            }
            expect(entity.getLogs()).toHaveLength(5);
            entity.addLog('line5\n', 'stdout');
            expect(entity.getLogs()).toHaveLength(5);
            expect(entity.getLogs()[0].text).toBe('line1');
        });

        test('should handle adding logs after flushPendingLogs', () => {
            const entity = new ProcessEntity();
            entity.addLog('pending', 'stdout');
            entity.flushPendingLogs();
            entity.addLog('new line\n', 'stdout');
            const logs = entity.getLogs();
            expect(logs).toHaveLength(2);
            expect(logs[0].text).toBe('pending');
            expect(logs[1].text).toBe('new line');
        });
    });

    describe('Security Tests', () => {
        test('should handle 100,000 log entries without excessive memory increase', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const entity = new ProcessEntity({ maxBufferSize: 100000 });
            
            const startTime = Date.now();
            for (let i = 0; i < 100000; i++) {
                entity.addLog(`line ${i}\n`, 'stdout');
            }
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
            
            const logs = entity.getLogs();
            
            console.log(`[Security] Added 100,000 logs in ${duration}ms`);
            console.log(`[Security] Memory increase for 100,000 logs: ${memoryIncrease.toFixed(2)}MB`);
            
            expect(logs).toHaveLength(100000);
            expect(duration).toBeLessThan(1000); // Should complete in under 1 second
            expect(memoryIncrease).toBeLessThan(100); // Should not increase by more than 100MB
        });

        test('should respect maxBufferSize even with large number of logs', () => {
            const entity = new ProcessEntity({ maxBufferSize: 1000 });
            
            // Add 10,000 logs but buffer should only hold 1000
            for (let i = 0; i < 10000; i++) {
                entity.addLog(`line ${i}\n`, 'stdout');
            }
            
            const logs = entity.getLogs();
            expect(logs).toHaveLength(1000);
            // Should contain the last 1000 logs
            expect(logs[0].text).toBe('line 9000');
            expect(logs[999].text).toBe('line 9999');
        });

        test('should handle rapid log addition without memory leak', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const entity = new ProcessEntity({ maxBufferSize: 5000 });
            
            // Add 50,000 logs rapidly
            for (let i = 0; i < 50000; i++) {
                entity.addLog(`line ${i}\n`, 'stdout');
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
            
            const logs = entity.getLogs();
            
            console.log(`[Security] Memory increase for 50,000 rapid logs: ${memoryIncrease.toFixed(2)}MB`);
            
            expect(logs).toHaveLength(5000); // Should be limited by maxBufferSize
            expect(memoryIncrease).toBeLessThan(50); // Should not increase by more than 50MB
        });

        test('should handle very long log lines without memory explosion', () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const entity = new ProcessEntity({ maxBufferSize: 100 });
            
            // Add 100 logs with 10KB each
            for (let i = 0; i < 100; i++) {
                const longLine = 'x'.repeat(10 * 1024); // 10KB
                entity.addLog(longLine + '\n', 'stdout');
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
            
            const logs = entity.getLogs();
            
            console.log(`[Security] Memory increase for 100 x 10KB logs: ${memoryIncrease.toFixed(2)}MB`);
            
            expect(logs).toHaveLength(100);
            expect(memoryIncrease).toBeLessThan(20); // Should not increase by more than 20MB
        });
    });
});
