// src/main/infrastructure/ipc/FilePickerHandler.js
'use strict';

const { dialog } = require('electron');

/**
 * FilePickerHandler
 * 
 * Thin IPC layer for file picker operations.
 * Responsibilities ONLY:
 * - Register IPC channels with Electron's ipcMain
 * - Open file/directory pickers
 * - Return selected paths
 * 
 * NO business logic, NO runtime state, NO process execution.
 */
class FilePickerHandler {
    constructor() {
        // No dependencies needed
    }

    /**
     * Register all file picker IPC channels
     */
    register(ipcMain) {
        if (!ipcMain || typeof ipcMain.handle !== 'function') {
            throw new Error('Valid ipcMain instance required');
        }

        // فتح File Picker لاختيار ملفات
        ipcMain.handle('file:pick', async (event, options = {}) => {
            const defaultOptions = {
                properties: ['openFile'],
                filters: []
            };

            const pickerOptions = { ...defaultOptions, ...options };

            try {
                const result = await dialog.showOpenDialog(pickerOptions);
                return result;
            } catch (error) {
                return {
                    canceled: true,
                    filePaths: [],
                    error: error.message
                };
            }
        });

        // فتح File Picker لاختيار مجلد
        ipcMain.handle('file:pickDirectory', async (event, options = {}) => {
            const defaultOptions = {
                properties: ['openDirectory']
            };

            const pickerOptions = { ...defaultOptions, ...options };

            try {
                const result = await dialog.showOpenDialog(pickerOptions);
                return result;
            } catch (error) {
                return {
                    canceled: true,
                    filePaths: [],
                    error: error.message
                };
            }
        });

        // فتح File Picker لاختيار ملفات متعددة
        ipcMain.handle('file:pickMultiple', async (event, options = {}) => {
            const defaultOptions = {
                properties: ['openFile', 'multiSelections'],
                filters: []
            };

            const pickerOptions = { ...defaultOptions, ...options };

            try {
                const result = await dialog.showOpenDialog(pickerOptions);
                return result;
            } catch (error) {
                return {
                    canceled: true,
                    filePaths: [],
                    error: error.message
                };
            }
        });

        // فتح Save Dialog لحفظ ملف
        ipcMain.handle('file:save', async (event, options = {}) => {
            const defaultOptions = {
                properties: ['saveFile'],
                filters: []
            };

            const pickerOptions = { ...defaultOptions, ...options };

            try {
                const result = await dialog.showSaveDialog(pickerOptions);
                return result;
            } catch (error) {
                return {
                    canceled: true,
                    filePath: null,
                    error: error.message
                };
            }
        });
    }
}

module.exports = FilePickerHandler;
