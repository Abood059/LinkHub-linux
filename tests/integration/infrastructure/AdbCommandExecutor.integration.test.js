'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const AdbCommandExecutor = require('../../../src/main/infrastructure/adb/AdbCommandExecutor');
const processManager = require('../../../src/main/infrastructure/process/ProcessManager');

describe('Integration Tests', () => {
    describe('AdbCommandExecutor Integration Tests', () => {
        let tempDir;
        let mockAdbPath;
        let adbExecutor;

        beforeAll(async () => {
            // Create temporary directory
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'linkhub-test-'));
            
            // Create mock adb script that outputs device list
            mockAdbPath = path.join(tempDir, 'mock-adb');
            const mockAdbScript = `#!/bin/sh
if [ "$1" = "devices" ]; then
    echo "List of devices attached"
    echo "emulator-5554	device"
    echo "127.0.0.1:5555	device"
elif [ "$1" = "-s" ]; then
    # Mock device info commands
    shift
    if [ "$1" = "emulator-5554" ]; then
        shift
        if [ "$1" = "shell" ]; then
            shift
            if [ "$1" = "getprop" ]; then
                shift
                if [ "$1" = "ro.product.model" ]; then
                    echo "Pixel 5"
                elif [ "$1" = "ro.build.version.release" ]; then
                    echo "12"
                elif [ "$1" = "ro.product.cpu.abi" ]; then
                    echo "arm64-v8a"
                fi
            fi
        fi
    fi
fi
`;
            await fs.writeFile(mockAdbPath, mockAdbScript, { mode: 0o755 });

            // Create AdbCommandExecutor with mock adb path
            adbExecutor = new AdbCommandExecutor({
                processSupervisor: processManager,
                adbPath: mockAdbPath
            });
        });

        afterAll(async () => {
            // Clean up temp directory
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (error) {
                console.error('Cleanup failed:', error);
                throw error;
            }
        });

        describe('getDevices with mock adb', () => {
            test('should parse mock adb devices output correctly', async () => {
                const devices = await adbExecutor.getDevices();

                expect(Array.isArray(devices)).toBe(true);
                expect(devices).toHaveLength(2);
                expect(devices[0]).toEqual({
                    serial: 'emulator-5554',
                    state: 'device'
                });
                expect(devices[1]).toEqual({
                    serial: '127.0.0.1:5555',
                    state: 'device'
                });
            });

            test('should handle empty device list', async () => {
                // Create mock adb that returns no devices
                const emptyAdbPath = path.join(tempDir, 'empty-adb');
                const emptyScript = `#!/bin/sh
echo "List of devices attached"
`;
                await fs.writeFile(emptyAdbPath, emptyScript, { mode: 0o755 });

                const emptyAdbExecutor = new AdbCommandExecutor({
                    processSupervisor: processManager,
                    adbPath: emptyAdbPath
                });

                const devices = await emptyAdbExecutor.getDevices();
                expect(devices).toEqual([]);
            });
        });

        describe('_sanitizeSerialOrTarget security', () => {
            test('should reject dangerous characters: semicolon', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget('device; rm -rf /');
                }).toThrow('Invalid serial or target: contains dangerous characters');
            });

            test('should reject dangerous characters: ampersand', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget('device& malicious');
                }).toThrow('Invalid serial or target: contains dangerous characters');
            });

            test('should reject dangerous characters: pipe', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget('device| cat /etc/passwd');
                }).toThrow('Invalid serial or target: contains dangerous characters');
            });

            test('should reject dangerous characters: backtick', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget('device`whoami`');
                }).toThrow('Invalid serial or target: contains dangerous characters');
            });

            test('should reject dangerous characters: dollar sign', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget('device$(evil)');
                }).toThrow('Invalid serial or target: contains dangerous characters');
            });

            test('should reject dangerous characters: parentheses', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget('device(evil)');
                }).toThrow('Invalid serial or target: contains dangerous characters');
            });

            test('should reject dangerous characters: angle brackets', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget('device<file');
                }).toThrow('Invalid serial or target: contains dangerous characters');
            });

            test('should accept valid serial with hyphens and dots', () => {
                const result = adbExecutor._sanitizeSerialOrTarget('emulator-5554');
                expect(result).toBe('emulator-5554');
            });

            test('should accept valid serial with colons', () => {
                const result = adbExecutor._sanitizeSerialOrTarget('127.0.0.1:5555');
                expect(result).toBe('127.0.0.1:5555');
            });

            test('should accept valid serial with underscores', () => {
                const result = adbExecutor._sanitizeSerialOrTarget('device_123');
                expect(result).toBe('device_123');
            });

            test('should trim whitespace from valid serial', () => {
                const result = adbExecutor._sanitizeSerialOrTarget('  emulator-5554  ');
                expect(result).toBe('emulator-5554');
            });

            test('should reject empty string', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget('');
                }).toThrow('Serial or target must be a non-empty string');
            });

            test('should reject null input', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget(null);
                }).toThrow('Serial or target must be a non-empty string');
            });

            test('should reject non-string input', () => {
                expect(() => {
                    adbExecutor._sanitizeSerialOrTarget(123);
                }).toThrow('Serial or target must be a non-empty string');
            });
        });

        describe('getDeviceInfo with mocked process execution', () => {
            test('should construct correct adb commands for device info', async () => {
                // Mock the _executeQuickAdbCommand to return known values
                // The _executeShellCommand expects an array from _executeQuickAdbCommand
                const executeSpy = jest.spyOn(adbExecutor, '_executeQuickAdbCommand')
                    .mockResolvedValueOnce(['Pixel 5'])
                    .mockResolvedValueOnce(['12'])
                    .mockResolvedValueOnce(['arm64-v8a']);

                const deviceInfo = await adbExecutor.getDeviceInfo('emulator-5554');

                expect(executeSpy).toHaveBeenCalledTimes(3);
                expect(executeSpy).toHaveBeenNthCalledWith(1, [
                    '-s',
                    'emulator-5554',
                    'shell',
                    'getprop',
                    'ro.product.model'
                ]);
                expect(executeSpy).toHaveBeenNthCalledWith(2, [
                    '-s',
                    'emulator-5554',
                    'shell',
                    'getprop',
                    'ro.build.version.release'
                ]);
                expect(executeSpy).toHaveBeenNthCalledWith(3, [
                    '-s',
                    'emulator-5554',
                    'shell',
                    'getprop',
                    'ro.product.cpu.abi'
                ]);

                expect(deviceInfo).toEqual({
                    serial: 'emulator-5554',
                    model: 'Pixel 5',
                    version: '12',
                    arch: 'arm64-v8a'
                });

                executeSpy.mockRestore();
            });

            test('should sanitize serial before constructing commands', async () => {
                const executeSpy = jest.spyOn(adbExecutor, '_executeQuickAdbCommand')
                    .mockResolvedValue(['test']);

                // This should not throw because the serial is valid
                await adbExecutor.getDeviceInfo('emulator-5554');

                // Verify the sanitized serial was used
                expect(executeSpy).toHaveBeenCalledWith(
                    expect.arrayContaining(['-s', 'emulator-5554'])
                );

                executeSpy.mockRestore();
            });
        });

        describe('Command construction verification', () => {
            test('should construct connect command correctly', async () => {
                const executeSpy = jest.spyOn(adbExecutor, '_executeQuickAdbCommand')
                    .mockResolvedValue('connected');

                await adbExecutor.connect('127.0.0.1:5555');

                expect(executeSpy).toHaveBeenCalledWith(['connect', '127.0.0.1:5555']);
                executeSpy.mockRestore();
            });

            test('should construct disconnect command with target', async () => {
                const executeSpy = jest.spyOn(adbExecutor, '_executeQuickAdbCommand')
                    .mockResolvedValue('disconnected');

                await adbExecutor.disconnect('127.0.0.1:5555');

                expect(executeSpy).toHaveBeenCalledWith(['disconnect', '127.0.0.1:5555']);
                executeSpy.mockRestore();
            });

            test('should construct disconnect command without target', async () => {
                const executeSpy = jest.spyOn(adbExecutor, '_executeQuickAdbCommand')
                    .mockResolvedValue('disconnected');

                await adbExecutor.disconnect();

                expect(executeSpy).toHaveBeenCalledWith(['disconnect']);
                executeSpy.mockRestore();
            });

            test('should construct pair command correctly', async () => {
                const executeSpy = jest.spyOn(adbExecutor, '_executeQuickAdbCommand')
                    .mockResolvedValue('paired');

                await adbExecutor.pair('192.168.1.100:1234', '123456');

                expect(executeSpy).toHaveBeenCalledWith(['pair', '192.168.1.100:1234', '123456']);
                executeSpy.mockRestore();
            });

            test('should reject pairing code with non-digits', async () => {
                await expect(
                    adbExecutor.pair('192.168.1.100:1234', 'abc123')
                ).rejects.toThrow('Pairing code must contain only digits');
            });
        });

    });
});
