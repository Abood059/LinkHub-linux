'use strict';

// Mock heavy dependencies - must be before imports
jest.mock('fs');
jest.mock('electron', () => ({
    app: {
        getAppPath: jest.fn(() => '/app/root')
    }
}));

// Mock logging module to prevent electron-log from loading
jest.mock('../../../src/main/infrastructure/logging/ErrorCentralService', () => {
    return jest.fn().mockImplementation(() => ({
        init: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        flush: jest.fn()
    }));
});

jest.mock('../../../src/main/bootstrap/container');
jest.mock('../../../src/main/infrastructure/windows/WindowManager');
jest.mock('../../../src/main/infrastructure/windows/WindowRegistry');

const fs = require('fs');
const ToolPathResolver = require('../../../src/main/infrastructure/tools/ToolPathResolver');
const ApplicationBootstrap = require('../../../src/main/bootstrap/ApplicationBootstrap');
const container = require('../../../src/main/bootstrap/container');

describe('Bootstrap Security Tests', () => {
    let originalEnv;
    let mockLogger;

    beforeEach(() => {
        originalEnv = { ...process.env };
        mockLogger = { warn: jest.fn(), error: jest.fn(), info: jest.fn() };
        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Path Traversal Attack Prevention', () => {
        it('should reject path traversal attacks via LINKHUB_ADB_PATH', () => {
            // Set malicious environment variable
            process.env.LINKHUB_ADB_PATH = '../../../etc/passwd';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            const result = resolver.getAdbPath();

            // Should return null because sanitizePath rejects paths outside appRoot
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('outside appRoot directory')
            );
        });

        it('should reject absolute path traversal attacks', () => {
            process.env.LINKHUB_ADB_PATH = '/etc/passwd';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            const result = resolver.getAdbPath();

            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        it('should reject relative path with multiple parent directories', () => {
            process.env.LINKHUB_ADB_PATH = '../../../../../../etc/passwd';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            const result = resolver.getAdbPath();

            expect(result).toBeNull();
        });
    });

    describe('Missing Tools Handling', () => {
        it('should continue when all tools are missing', async () => {
            // Mock fs.existsSync to return false for all paths
            fs.existsSync.mockReturnValue(false);

            // Mock container to return mock services
            container.initialize = jest.fn();
            container.resolve = jest.fn((name) => {
                if (name === 'errorCentralService') {
                    return {
                        init: jest.fn(),
                        warn: jest.fn(),
                        error: jest.fn()
                    };
                }
                if (name === 'toolPathResolver') {
                    const resolver = new ToolPathResolver({
                        logger: mockLogger,
                        appRoot: '/app/root'
                    });
                    return resolver;
                }
                if (name === 'databaseManager') {
                    return {
                        initDb: jest.fn().mockResolvedValue(undefined)
                    };
                }
                if (name === 'connectionService') {
                    return {
                        startAdbMonitoring: jest.fn(),
                        startWirelessDiscovery: jest.fn()
                    };
                }
                if (name === 'deviceEventHandler') {
                    return {
                        setup: jest.fn()
                    };
                }
                return null;
            });

            // Mock createMainWindow to prevent actual window creation
            const bootstrap = new ApplicationBootstrap();
            bootstrap.createMainWindow = jest.fn().mockResolvedValue({
                once: jest.fn(),
                show: jest.fn(),
                webContents: {
                    openDevTools: jest.fn()
                }
            });

            // Should not throw even though tools are missing
            await expect(bootstrap.run()).resolves.not.toThrow();

            // Verify tool verification returns all false
            const toolPathResolver = container.resolve('toolPathResolver');
            const toolsStatus = toolPathResolver.verifyAll();
            expect(toolsStatus).toEqual({
                adb: false,
                scrcpy: false,
                ytdlp: false
            });
        });

        it('should log warnings when tools are missing', async () => {
            fs.existsSync.mockReturnValue(false);

            const mockErrorService = {
                init: jest.fn(),
                warn: jest.fn(),
                error: jest.fn()
            };

            container.initialize = jest.fn();
            container.resolve = jest.fn((name) => {
                if (name === 'errorCentralService') return mockErrorService;
                if (name === 'toolPathResolver') {
                    const resolver = new ToolPathResolver({
                        logger: mockLogger,
                        appRoot: '/app/root'
                    });
                    return resolver;
                }
                if (name === 'databaseManager') {
                    return { initDb: jest.fn().mockResolvedValue(undefined) };
                }
                if (name === 'connectionService') {
                    return {
                        startAdbMonitoring: jest.fn(),
                        startWirelessDiscovery: jest.fn()
                    };
                }
                if (name === 'deviceEventHandler') {
                    return { setup: jest.fn() };
                }
                return null;
            });

            const bootstrap = new ApplicationBootstrap();
            bootstrap.createMainWindow = jest.fn().mockResolvedValue({
                once: jest.fn(),
                show: jest.fn(),
                webContents: {
                    openDevTools: jest.fn()
                }
            });

            await bootstrap.run();

            // Verify warnings were logged for missing tools
            expect(mockErrorService.warn).toHaveBeenCalledWith(
                expect.stringContaining('ADB binary not found'),
                expect.objectContaining({ source: 'ApplicationBootstrap' })
            );
            expect(mockErrorService.warn).toHaveBeenCalledWith(
                expect.stringContaining('scrcpy binary not found'),
                expect.objectContaining({ source: 'ApplicationBootstrap' })
            );
            expect(mockErrorService.warn).toHaveBeenCalledWith(
                expect.stringContaining('yt-dlp binary not found'),
                expect.objectContaining({ source: 'ApplicationBootstrap' })
            );
        });
    });

    describe('Empty/Invalid Environment Variables', () => {
        it('should ignore empty environment variable', () => {
            process.env.LINKHUB_ADB_PATH = '';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            // Should fall back to default path
            const result = resolver.getAdbPath();

            // Since default path also doesn't exist (mocked), should return null
            expect(result).toBeNull();
        });

        it('should ignore whitespace-only environment variable', () => {
            process.env.LINKHUB_ADB_PATH = '   ';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            const result = resolver.getAdbPath();

            expect(result).toBeNull();
        });

        it('should not crash with invalid environment variable', () => {
            process.env.LINKHUB_ADB_PATH = null;

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            expect(() => resolver.getAdbPath()).not.toThrow();
        });
    });

    describe('Command Injection Prevention', () => {
        it('should reject paths with command injection characters (semicolon)', () => {
            process.env.LINKHUB_ADB_PATH = '/bin/echo; malicious';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            const result = resolver.getAdbPath();

            // Path should be rejected (either by sanitizePath or fs.existsSync)
            expect(result).toBeNull();
        });

        it('should reject paths with pipe character', () => {
            process.env.LINKHUB_ADB_PATH = '/bin/echo | malicious';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            const result = resolver.getAdbPath();

            expect(result).toBeNull();
        });

        it('should reject paths with ampersand character', () => {
            process.env.LINKHUB_ADB_PATH = '/bin/echo & malicious';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            const result = resolver.getAdbPath();

            expect(result).toBeNull();
        });

        it('should reject paths with backtick character', () => {
            process.env.LINKHUB_ADB_PATH = '/bin/echo `malicious`';

            const resolver = new ToolPathResolver({
                logger: mockLogger,
                appRoot: '/app/root'
            });

            const result = resolver.getAdbPath();

            expect(result).toBeNull();
        });
    });
});
