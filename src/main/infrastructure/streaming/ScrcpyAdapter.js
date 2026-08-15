'use strict';

/**
 * ScrcpyAdapter
 * مسؤول فقط عن تشغيل وإيقاف انعكاس الشاشة عبر scrcpy
 * بدون أي منطق أعمال أو إدارة أجهزة
 * 
 * @param {string} adbTarget - معرّف ADB للجهاز (serial أو host:port)
 */
class ScrcpyAdapter {
    constructor({
        processSupervisor,
        scrcpyPath = null,
        toolPathResolver = null,
        logger = null
    }) {
        this._processSupervisor = processSupervisor;
        this._logger = logger;
        this._toolPathResolver = toolPathResolver;
        this._scrcpyPath = this._resolveScrcpyPath(scrcpyPath);
        this._activeProcesses = new Map(); // key: adbTarget, value: processId
    }

    /**
     * Validate and sanitize adbTarget input to prevent command injection
     * @param {string} input - The adbTarget to validate
     * @returns {string} The validated input
     * @throws {Error} If input contains dangerous characters
     */
    _sanitizeAdbTarget(input) {
        if (!input || typeof input !== 'string') {
            throw new Error('adbTarget must be a non-empty string');
        }

        // Allow alphanumeric, hyphens, underscores, dots, colons, and spaces
        // Reject characters commonly used in command injection: ;, &, |, `, $, (, ), <, >
        const dangerousPattern = /[;&|`$()<>]/;
        if (dangerousPattern.test(input)) {
            throw new Error(`Invalid adbTarget: contains dangerous characters`);
        }

        // Trim whitespace
        return input.trim();
    }

    _resolveScrcpyPath(explicitPath) {
        if (explicitPath) return explicitPath;
        if (this._toolPathResolver) return this._toolPathResolver.getScrcpyPath();
        const fallbackPath = 'scrcpy';
        if (this._logger) {
            this._logger.warn(`ScrcpyAdapter: No toolPathResolver provided, using fallback: ${fallbackPath}`);
        }
        return fallbackPath;
    }

    /**
     * بدء انعكاس الشاشة لجهاز معرّف بواسطة adbTarget
     * @param {string} adbTarget - معرّف ADB (serial مثل "emulator-5554" أو "192.168.1.10:5555")
     * @param {Object} options - { fullscreen, bitrate }
     * @returns {string} processId
     */
    startMirroring(adbTarget, options = {}) {
        const sanitizedTarget = this._sanitizeAdbTarget(adbTarget);

        // التحقق من وجود عملية بث نشطة لهذا الجهاز
        const existingProcessId = this._activeProcesses.get(sanitizedTarget);
        if (existingProcessId) {
            const processStatus = this._processSupervisor.getProcessStatus(existingProcessId);
            if (processStatus && processStatus.status === 'RUNNING') {
                throw new Error('Screen mirroring is already active for this device');
            } else {
                // العملية القديمة انتهت (أو فشلت) – نقوم بتنظيف المفتاح
                this._activeProcesses.delete(sanitizedTarget);
            }
        }

        const processId = `scrcpy:${sanitizedTarget}`;
        const args = [
            '-s', sanitizedTarget,
            ...(options.fullscreen ? ['--fullscreen'] : []),
            ...(options.bitrate ? ['--bit-rate', String(options.bitrate)] : [])
        ];

        const childProcess = this._processSupervisor.startManagedProcess({
            processId,
            binPath: this._scrcpyPath,
            args,
            type: 'scrcpy',
            metadata: { adbTarget: sanitizedTarget }
        });

        // تنظيف الخريطة عند انتهاء العملية (لأي سبب)
        if (childProcess && typeof childProcess.once === 'function') {
            childProcess.once('exit', () => {
                this._activeProcesses.delete(sanitizedTarget);
            });
            childProcess.once('error', () => {
                this._activeProcesses.delete(sanitizedTarget);
            });
        }

        this._activeProcesses.set(sanitizedTarget, processId);
        return processId;
    }

    /**
     * إيقاف انعكاس الشاشة لجهاز معرّف بواسطة adbTarget
     * @param {string} adbTarget - نفس المعرّف المستخدم في startMirroring
     * @returns {boolean} نجاح العملية
     */
    stopMirroring(adbTarget) {
        if (!adbTarget) return false;
        const sanitizedTarget = this._sanitizeAdbTarget(adbTarget);
        const processId = this._activeProcesses.get(sanitizedTarget);
        if (!processId) return false;

        this._processSupervisor.stopManagedProcess(processId);
        this._activeProcesses.delete(sanitizedTarget);
        return true;
    }
}

module.exports = ScrcpyAdapter;