'use strict';

class ProcessRegistry {
    constructor() {
        this._processes = new Map();
    }

    register(processId, processData) {
        this._processes.set(
            processId,
            Object.freeze({
                ...processData
            })
        );
    }

    unregister(processId) {
        return this._processes.delete(processId);
    }

    get(processId) {
        return this._processes.get(processId) || null;
    }

    updateStatus(processId, status) {
        const existing =
            this._processes.get(processId);

        if (!existing) {
            return false;
        }

        this._processes.set(
            processId,
            Object.freeze({
                ...existing,
                status
            })
        );

        return true;
    }
}

module.exports = ProcessRegistry;