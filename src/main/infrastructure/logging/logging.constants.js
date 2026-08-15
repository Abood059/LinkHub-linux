'use strict';

const LOG_LEVELS = Object.freeze({
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR'
});

const LOG_TYPES = Object.freeze({
    GENERAL: 'GENERAL',
    SYSTEM: 'SYSTEM',
    PROCESS: 'PROCESS',
    ADB: 'ADB',
    YT_DLP: 'YT_DLP',
    HTTP_DOWNLOAD: 'HTTP_DOWNLOAD'
});

const LOG_SOURCES = Object.freeze({
    SYSTEM: 'System',

    PROCESS_MANAGER: 'ProcessManager',
    PROCESS_SUPERVISOR: 'ProcessSupervisor',

    CONNECTION_SERVICE: 'ConnectionService',
    ADB_COMMAND_EXECUTOR: 'AdbCommandExecutor',

    DEVICE_REGISTRY: 'DeviceRegistry',
    DEVICE_ORCHESTRATOR: 'DeviceOrchestrator',

    DOWNLOAD_ORCHESTRATOR: 'DownloadOrchestrator',

    YTDLP_ADAPTER: 'YtdlpAdapter',
    SCRCPY_ADAPTER: 'ScrcpyAdapter',

    DATABASE_MANAGER: 'DatabaseManager'
});

const SEVERITY = Object.freeze({
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    CRITICAL: 'CRITICAL'
});

module.exports = Object.freeze({
    LOG_LEVELS,
    LOG_TYPES,
    LOG_SOURCES,
    SEVERITY
});