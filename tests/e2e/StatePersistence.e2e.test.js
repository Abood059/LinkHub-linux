// tests/e2e/StatePersistence.e2e.test.js
'use strict';

const { runElectronTestApp } = require('./helpers/electronRunner');
const fs = require('fs/promises');
const path = require('path');

describe('State Persistence E2E Tests', () => {
    let testApp;
    let tempDbPath;

    afterEach(async () => {
        if (testApp) {
            await testApp.cleanup();
            testApp = null;
        }
        // Cleanup temp database
        if (tempDbPath) {
            try {
                await fs.unlink(tempDbPath).catch(() => {});
            } catch (error) {
                // Ignore
            }
        }
    });

    // ============================================================================
    // Use Case 21: استمرارية بيانات الأجهزة (Device Data Persistence)
    // ============================================================================
    it('should persist device data across application restarts', async () => {
        // 1. التشغيل الأول
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, dbPath } = testApp;
        const deviceOrchestrator = container.resolve('deviceOrchestrator');
        const databaseManager = container.resolve('databaseManager');
        
        tempDbPath = dbPath;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. إضافة أجهزة وتعيين خصائص
        const mockDevices = [
            { serial: 'persistent-device-1', state: 'device' },
            { serial: 'persistent-device-2', state: 'device' }
        ];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // تعيين خصائص مخصصة
        await deviceOrchestrator.setFavorite('persistent-device-1', true);
        await deviceOrchestrator.setTrusted('persistent-device-2', true);
        await deviceOrchestrator.setCustomName('persistent-device-1', 'My Favorite Phone');
        
        // حفظ البيانات في قاعدة البيانات
        const devices = deviceOrchestrator.getAllDevices();
        await databaseManager.saveDevices(devices.map(d => d.toJSON()));
        
        await testApp.cleanup();
        
        // 3. التشغيل الثاني - استعادة البيانات
        const testApp2 = await runElectronTestApp({ 
            mockAdb: true,
            databasePath: tempDbPath
        });
        const deviceOrchestrator2 = testApp2.container.resolve('deviceOrchestrator');
        const databaseManager2 = testApp2.container.resolve('databaseManager');
        
        // استعادة البيانات من قاعدة البيانات
        const restoredDevices = await databaseManager2.loadDevices();
        
        // 4. التحقق من استعادة البيانات
        expect(restoredDevices).toHaveLength(2);
        
        const device1 = restoredDevices.find(d => d.id === 'persistent-device-1');
        const device2 = restoredDevices.find(d => d.id === 'persistent-device-2');
        
        expect(device1).toBeDefined();
        expect(device2).toBeDefined();
        expect(device1.isFavorite).toBe(true);
        expect(device2.isTrusted).toBe(true);
        expect(device1.customName).toBe('My Favorite Phone');
        
        await testApp2.cleanup();
    });

    // ============================================================================
    // Use Case 22: استمرارية حالة التحميل (Download State Persistence)
    // ============================================================================
    it('should persist download state across application restarts', async () => {
        // 1. التشغيل الأول
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, dbPath, testAPI } = testApp;
        const downloadOrchestrator = container.resolve('downloadOrchestrator');
        const databaseManager = container.resolve('databaseManager');
        
        tempDbPath = dbPath;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 3. بدء تحميل
        const url = 'https://youtube.com/watch?v=test';
        const formatId = '137';
        const deviceId = 'emulator-5554';
        
        const downloadResult = await testAPI.downloads.start(url, formatId, deviceId);
        expect(downloadResult).toBeDefined();
        
        // حفظ حالة التحميل
        const downloadState = {
            processId: downloadResult.processId,
            url,
            formatId,
            deviceId,
            status: 'downloading',
            startTime: new Date().toISOString()
        };
        await databaseManager.saveDownloadState(downloadState);
        
        await testApp.cleanup();
        
        // 4. التشغيل الثاني - استعادة حالة التحميل
        const testApp2 = await runElectronTestApp({ 
            mockAdb: true,
            databasePath: tempDbPath
        });
        const databaseManager2 = testApp2.container.resolve('databaseManager');
        
        // استعادة حالة التحميل
        const restoredState = await databaseManager2.loadDownloadState(downloadResult.processId);
        
        // 5. التحقق من استعادة الحالة
        expect(restoredState).toBeDefined();
        expect(restoredState.processId).toBe(downloadResult.processId);
        expect(restoredState.url).toBe(url);
        expect(restoredState.deviceId).toBe(deviceId);
        
        await testApp2.cleanup();
    });

    // ============================================================================
    // Use Case 23: استمرارية تاريخ النقل (Transfer History Persistence)
    // ============================================================================
    it('should persist transfer history across application restarts', async () => {
        // 1. التشغيل الأول
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, dbPath } = testApp;
        const transferOrchestrator = container.resolve('transferOrchestrator');
        const databaseManager = container.resolve('databaseManager');
        
        tempDbPath = dbPath;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 3. إنشاء سجل نقل
        const transferRecord = {
            transferId: 'transfer-123',
            deviceId: 'emulator-5554',
            localPath: '/tmp/test.mp4',
            remotePath: '/sdcard/Download/test.mp4',
            fileSize: 50000000,
            status: 'completed',
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString()
        };
        await databaseManager.saveTransferRecord(transferRecord);
        
        await testApp.cleanup();
        
        // 4. التشغيل الثاني - استعادة سجل النقل
        const testApp2 = await runElectronTestApp({ 
            mockAdb: true,
            databasePath: tempDbPath
        });
        const databaseManager2 = testApp2.container.resolve('databaseManager');
        
        // استعادة سجل النقل
        const transferHistory = await databaseManager2.getTransferHistory('emulator-5554');
        
        // 5. التحقق من استعادة السجل
        expect(transferHistory).toHaveLength(1);
        expect(transferHistory[0].transferId).toBe('transfer-123');
        expect(transferHistory[0].status).toBe('completed');
        
        await testApp2.cleanup();
    });

    // ============================================================================
    // Use Case 24: استمرارية الإعدادات (Settings Persistence)
    // ============================================================================
    it('should persist user settings across application restarts', async () => {
        // 1. التشغيل الأول
        testApp = await runElectronTestApp({ mockAdb: true });
        const { dbPath } = testApp;
        const databaseManager = testApp.container.resolve('databaseManager');
        
        tempDbPath = dbPath;
        
        // 2. حفظ إعدادات المستخدم
        const userSettings = {
            defaultDownloadPath: '/tmp/downloads',
            defaultTransferPath: '/sdcard/Download',
            maxConcurrentDownloads: 3,
            maxConcurrentTransfers: 2,
            autoDeleteAfterTransfer: false,
            preferredVideoQuality: '1080p'
        };
        await databaseManager.saveSettings(userSettings);
        
        await testApp.cleanup();
        
        // 3. التشغيل الثاني - استعادة الإعدادات
        const testApp2 = await runElectronTestApp({ 
            mockAdb: true,
            databasePath: tempDbPath
        });
        const databaseManager2 = testApp2.container.resolve('databaseManager');
        
        // استعادة الإعدادات
        const restoredSettings = await databaseManager2.loadSettings();
        
        // 4. التحقق من استعادة الإعدادات
        expect(restoredSettings).toBeDefined();
        expect(restoredSettings.defaultDownloadPath).toBe('/tmp/downloads');
        expect(restoredSettings.maxConcurrentDownloads).toBe(3);
        expect(restoredSettings.preferredVideoQuality).toBe('1080p');
        
        await testApp2.cleanup();
    });
});
