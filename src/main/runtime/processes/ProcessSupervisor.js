'use strict';

class ProcessSupervisor {
    constructor({
        processManager,
        processRegistry,
        logger = null
    }) {
        this._processManager =
            processManager;

        this._processRegistry =
            processRegistry;

        this._logger =
            logger;
    }

    startManagedProcess(
        processConfig = {}
    ) {
        const {
            processId,
            binPath,
            args = [],
            type = 'generic',
            metadata = {},
            onData = null,
            maxBufferSize = 100,
            cwd = null
        } = processConfig;

        if (!processId) {
            throw new Error(
                'processId is required'
            );
        }

        if (!binPath) {
            throw new Error(
                'binPath is required'
            );
        }

        this._processRegistry.register(
            processId,
            {
                id: processId,
                type,
                metadata,
                status: 'STARTING',
                startedAt:
                    Date.now()
            }
        );

        try {
            const result = cwd
                ? this._processManager.executeWithCwd(
                    processId,
                    binPath,
                    args,
                    type,
                    onData,
                    maxBufferSize,
                    cwd
                )
                : this._processManager.execute(
                    processId,
                    binPath,
                    args,
                    type,
                    onData,
                    maxBufferSize
                );

            this._processRegistry
                .updateStatus(
                    processId,
                    'RUNNING'
                );

            return result;
        } catch (error) {
            this._processRegistry
                .updateStatus(
                    processId,
                    'FAILED'
                );

            throw error;
        }
    }

    /**
     * Check if a live process exists in registry
     * @param {string} processId - Process identifier
     * @returns {boolean} true if process exists in registry, false if not
     */
    hasProcess(
        processId
    ) {
        const process =
            this._processRegistry.get(
                processId
            );

        return !!process;
    }

    stopManagedProcess(
        processId
    ) {
        const process =
            this._processRegistry.get(
                processId
            );

        if (!process) {
            return false;
        }

        // Handle external processes registered via registerExternalProcess
        if (process._controller) {
            process._controller.abort();
        }

        if (process._process) {
            try {
                process._process.kill('SIGTERM');
                
                // Force kill after timeout if still alive
                setTimeout(() => {
                    if (process._process.exitCode === null) {
                        try {
                            process._process.kill('SIGKILL');
                        } catch { }
                    }
                }, 5000); // 5 seconds graceful timeout
            } catch (error) {
                if (this._logger) {
                    this._logger.error(`Failed to stop external process ${processId}: ${error.message}`);
                }
                return false;
            }
        } else {
            // For regular processes, use ProcessManager
            return this._processManager.terminate(processId);
        }

        // Update status in registry
        this._processRegistry.updateStatus(processId, 'STOPPED');
        
        return true;
    }

    /**
     * Register external process in registry (for processes managed by external libraries)
     * @param {string} processId - Process identifier
     * @param {ChildProcess} process - Process object
     * @param {AbortController} controller - For cancellation control
     * @param {Object} metadata - Descriptive data
     */
    registerExternalProcess(processId, process, controller, metadata) {
        if (!processId) {
            throw new Error('processId is required');
        }

        this._processRegistry.register(processId, {
            id: processId,
            type: 'external',
            metadata,
            status: 'RUNNING',
            startedAt: Date.now(),
            _process: process,
            _controller: controller
        });

        // Link exit event to update status in registry
        process.once('exit', (code) => {
            this._processRegistry.updateStatus(
                processId,
                code === 0 ? 'EXITED' : 'FAILED'
            );
        });

        process.once('error', () => {
            this._processRegistry.updateStatus(processId, 'FAILED');
        });
    }

    getProcessStatus(
        processId
    ) {
        const runtimeState =
            this._processRegistry.get(
                processId
            );

        if (!runtimeState) {
            return null;
        }

        const processStatus =
            this._processManager
                .getProcessStatus(
                    processId
                );

        return {
            ...runtimeState,

            status:
                processStatus?.status ??
                runtimeState.status,

            process:
                processStatus
        };
    }

    async executeQuickTaskArray(
        binPath,
        args = [],
        options = {}
    ) {
        if (!binPath) {
            throw new Error(
                'binPath is required'
            );
        }

        return this._processManager
            .executeQuickTaskArray(
                binPath,
                args,
                options
            );
    }

    async executeAndWatch(
        processConfig = {},
        successSentinel,
        timeoutMs
    ) {
        const {
            processId,
            binPath,
            args = [],
            type = 'watch',
            metadata = {}
        } = processConfig;

        if (!processId) {
            throw new Error(
                'processId is required'
            );
        }

        if (!binPath) {
            throw new Error(
                'binPath is required'
            );
        }

        this._processRegistry.register(
            processId,
            {
                id: processId,
                type,
                metadata,
                status: 'RUNNING',
                startedAt:
                    Date.now()
            }
        );

        try {
            const result =
                await this._processManager
                    .executeAndWatch(
                        processId,
                        binPath,
                        args,
                        successSentinel,
                        timeoutMs
                    );

            this._processRegistry
                .updateStatus(
                    processId,
                    result.success
                        ? 'EXITED'
                        : 'FAILED'
                    );

            return result;
        } catch (error) {
            this._processRegistry
                .updateStatus(
                    processId,
                    'FAILED'
                );

            throw error;
        }
    }
}

module.exports =
    ProcessSupervisor;