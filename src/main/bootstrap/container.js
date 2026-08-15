// src/main/bootstrap/container.js
'use strict';

// Import instance instead of class
const { errorCentralService } = require('../infrastructure/logging');

const ProcessManager = require('../infrastructure/process');
const DatabaseManager = require('../infrastructure/persistence/DatabaseManager');
const AdbCommandExecutor = require('../infrastructure/adb/AdbCommandExecutor');
const ConnectionService = require('../infrastructure/adb/ConnectionService');
const ProcessRegistry = require('../runtime/processes/ProcessRegistry');
const ProcessSupervisor = require('../runtime/processes/ProcessSupervisor');
const DeviceRegistry = require('../runtime/devices/DeviceRegistry');
const ScrcpyAdapter = require('../infrastructure/streaming/ScrcpyAdapter');
const YtdlpAdapter = require('../infrastructure/media/YtdlpAdapter');
const DeviceStateSyncService = require('../infrastructure/sync/DeviceStateSyncService');
const DownloadStateSyncService = require('../infrastructure/sync/DownloadStateSyncService');
const DownloadSyncService = require('../infrastructure/sync/DownloadSyncService');
const DeviceOrchestrator = require('../application/orchestrators/DeviceOrchestrator');
const DownloadOrchestrator = require('../application/orchestrators/DownloadOrchestrator');
const TransferOrchestrator = require('../application/orchestrators/TransferOrchestrator');
const AdbPushService = require('../infrastructure/transfer/AdbPushService');
const ToolPathResolver = require('../infrastructure/tools/ToolPathResolver');
const PathService = require('../infrastructure/path/PathService');
const DeviceEventHandler = require('../application/handlers/DeviceEventHandler');

// Transfer service components
const FileTransferExecutor = require('../infrastructure/transfer/FileTransferExecutor');
const TransferProgressTracker = require('../infrastructure/transfer/TransferProgressTracker');
const FileDeleter = require('../infrastructure/transfer/FileDeleter');
const SpaceChecker = require('../infrastructure/transfer/SpaceChecker');
const TransferStateManager = require('../infrastructure/transfer/TransferStateManager');
const TransferStateSyncService = require('../infrastructure/sync/TransferStateSyncService');

class BootstrapContainer {
    constructor() {
        this._services = new Map();
        this._initialized = false;
        this._windowManager = null;
        this._stateSyncService = null;
    }

    initialize() {
        if (this._initialized) {
            return this;
        }

        // Initialize PathService first
        const pathService = new PathService({
            logger: errorCentralService
        });

        // Initialize logger first (very important)
        errorCentralService.init({
            pathService: pathService
        });

        const processRegistry = new ProcessRegistry();
        const processSupervisor = new ProcessSupervisor({
            processManager: ProcessManager,
            processRegistry,
            logger: errorCentralService
        });

        const databaseManager = new DatabaseManager({
            pathService: pathService
        });

        const toolPathResolver = new ToolPathResolver({
            logger: errorCentralService,
            appRoot: pathService.getAppRoot()
        });

        const adbCommandExecutor = new AdbCommandExecutor({
            processSupervisor,
            logger: errorCentralService,
            toolPathResolver: toolPathResolver
        });

        const connectionService = new ConnectionService({
            adbExecutor: adbCommandExecutor,
            logger: errorCentralService
        });

        const deviceRegistry = new DeviceRegistry({ 
            deviceRepository: null, // Will be set after DB init
            connectionService: connectionService // Set connectionService now
        });

        // ==================== Initialize DeviceEventHandler ====================
        const deviceEventHandler = new DeviceEventHandler({
            deviceRegistry,
            stateSyncService: null, // Will be set later in setWindowManager
            connectionService: connectionService,
            logger: errorCentralService
        });

        // ==================== Initialize adapters and orchestrators ====================
        const scrcpyAdapter = new ScrcpyAdapter({
            processSupervisor,
            logger: errorCentralService,
            toolPathResolver: toolPathResolver
        });

        // ==================== Initialize transfer service ====================
        const fileTransferExecutor = new FileTransferExecutor({
            adbExecutor: adbCommandExecutor,
            logger: errorCentralService
        });

        const transferProgressTracker = new TransferProgressTracker({
            adbExecutor: adbCommandExecutor,
            logger: errorCentralService
        });

        const fileDeleter = new FileDeleter({
            adbExecutor: adbCommandExecutor,
            logger: errorCentralService
        });

        const spaceChecker = new SpaceChecker({
            adbExecutor: adbCommandExecutor,
            logger: errorCentralService
        });

        const transferStateManager = new TransferStateManager({
            logger: errorCentralService
        });

        const adbPushService = new AdbPushService({
            fileTransferExecutor,
            progressTracker: transferProgressTracker,
            fileDeleter,
            logger: errorCentralService
        });
        this._services.set('adbPushService', adbPushService);

        // ==================== Initialize TransferOrchestrator ====================
        const transferOrchestrator = new TransferOrchestrator({
            transferStateManager,
            adbPushService,
            spaceChecker,
            deviceRegistry,
            logger: errorCentralService,
            windowManager: null // Will be set later in setWindowManager
        });
        this._services.set('transferOrchestrator', transferOrchestrator);

        const ytdlpAdapter = new YtdlpAdapter({
            processSupervisor,
            logger: errorCentralService,
            toolPathResolver: toolPathResolver,
            pathService: pathService,
            adbPushService: adbPushService
        });

        const deviceOrchestrator = new DeviceOrchestrator({
            deviceRegistry,
            connectionService,
            scrcpyAdapter,
            deviceRepository: null, // Will be set after DB init
            logger: errorCentralService
        });

        const downloadOrchestrator = new DownloadOrchestrator({
            ytdlpAdapter,
            downloadManager: ytdlpAdapter._downloadManager,
            deviceRegistry,
            adbPushService,
            downloadRepository: null, // Will be set after DB init
            logger: errorCentralService
        });


        // ==================== Register services ====================
        this._services.set('errorCentralService', errorCentralService);
        this._services.set('pathService', pathService);
        this._services.set('processManager', ProcessManager);
        this._services.set('processRegistry', processRegistry);
        this._services.set('processSupervisor', processSupervisor);
        this._services.set('deviceRegistry', deviceRegistry);
        this._services.set('databaseManager', databaseManager);
        this._services.set('adbCommandExecutor', adbCommandExecutor);
        this._services.set('connectionService', connectionService);
        this._services.set('scrcpyAdapter', scrcpyAdapter);
        this._services.set('ytdlpAdapter', ytdlpAdapter);
        this._services.set('deviceOrchestrator', deviceOrchestrator);
        this._services.set('downloadOrchestrator', downloadOrchestrator);
        this._services.set('transferOrchestrator', transferOrchestrator);
        this._services.set('adbPushService', adbPushService);
        this._services.set('toolPathResolver', toolPathResolver);
        this._services.set('deviceEventHandler', deviceEventHandler);
        this._services.set('fileTransferExecutor', fileTransferExecutor);
        this._services.set('transferProgressTracker', transferProgressTracker);
        this._services.set('fileDeleter', fileDeleter);
        this._services.set('spaceChecker', spaceChecker);
        this._services.set('transferStateManager', transferStateManager);

        this._initialized = true;
        return this;
    }

    resolve(name) {
        return this._services.get(name) || null;
    }

    setWindowManager(windowManager) {
        this._windowManager = windowManager;

        // Create separate services
        const deviceRegistry = this._services.get('deviceRegistry');

        // DeviceStateSyncService - update on changes only
        this._deviceStateSyncService = new DeviceStateSyncService(windowManager, deviceRegistry, { interval: 1000 });
        this._deviceStateSyncService.start();

        // DownloadStateSyncService - update every 0.3 seconds from memory
        const ytdlpAdapter = this._services.get('ytdlpAdapter');
        const downloadManager = ytdlpAdapter ? ytdlpAdapter._downloadManager : null;
        this._downloadStateSyncService = new DownloadStateSyncService(windowManager, downloadManager, { interval: 300 });
        this._downloadStateSyncService.start();

        // TransferStateSyncService - update every 0.3 seconds from memory
        const transferStateManager = this._services.get('transferStateManager');
        this._transferStateSyncService = new TransferStateSyncService(windowManager, transferStateManager, { interval: 300 });
        this._transferStateSyncService.start();

        // Pass DeviceStateSyncService to DeviceEventHandler
        const deviceEventHandler = this._services.get('deviceEventHandler');
        if (deviceEventHandler) {
            deviceEventHandler.setStateSyncService(this._deviceStateSyncService);
        }

        // Pass WindowManager to YtdlpAdapter
        if (ytdlpAdapter) {
            ytdlpAdapter.setWindowManager(windowManager);
        }

        // Pass WindowManager to TransferOrchestrator
        const transferOrchestrator = this._services.get('transferOrchestrator');
        if (transferOrchestrator) {
            transferOrchestrator.setWindowManager(windowManager);
        }

        // Pass TransferOrchestrator to CompletionHandler
        if (ytdlpAdapter && transferOrchestrator) {
            const downloadManager = ytdlpAdapter._downloadManager;
            const completionHandler = downloadManager ? downloadManager._completionHandler : null;
            if (completionHandler && typeof completionHandler.setTransferOrchestrator === 'function') {
                completionHandler.setTransferOrchestrator(transferOrchestrator);
            }
        }

        // Note: Removed subscription to YtdlpAdapter events
        // DownloadStateSyncService is the single source of truth for state sync
        // DownloadStateSyncService reads state from memory (DownloadManager._activeDownloads) periodically every 300ms

        // Register separate services
        this._services.set('deviceStateSyncService', this._deviceStateSyncService);
        this._services.set('downloadStateSyncService', this._downloadStateSyncService);
        this._services.set('transferStateSyncService', this._transferStateSyncService);
    }

    /**
     * Set repositories after database initialization
     * This is called after databaseManager.initDb() completes
     */
    setRepositories() {
        const databaseManager = this._services.get('databaseManager');
        if (!databaseManager || !databaseManager.isInitialized()) {
            console.warn('[Container] Database not initialized, cannot set repositories');
            return;
        }

        const deviceRepository = databaseManager.devices;
        const downloadRepository = databaseManager.downloads;

        // Update DeviceRegistry with repository
        const deviceRegistry = this._services.get('deviceRegistry');
        if (deviceRegistry) {
            deviceRegistry._deviceRepository = deviceRepository;
        }

        // Update DeviceOrchestrator with repository
        const deviceOrchestrator = this._services.get('deviceOrchestrator');
        if (deviceOrchestrator) {
            deviceOrchestrator._deviceRepository = deviceRepository;
        }

        // ==================== Initialize DownloadSyncService ====================
        // Independent periodic sync service for downloads between memory and database
        // Reads memory every 300ms and writes only changes to database
        const ytdlpAdapter = this._services.get('ytdlpAdapter');
        const pathService = this._services.get('pathService');
        const downloadSyncService = new DownloadSyncService(
            ytdlpAdapter._downloadManager,
            downloadRepository,
            errorCentralService,
            pathService
        );
        downloadSyncService.start();
        this._services.set('downloadSyncService', downloadSyncService);

        // Update DownloadOrchestrator with repository
        const downloadOrchestrator = this._services.get('downloadOrchestrator');
        if (downloadOrchestrator) {
            downloadOrchestrator._downloadRepository = downloadRepository;
        }

        console.log('[Container] Repositories set successfully');
    }

    getWindowManager() {
        return this._windowManager;
    }
}

module.exports = new BootstrapContainer();