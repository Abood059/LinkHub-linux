'use strict';

const path = require('path');
const log = require('electron-log/main');

const LoggerContext = require('./LoggerContext');

const {
    LOG_LEVELS,
    LOG_TYPES,
    SEVERITY
} = require('./logging.constants');

class ErrorCentralService {
    constructor() {
        this._initialized = false;
        this._globalHandlersRegistered = false;
        this._pathService = null;
    }

    init(options = {}) {
        try {
            if (this._initialized) {
                return;
            }

            this._pathService = options.pathService || null;

            const {
                logFilePath = this._pathService ? this._pathService.getLogPath() : path.join(
                    process.cwd(),
                    'logs',
                    'application.log'
                ),
                maxSize = 5 * 1024 * 1024
            } = options;

            log.initialize();

            log.transports.file.level = 'info';
            log.transports.file.maxSize = maxSize;

            log.transports.file.resolvePathFn = () =>
                logFilePath;

            this._registerGlobalHandlers();

            this._initialized = true;
        } catch (error) {
            this._safeConsoleError(
                'Failed to initialize logger',
                error
            );
        }
    }

    createLogger(source) {
        return new LoggerContext(
            this,
            source
        );
    }

    info(message, options = {}) {
        return this.report({
            ...options,
            message,
            severity:
                options.severity ||
                SEVERITY.LOW
        });
    }

    warn(message, options = {}) {
        return this.report({
            ...options,
            message,
            severity:
                options.severity ||
                SEVERITY.MEDIUM
        });
    }

    error(message, options = {}) {
        return this.report({
            ...options,
            message,
            severity:
                options.severity ||
                SEVERITY.HIGH
        });
    }

    fatal(message, options = {}) {
        return this.report({
            ...options,
            message,
            severity:
                SEVERITY.CRITICAL
        });
    }

    report(options = {}) {
        try {
            const {
                message = '',
                type = LOG_TYPES.GENERAL,
                severity = SEVERITY.LOW,
                source = 'UNKNOWN',
                metadata = null,
                error = null
            } = options;

            this._writeLog({
                message,
                type,
                severity,
                source,
                metadata,
                error
            });
        } catch (err) {
            this._safeConsoleError(
                'Log processing failed',
                err
            );
        }
    }

    _writeLog(entry) {
        try {
            const level =
                this._resolveLevel(
                    entry.severity
                );

            const timestamp =
                new Date().toISOString();

            const metadata =
                this._normalizeMetadata(
                    entry.metadata
                );

            const errorStack =
                this._extractErrorStack(
                    entry.error
                );

            const logLine = [
                `[${timestamp}]`,
                `[${level}]`,
                `[${entry.type}]`,
                `[${entry.severity}]`,
                `[${entry.source}]`,
                entry.message,
                metadata,
                errorStack
            ].join(' | ');

            switch (level) {
                case LOG_LEVELS.ERROR:
                    log.error(logLine);
                    break;

                case LOG_LEVELS.WARN:
                    log.warn(logLine);
                    break;

                default:
                    log.info(logLine);
                    break;
            }
        } catch (error) {
            this._safeConsoleError(
                'Log write failed',
                error
            );
        }
    }

    _resolveLevel(severity) {
        switch (severity) {
            case SEVERITY.CRITICAL:
            case SEVERITY.HIGH:
                return LOG_LEVELS.ERROR;

            case SEVERITY.MEDIUM:
                return LOG_LEVELS.WARN;

            default:
                return LOG_LEVELS.INFO;
        }
    }

    _normalizeMetadata(metadata) {
        try {
            if (
                metadata === undefined ||
                metadata === null
            ) {
                return '';
            }

            if (
                typeof metadata !== 'object'
            ) {
                return String(metadata);
            }

            return this._safeStringify(
                metadata
            );
        } catch {
            return '[Metadata Parse Failed]';
        }
    }

    _extractErrorStack(error) {
        try {
            if (!(error instanceof Error)) {
                return '';
            }

            const cause =
                error.cause instanceof Error
                    ? `\nCAUSE:\n${error.cause.stack}`
                    : '';

            return `${error.stack}${cause}`;
        } catch {
            return '';
        }
    }

    _safeStringify(value) {
        try {
            const visited =
                new WeakSet();

            return JSON.stringify(
                value,
                (key, currentValue) => {
                    if (
                        currentValue &&
                        typeof currentValue ===
                            'object'
                    ) {
                        if (
                            visited.has(
                                currentValue
                            )
                        ) {
                            return '[Circular Reference]';
                        }

                        visited.add(
                            currentValue
                        );
                    }

                    return currentValue;
                }
            );
        } catch {
            return '[Serialization Failed]';
        }
    }

    _registerGlobalHandlers() {
        if (
            this
                ._globalHandlersRegistered
        ) {
            return;
        }

        process.on(
            'uncaughtException',
            (error) => {
                try {
                    this.fatal(
                        'Uncaught Exception',
                        {
                            type:
                                LOG_TYPES.SYSTEM,
                            source:
                                'process',
                            error
                        }
                    );
                } catch (err) {
                    this._safeConsoleError(
                        'uncaughtException handler failed',
                        err
                    );
                }
            }
        );

        process.on(
            'unhandledRejection',
            (reason) => {
                try {
                    const error =
                        reason instanceof
                        Error
                            ? reason
                            : new Error(
                                  String(
                                      reason
                                  )
                              );

                    this.fatal(
                        'Unhandled Promise Rejection',
                        {
                            type:
                                LOG_TYPES.SYSTEM,
                            source:
                                'process',
                            error
                        }
                    );
                } catch (err) {
                    this._safeConsoleError(
                        'unhandledRejection handler failed',
                        err
                    );
                }
            }
        );

        this
            ._globalHandlersRegistered = true;
    }

    _safeConsoleError(
        message,
        error
    ) {
        try {
            console.error(
                '[ErrorCentralService]',
                message,
                error?.stack || error
            );
        } catch (_) {}
    }
}

module.exports =
    ErrorCentralService;