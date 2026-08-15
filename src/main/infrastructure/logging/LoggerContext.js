'use strict';

class LoggerContext {
    constructor(logger, source) {
        this._logger = logger;
        this._source = source;

        Object.freeze(this);
    }

    info(message, options = {}) {
        return this._logger.info(
            message,
            {
                ...options,
                source: this._source
            }
        );
    }

    warn(message, options = {}) {
        return this._logger.warn(
            message,
            {
                ...options,
                source: this._source
            }
        );
    }

    error(message, options = {}) {
        return this._logger.error(
            message,
            {
                ...options,
                source: this._source
            }
        );
    }

    fatal(message, options = {}) {
        return this._logger.fatal(
            message,
            {
                ...options,
                source: this._source
            }
        );
    }

    report(options = {}) {
        return this._logger.report({
            ...options,
            source: this._source
        });
    }
}

module.exports = LoggerContext;