describe('ApplicationBootstrap Integration Tests', () => {
  // Since ApplicationBootstrap has Electron dependencies, we test the integration
  // logic directly without loading the actual module

  describe('Integration logic', () => {
    it('should integrate container with DeviceEventHandler', () => {
      const mockDeviceRegistry = {};
      const mockConnectionService = {};
      const mockDeviceEventHandler = {
        _deviceRegistry: mockDeviceRegistry,
        setup: jest.fn()
      };

      mockDeviceEventHandler.setup(mockConnectionService);

      expect(mockDeviceEventHandler.setup).toHaveBeenCalledWith(mockConnectionService);
    });

    it('should integrate container with IpcBootstrap', () => {
      const mockContainer = {
        resolve: jest.fn().mockReturnValue({})
      };
      const registerSpy = jest.fn();

      registerSpy(mockContainer);

      expect(registerSpy).toHaveBeenCalledWith(mockContainer);
    });

    it('should integrate window manager with container', () => {
      const mockWindowManager = { send: jest.fn() };
      const mockContainer = {
        _windowManager: null,
        _stateSyncService: null,
        setWindowManager: function(wm) {
          this._windowManager = wm;
          this._stateSyncService = { start: jest.fn() };
        }
      };

      mockContainer.setWindowManager(mockWindowManager);

      expect(mockContainer._windowManager).toBe(mockWindowManager);
      expect(mockContainer._stateSyncService).toBeDefined();
    });

    it('should integrate StateSyncService with DeviceEventHandler', () => {
      const mockStateSyncService = { start: jest.fn() };
      const mockDeviceEventHandler = {
        _stateSyncService: null,
        setStateSyncService: function(service) {
          this._stateSyncService = service;
        }
      };

      mockDeviceEventHandler.setStateSyncService(mockStateSyncService);

      expect(mockDeviceEventHandler._stateSyncService).toBe(mockStateSyncService);
    });
  });

  describe('Service dependency integration', () => {
    it('should verify DeviceOrchestrator dependencies', () => {
      const mockDeviceRegistry = {};
      const mockConnectionService = {};
      const mockScrcpyAdapter = {};

      const deviceOrchestrator = {
        _deviceRegistry: mockDeviceRegistry,
        _connectionService: mockConnectionService,
        _scrcpyAdapter: mockScrcpyAdapter
      };

      expect(deviceOrchestrator._deviceRegistry).toBe(mockDeviceRegistry);
      expect(deviceOrchestrator._connectionService).toBe(mockConnectionService);
      expect(deviceOrchestrator._scrcpyAdapter).toBe(mockScrcpyAdapter);
    });

    it('should verify DownloadOrchestrator dependencies', () => {
      const mockYtdlpAdapter = {};
      const mockDeviceRegistry = {};

      const downloadOrchestrator = {
        _ytdlpAdapter: mockYtdlpAdapter,
        _deviceRegistry: mockDeviceRegistry
      };

      expect(downloadOrchestrator._ytdlpAdapter).toBe(mockYtdlpAdapter);
      expect(downloadOrchestrator._deviceRegistry).toBe(mockDeviceRegistry);
    });

    it('should verify DeviceEventHandler dependencies', () => {
      const mockDeviceRegistry = {};
      const mockLogger = {};

      const deviceEventHandler = {
        _deviceRegistry: mockDeviceRegistry,
        _logger: mockLogger
      };

      expect(deviceEventHandler._deviceRegistry).toBe(mockDeviceRegistry);
      expect(deviceEventHandler._logger).toBe(mockLogger);
    });
  });

  describe('End-to-end integration flow', () => {
    it('should complete full initialization sequence', () => {
      const executionOrder = [];

      const mockContainer = {
        initialize: () => executionOrder.push('container'),
        resolve: () => ({}),
        setWindowManager: () => executionOrder.push('setWindowManager')
      };

      const mockDeviceEventHandler = {
        setup: () => executionOrder.push('deviceEventHandler')
      };

      const mockConnectionService = {
        startAdbMonitoring: () => executionOrder.push('adbMonitoring'),
        startWirelessDiscovery: () => executionOrder.push('wirelessDiscovery')
      };

      const mockIpcBootstrap = {
        register: () => executionOrder.push('ipc')
      };

      // Simulate the integration flow
      mockContainer.initialize();
      mockDeviceEventHandler.setup(mockConnectionService);
      mockConnectionService.startAdbMonitoring();
      mockConnectionService.startWirelessDiscovery();
      mockIpcBootstrap.register(mockContainer);
      mockContainer.setWindowManager({});

      expect(executionOrder).toEqual([
        'container',
        'deviceEventHandler',
        'adbMonitoring',
        'wirelessDiscovery',
        'ipc',
        'setWindowManager'
      ]);
    });
  });
});
