// src/main/infrastructure/media/YtdlpUtils.js
'use strict';

const path = require('path');
const fs = require('fs').promises;
const os = require('os');

/**
 * Clean file name from invalid characters
 */
function sanitizeFileName(fileName) {
    if (!fileName) return 'download';
    // Remove or replace characters invalid for file names
    // Includes characters forbidden in Windows/Linux plus common special characters
    return fileName
        .replace(/[<>:"/\\|?*｜«»""''—–]/g, '_')  // Replace forbidden and special characters
        .replace(/\s+/g, '_')           // Replace spaces with underscore
        .substring(0, 200);             // Limit to 200 characters
}

/**
 * Format bytes to readable unit
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KiB', 'MiB', 'GiB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + sizes[i];
}

/**
 * Calculate total size for combined download
 */
function calculateTotalSize(formatId, formatsData) {
    if (!formatId.includes('+') || !formatsData || !formatsData.formats) {
        return { totalSize: null, hasSizeInfo: false };
    }
    
    const formatIds = formatId.split('+');
    let totalSize = 0;
    let hasValidSize = false;
    
    for (const fid of formatIds) {
        const format = formatsData.formats.find(f => f.formatId === fid);
        if (format && format.filesize) {
            totalSize += format.filesize;
            hasValidSize = true;
        }
    }
    
    // If we have only one size, multiply by 2 as estimate
    if (hasValidSize && formatIds.length === 2) {
        const sizes = formatIds.map(fid => {
            const format = formatsData.formats.find(f => f.formatId === fid);
            return format && format.filesize ? format.filesize : 0;
        }).filter(s => s > 0);
        
        if (sizes.length === 1) {
            totalSize = sizes[0] * 2;
        }
    }
    
    return { totalSize: hasValidSize ? totalSize : null, hasSizeInfo: hasValidSize };
}

/**
 * Adjust progress percentage for combined downloads (video+audio sequential via aria2c)
 *
 * aria2c reports each file separately, so we aggregate:
 *   completedBytes (finished files) + downloadedBytes for current file
 *
 * Signals for next file transition from actual output:
 *   1) yt-dlp line: [download] 100% of X.XXiB ...
 *   2) aria2c GID change between [#c817a5 ...] and [#99fd6f ...]
 *   3) Percentage decrease (fallback from yt-dlp-wrap-plus)
 */
function adjustProgressForCombinedDownload(currentPercent, currentSize, entry, progressData) {
    // If not combined download or size info unavailable, return value as-is
    if (!entry.hasSizeInfo || !entry.totalSize || !entry.formatId.includes('+')) {
        return { percent: currentPercent, size: currentSize };
    }

    if (entry.completedBytes == null) entry.completedBytes = 0;
    if (entry.lastFileDownloadedBytes == null) entry.lastFileDownloadedBytes = 0;
    if (entry.lastFileTotalBytes == null) entry.lastFileTotalBytes = 0;
    if (entry.currentFileIndex == null) entry.currentFileIndex = 0;

    const toDisplay = (downloaded) => ({
        percent: Math.round(Math.min((downloaded / entry.totalSize) * 100, 100) * 10) / 10,
        size: `${formatBytes(downloaded)}/${formatBytes(entry.totalSize)}`
    });

    // File completion from yt-dlp summary — add its size to completed files
    if (progressData.fileComplete && progressData.totalBytes > 0) {
        entry.completedBytes += progressData.totalBytes;
        entry.lastAriaGid = null;
        entry.lastFileDownloadedBytes = 0;
        entry.lastFileTotalBytes = 0;
        entry.currentFileIndex++;
        entry.downloadedBytes = entry.completedBytes;
        entry.lastPercent = 100;
        return toDisplay(entry.downloadedBytes);
    }

    // Check availability of byte data from yt-dlp-wrap-plus
    const hasByteProgress = progressData.downloadedBytes != null
        && progressData.totalBytes > 0;

    if (hasByteProgress) {
        const gid = progressData.gid || null;

        // New file via GID change (fallback if we missed 100% line)
        if (gid && entry.lastAriaGid && gid !== entry.lastAriaGid) {
            const finishedBytes = entry.lastFileTotalBytes || entry.lastFileDownloadedBytes || 0;
            entry.completedBytes += finishedBytes;
            entry.currentFileIndex++;
        }

        if (gid) entry.lastAriaGid = gid;
        entry.lastFileDownloadedBytes = progressData.downloadedBytes;
        entry.lastFileTotalBytes = progressData.totalBytes;
        entry.lastPercent = currentPercent;

        entry.downloadedBytes = entry.completedBytes + progressData.downloadedBytes;
        return toDisplay(entry.downloadedBytes);
    }

    // Fallback: Use percentages when byte data is unavailable
    // This happens with yt-dlp-wrap-plus when byte data is not provided
    if (entry.lastPercent && currentPercent < entry.lastPercent - 10) {
        // Transition from one file to another (large percentage drop)
        entry.currentFileIndex++;
        entry.completedBytes = Math.floor((entry.currentFileIndex / 2) * entry.totalSize);
    }
    entry.lastPercent = currentPercent;

    const fileCount = 2;
    const totalPercent = (entry.currentFileIndex * (100 / fileCount)) + (currentPercent / fileCount);
    entry.downloadedBytes = Math.floor((Math.min(totalPercent, 100) / 100) * entry.totalSize);

    return {
        percent: Math.round(Math.min(totalPercent, 100) * 10) / 10,
        size: `${formatBytes(entry.downloadedBytes)}/${formatBytes(entry.totalSize)}`
    };
}

/**
 * Create temporary directory for downloads
 */
async function createTempDirectory(pathService = null) {
    let tempDir;
    if (pathService && typeof pathService.getDownloadsTempDir === 'function') {
        tempDir = pathService.getDownloadsTempDir();
    } else {
        // Fallback to process.cwd() if pathService is not available
        tempDir = path.join(process.cwd(), 'temp', 'downloads');
    }
    try {
        await fs.mkdir(tempDir, { recursive: true });
        return tempDir;
    } catch (err) {
        throw new Error(`Failed to create temp directory: ${err.message}`);
    }
}

/**
 * Get progress template compatible with unified JSON format
 * Uses correct yt-dlp variables to extract actual size data
 */
function getProgressTemplate() {
    return JSON.stringify({
        progress: '%(progress._percent_str)s',
        speed: '%(speed)s',
        downloaded_bytes: '%(downloaded_bytes)s',
        total_bytes: '%(total_bytes)s',
        eta: '%(eta)s',
        elapsed: '%(elapsed)s'
    });
}

/**
 * Move downloaded file to downloads folder
 */
async function moveDownloadedFile(tempFilePath, title, deviceIds, downloadsDir = null) {
    // Use specified path or default path (~/Downloads)
    if (!downloadsDir) {
        downloadsDir = path.join(os.homedir(), 'Downloads');
    }
    
    try {
        await fs.mkdir(downloadsDir, { recursive: true });
        
        // Extract extension from downloaded file
        const fileExt = path.extname(tempFilePath);
        
        // Create new file name using title
        let newFileName = sanitizeFileName(title) || path.basename(tempFilePath);
        
        // Add extension if not present
        if (!newFileName.endsWith(fileExt)) {
            newFileName += fileExt;
        }
        
        const finalFilePath = path.join(downloadsDir, newFileName);
        
        await fs.copyFile(tempFilePath, finalFilePath);

        // Delete temp file after successful transfer
        await fs.unlink(tempFilePath);

        return {
            finalPath: finalFilePath,
            tempPath: tempFilePath
        };
    } catch (err) {
        throw new Error(`Failed to move file: ${err.message}`);
    }
}

module.exports = {
    sanitizeFileName,
    calculateTotalSize,
    adjustProgressForCombinedDownload,
    createTempDirectory,
    getProgressTemplate,
    moveDownloadedFile,
    formatBytes
};
