'use strict';

/**
 * Represents the runtime state of a device.
 *
 * This object contains only volatile runtime information.
 * It does not contain device metadata and does not perform
 * any business logic.
 */
class DeviceRuntimeState {
    constructor({
        status = 'offline',
        ip = null,
        port = null,
        connectionType = null,
        adbTarget = null,
        lastSeen = null
    } = {}) {
        this.status = status;
        this.ip = ip;
        this.port = port;
        this.connectionType = connectionType;
        this.adbTarget = adbTarget;
        this.lastSeen = lastSeen;
    }

    update(partialState = {}) {
        Object.assign(this, partialState);
    }

    toJSON() {
        return {
            status: this.status,
            ip: this.ip,
            port: this.port,
            connectionType: this.connectionType,
            adbTarget: this.adbTarget,
            lastSeen: this.lastSeen
        };
    }
}

module.exports = DeviceRuntimeState;