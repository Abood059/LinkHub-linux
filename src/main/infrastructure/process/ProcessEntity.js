'use strict';

const {
    PROCESS_STATUS
} = require('./process.constants');

class ProcessEntity {
    constructor(options = {}) {
        this.pid = options.pid ?? null;
        this.type = options.type ?? 'generic';
        this.serial = options.serial ?? null;

        this.status = PROCESS_STATUS.RUNNING;
        this.exitCode = null;

        this._logs = [];

        this.maxBufferSize =
            Number.isFinite(options.maxBufferSize) &&
            options.maxBufferSize > 0
                ? Math.floor(options.maxBufferSize)
                : 100;

        this._pendingStdout = '';
        this._pendingStderr = '';
    }

    addLog(text, streamType) {
        const pendingKey =
            streamType === 'stderr'
                ? '_pendingStderr'
                : '_pendingStdout';

        const chunk = String(text);

        const combined =
            this[pendingKey] + chunk;

        const endsWithNewLine =
            chunk.endsWith('\n');

        const lines =
            combined.split('\n');

        if (!endsWithNewLine) {
            this[pendingKey] =
                lines.pop() ?? '';
        } else {
            this[pendingKey] = '';

            if (
                lines.length > 0 &&
                lines[lines.length - 1] === ''
            ) {
                lines.pop();
            }
        }

        for (const line of lines) {
            this._pushLog(
                line,
                streamType
            );
        }
    }

    flushPendingLogs() {
        if (this._pendingStdout) {
            this._pushLog(
                this._pendingStdout,
                'stdout'
            );

            this._pendingStdout = '';
        }

        if (this._pendingStderr) {
            this._pushLog(
                this._pendingStderr,
                'stderr'
            );

            this._pendingStderr = '';
        }
    }

    markAsExited(code) {
        this.flushPendingLogs();

        this.status =
            PROCESS_STATUS.EXITED;

        this.exitCode = code;
    }

    markAsFailed(errorMessage = null) {
        this.flushPendingLogs();

        this.status =
            PROCESS_STATUS.FAILED;

        this.exitCode = -1;

        if (errorMessage) {
            this._pushLog(
                String(errorMessage),
                'stderr'
            );
        }
    }

    getLogs() {
        return [...this._logs];
    }

    _pushLog(text, streamType) {
        this._logs.push({
            text,
            type: streamType,
            timestamp: Date.now()
        });

        while (
            this._logs.length >
            this.maxBufferSize
        ) {
            this._logs.shift();
        }
    }
}

module.exports = ProcessEntity;