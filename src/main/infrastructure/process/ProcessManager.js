// src/main/infrastructure/process/ProcessManager.js
'use strict';

const { spawn } = require('child_process');
const ProcessEntity = require('./ProcessEntity');
const { PROCESS_TIMEOUTS, PROCESS_SIGNALS } = require('./process.constants');
const { errorCentralService } = require('../logging');

class ProcessManager {
    constructor() {
        this.activeProcesses = new Map(); // key: processId, value: { instance, data, type, startedAt, finishedAt }
    }

    /**
     * Execute a long-running process and track it.
     */
    execute(id, binPath, args = [], type = 'generic', onData = null, maxBufferSize = 100) {
        if (!id) throw new Error('Process id is required');
        if (this.activeProcesses.has(id)) this.terminate(id);

        let child;
        try {
            child = spawn(binPath, Array.isArray(args) ? args : []);
        } catch (error) {
            errorCentralService.report({
                type: 'PROCESS',
                severity: 'HIGH',
                message: `Failed to spawn process ${id}: ${error.message}`,
                source: 'ProcessManager'
            });
            throw error;
        }

        const entity = new ProcessEntity({ pid: child.pid, type, serial: id, maxBufferSize });
        const processRecord = {
            instance: child,
            data: entity,
            type,
            startedAt: Date.now(),
            finishedAt: null
        };
        this.activeProcesses.set(id, processRecord);

        const feed = (chunk, streamType) => {
            const text = chunk.toString();
            entity.addLog(text, streamType);
            if (typeof onData === 'function') {
                try {
                    onData(text, streamType);
                } catch (err) {
                    errorCentralService.report({
                        type: 'PROCESS',
                        severity: 'LOW',
                        message: `Consumer callback failed for ${id}: ${err.message}`,
                        source: 'ProcessManager'
                    });
                }
            }
        };

        child.stdout?.on('data', data => feed(data, 'stdout'));
        child.stderr?.on('data', data => feed(data, 'stderr'));

        // Cleanup on error
        child.once('error', error => {
            entity.markAsFailed(error.message);
            processRecord.instance = null;
            processRecord.finishedAt = Date.now();
            // Remove from map to prevent memory leak
            this.activeProcesses.delete(id);
            errorCentralService.report({
                type: 'PROCESS',
                severity: 'HIGH',
                message: `Process ${id} error: ${error.message}`,
                source: 'ProcessManager'
            });
        });

        // Cleanup on exit
        child.once('exit', code => {
            entity.markAsExited(code);
            processRecord.instance = null;
            processRecord.finishedAt = Date.now();
            // Remove from map to prevent memory leak
            this.activeProcesses.delete(id);
            errorCentralService.report({
                type: 'PROCESS',
                severity: 'INFO',
                message: `Process ${id} exited with code ${code}`,
                source: 'ProcessManager'
            });
        });

        return child;
    }

    /**
     * Execute a long-running process with custom working directory (cwd)
     */
    executeWithCwd(id, binPath, args = [], type = 'generic', onData = null, maxBufferSize = 100, cwd = null) {
        if (!id) throw new Error('Process id is required');
        if (this.activeProcesses.has(id)) this.terminate(id);

        let child;
        try {
            const spawnOptions = {};
            if (cwd) {
                spawnOptions.cwd = cwd;
            }
            child = spawn(binPath, Array.isArray(args) ? args : [], spawnOptions);
        } catch (error) {
            errorCentralService.report({
                type: 'PROCESS',
                severity: 'HIGH',
                message: `Failed to spawn process ${id}: ${error.message}`,
                source: 'ProcessManager'
            });
            throw error;
        }

        const entity = new ProcessEntity({ pid: child.pid, type, serial: id, maxBufferSize });
        const processRecord = {
            instance: child,
            data: entity,
            type,
            startedAt: Date.now(),
            finishedAt: null
        };
        this.activeProcesses.set(id, processRecord);

        const feed = (chunk, streamType) => {
            const text = chunk.toString();
            entity.addLog(text, streamType);
            if (typeof onData === 'function') {
                try {
                    onData(text, streamType);
                } catch (err) {
                    errorCentralService.report({
                        type: 'PROCESS',
                        severity: 'LOW',
                        message: `Consumer callback failed for ${id}: ${err.message}`,
                        source: 'ProcessManager'
                    });
                }
            }
        };

        child.stdout?.on('data', data => feed(data, 'stdout'));
        child.stderr?.on('data', data => feed(data, 'stderr'));

        // Cleanup on error
        child.once('error', error => {
            entity.markAsFailed(error.message);
            processRecord.instance = null;
            processRecord.finishedAt = Date.now();
            // Remove from map to prevent memory leak
            this.activeProcesses.delete(id);
            errorCentralService.report({
                type: 'PROCESS',
                severity: 'HIGH',
                message: `Process ${id} error: ${error.message}`,
                source: 'ProcessManager'
            });
        });

        // Cleanup on exit
        child.once('exit', code => {
            entity.markAsExited(code);
            processRecord.instance = null;
            processRecord.finishedAt = Date.now();
            // Remove from map to prevent memory leak
            this.activeProcesses.delete(id);
            errorCentralService.report({
                type: 'PROCESS',
                severity: 'INFO',
                message: `Process ${id} exited with code ${code}`,
                source: 'ProcessManager'
            });
        });

        return child;
    }

    /**
     * Execute a process and watch for a success sentinel in output.
     */
    executeAndWatch(id, binPath, args, successSentinel, timeoutMs = PROCESS_TIMEOUTS.WATCH_DEFAULT_TIMEOUT_MS) {
        return new Promise((resolve, reject) => {
            let child;
            let resolved = false;
            let output = '';

            try {
                child = spawn(binPath, Array.isArray(args) ? args : []);
            } catch (error) {
                reject(error);
                return;
            }

            const safeResolve = (result) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                resolve(result);
            };

            const timeout = setTimeout(() => {
                try {
                    child.kill(PROCESS_SIGNALS.GRACEFUL);
                } catch { }
                safeResolve({ success: false, output: output + '\n[Timeout]' });
            }, timeoutMs);

            const handleData = (chunk) => {
                const text = chunk.toString();
                if (output.length < PROCESS_TIMEOUTS.MAX_WATCH_OUTPUT_SIZE) {
                    output += text;
                    if (output.length > PROCESS_TIMEOUTS.MAX_WATCH_OUTPUT_SIZE)
                        output = output.substring(0, PROCESS_TIMEOUTS.MAX_WATCH_OUTPUT_SIZE);
                }
                if (text.includes(successSentinel)) {
                    try {
                        child.kill(PROCESS_SIGNALS.GRACEFUL);
                    } catch { }
                    safeResolve({ success: true, output });
                }
            };

            child.stdout?.on('data', handleData);
            child.stderr?.on('data', handleData);

            child.once('error', error => {
                if (resolved) return;
                clearTimeout(timeout);
                reject(error);
            });

            child.once('exit', code => {
                safeResolve({ success: code === 0, output });
            });
        });
    }

    /**
     * Execute a quick one-off task and return its stdout.
     */
    executeQuickTaskArray(binPath, args = [], options = {}) {
        return new Promise((resolve, reject) => {
            let child;
            try {
                child = spawn(binPath, Array.isArray(args) ? args : []);
            } catch (error) {
                reject(error);
                return;
            }

            let stdout = '';
            let stderr = '';

            const timeout = setTimeout(() => {
                try {
                    child.kill(PROCESS_SIGNALS.GRACEFUL);
                } catch { }
                reject(new Error(`Command timeout after ${options.timeout || PROCESS_TIMEOUTS.QUICK_TASK_TIMEOUT_MS}ms`));
            }, options.timeout || PROCESS_TIMEOUTS.QUICK_TASK_TIMEOUT_MS);

            child.stdout?.on('data', chunk => { stdout += chunk.toString(); });
            child.stderr?.on('data', chunk => { stderr += chunk.toString(); });

            child.once('error', error => {
                clearTimeout(timeout);
                reject(error);
            });

            child.once('exit', code => {
                clearTimeout(timeout);
                if (code === 0 || stdout) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(`Process exited with code ${code}: ${stderr}`));
                }
            });
        });
    }

    /**
     * Terminate a tracked process gracefully (SIGTERM), then force kill after timeout.
     * Does NOT immediately delete from map; removal happens on 'exit' event.
     */
    terminate(id) {
        const entry = this.activeProcesses.get(id);
        if (!entry || !entry.instance) return false;

        const child = entry.instance;
        entry.data?.markAsExited(-1);

        try {
            child.kill(PROCESS_SIGNALS.GRACEFUL);
        } catch (error) {
            errorCentralService.report({
                type: 'PROCESS',
                severity: 'LOW',
                message: `SIGTERM failed for ${id}: ${error.message}`,
                source: 'ProcessManager'
            });
            return false;
        }

        // Force kill after graceful timeout if still alive
        setTimeout(() => {
            if (child.exitCode === null) {
                try {
                    child.kill(PROCESS_SIGNALS.FORCE);
                } catch { }
            }
        }, PROCESS_TIMEOUTS.GRACEFUL_TERMINATION_MS);

        return true;
    }

    /**
     * Terminate all tracked processes and wait for them to finish.
     * Improved to actually wait for exit events before resolving.
     */
    async terminateAll() {
        const entries = Array.from(this.activeProcesses.entries());
        const terminationPromises = [];

        for (const [id, entry] of entries) {
            const promise = new Promise((resolve) => {
                if (!entry.instance) {
                    // Already dead, just remove and resolve
                    this.activeProcesses.delete(id);
                    return resolve();
                }

                const onExit = () => {
                    this.activeProcesses.delete(id);
                    resolve();
                };

                // Listen for exit/error events
                entry.instance.once('exit', onExit);
                entry.instance.once('error', onExit);

                // Send SIGTERM
                try {
                    entry.instance.kill(PROCESS_SIGNALS.GRACEFUL);
                } catch (err) {
                    onExit(); // force resolve if kill fails
                }

                // Force kill after timeout if still running
                setTimeout(() => {
                    if (entry.instance && !entry.instance.killed && entry.instance.exitCode === null) {
                        try {
                            entry.instance.kill(PROCESS_SIGNALS.FORCE);
                        } catch { }
                    }
                }, PROCESS_TIMEOUTS.GRACEFUL_TERMINATION_MS);
            });
            terminationPromises.push(promise);
        }

        // Wait for all processes to be cleaned up (with timeout safeguard)
        await Promise.all(terminationPromises);

        // Final cleanup: any remaining entries (should be none, but just in case)
        for (const [id, entry] of this.activeProcesses.entries()) {
            if (entry.instance && !entry.instance.killed) {
                try {
                    entry.instance.kill(PROCESS_SIGNALS.FORCE);
                } catch { }
            }
            this.activeProcesses.delete(id);
        }
    }

    getLogs(id) {
        return this.activeProcesses.get(id)?.data?.getLogs?.() ?? null;
    }

    getProcessInfo(id) {
        return this.activeProcesses.get(id)?.data ?? null;
    }

    getProcessStatus(id) {
        const entry = this.activeProcesses.get(id);
        if (!entry) return null;
        const entity = entry.data;
        return {
            pid: entity.pid,
            type: entity.type,
            serial: entity.serial,
            status: entity.status,
            exitCode: entity.exitCode,
            startedAt: entry.startedAt ?? null,
            finishedAt: entry.finishedAt ?? null
        };
    }
}

// Singleton export
module.exports = new ProcessManager();