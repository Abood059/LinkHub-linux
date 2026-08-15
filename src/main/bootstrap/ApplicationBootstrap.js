// src/main/bootstrap/ApplicationBootstrap.js
'use strict';

const path = require('path');
const { app } = require('electron');
const container = require('./container');
const WindowManager = require('../infrastructure/windows/WindowManager');
const WindowRegistry = require('../infrastructure/windows/WindowRegistry');
const IpcBootstrap = require('./IpcBootstrap');

class ApplicationBootstrap {
    constructor() {
        this._windowManager = null;
        this._windowRegistry = null;
    }

    async run() {
        console.log('[Bootstrap] Starting application...');

        // 1. Initialize dependency container
        try {
            container.initialize();
            console.log('[Bootstrap] Container initialized.');
        } catch (error) {
            console.error('[Bootstrap] Failed to initialize container:', error);
            throw error;
        }

        // 2. Initialize error central service (logger)
        const errorService = container.resolve('errorCentralService');
        if (errorService && typeof errorService.init === 'function') {
            errorService.init();
            console.log('[Bootstrap] ErrorCentralService initialized.');
        }

        // 2.5. Verify required tools (adb, scrcpy, yt-dlp, deno)
        const toolPathResolver = container.resolve('toolPathResolver');
        if (toolPathResolver && typeof toolPathResolver.verifyAll === 'function') {
            const toolsStatus = toolPathResolver.verifyAll();
            console.log('[Bootstrap] Tool verification results:', toolsStatus);

            if (!toolsStatus.adb) {
                if (errorService) {
                    errorService.warn('ADB binary not found. Please ensure resources/bin/win/adb.exe or LINKHUB_ADB_PATH is set.', {
                        source: 'ApplicationBootstrap'
                    });
                }
            }
            if (!toolsStatus.scrcpy) {
                if (errorService) {
                    errorService.warn('scrcpy binary not found. Please ensure resources/bin/win/scrcpy.exe or LINKHUB_SCRCPY_PATH is set.', {
                        source: 'ApplicationBootstrap'
                    });
                }
            }
            if (!toolsStatus.ytdlp) {
                if (errorService) {
                    errorService.warn('yt-dlp binary not found. Please ensure resources/bin/win/yt-dlp.exe or LINKHUB_YTDLP_PATH is set.', {
                        source: 'ApplicationBootstrap'
                    });
                }
            }
            if (!toolsStatus.deno) {
                if (errorService) {
                    errorService.warn('Deno binary not found. Please ensure resources/bin/linux/deno or LINKHUB_DENO_PATH is set. Downloads may fail without Deno.', {
                        source: 'ApplicationBootstrap'
                    });
                }
            }

            // Verify that deno works correctly
            if (toolsStatus.deno && typeof toolPathResolver.verifyDeno === 'function') {
                const denoCheck = await toolPathResolver.verifyDeno();
                if (denoCheck.valid) {
                    console.log('[Bootstrap] Deno verification successful:', denoCheck.version);
                    if (errorService) {
                        errorService.info(`Deno verified successfully: ${denoCheck.version}`, {
                            source: 'ApplicationBootstrap'
                        });
                    }
                } else {
                    console.error('[Bootstrap] Deno verification failed:', denoCheck.error);
                    if (errorService) {
                        errorService.error(`Deno verification failed: ${denoCheck.error}. Downloads may fail without working Deno.`, {
                            source: 'ApplicationBootstrap'
                        });
                    }
                }
            }
        }

        // 3. Initialize database (ensures directory and file exist)
        const dbManager = container.resolve('databaseManager');
        if (dbManager && typeof dbManager.initDb === 'function') {
            await dbManager.initDb();
            console.log('[Bootstrap] Database initialized.');
        }

        // 3.5. Set repositories in container after DB initialization
        container.setRepositories();
        console.log('[Bootstrap] Repositories set in container.');

        // 4. Initialize window management infrastructure
        this._windowRegistry = new WindowRegistry();
        this._windowManager = new WindowManager(this._windowRegistry);

        // 5. Pass windowManager to container for event broadcasting and StateSyncService initialization
        container.setWindowManager(this._windowManager);
        console.log('[Bootstrap] WindowManager set and StateSyncServices initialized.');

        // 6. Load data from database into memory (after sync services are initialized)
        const deviceRegistry = container.resolve('deviceRegistry');
        const ytdlpAdapter = container.resolve('ytdlpAdapter');

        if (deviceRegistry && dbManager) {
            await deviceRegistry.loadFromRepository(dbManager.devices);
        }

        if (ytdlpAdapter && dbManager) {
            await ytdlpAdapter._downloadManager.restoreMemoryFromDatabase(dbManager.downloads);

            // Initialize DownloadStateSyncService with restored downloads
            const downloadStateSyncService = container.resolve('downloadStateSyncService');
            if (downloadStateSyncService) {
                const activeDownloads = ytdlpAdapter._downloadManager.getActiveDownloads();
                downloadStateSyncService.initializeState(activeDownloads);
            }
        }

        // 7. Register IPC handlers
        try {
            IpcBootstrap.register(container);
            console.log('[Bootstrap] IPC handlers registered.');
        } catch (error) {
            // Error handled silently
        }

        // 8. Setup DeviceEventHandler and start monitoring (after StateSyncService is ready)
        const connectionService = container.resolve('connectionService');
        const deviceEventHandler = container.resolve('deviceEventHandler');
        if (deviceEventHandler && connectionService) {
            deviceEventHandler.setup(connectionService);
            console.log('[Bootstrap] DeviceEventHandler setup completed.');
        }

        // 9. Start ADB monitoring and wireless discovery (after StateSyncService is ready)
        if (connectionService) {
            if (typeof connectionService.startAdbMonitoring === 'function') {
                connectionService.startAdbMonitoring(500);
                console.log('[Bootstrap] ADB monitoring started.');
            }
            if (typeof connectionService.startWirelessDiscovery === 'function') {
                connectionService.startWirelessDiscovery();
                console.log('[Bootstrap] Wireless discovery started.');
            }
        }

        // 10. Create main window
        await this.createMainWindow();

        // 11. Setup shutdown handler for graceful shutdown
        this._setupShutdownHandler();

        console.log('[Bootstrap] Application ready.');
    }

    async createMainWindow() {
        const mainWindow = this._windowManager.createMainWindow({
            show: false
        });
        mainWindow.once('ready-to-show', () => {
            mainWindow.show();
            if (process.env.NODE_ENV === 'development') {
                mainWindow.webContents.openDevTools();
            }
        });
        return mainWindow;
    }

    getWindowManager() {
        return this._windowManager;
    }

    getWindowRegistry() {
        return this._windowRegistry;
    }

    /**
     * Setup shutdown handler
     * Ensures all data is flushed to database before closing
     */
    _setupShutdownHandler() {
        let isShuttingDown = false;

        app.on('before-quit', async (event) => {
            // Prevent multiple shutdown attempts
            if (isShuttingDown) {
                console.log('[Bootstrap] Shutdown already in progress, skipping...');
                return;
            }
            isShuttingDown = true;

            console.log('[Bootstrap] Application is shutting down...');

            // Prevent default quit behavior to handle cleanup
            event.preventDefault();

            try {
                // 1. Stop all active downloads
                const ytdlpAdapter = container.resolve('ytdlpAdapter');
                if (ytdlpAdapter) {
                    const downloadManager = ytdlpAdapter._downloadManager;
                    const activeDownloads = downloadManager.getActiveDownloads();
                    
                    console.log(`[Bootstrap] Stopping ${activeDownloads.size} active downloads...`);
                    for (const [processId] of activeDownloads.entries()) {
                        try {
                            ytdlpAdapter.stopDownload(processId);
                        } catch (error) {
                            console.error(`[Bootstrap] Failed to stop download ${processId}:`, error);
                        }
                    }
                }

                // 2. Stop download sync service timer to prevent new sync cycles
                const downloadSyncService = container.resolve('downloadSyncService');
                if (downloadSyncService) {
                    console.log('[Bootstrap] Stopping download sync service...');
                    downloadSyncService.stop();
                }

                // 2.5. Stop transfer state sync service
                const transferStateSyncService = container.resolve('transferStateSyncService');
                if (transferStateSyncService) {
                    console.log('[Bootstrap] Stopping transfer state sync service...');
                    transferStateSyncService.stop();
                }

                // 3. Flush download sync service to ensure all data is written
                if (downloadSyncService) {
                    console.log('[Bootstrap] Flushing download sync service...');
                    const flushSuccess = await downloadSyncService.flush();
                    if (flushSuccess) {
                        console.log('[Bootstrap] Download sync service flushed successfully');
                    } else {
                        console.error('[Bootstrap] Download sync service flush failed');
                    }
                }

                // 4. Close database
                const dbManager = container.resolve('databaseManager');
                if (dbManager && typeof dbManager.close === 'function') {
                    console.log('[Bootstrap] Closing database...');
                    await dbManager.close();
                    console.log('[Bootstrap] Database closed');
                }

                console.log('[Bootstrap] Shutdown complete, allowing app to quit');
            } catch (error) {
                console.error('[Bootstrap] Error during shutdown:', error);
            } finally {
                // Allow app to quit regardless of errors
                app.exit(0);
            }
        });
    }
}

module.exports = ApplicationBootstrap;