// src/main/utils/pathSanitizer.js
'use strict';

const path = require('path');

/**
 * Sanitize a path to prevent directory traversal attacks.
 * Only allows paths within the application root directory.
 * 
 * @param {string} appRoot - The application root directory
 * @param {string} inputPath - The path to sanitize
 * @param {object} logger - Optional logger instance
 * @returns {string|null} Sanitized absolute path, or null if invalid
 */
function sanitizePath(appRoot, inputPath, logger = null) {
    if (!inputPath || typeof inputPath !== 'string') {
        return null;
    }

    const appRootResolved = path.resolve(appRoot);
    let resolvedPath;

    // If the path is relative, resolve it relative to appRoot
    if (!path.isAbsolute(inputPath)) {
        resolvedPath = path.resolve(appRootResolved, inputPath);
    } else {
        resolvedPath = path.resolve(inputPath);
    }

    const normalizedPath = path.normalize(resolvedPath);

    // Check if the normalized path is within appRoot directory
    const relativePath = path.relative(appRootResolved, normalizedPath);
    
    // If relative path starts with '..', it's outside appRoot
    if (relativePath.startsWith('..')) {
        const message = `Path "${inputPath}" is outside appRoot directory. Rejected for security.`;
        if (logger) {
            logger.warn(message);
        } else {
            console.warn(`[pathSanitizer] ${message}`);
        }
        return null;
    }

    return normalizedPath;
}

module.exports = { sanitizePath };
