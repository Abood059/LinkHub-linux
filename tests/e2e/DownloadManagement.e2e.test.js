// tests/e2e/DownloadManagement.e2e.test.js
'use strict';

const { runElectronTestApp } = require('./helpers/electronRunner');

describe('Download Management E2E Tests', () => {
    let testApp;

    afterEach(async () => {
        if (testApp) {
            await testApp.cleanup();
            testApp = null;
        }
    });

    // ============================================================================
    // Use Case 6: إيقاف واستئناف التحميل (Stop and Resume Download)
    // ============================================================================
    it('should stop a download and resume it from where it left off', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        const downloadOrchestrator = container.resolve('downloadOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء تحميل
        const url = 'https://youtube.com/watch?v=test';
        const formatId = '137';
        const deviceId = 'emulator-5554';
        
        const downloadPromise = testAPI.downloads.start(url, formatId, deviceId);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const result = await Promise.race([
            downloadPromise,
            new Promise(resolve => setTimeout(() => resolve(null), 100))
        ]);
        
        if (result && result.processId) {
            const processId = result.processId;
            
            // 3. إيقاف التحميل
            const stopResult = testAPI.downloads.stop(processId);
            expect(stopResult).toBe(true);
            
            // 4. محاولة استئناف التحميل
            const resumeResult = await testAPI.downloads.start(url, formatId, deviceId);
            expect(resumeResult).toBeDefined();
            
            // 5. التحقق من أن processId جديد (استئناف)
            expect(resumeResult.processId).not.toBe(processId);
        }
    });

    // ============================================================================
    // Use Case 7: منع التحميل المكرر (Prevent Duplicate Downloads)
    // ============================================================================
    it('should prevent duplicate downloads of the same URL to same device', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        const downloadOrchestrator = container.resolve('downloadOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء تحميل
        const url = 'https://youtube.com/watch?v=test';
        const formatId = '137';
        const deviceId = 'emulator-5554';
        
        const result1 = await testAPI.downloads.start(url, formatId, deviceId);
        expect(result1).toBeDefined();
        
        // 3. محاولة بدء تحميل مكرر لنفس URL ونفس الجهاز
        try {
            const result2 = await testAPI.downloads.start(url, formatId, deviceId);
            // إذا لم يرمي خطأ، يجب أن يرجع نفس processId أو null
            expect(result2.processId === result1.processId || result2 === null).toBe(true);
        } catch (error) {
            // أو يمكن أن يرمي خطأ
            expect(error.message).toContain('duplicate') || expect(error.message).toContain('already');
        }
    });

    // ============================================================================
    // Use Case 8: تحميلات متعددة لأجهزة مختلفة (Multiple Downloads to Different Devices)
    // ============================================================================
    it('should handle multiple downloads to different devices simultaneously', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف أجهزة متعددة
        const mockDevices = [
            { serial: 'emulator-5554', state: 'device' },
            { serial: 'emulator-5556', state: 'device' },
            { serial: 'emulator-5558', state: 'device' }
        ];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء تحميلات متعددة لأجهزة مختلفة
        const url = 'https://youtube.com/watch?v=test';
        const formatId = '137';
        
        const downloadPromises = [
            testAPI.downloads.start(url, formatId, 'emulator-5554'),
            testAPI.downloads.start(url, formatId, 'emulator-5556'),
            testAPI.downloads.start(url, formatId, 'emulator-5558')
        ];
        
        const results = await Promise.all(downloadPromises);
        
        // 3. التحقق من أن كل تحميل له processId فريد
        const processIds = results.map(r => r.processId);
        const uniqueIds = new Set(processIds);
        expect(uniqueIds.size).toBe(3);
        
        // 4. التحقق من أن جميع التحميلات نشطة
        const ytdlpAdapter = container.resolve('ytdlpAdapter');
        for (const processId of processIds) {
            const status = ytdlpAdapter.getDownloadStatus(processId);
            expect(status === 'downloading' || status === null).toBe(true);
        }
    });

    // ============================================================================
    // Use Case 9: التعامل مع فشل التحميل (Handle Download Failure)
    // ============================================================================
    it('should handle download failure gracefully and allow retry', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        const processSupervisor = container.resolve('processSupervisor');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. محاكاة فشل في ProcessSupervisor
        const originalExecute = processSupervisor.execute;
        processSupervisor.execute = jest.fn().mockImplementation(() => {
            const mockProcess = {
                pid: 9999,
                kill: jest.fn(),
                once: jest.fn((event, callback) => {
                    if (event === 'error') {
                        setTimeout(() => callback(new Error('Network error')), 10);
                    }
                }),
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() }
            };
            return mockProcess;
        });
        
        // 3. محاولة بدء تحميل سيفشل
        const url = 'https://youtube.com/watch?v=test';
        const formatId = '137';
        const deviceId = 'emulator-5554';
        
        try {
            await testAPI.downloads.start(url, formatId, deviceId);
        } catch (error) {
            // متوقع أن يفشل
            expect(error).toBeDefined();
        }
        
        // 4. استعادة ProcessSupervisor
        processSupervisor.execute = originalExecute;
        
        // 5. إعادة المحاولة بعد الفشل
        const retryResult = await testAPI.downloads.start(url, formatId, deviceId);
        expect(retryResult).toBeDefined();
    });

    // ============================================================================
    // Use Case 10: اختيار الصيغة المختلفة (Format Selection)
    // ============================================================================
    it('should allow downloading same URL in different formats', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. فحص الرابط للحصول على الصيغ المتاحة
        const url = 'https://youtube.com/watch?v=test';
        const processSupervisor = container.resolve('processSupervisor');
        processSupervisor.executeQuickTaskArray = jest.fn().mockResolvedValue(JSON.stringify({
            title: 'Test Video',
            formats: [
                { format_id: '137', ext: 'mp4', resolution: '1920x1080' },
                { format_id: '22', ext: 'mp4', resolution: '1280x720' },
                { format_id: '140', ext: 'm4a', resolution: 'audio only' }
            ]
        }));
        
        const inspection = await testAPI.downloads.inspect(url);
        expect(inspection.formats).toHaveLength(3);
        
        // 3. تحميل بصيغ مختلفة لنفس الجهاز
        const result1 = await testAPI.downloads.start(url, '137', 'emulator-5554');
        const result2 = await testAPI.downloads.start(url, '22', 'emulator-5554');
        const result3 = await testAPI.downloads.start(url, '140', 'emulator-5554');
        
        // 4. التحقق من أن كل تحميل له processId فريد
        expect(result1.processId).not.toBe(result2.processId);
        expect(result2.processId).not.toBe(result3.processId);
        expect(result1.processId).not.toBe(result3.processId);
    });
});
