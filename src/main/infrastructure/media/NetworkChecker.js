// src/main/infrastructure/media/NetworkChecker.js
'use strict';

const https = require('https');
const http = require('http');

/**
 * NetworkChecker
 * مسؤول عن التحقق من الاتصال بالإنترنت
 */
class NetworkChecker {
    constructor(logger = null) {
        this._logger = logger;
    }

    /**
     * التحقق من الاتصال بالإنترنت
     * @param {number} timeout - مهلة التحقق بالميلي ثانية (الافتراضي 5000)
     * @returns {Promise<boolean>} true إذا كان هناك اتصال، false إذا لم يكن
     */
    async checkInternetConnection(timeout = 5000) {
        return new Promise((resolve) => {
            const options = {
                host: 'www.google.com',
                port: 443,
                path: '/',
                method: 'HEAD',
                timeout: timeout
            };

            const req = https.request(options, (res) => {
                resolve(true);
                req.destroy();
            });

            req.on('error', () => {
                // فشل HTTPS، جرب HTTP
                const httpOptions = {
                    host: 'www.google.com',
                    port: 80,
                    path: '/',
                    method: 'HEAD',
                    timeout: timeout
                };

                const httpReq = http.request(httpOptions, (res) => {
                    resolve(true);
                    httpReq.destroy();
                });

                httpReq.on('error', () => {
                    resolve(false);
                });

                httpReq.setTimeout(timeout, () => {
                    httpReq.destroy();
                    resolve(false);
                });

                httpReq.end();
            });

            req.setTimeout(timeout, () => {
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }
}

module.exports = NetworkChecker;
