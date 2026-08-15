
class FileStatus {
    constructor({
        percentage = 0,
        speed = null,
        eta = null,
        downloadedBytes = 0,
        totalBytes = null,
        isPaused = false,
        state = 'pending'
    } = {}) {
        this._percentage = this._clampPercentage(percentage);
        this._speed = speed;
        this._eta = eta;
        this._downloadedBytes = Math.max(0, downloadedBytes);
        this._totalBytes = totalBytes !== null ? Math.max(0, totalBytes) : null;
        this._isPaused = isPaused;
        this._state = this._validateState(state);
    }

    // ---- Getters ----
    get percentage() { return this._percentage; }
    get speed() { return this._speed; }
    get eta() { return this._eta; }
    get downloadedBytes() { return this._downloadedBytes; }
    get totalBytes() { return this._totalBytes; }
    get isPaused() { return this._isPaused; }
    get state() { return this._state; }

    // ---- Private helpers ----
    _clampPercentage(value) {
        if (value < 0) return 0;
        if (value > 100) return 100;
        return value;
    }

    _validateState(state) {
        const allowed = ['pending', 'downloading', 'completed', 'failed', 'paused', 'cancelled'];
        return allowed.includes(state) ? state : 'pending';
    }

    // ---- Public methods ----
    update(data) {
        if (!data || typeof data !== 'object') return;

        // percentage
        if (data.percentage !== undefined) {
            this._percentage = this._clampPercentage(data.percentage);
        }

        // speed
        if (data.speed !== undefined) {
            this._speed = data.speed;
        }

        // eta
        if (data.eta !== undefined) {
            this._eta = data.eta;
        }

        // totalBytes
        if (data.totalBytes !== undefined && data.totalBytes !== null) {
            this._totalBytes = Math.max(0, data.totalBytes);
        }

        // downloadedBytes
        if (data.downloadedBytes !== undefined) {
            let newDownloaded = Math.max(0, data.downloadedBytes);
            if (this._totalBytes !== null && newDownloaded > this._totalBytes) {
                // silently clamp to totalBytes – no error reporting here (domain purity)
                newDownloaded = this._totalBytes;
            }
            this._downloadedBytes = newDownloaded;
        }

        // isPaused
        if (data.isPaused !== undefined) {
            this._isPaused = !!data.isPaused;
        }

        // state
        if (data.state !== undefined) {
            this._state = this._validateState(data.state);
        }
    }

    toJSON() {
        return {
            percentage: this._percentage,
            speed: this._speed,
            eta: this._eta,
            downloadedBytes: this._downloadedBytes,
            totalBytes: this._totalBytes,
            isPaused: this._isPaused,
            state: this._state
        };
    }
}

module.exports = FileStatus;
