'use strict';

// Mock the ipc infrastructure module before importing IpcBootstrap
jest.mock('../../../src/main/infrastructure/ipc', () => ({
    registerIpcHandlers: jest.fn()
}));

const IpcBootstrap = require('../../../src/main/bootstrap/IpcBootstrap');

describe('IpcBootstrap', () => {
    beforeEach(() => {
        // Clear mock calls before each test
        const { registerIpcHandlers } = require('../../../src/main/infrastructure/ipc');
        registerIpcHandlers.mockClear();
    });

    describe('register()', () => {
        it('should call registerIpcHandlers with correct orchestrators when both are available', () => {
            const mockDeviceOrchestrator = { connectDevice: jest.fn() };
            const mockDownloadOrchestrator = { startDownload: jest.fn() };
            const mockContainer = {
                resolve: jest.fn((name) => {
                    if (name === 'deviceOrchestrator') return mockDeviceOrchestrator;
                    if (name === 'downloadOrchestrator') return mockDownloadOrchestrator;
                    return null;
                })
            };

            IpcBootstrap.register(mockContainer);

            const { registerIpcHandlers } = require('../../../src/main/infrastructure/ipc');
            expect(registerIpcHandlers).toHaveBeenCalledTimes(1);
            expect(registerIpcHandlers).toHaveBeenCalledWith(
                mockDeviceOrchestrator,
                mockDownloadOrchestrator
            );
        });

        it('should throw error when deviceOrchestrator is null', () => {
            const mockDownloadOrchestrator = { startDownload: jest.fn() };
            const mockContainer = {
                resolve: jest.fn((name) => {
                    if (name === 'deviceOrchestrator') return null;
                    if (name === 'downloadOrchestrator') return mockDownloadOrchestrator;
                    return null;
                })
            };

            expect(() => {
                IpcBootstrap.register(mockContainer);
            }).toThrow('deviceOrchestrator and downloadOrchestrator are required for IPC registration');

            const { registerIpcHandlers } = require('../../../src/main/infrastructure/ipc');
            expect(registerIpcHandlers).not.toHaveBeenCalled();
        });

        it('should throw error when downloadOrchestrator is null', () => {
            const mockDeviceOrchestrator = { connectDevice: jest.fn() };
            const mockContainer = {
                resolve: jest.fn((name) => {
                    if (name === 'deviceOrchestrator') return mockDeviceOrchestrator;
                    if (name === 'downloadOrchestrator') return null;
                    return null;
                })
            };

            expect(() => {
                IpcBootstrap.register(mockContainer);
            }).toThrow('deviceOrchestrator and downloadOrchestrator are required for IPC registration');

            const { registerIpcHandlers } = require('../../../src/main/infrastructure/ipc');
            expect(registerIpcHandlers).not.toHaveBeenCalled();
        });

        it('should throw error when both orchestrators are null', () => {
            const mockContainer = {
                resolve: jest.fn().mockReturnValue(null)
            };

            expect(() => {
                IpcBootstrap.register(mockContainer);
            }).toThrow('deviceOrchestrator and downloadOrchestrator are required for IPC registration');

            const { registerIpcHandlers } = require('../../../src/main/infrastructure/ipc');
            expect(registerIpcHandlers).not.toHaveBeenCalled();
        });
    });
});
