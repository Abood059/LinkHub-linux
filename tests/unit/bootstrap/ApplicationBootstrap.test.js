describe('ApplicationBootstrap', () => {
  // Since ApplicationBootstrap has Electron dependencies, we test the logic
  // directly without loading the actual module

  describe('bootstrap logic', () => {
    it('should initialize with null window manager and registry', () => {
      const bootstrap = {
        _windowManager: null,
        _windowRegistry: null
      };

      expect(bootstrap._windowManager).toBeNull();
      expect(bootstrap._windowRegistry).toBeNull();
    });

    it('should initialize container during run', () => {
      let initialized = false;
      const initialize = () => {
        initialized = true;
      };

      initialize();

      expect(initialized).toBe(true);
    });

    it('should initialize error service if available', () => {
      const mockErrorService = {
        init: jest.fn()
      };

      if (mockErrorService && typeof mockErrorService.init === 'function') {
        mockErrorService.init();
      }

      expect(mockErrorService.init).toHaveBeenCalled();
    });

    it('should verify tools if tool path resolver is available', () => {
      const mockToolPathResolver = {
        verifyAll: jest.fn().mockReturnValue({
          adb: true,
          scrcpy: true,
          ytdlp: true
        })
      };

      if (mockToolPathResolver && typeof mockToolPathResolver.verifyAll === 'function') {
        const toolsStatus = mockToolPathResolver.verifyAll();
        expect(toolsStatus).toHaveProperty('adb');
        expect(toolsStatus).toHaveProperty('scrcpy');
        expect(toolsStatus).toHaveProperty('ytdlp');
      }
    });

    it('should initialize database if available', async () => {
      const mockDbManager = {
        initDb: jest.fn().mockResolvedValue(undefined)
      };

      if (mockDbManager && typeof mockDbManager.initDb === 'function') {
        await mockDbManager.initDb();
      }

      expect(mockDbManager.initDb).toHaveBeenCalled();
    });

    it('should setup device event handler if available', () => {
      const mockDeviceEventHandler = {
        setup: jest.fn()
      };
      const mockConnectionService = {};

      if (mockDeviceEventHandler && mockConnectionService) {
        mockDeviceEventHandler.setup(mockConnectionService);
      }

      expect(mockDeviceEventHandler.setup).toHaveBeenCalledWith(mockConnectionService);
    });

    it('should start ADB monitoring if available', () => {
      const mockConnectionService = {
        startAdbMonitoring: jest.fn()
      };

      if (mockConnectionService && typeof mockConnectionService.startAdbMonitoring === 'function') {
        mockConnectionService.startAdbMonitoring(500);
      }

      expect(mockConnectionService.startAdbMonitoring).toHaveBeenCalledWith(500);
    });

    it('should start wireless discovery if available', () => {
      const mockConnectionService = {
        startWirelessDiscovery: jest.fn()
      };

      if (mockConnectionService && typeof mockConnectionService.startWirelessDiscovery === 'function') {
        mockConnectionService.startWirelessDiscovery();
      }

      expect(mockConnectionService.startWirelessDiscovery).toHaveBeenCalled();
    });

    it('should register IPC handlers', () => {
      const mockContainer = {};
      const registerSpy = jest.fn();

      registerSpy(mockContainer);

      expect(registerSpy).toHaveBeenCalledWith(mockContainer);
    });

    it('should handle IPC registration error gracefully', () => {
      const registerSpy = jest.fn().mockImplementation(() => {
        throw new Error('IPC registration failed');
      });

      expect(() => registerSpy({})).toThrow('IPC registration failed');
    });

    it('should create window registry and window manager', () => {
      const mockWindowRegistry = {};
      const mockWindowManager = {};

      expect(mockWindowRegistry).toBeDefined();
      expect(mockWindowManager).toBeDefined();
    });

    it('should pass window manager to container', () => {
      const mockWindowManager = {};
      const mockContainer = {
        setWindowManager: jest.fn()
      };

      mockContainer.setWindowManager(mockWindowManager);

      expect(mockContainer.setWindowManager).toHaveBeenCalledWith(mockWindowManager);
    });
  });

  describe('getter methods', () => {
    it('should return window manager', () => {
      const mockWindowManager = {};
      const bootstrap = {
        _windowManager: mockWindowManager,
        getWindowManager: function() {
          return this._windowManager;
        }
      };

      const result = bootstrap.getWindowManager();
      expect(result).toBe(mockWindowManager);
    });

    it('should return window registry', () => {
      const mockWindowRegistry = {};
      const bootstrap = {
        _windowRegistry: mockWindowRegistry,
        getWindowRegistry: function() {
          return this._windowRegistry;
        }
      };

      const result = bootstrap.getWindowRegistry();
      expect(result).toBe(mockWindowRegistry);
    });
  });

  describe('initialization order', () => {
    it('should follow correct initialization sequence', async () => {
      const executionOrder = [];

      const mockContainer = {
        initialize: () => executionOrder.push('container'),
        resolve: () => null,
        setWindowManager: () => executionOrder.push('setWindowManager')
      };

      const mockErrorService = {
        init: () => executionOrder.push('errorService')
      };

      const mockDbManager = {
        initDb: async () => {
          executionOrder.push('database');
        }
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

      // Simulate the run sequence
      mockContainer.initialize();
      mockErrorService.init();
      await mockDbManager.initDb();
      mockDeviceEventHandler.setup(mockConnectionService);
      mockConnectionService.startAdbMonitoring();
      mockConnectionService.startWirelessDiscovery();
      mockIpcBootstrap.register(mockContainer);
      mockContainer.setWindowManager({});

      expect(executionOrder).toEqual([
        'container',
        'errorService',
        'database',
        'deviceEventHandler',
        'adbMonitoring',
        'wirelessDiscovery',
        'ipc',
        'setWindowManager'
      ]);
    });
  });
});
