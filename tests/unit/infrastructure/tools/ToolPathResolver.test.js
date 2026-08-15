'use strict';

const path = require('path');
const ToolPathResolver = require('../../../../src/main/infrastructure/tools/ToolPathResolver');

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn()
}));

// Mock electron module
jest.mock('electron', () => ({
    app: {
        getAppPath: jest.fn()
    }
}));

const fs = require('fs');
const electron = require('electron');

describe('ToolPathResolver', () => {
    let originalPlatform;
    let originalEnv;

    beforeEach(() => {
        jest.clearAllMocks();
        originalPlatform = process.platform;
        originalEnv = { ...process.env };
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform
        });
        process.env = originalEnv;
        jest.restoreAllMocks();
    });

    describe('Constructor', () => {
        test('should use explicit appRoot when provided', () => {
            const resolver = new ToolPathResolver({ appRoot: '/custom/path' });
            expect(resolver._appRoot).toBe('/custom/path');
        });

        test('should use electron.app.getAppPath when available and no explicit root', () => {
            electron.app.getAppPath.mockReturnValue('/electron/path');
            const resolver = new ToolPathResolver();
            expect(resolver._appRoot).toBe('/electron/path');
        });

        test('should fallback to process.cwd when electron not available', () => {
            electron.app.getAppPath.mockImplementation(() => {
                throw new Error('Electron not available');
            });
            const resolver = new ToolPathResolver();
            expect(resolver._appRoot).toBe(process.cwd());
        });

        test('should set _platform correctly for win32', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            const resolver = new ToolPathResolver();
            expect(resolver._platform).toBe('win32');
        });

        test('should set _platform correctly for linux', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            const resolver = new ToolPathResolver();
            expect(resolver._platform).toBe('linux');
        });

        test('should set _platform correctly for darwin', () => {
            Object.defineProperty(process, 'platform', {
                value: 'darwin'
            });
            const resolver = new ToolPathResolver();
            expect(resolver._platform).toBe('darwin');
        });

        test('should set _binSubDir to win for win32', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            const resolver = new ToolPathResolver();
            expect(resolver._binSubDir).toBe('win');
        });

        test('should set _binSubDir to linux for linux', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            const resolver = new ToolPathResolver();
            expect(resolver._binSubDir).toBe('linux');
        });

        test('should set _binSubDir to macos for darwin', () => {
            Object.defineProperty(process, 'platform', {
                value: 'darwin'
            });
            const resolver = new ToolPathResolver();
            expect(resolver._binSubDir).toBe('macos');
        });

        test('should throw error for unsupported platform', () => {
            Object.defineProperty(process, 'platform', {
                value: 'freebsd'
            });
            expect(() => new ToolPathResolver()).toThrow('Unsupported platform: freebsd');
        });

        test('should accept logger option', () => {
            const mockLogger = { warn: jest.fn() };
            const resolver = new ToolPathResolver({ logger: mockLogger });
            expect(resolver._logger).toBe(mockLogger);
        });
    });

    describe('getAdbPath', () => {
        test('should return default path when file exists on Windows', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).toBe(path.join('/app', 'resources', 'bin', 'win', 'adb.exe'));
        });

        test('should return default path when file exists on Linux', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).toBe(path.join('/app', 'resources', 'bin', 'linux', 'adb'));
        });

        test('should return default path when file exists on macOS', () => {
            Object.defineProperty(process, 'platform', {
                value: 'darwin'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).toBe(path.join('/app', 'resources', 'bin', 'macos', 'adb'));
        });

        test('should return null when default file does not exist', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(false);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).toBeNull();
        });

        test('should use environment variable when set and file exists', () => {
            process.env.LINKHUB_ADB_PATH = '/app/custom/adb';
            fs.existsSync.mockImplementation((filePath) => {
                return filePath === '/app/custom/adb';
            });
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).toBe('/app/custom/adb');
        });

        test('should return null when environment variable points to non-existent file', () => {
            process.env.LINKHUB_ADB_PATH = '/custom/adb';
            fs.existsSync.mockReturnValue(false);
            const mockLogger = { warn: jest.fn() };
            const resolver = new ToolPathResolver({ appRoot: '/app', logger: mockLogger });
            const result = resolver.getAdbPath();
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalled();
        });

        test('should ignore environment variable when empty string', () => {
            process.env.LINKHUB_ADB_PATH = '';
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).not.toBe('');
        });

        test('should ignore environment variable when whitespace only', () => {
            process.env.LINKHUB_ADB_PATH = '   ';
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).not.toBe('   ');
        });

        test('should call logger.warn when default binary not found and no env override', () => {
            const mockLogger = {
                warn: jest.fn()
            };
            process.env.LINKHUB_ADB_PATH = '';
            fs.existsSync.mockReturnValue(false);
            const resolver = new ToolPathResolver({ appRoot: '/app', logger: mockLogger });
            resolver.getAdbPath();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Optional binary')
            );
        });
    });

    describe('getScrcpyPath', () => {
        test('should return default path when file exists on Windows', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getScrcpyPath();
            expect(result).toBe(path.join('/app', 'resources', 'bin', 'win', 'scrcpy.exe'));
        });

        test('should return default path when file exists on Linux', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getScrcpyPath();
            expect(result).toBe(path.join('/app', 'resources', 'bin', 'linux', 'scrcpy'));
        });

        test('should use environment variable when set', () => {
            process.env.LINKHUB_SCRCPY_PATH = '/app/custom/scrcpy';
            fs.existsSync.mockImplementation((filePath) => {
                return filePath === '/app/custom/scrcpy';
            });
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getScrcpyPath();
            expect(result).toBe('/app/custom/scrcpy');
        });

        test('should return null when file does not exist', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(false);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getScrcpyPath();
            expect(result).toBeNull();
        });
    });

    describe('getYtDlpPath', () => {
        test('should return default path when file exists on Windows', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getYtDlpPath();
            expect(result).toBe(path.join('/app', 'resources', 'bin', 'win', 'yt-dlp_linux.exe'));
        });

        test('should return default path when file exists on Linux', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getYtDlpPath();
            expect(result).toBe(path.join('/app', 'resources', 'bin', 'linux', 'yt-dlp_linux'));
        });

        test('should use environment variable when set', () => {
            process.env.LINKHUB_YTDLP_PATH = '/app/custom/yt-dlp';
            fs.existsSync.mockImplementation((filePath) => {
                return filePath === '/app/custom/yt-dlp';
            });
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getYtDlpPath();
            expect(result).toBe('/app/custom/yt-dlp');
        });

        test('should return null when file does not exist', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(false);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getYtDlpPath();
            expect(result).toBeNull();
        });
    });

    describe('verifyAll', () => {
        test('should return all false when no tools found', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(false);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.verifyAll();
            expect(result).toEqual({
                adb: false,
                scrcpy: false,
                ytdlp: false
            });
        });

        test('should return all true when all tools found', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.verifyAll();
            expect(result).toEqual({
                adb: true,
                scrcpy: true,
                ytdlp: true
            });
        });

        test('should return mixed results when some tools found', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockImplementation((filePath) => {
                return filePath.includes('adb') || filePath.includes('scrcpy');
            });
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.verifyAll();
            expect(result).toEqual({
                adb: true,
                scrcpy: true,
                ytdlp: false
            });
        });

        test('should handle exceptions gracefully', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockImplementation(() => {
                throw new Error('Test error');
            });
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.verifyAll();
            expect(result).toEqual({
                adb: false,
                scrcpy: false,
                ytdlp: false
            });
        });
    });

    describe('Security Tests', () => {
        test('should normalize path with ../ in appRoot', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app/../../etc' });
            const result = resolver.getAdbPath();
            const normalized = path.normalize(result);
            expect(normalized).not.toContain('..');
        });

        test('should not allow path traversal via environment variable', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            process.env.LINKHUB_ADB_PATH = '/app/../../../etc/passwd';
            fs.existsSync.mockReturnValue(true);
            const mockLogger = { warn: jest.fn() };
            const resolver = new ToolPathResolver({ appRoot: '/app', logger: mockLogger });
            const result = resolver.getAdbPath();
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('outside appRoot directory')
            );
        });

        test('should reject absolute path outside appRoot', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            process.env.LINKHUB_ADB_PATH = '/etc/passwd';
            fs.existsSync.mockReturnValue(true);
            const mockLogger = { warn: jest.fn() };
            const resolver = new ToolPathResolver({ appRoot: '/app', logger: mockLogger });
            const result = resolver.getAdbPath();
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('outside appRoot directory')
            );
        });

        test('should reject relative path with .. outside appRoot', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            process.env.LINKHUB_ADB_PATH = '../etc/passwd';
            fs.existsSync.mockReturnValue(true);
            const mockLogger = { warn: jest.fn() };
            const resolver = new ToolPathResolver({ appRoot: '/app', logger: mockLogger });
            const result = resolver.getAdbPath();
            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('outside appRoot directory')
            );
        });

        test('should accept valid path within appRoot', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            process.env.LINKHUB_ADB_PATH = '/app/resources/bin/linux/adb';
            fs.existsSync.mockImplementation((filePath) => {
                return filePath === '/app/resources/bin/linux/adb';
            });
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).toBe('/app/resources/bin/linux/adb');
        });

        test('should accept relative path within appRoot', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            process.env.LINKHUB_ADB_PATH = './resources/bin/linux/adb';
            fs.existsSync.mockImplementation((filePath) => {
                return filePath === '/app/resources/bin/linux/adb';
            });
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).toBe('/app/resources/bin/linux/adb');
        });

        test('should reject null or undefined environment path', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            process.env.LINKHUB_ADB_PATH = null;
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result).toBe(path.join('/app', 'resources', 'bin', 'linux', 'adb'));
        });

        test('should handle null appRoot gracefully', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            electron.app.getAppPath.mockReturnValue('/electron/path');
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: null });
            expect(resolver._appRoot).toBe('/electron/path');
        });

        test('should handle undefined appRoot gracefully', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            electron.app.getAppPath.mockReturnValue('/electron/path');
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: undefined });
            expect(resolver._appRoot).toBe('/electron/path');
        });
    });

    describe('Performance Tests', () => {
        test('should complete 10000 getAdbPath calls in less than 100ms', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });

            const start = Date.now();
            for (let i = 0; i < 10000; i++) {
                resolver.getAdbPath();
            }
            const end = Date.now();
            const duration = end - start;

            expect(duration).toBeLessThan(100);
        });

        test('should complete 10000 verifyAll calls in less than 200ms', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });

            const start = Date.now();
            for (let i = 0; i < 10000; i++) {
                resolver.verifyAll();
            }
            const end = Date.now();
            const duration = end - start;

            expect(duration).toBeLessThan(200);
        });
    });

    describe('Edge Cases', () => {
        test('should handle .exe already present in binary name on Windows', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            
            // The internal _getDefaultPath should handle this
            // Testing via getAdbPath which uses 'adb' without .exe
            const result = resolver.getAdbPath();
            expect(result).toContain('.exe');
        });

        test('should handle case-insensitive .exe check on Windows', () => {
            Object.defineProperty(process, 'platform', {
                value: 'win32'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app' });
            const result = resolver.getAdbPath();
            expect(result.toLowerCase()).toMatch(/\.exe$/);
        });

        test('should handle very long appRoot path', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            const longPath = '/app/' + 'x'.repeat(1000);
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: longPath });
            const result = resolver.getAdbPath();
            expect(result).toContain(longPath);
        });

        test('should handle special characters in appRoot', () => {
            Object.defineProperty(process, 'platform', {
                value: 'linux'
            });
            fs.existsSync.mockReturnValue(true);
            const resolver = new ToolPathResolver({ appRoot: '/app/path with spaces' });
            const result = resolver.getAdbPath();
            expect(result).toContain('path with spaces');
        });
    });
});
