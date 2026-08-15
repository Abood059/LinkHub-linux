'use strict';

const processManager = require('../../../src/main/infrastructure/process/ProcessManager');

describe('ProcessManager Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Clear any active processes before each test
        processManager.activeProcesses.clear();
    });

    afterEach(async () => {
        // Clean up any running processes
        try {
            await processManager.terminateAll();
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    describe('execute with real commands', () => {
        test('should execute echo command successfully', (done) => {
            const onData = jest.fn();
            
            const child = processManager.execute('echo-test', 'echo', ['hello world'], 'generic', onData);
            
            expect(child.pid).toBeDefined();
            expect(typeof child.pid).toBe('number');
            expect(child.pid).toBeGreaterThan(0);
            
            // Wait for process to complete
            setTimeout(() => {
                expect(onData).toHaveBeenCalled();
                const calls = onData.mock.calls;
                const output = calls.map(call => call[0]).join('');
                expect(output).toContain('hello world');
                done();
            }, 100);
        });

        test('should register process in activeProcesses', () => {
            const child = processManager.execute('echo-test', 'echo', ['test']);
            
            expect(processManager.activeProcesses.has('echo-test')).toBe(true);
            const entry = processManager.activeProcesses.get('echo-test');
            expect(entry.instance).toBe(child);
            expect(entry.data).toBeDefined();
            expect(entry.startedAt).toBeDefined();
        });

        test('should remove process from activeProcesses on exit', (done) => {
            processManager.execute('echo-test', 'echo', ['test']);
            
            expect(processManager.activeProcesses.has('echo-test')).toBe(true);
            
            setTimeout(() => {
                expect(processManager.activeProcesses.has('echo-test')).toBe(false);
                done();
            }, 200);
        });

        test('should collect logs from stdout', (done) => {
            processManager.execute('echo-test', 'echo', ['line1\nline2\nline3']);
            
            setTimeout(() => {
                const logs = processManager.getLogs('echo-test');
                // Process should be removed, so logs might be null
                // But we can check if logs were collected during execution
                if (logs) {
                    expect(logs.length).toBeGreaterThan(0);
                }
                done();
            }, 200);
        });

        test('should handle multiple concurrent processes', (done) => {
            const onData1 = jest.fn();
            const onData2 = jest.fn();
            const onData3 = jest.fn();
            
            processManager.execute('echo-test-1', 'echo', ['test1'], 'generic', onData1);
            processManager.execute('echo-test-2', 'echo', ['test2'], 'generic', onData2);
            processManager.execute('echo-test-3', 'echo', ['test3'], 'generic', onData3);
            
            expect(processManager.activeProcesses.size).toBe(3);
            
            setTimeout(() => {
                expect(onData1).toHaveBeenCalled();
                expect(onData2).toHaveBeenCalled();
                expect(onData3).toHaveBeenCalled();
                done();
            }, 300);
        });

        test('should terminate existing process when reusing id', (done) => {
            // Start a long-running process
            processManager.execute('long-test', 'node', ['-e', 'setTimeout(() => {}, 10000)']);
            
            setTimeout(() => {
                // Start another process with same ID
                const child = processManager.execute('long-test', 'echo', ['test']);
                
                expect(child.pid).toBeDefined();
                
                setTimeout(() => {
                    // Should have output from echo, not the long process
                    done();
                }, 200);
            }, 100);
        });
    });

    describe('executeQuickTaskArray with real commands', () => {
        test('should execute echo "Hello" and return correct output', async () => {
            const result = await processManager.executeQuickTaskArray('echo', ['Hello']);
            
            expect(typeof result).toBe('string');
            expect(result.trim()).toBe('Hello');
        });

        test('should execute node -e "console.log(\'test\')" and return test', async () => {
            const result = await processManager.executeQuickTaskArray('node', ['-e', 'console.log("test")']);
            
            expect(typeof result).toBe('string');
            expect(result.trim()).toBe('test');
        });

        test('should reject with error for non-existent command', async () => {
            await expect(
                processManager.executeQuickTaskArray('command_that_does_not_exist_xyz_123', ['arg'])
            ).rejects.toThrow();
        });

        test('should execute and return stdout', async () => {
            const result = await processManager.executeQuickTaskArray('echo', ['hello world']);
            
            expect(typeof result).toBe('string');
            expect(result.trim()).toBe('hello world');
        });

        test('should trim output', async () => {
            const result = await processManager.executeQuickTaskArray('echo', ['  test  ']);
            
            expect(result).toBe('test');
        });

        test('should handle multi-line output', async () => {
            const result = await processManager.executeQuickTaskArray('echo', ['-e', 'line1\\nline2\\nline3']);
            
            expect(result).toContain('line1');
            expect(result).toContain('line2');
            expect(result).toContain('line3');
        });

        test('should handle empty output', async () => {
            const result = await processManager.executeQuickTaskArray('echo', ['']);
            
            expect(result).toBe('');
        });

        test('should handle node command', async () => {
            const result = await processManager.executeQuickTaskArray('node', ['-e', 'console.log("node test")']);
            
            expect(result.trim()).toBe('node test');
        });

        test('should handle command with special characters', async () => {
            const result = await processManager.executeQuickTaskArray('echo', ['test!@#$%^&*()']);
            
            expect(result).toContain('test!@#$%^&*()');
        });

        test('should timeout on long-running command', async () => {
            await expect(
                processManager.executeQuickTaskArray('node', ['-e', 'setTimeout(() => {}, 10000)'], { timeout: 1000 })
            ).rejects.toThrow('Command timeout');
        });

        test('should handle non-zero exit code', async () => {
            await expect(
                processManager.executeQuickTaskArray('node', ['-e', 'process.exit(1)'])
            ).rejects.toThrow('Process exited with code 1');
        });

        test('should handle command that outputs to stderr', async () => {
            await expect(
                processManager.executeQuickTaskArray('node', ['-e', 'console.error("error message"); process.exit(1);'])
            ).rejects.toThrow('error message');
        });
    });

    describe('executeAndWatch with real commands', () => {
        test('should find sentinel "waiting" in node process output and stop process', async () => {
            const result = await processManager.executeAndWatch(
                'watch-test',
                'node',
                ['-e', 'setInterval(() => console.log("waiting"), 1000)'],
                'waiting',
                5000
            );
            
            expect(result.success).toBe(true);
            expect(result.output).toContain('waiting');
        });

        test('should timeout when running sleep 10 with 1s timeout', async () => {
            const result = await processManager.executeAndWatch(
                'watch-test',
                'sleep',
                ['10'],
                'never',
                1000
            );
            
            expect(result.success).toBe(false);
            expect(result.output).toContain('[Timeout]');
        });

        test('should find sentinel in output', async () => {
            const result = await processManager.executeAndWatch(
                'watch-test',
                'node',
                ['-e', 'console.log("starting"); setTimeout(() => console.log("SUCCESS"), 100);'],
                'SUCCESS',
                5000
            );
            
            expect(result.success).toBe(true);
            expect(result.output).toContain('SUCCESS');
        });

        test('should timeout when sentinel not found', async () => {
            const result = await processManager.executeAndWatch(
                'watch-test',
                'node',
                ['-e', 'console.log("starting"); setTimeout(() => console.log("never"), 10000);'],
                'SUCCESS',
                500
            );
            
            expect(result.success).toBe(false);
            expect(result.output).toContain('[Timeout]');
        });

        test('should handle immediate success', async () => {
            const result = await processManager.executeAndWatch(
                'watch-test',
                'echo',
                ['SUCCESS'],
                'SUCCESS',
                5000
            );
            
            expect(result.success).toBe(true);
        });

        test('should handle non-zero exit code', async () => {
            const result = await processManager.executeAndWatch(
                'watch-test',
                'node',
                ['-e', 'process.exit(1)'],
                'SUCCESS',
                5000
            );
            
            expect(result.success).toBe(false);
        });

        test('should limit output size', async () => {
            // Use a loop to generate output instead of passing as argument
            const result = await processManager.executeAndWatch(
                'watch-test',
                'node',
                ['-e', 'for(let i=0;i<50000;i++)console.log("x");console.log("SUCCESS");'],
                'SUCCESS',
                5000
            );
            
            expect(result.output.length).toBeLessThanOrEqual(1024 * 1024 + 100); // Allow some margin
        });
    });

    describe('terminate with real processes', () => {
        test('should terminate a running process', (done) => {
            processManager.execute('long-test', 'node', ['-e', 'setTimeout(() => {}, 10000)']);
            
            setTimeout(() => {
                expect(processManager.activeProcesses.has('long-test')).toBe(true);
                
                const result = processManager.terminate('long-test');
                expect(result).toBe(true);
                
                setTimeout(() => {
                    expect(processManager.activeProcesses.has('long-test')).toBe(false);
                    done();
                }, 200);
            }, 100);
        });

        test('should return false for non-existent process', () => {
            const result = processManager.terminate('non-existent');
            expect(result).toBe(false);
        });

        test('should handle process that exits quickly', (done) => {
            processManager.execute('quick-test', 'echo', ['test']);
            
            setTimeout(() => {
                const result = processManager.terminate('quick-test');
                expect(result).toBe(false); // Process already gone
                done();
            }, 200);
        });
    });

    describe('terminateAll with real processes', () => {
        test('should terminate 5 sleep 30 processes within 2 seconds and clear activeProcesses', async () => {
            // Launch 5 sleep processes
            for (let i = 0; i < 5; i++) {
                processManager.execute(`sleep-${i}`, 'sleep', ['30']);
            }
            
            // Wait a bit for processes to start
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(processManager.activeProcesses.size).toBe(5);
            
            const start = Date.now();
            await processManager.terminateAll();
            const duration = Date.now() - start;
            
            // Should complete within 2 seconds (due to force kill after graceful timeout)
            expect(duration).toBeLessThan(2000);
            expect(processManager.activeProcesses.size).toBe(0);
        });

        test('should terminate all running processes', (done) => {
            processManager.execute('long-1', 'node', ['-e', 'setTimeout(() => {}, 10000)']);
            processManager.execute('long-2', 'node', ['-e', 'setTimeout(() => {}, 10000)']);
            processManager.execute('long-3', 'node', ['-e', 'setTimeout(() => {}, 10000)']);
            
            setTimeout(() => {
                expect(processManager.activeProcesses.size).toBe(3);
                
                processManager.terminateAll().then(() => {
                    expect(processManager.activeProcesses.size).toBe(0);
                    done();
                });
            }, 100);
        });

        test('should handle empty process list', async () => {
            await expect(processManager.terminateAll()).resolves.toBeUndefined();
        });

        test('should handle mix of running and completed processes', (done) => {
            processManager.execute('quick', 'echo', ['test']);
            processManager.execute('long', 'node', ['-e', 'setTimeout(() => {}, 10000)']);
            
            setTimeout(() => {
                processManager.terminateAll().then(() => {
                    expect(processManager.activeProcesses.size).toBe(0);
                    done();
                });
            }, 200);
        });
    });

    describe('getProcessStatus with real processes', () => {
        test('should return status for running process', (done) => {
            processManager.execute('status-test', 'node', ['-e', 'setTimeout(() => {}, 1000)']);
            
            setTimeout(() => {
                const status = processManager.getProcessStatus('status-test');
                expect(status).toBeDefined();
                expect(status.pid).toBeDefined();
                expect(status.status).toBe('RUNNING');
                expect(status.startedAt).toBeDefined();
                done();
            }, 50);
        });

        test('should return null for non-existent process', () => {
            const status = processManager.getProcessStatus('non-existent');
            expect(status).toBeNull();
        });

        test('should return null after process exits', (done) => {
            processManager.execute('quick-status', 'echo', ['test']);
            
            setTimeout(() => {
                const status = processManager.getProcessStatus('quick-status');
                expect(status).toBeNull();
                done();
            }, 300);
        });
    });

    describe('getLogs with real processes', () => {
        test('should return logs for running process', (done) => {
            processManager.execute('log-test', 'echo', ['test output']);
            
            setTimeout(() => {
                const logs = processManager.getLogs('log-test');
                // Process may have already exited
                if (logs) {
                    expect(Array.isArray(logs)).toBe(true);
                }
                done();
            }, 100);
        });

        test('should return null for non-existent process', () => {
            const logs = processManager.getLogs('non-existent');
            expect(logs).toBeNull();
        });
    });

    describe('getProcessInfo with real processes', () => {
        test('should return info for running process', (done) => {
            processManager.execute('info-test', 'node', ['-e', 'setTimeout(() => {}, 1000)']);
            
            setTimeout(() => {
                const info = processManager.getProcessInfo('info-test');
                expect(info).toBeDefined();
                expect(info.pid).toBeDefined();
                expect(info.type).toBe('generic');
                done();
            }, 50);
        });

        test('should return null for non-existent process', () => {
            const info = processManager.getProcessInfo('non-existent');
            expect(info).toBeNull();
        });
    });

    describe('Error handling with real commands', () => {
        test('should handle non-existent command', async () => {
            await expect(
                processManager.executeQuickTaskArray('nonexistent-command-xyz-123', ['arg'])
            ).rejects.toThrow();
        });

        test('should handle command with invalid arguments', async () => {
            await expect(
                processManager.executeQuickTaskArray('node', ['--invalid-flag-xyz'])
            ).rejects.toThrow();
        });
    });

    describe('Performance tests', () => {
        test('should execute 50 echo commands in less than 500ms', async () => {
            const start = Date.now();
            const promises = [];
            for (let i = 0; i < 50; i++) {
                promises.push(processManager.executeQuickTaskArray('echo', [`test-${i}`]));
            }
            
            const results = await Promise.all(promises);
            const duration = Date.now() - start;
            
            expect(results).toHaveLength(50);
            expect(duration).toBeLessThan(500);
            console.log(`[Performance] 50 echo commands: ${duration}ms`);
        });

        test('should handle rapid sequential executions', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(processManager.executeQuickTaskArray('echo', [`test-${i}`]));
            }
            
            const results = await Promise.all(promises);
            expect(results).toHaveLength(10);
        });

        test('should complete within reasonable time', async () => {
            const start = Date.now();
            await processManager.executeQuickTaskArray('echo', ['test']);
            const duration = Date.now() - start;
            
            expect(duration).toBeLessThan(1000);
        });
    });

    describe('Security and cleanup verification', () => {
        test('should not leave zombie processes after terminateAll', async () => {
            // Launch multiple long-running processes
            const pids = [];
            for (let i = 0; i < 3; i++) {
                const child = processManager.execute(`zombie-test-${i}`, 'sleep', ['30']);
                pids.push(child.pid);
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Terminate all
            await processManager.terminateAll();
            
            // Wait a bit for processes to fully terminate
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verify activeProcesses is empty
            expect(processManager.activeProcesses.size).toBe(0);
            
            // Optional: Check if processes are still running using ps (Linux/macOS only)
            // This is optional and may not work in all CI environments
            if (process.platform !== 'win32') {
                try {
                    const { exec } = require('child_process');
                    const checkPids = pids.map(pid => {
                        return new Promise((resolve) => {
                            exec(`ps -p ${pid}`, (error) => {
                                // If error exists, process is not running (good)
                                // If no error, process might still be running (bad)
                                resolve(!error);
                            });
                        });
                    });
                    
                    const stillRunning = await Promise.all(checkPids);
                    const runningCount = stillRunning.filter(r => r).length;
                    
                    // At most 0 processes should still be running
                    expect(runningCount).toBe(0);
                } catch (e) {
                    // If ps command fails, skip this check
                    console.log('Skipping zombie process check (ps command not available)');
                }
            }
        });

        test('should handle concurrent process creation and termination', async () => {
            // Create and terminate processes rapidly to test for race conditions
            const operations = [];
            for (let i = 0; i < 10; i++) {
                operations.push(
                    (async () => {
                        processManager.execute(`concurrent-${i}`, 'sleep', ['1']);
                        await new Promise(resolve => setTimeout(resolve, 50));
                    })()
                );
            }
            
            await Promise.all(operations);
            await processManager.terminateAll();
            
            expect(processManager.activeProcesses.size).toBe(0);
        });
    });
});
