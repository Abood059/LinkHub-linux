// tests/e2e/ScreenMirroring.e2e.test.js
'use strict';

const { runElectronTestApp } = require('./helpers/electronRunner');

describe('Screen Mirroring E2E Tests', () => {
    let testApp;

    afterEach(async () => {
        if (testApp) {
            await testApp.cleanup();
            testApp = null;
        }
    });

    // ============================================================================
    // Use Case 17: بدء مرآة الشاشة (Start Screen Mirroring)
    // ============================================================================
    it('should start screen mirroring for a connected device', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        const deviceOrchestrator = container.resolve('deviceOrchestrator');
        const scrcpyAdapter = container.resolve('scrcpyAdapter');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء مرآة الشاشة
        const streamingOptions = {
            bitrate: '8M',
            maxFps: 30,
            crop: '1280:720:0:0'
        };
        
        const streamResult = await testAPI.devices.startStreaming('emulator-5554', streamingOptions);
        
        expect(streamResult).toBeDefined();
        expect(streamResult.processId).toBeDefined();
        expect(streamResult.processId).toMatch(/^scrcpy-\d+$/);
        
        // 3. التحقق من أن العملية نشطة
        const processStatus = scrcpyAdapter.getStreamStatus(streamResult.processId);
        expect(processStatus).toBe('running');
    });

    // ============================================================================
    // Use Case 18: إيقاف مرآة الشاشة (Stop Screen Mirroring)
    // ============================================================================
    it('should stop screen mirroring for a device', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        const deviceOrchestrator = container.resolve('deviceOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء مرآة الشاشة
        const streamResult = await testAPI.devices.startStreaming('emulator-5554', {});
        expect(streamResult).toBeDefined();
        
        // 3. إيقاف مرآة الشاشة
        const stopResult = await testAPI.devices.stopStreaming('emulator-5554');
        expect(stopResult).toBe(true);
        
        // 4. التحقق من أن العملية توقفت
        const scrcpyAdapter = container.resolve('scrcpyAdapter');
        const processStatus = scrcpyAdapter.getStreamStatus(streamResult.processId);
        expect(processStatus).toBeNull();
    });

    // ============================================================================
    // Use Case 19: مرآة شاشة متعددة (Multiple Screen Mirroring Sessions)
    // ============================================================================
    it('should handle multiple screen mirroring sessions simultaneously', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف أجهزة متعددة
        const mockDevices = [
            { serial: 'emulator-5554', state: 'device' },
            { serial: 'emulator-5556', state: 'device' }
        ];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء مرآة الشاشة للأجهزة المتعددة
        const streamPromises = [
            testAPI.devices.startStreaming('emulator-5554', {}),
            testAPI.devices.startStreaming('emulator-5556', {})
        ];
        
        const streamResults = await Promise.all(streamPromises);
        
        // 3. التحقق من أن كل جلسة لها processId فريد
        const processIds = streamResults.map(r => r.processId);
        const uniqueIds = new Set(processIds);
        expect(uniqueIds.size).toBe(2);
        
        // 4. التحقق من أن جميع الجلسات نشطة
        const scrcpyAdapter = container.resolve('scrcpyAdapter');
        for (const processId of processIds) {
            const status = scrcpyAdapter.getStreamStatus(processId);
            expect(status).toBe('running');
        }
        
        // 5. إيقاف جميع الجلسات
        await testAPI.devices.stopStreaming('emulator-5554');
        await testAPI.devices.stopStreaming('emulator-5556');
    });

    // ============================================================================
    // Use Case 20: إعادة تشغيل مرآة الشاشة بعد الفشل (Restart After Failure)
    // ============================================================================
    it('should restart screen mirroring after failure', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        const processSupervisor = container.resolve('processSupervisor');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء مرآة الشاشة
        const streamResult1 = await testAPI.devices.startStreaming('emulator-5554', {});
        expect(streamResult1).toBeDefined();
        
        // 3. محاكاة فشل العملية
        await testAPI.devices.stopStreaming('emulator-5554');
        
        // 4. إعادة بدء مرآة الشاشة
        const streamResult2 = await testAPI.devices.startStreaming('emulator-5554', {});
        
        // 5. التحقق من أن processId جديد
        expect(streamResult2.processId).not.toBe(streamResult1.processId);
        expect(streamResult2).toBeDefined();
        
        // 6. التنظيف
        await testAPI.devices.stopStreaming('emulator-5554');
    });
});
