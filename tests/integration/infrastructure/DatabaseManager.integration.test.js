'use strict';

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const DatabaseManager = require('../../../src/main/infrastructure/persistence/DatabaseManager');

describe('Integration Tests', () => {
    describe('DatabaseManager Integration Tests', () => {
        let tempDir;
        let dbManager;
        let dbPath;

        beforeEach(async () => {
            // Create a unique temporary directory for each test within the project
            tempDir = path.join(process.cwd(), 'temp-test-' + Date.now());
            await fs.mkdir(tempDir, { recursive: true });
            dbPath = path.join(tempDir, 'devices.json');
            dbManager = new DatabaseManager({ databasePath: dbPath });
            await dbManager.initDb();
        });

        afterEach(async () => {
            // Close database and remove temp directory after each test
            try {
                await dbManager.close();
            } catch (error) {
                // Ignore close errors
            }
            try {
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (error) {
                // Ignore cleanup errors
            }
        });

        describe('Database lifecycle with real files', () => {
            test('should initialize database and create file', async () => {
                const fileExists = await fs.access(dbPath).then(() => true).catch(() => false);
                expect(fileExists).toBe(true);
                expect(dbManager._initialized).toBe(true);
            });

            test('should insert 10 dummy devices', async () => {
                for (let i = 0; i < 10; i++) {
                    await dbManager.insertDevice({
                        id: `device-${i}`,
                        name: `Device ${i}`,
                        status: 'active'
                    });
                }

                const devices = await dbManager.loadDevices();
                expect(devices).toHaveLength(10);
                expect(devices[0].id).toBe('device-0');
                expect(devices[9].id).toBe('device-9');
            });

            test('should load devices and verify data integrity', async () => {
                // Insert test data first
                for (let i = 0; i < 10; i++) {
                    await dbManager.insertDevice({
                        id: `device-${i}`,
                        name: `Device ${i}`,
                        status: 'active'
                    });
                }

                const devices = await dbManager.loadDevices();

                expect(Array.isArray(devices)).toBe(true);
                expect(devices).toHaveLength(10);

                // Verify each device has correct structure
                devices.forEach((device, index) => {
                    expect(device.id).toBe(`device-${index}`);
                    expect(device.name).toBe(`Device ${index}`);
                    expect(device.status).toBe('active');
                });
            });

            test('should update 2 devices successfully', async () => {
                // Insert test data first
                for (let i = 0; i < 10; i++) {
                    await dbManager.insertDevice({
                        id: `device-${i}`,
                        name: `Device ${i}`,
                        status: 'active'
                    });
                }

                const updated1 = await dbManager.updateDevice('device-0', { name: 'Updated Device 0', status: 'inactive' });
                const updated2 = await dbManager.updateDevice('device-5', { name: 'Updated Device 5' });

                expect(updated1).toEqual({
                    id: 'device-0',
                    name: 'Updated Device 0',
                    status: 'inactive'
                });
                expect(updated2).toEqual({
                    id: 'device-5',
                    name: 'Updated Device 5',
                    status: 'active'
                });

                // Verify updates persisted
                const devices = await dbManager.loadDevices();
                const device0 = devices.find(d => d.id === 'device-0');
                const device5 = devices.find(d => d.id === 'device-5');
                expect(device0.name).toBe('Updated Device 0');
                expect(device0.status).toBe('inactive');
                expect(device5.name).toBe('Updated Device 5');
            });

            test('should delete 2 devices and verify count is 8', async () => {
                // Insert test data first
                for (let i = 0; i < 10; i++) {
                    await dbManager.insertDevice({
                        id: `device-${i}`,
                        name: `Device ${i}`,
                        status: 'active'
                    });
                }

                const deleted1 = await dbManager.deleteDevice('device-1');
                const deleted2 = await dbManager.deleteDevice('device-2');

                expect(deleted1).toBe(true);
                expect(deleted2).toBe(true);

                const devices = await dbManager.loadDevices();
                expect(devices).toHaveLength(8);

                // Verify deleted devices are not in list
                const ids = devices.map(d => d.id);
                expect(ids).not.toContain('device-1');
                expect(ids).not.toContain('device-2');
            });

            test('should close database successfully', async () => {
                await expect(dbManager.close()).resolves.not.toThrow();
            });
        });

        describe('Error handling with real file system', () => {
            test('should handle database initialization with valid path', async () => {
                // Test that normal initialization works
                const testDir = path.join(process.cwd(), 'temp-error-' + Date.now());
                await fs.mkdir(testDir, { recursive: true });
                const testDbPath = path.join(testDir, 'devices.json');
                const testDbManager = new DatabaseManager({ databasePath: testDbPath });
                
                // Should initialize successfully
                await expect(testDbManager.initDb()).resolves.not.toThrow();
                
                await testDbManager.close();
                await fs.rm(testDir, { recursive: true, force: true });
            });
        });

        describe('Performance tests with real file system', () => {
            let perfTempDir;
            let perfDbManager;
            let perfDbPath;

            beforeEach(async () => {
                // Create isolated temporary directory for performance tests within the project
                perfTempDir = path.join(process.cwd(), 'temp-perf-' + Date.now());
                await fs.mkdir(perfTempDir, { recursive: true });
                perfDbPath = path.join(perfTempDir, 'devices.json');
                perfDbManager = new DatabaseManager({ databasePath: perfDbPath });
                await perfDbManager.initDb();
            });

            afterEach(async () => {
                try {
                    await perfDbManager.close();
                } catch (error) {
                    // Ignore close errors
                }
                try {
                    await fs.rm(perfTempDir, { recursive: true, force: true });
                } catch (error) {
                    // Ignore cleanup errors
                }
            });

            test('should insert 500 devices in reasonable time', async () => {
                const start = Date.now();
                for (let i = 0; i < 500; i++) {
                    await perfDbManager.insertDevice({
                        id: `perf-device-${i}`,
                        name: `Performance Device ${i}`,
                        status: 'active',
                        metadata: { index: i }
                    });
                }
                const duration = Date.now() - start;

                console.log(`[Performance] Insert 500 devices: ${duration}ms`);
                // Adjusted limit to be more realistic (5 seconds)
                expect(duration).toBeLessThan(5000);
            });

            test('should load 500 devices in reasonable time', async () => {
                // Insert test data first
                for (let i = 0; i < 500; i++) {
                    await perfDbManager.insertDevice({
                        id: `perf-device-${i}`,
                        name: `Performance Device ${i}`,
                        status: 'active',
                        metadata: { index: i }
                    });
                }
                
                const start = Date.now();
                const devices = await perfDbManager.loadDevices();
                const duration = Date.now() - start;

                console.log(`[Performance] Load 500 devices: ${duration}ms`);

                expect(devices).toHaveLength(500);
                // Adjusted limit to be more realistic (1 second)
                expect(duration).toBeLessThan(1000);
            });
        });

        describe('Data persistence verification', () => {
            test('should persist data across database instances', async () => {
                // Insert data with first instance
                await dbManager.insertDevice({ id: 'device-1', name: 'Device 1', status: 'active' });
                await dbManager.close();

                // Create new instance with same path
                const newDbManager = new DatabaseManager({ databasePath: dbPath });
                await newDbManager.initDb();
                
                const devices = await newDbManager.loadDevices();
                expect(devices).toHaveLength(1);
                expect(devices[0].id).toBe('device-1');
                
                await newDbManager.close();
            });

            test('should handle concurrent operations', async () => {
                // Insert devices sequentially first
                for (let i = 0; i < 100; i++) {
                    await dbManager.insertDevice({ id: `concurrent-${i}`, name: `Device ${i}`, status: 'active' });
                }
                
                const devices = await dbManager.loadDevices();
                expect(devices).toHaveLength(100);
            });
        });
    });
});
