// src/main/infrastructure/media/CompletionHandler.js
'use strict';

const { moveDownloadedFile, sanitizeFileName } = require('./YtdlpUtils');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Class responsible for handling successful download completion and file transfers
 */
class CompletionHandler {
    constructor(pathService, logger = null, adbPushService = null) {
        this._pathService = pathService;
        this._logger = logger;
        this._adbPushService = adbPushService;
        this._transferOrchestrator = null;
    }

    /**
     * Set TransferOrchestrator for integration with transfer service
     * @param {Object} transferOrchestrator - TransferOrchestrator instance
     */
    setTransferOrchestrator(transferOrchestrator) {
        this._transferOrchestrator = transferOrchestrator;
        if (this._logger) {
            this._logger.info('[CompletionHandler] TransferOrchestrator set successfully');
        }
    }

    /**
     * Handle successful download completion
     */
    async handleDownloadSuccess(entry, processId, finalOutputPath, deviceIds, url, title, actualFilename = null) {
        if (!entry) return;

        // Download completion determined by successful process exit (exit 0)
        entry.percent = 100;
        if (entry.totalSize && entry.downloadedBytes < entry.totalSize) {
            entry.downloadedBytes = entry.totalSize;
        }
        entry.completedAt = new Date().toISOString();

        // Save downloadId for use in transfer
        const downloadId = processId;

        try {
            let tempFilePath;

            // Use actualFilename from ytDlpEvent first
            if (actualFilename) {
                // Check file existence with short retry
                let fileExists = false;
                for (let i = 0; i < 5; i++) {
                    try {
                        const fileStats = await fs.stat(actualFilename);
                        if (fileStats.isFile()) {
                            tempFilePath = actualFilename;
                            fileExists = true;
                            if (this._logger && typeof this._logger.info === 'function') {
                                this._logger.info(`Using actualFilename from ytDlpEvent: ${actualFilename}`);
                            }
                            break;
                        }
                    } catch (err) {
                        if (i < 4) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                }

                if (!fileExists) {
                    if (this._logger && typeof this._logger.warn === 'function') {
                        this._logger.warn(`actualFilename not found after retries, falling back to search: ${actualFilename}`);
                    }
                    tempFilePath = await this._findFileBySearch(finalOutputPath, title);
                }
            } else {
                // Use traditional search logic as fallback
                tempFilePath = await this._findFileBySearch(finalOutputPath, title);
            }

            if (!tempFilePath) {
                throw new Error(`No downloaded file found. yt-dlp exited with code 0 but failed to create the file.`);
            }

            // Move file to final downloads folder (dynamic, works on all systems)
            const downloadsDir = path.join(os.homedir(), 'Downloads');
            const { finalPath, tempPath } = await moveDownloadedFile(tempFilePath, title, deviceIds, downloadsDir);

            entry.status = 'completed';
            entry.outputPath = finalPath;

            // Automatic transfer to devices if selected
            let transferResult = null;
            if (this._logger) {
                this._logger.info(`[CompletionHandler] Checking automatic transfer - deviceIds: ${deviceIds}, adbPushService: ${!!this._adbPushService}, transferOrchestrator: ${!!this._transferOrchestrator}`);
            }
            
            // Use TransferOrchestrator if available (for multi-device transfer)
            if (deviceIds && deviceIds.length > 0 && this._transferOrchestrator) {
                try {
                    // Use TransferOrchestrator for multi-device transfer
                    transferResult = await this._transferOrchestrator.startDownloadTransfer(downloadId, deviceIds, finalPath);
                    
                    if (transferResult.success) {
                        if (this._logger) {
                            this._logger.info(`File transfer started successfully to devices ${deviceIds.join(', ')} via TransferOrchestrator`);
                        }
                    } else {
                        if (this._logger) {
                            this._logger.warn(`File transfer to devices ${deviceIds.join(', ')} failed via TransferOrchestrator: ${transferResult.message}`);
                        }
                    }
                } catch (err) {
                    if (this._logger) {
                        this._logger.error(`Error during automatic transfer to devices ${deviceIds.join(', ')} via TransferOrchestrator: ${err.message}`);
                    }
                    transferResult = { success: false, message: err.message };
                }
            }

            if (entry.resolve) {
                entry.resolve({
                    success: true,
                    outputPath: finalPath,
                    tempPath: tempPath,
                    processId,
                    transferResult
                });
            }
        } catch (err) {
            if (this._logger && typeof this._logger.error === 'function') {
                this._logger.error(`Failed to move file: ${err.message}`);
            }
            entry.status = 'failed';
            if (entry.reject) {
                entry.reject(new Error(`Download completed but file transfer failed: ${err.message}`));
            }
        }
    }

    /**
     * Find downloaded file using traditional search logic
     */
    async _findFileBySearch(finalOutputPath, title) {
        try {
            // Use correct path from PathService for temporary download files
            const searchPath = this._pathService ? this._pathService.getDownloadsTempDir() : finalOutputPath;
            
            // Check if path is directory (new case) or file (old case)
            const stats = await fs.stat(searchPath);
            
            if (stats.isDirectory()) {
                // Path is directory - search for final file using video title
                // yt-dlp names final file based on video title and deletes temp files automatically
                const files = await fs.readdir(searchPath);
                
                if (this._logger && typeof this._logger.info === 'function') {
                    this._logger.info(`Searching in directory: ${searchPath}, found ${files.length} items`);
                }
                
                // Check if any files exist
                if (files.length === 0) {
                    if (this._logger && typeof this._logger.error === 'function') {
                        this._logger.error(`Directory is empty: ${searchPath}`);
                    }
                    return null;
                }
                
                // Sanitize video title to match filename created by yt-dlp
                const sanitizedTitle = sanitizeFileName(title);
                
                // Create simplified version of title for flexible matching (fuzzy matching)
                // Remove all non-alphanumeric characters for comparison
                const fuzzyTitle = title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                
                // Search for file starting with sanitized title
                let finalFile = null;
                
                for (const file of files) {
                    const filePath = path.join(searchPath, file);
                    const fileStats = await fs.stat(filePath);
                    
                    if (fileStats.isFile()) {
                        // Check if filename starts with sanitized title
                        const fileNameWithoutExt = path.basename(file, path.extname(file));
                        // Normalize actual filename to replace spaces with underscores like sanitizeFileName
                        const normalizedFileName = fileNameWithoutExt.replace(/\s+/g, '_');
                        // Create simplified version of filename for flexible matching
                        const fuzzyFileName = fileNameWithoutExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                        
                        // Use partial matching to handle special characters and format differences
                        if (normalizedFileName === sanitizedTitle || 
                            normalizedFileName.includes(sanitizedTitle) ||
                            sanitizedTitle.includes(normalizedFileName) ||
                            fuzzyFileName === fuzzyTitle ||
                            fuzzyFileName.includes(fuzzyTitle) ||
                            fuzzyTitle.includes(fuzzyFileName)) {
                            finalFile = filePath;
                            break;
                        }
                    }
                }
                
                // إذا لم يتم العثور على الملف في المجلد المحدد، ابحث في المجلد الأب
                // yt-dlp قد يضع الملف المدموج في المجلد الأب عند الدمج
                if (!finalFile) {
                    const parentDir = path.dirname(searchPath);
                    try {
                        const parentFiles = await fs.readdir(parentDir);
                        if (this._logger && typeof this._logger.info === 'function') {
                            this._logger.info(`Searching in parent directory: ${parentDir}, found ${parentFiles.length} items`);
                        }
                        for (const file of parentFiles) {
                            const filePath = path.join(parentDir, file);
                            const fileStats = await fs.stat(filePath);
                            
                            if (fileStats.isFile()) {
                                const fileNameWithoutExt = path.basename(file, path.extname(file));
                                // Normalize actual filename to replace spaces with underscores like sanitizeFileName
                                const normalizedFileName = fileNameWithoutExt.replace(/\s+/g, '_');
                                // Create simplified version of filename for flexible matching
                                const fuzzyFileName = fileNameWithoutExt.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                // Use partial matching to handle special characters and format differences
                                if (normalizedFileName === sanitizedTitle || 
                                    normalizedFileName.includes(sanitizedTitle) ||
                                    sanitizedTitle.includes(normalizedFileName) ||
                                    fuzzyFileName === fuzzyTitle ||
                                    fuzzyFileName.includes(fuzzyTitle) ||
                                    fuzzyTitle.includes(fuzzyFileName)) {
                                    finalFile = filePath;
                                    break;
                                }
                            }
                        }
                    } catch (err) {
                        if (this._logger && typeof this._logger.error === 'function') {
                            this._logger.error(`Error searching in parent directory: ${err.message}`);
                        }
                    }
                }
                
                if (!finalFile) {
                    if (this._logger && typeof this._logger.error === 'function') {
                        this._logger.error(`No downloaded file found matching title: ${sanitizedTitle}`);
                    }
                    return null;
                }
                
                return finalFile;
            } else {
                // المسار هو ملف - استخدامه مباشرة (للتوافق مع الحالة القديمة)
                return finalOutputPath;
            }
        } catch (err) {
            if (this._logger && typeof this._logger.error === 'function') {
                this._logger.error(`Error in _findFileBySearch: ${err.message}`);
            }
            return null;
        }
    }
}

module.exports = CompletionHandler;
