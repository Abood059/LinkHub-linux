'use strict';

const ProcessManager =
    require('./ProcessManager');

const ProcessLogFormatter =
    require('./ProcessLogFormatter');

module.exports = Object.freeze({
    /**
     * Long Running Process
     */
    execute:
        ProcessManager.execute.bind(
            ProcessManager
        ),

    /**
     * Execute + Watch
     */
    executeAndWatch:
        ProcessManager.executeAndWatch.bind(
            ProcessManager
        ),

    /**
     * Execute with custom working directory (cwd)
     */
    executeWithCwd:
        ProcessManager.executeWithCwd.bind(
            ProcessManager
        ),

    /**
     * Quick Task
     */
    executeQuickTaskArray:
        ProcessManager.executeQuickTaskArray.bind(
            ProcessManager
        ),

    /**
     * Termination
     */
    terminate:
        ProcessManager.terminate.bind(
            ProcessManager
        ),

    terminateAll:
        ProcessManager.terminateAll.bind(
            ProcessManager
        ),

    /**
     * Read APIs
     */
    getLogs:
        ProcessManager.getLogs.bind(
            ProcessManager
        ),

    getProcessInfo:
        ProcessManager.getProcessInfo.bind(
            ProcessManager
        ),

    getProcessStatus:
        ProcessManager.getProcessStatus.bind(
            ProcessManager
        ),

    /**
     * Formatting
     */
    formatLogs:
        ProcessLogFormatter.format.bind(
            ProcessLogFormatter
        )
});