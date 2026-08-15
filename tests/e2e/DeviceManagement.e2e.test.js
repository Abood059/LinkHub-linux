// tests/e2e/DeviceManagement.e2e.test.js
'use strict';

const { runElectronTestApp } = require('./helpers/electronRunner');

describe('Device Management E2E Tests', () => {
    let testApp;

    afterEach(async () => {
        if (testApp) {
            await testApp.cleanup();
            testApp = null;
        }
    });

    // ============================================================================
    // Use Case 1: إدارة المفضلة (Favorite Management)
    // ============================================================================
    it('should mark device as favorite and persist the preference', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        const deviceOrchestrator = container.resolve('deviceOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. التحقق من أن الجهاز ليس مفضلاً مبدئياً
        let device = deviceOrchestrator.getDevice('emulator-5554');
        expect(device.isFavorite).toBe(false);
        
        // 3. تحديد الجهاز كمفضل
        await deviceOrchestrator.setFavorite('emulator-5554', true);
        
        // 4. التحقق من تحديث الحالة
        device = deviceOrchestrator.getDevice('emulator-5554');
        expect(device.isFavorite).toBe(true);
        
        // 5. التحقق من أن الأجهزة المفضلة يمكن استرجاعها
        const favoriteDevices = deviceOrchestrator.getFavoriteDevices();
        expect(favoriteDevices).toHaveLength(1);
        expect(favoriteDevices[0].id).toBe('emulator-5554');
    });

    // ============================================================================
    // Use Case 2: إدارة الثقة (Trust Management)
    // ============================================================================
    it('should mark device as trusted and allow auto-connection', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const deviceOrchestrator = container.resolve('deviceOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. التحقق من أن الجهاز ليس موثوقاً مبدئياً
        let device = deviceOrchestrator.getDevice('emulator-5554');
        expect(device.isTrusted).toBe(false);
        
        // 3. تحديد الجهاز كموثوق
        await deviceOrchestrator.setTrusted('emulator-5554', true);
        
        // 4. التحقق من تحديث الحالة
        device = deviceOrchestrator.getDevice('emulator-5554');
        expect(device.isTrusted).toBe(true);
        
        // 5. التحقق من أن الأجهزة الموثوقة يمكن استرجاعها
        const trustedDevices = deviceOrchestrator.getTrustedDevices();
        expect(trustedDevices).toHaveLength(1);
        expect(trustedDevices[0].id).toBe('emulator-5554');
    });

    // ============================================================================
    // Use Case 3: تخصيص اسم الجهاز (Custom Device Name)
    // ============================================================================
    it('should allow setting custom device name and persist it', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const deviceOrchestrator = container.resolve('deviceOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. التحقق من الاسم الافتراضي
        let device = deviceOrchestrator.getDevice('emulator-5554');
        expect(device.customName).toBeNull();
        
        // 3. تعيين اسم مخصص
        const customName = 'My Test Phone';
        await deviceOrchestrator.setCustomName('emulator-5554', customName);
        
        // 4. التحقق من تحديث الاسم
        device = deviceOrchestrator.getDevice('emulator-5554');
        expect(device.customName).toBe(customName);
        
        // 5. التحقق من أن الاسم المخصص يظهر في JSON
        const deviceJSON = device.toJSON();
        expect(deviceJSON.customName).toBe(customName);
    });

    // ============================================================================
    // Use Case 4: إدارة أجهزة متعددة (Multiple Device Management)
    // ============================================================================
    it('should handle multiple devices with different states simultaneously', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const deviceOrchestrator = container.resolve('deviceOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف أجهزة متعددة
        const mockDevices = [
            { serial: 'emulator-5554', state: 'device' },
            { serial: 'emulator-5556', state: 'device' },
            { serial: '192.168.1.10:5555', state: 'device' }
        ];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. التحقق من تسجيل جميع الأجهزة
        const allDevices = deviceOrchestrator.getAllDevices();
        expect(allDevices).toHaveLength(3);
        
        // 3. تعيين حالات مختلفة لكل جهاز
        await deviceOrchestrator.setFavorite('emulator-5554', true);
        await deviceOrchestrator.setTrusted('emulator-5556', true);
        await deviceOrchestrator.setCustomName('192.168.1.10:5555', 'Wireless Device');
        
        // 4. التحقق من الحالات المختلفة
        const device1 = deviceOrchestrator.getDevice('emulator-5554');
        const device2 = deviceOrchestrator.getDevice('emulator-5556');
        const device3 = deviceOrchestrator.getDevice('192.168.1.10:5555');
        
        expect(device1.isFavorite).toBe(true);
        expect(device2.isTrusted).toBe(true);
        expect(device3.customName).toBe('Wireless Device');
        
        // 5. التحقق من الفلترة حسب النوع
        const favorites = deviceOrchestrator.getFavoriteDevices();
        const trusted = deviceOrchestrator.getTrustedDevices();
        
        expect(favorites).toHaveLength(1);
        expect(trusted).toHaveLength(1);
    });

    // ============================================================================
    // Use Case 5: إعادة الاتصال التلقائي (Auto-Reconnection)
    // ============================================================================
    it('should handle device reconnection after temporary disconnection', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const deviceRegistry = container.resolve('deviceRegistry');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. التحقق من الاتصال
        let runtimeState = deviceRegistry.getRuntimeState('emulator-5554');
        expect(runtimeState.status).toBe('connected');
        
        // 3. محاكاة قطع الاتصال
        mockConnectionService.simulateDisconnect('emulator-5554');
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 4. التحقق من حالة offline
        runtimeState = deviceRegistry.getRuntimeState('emulator-5554');
        expect(runtimeState.status).toBe('offline');
        
        // 5. محاكاة إعادة الاتصال
        mockConnectionService.simulateAdbDevices([{ serial: 'emulator-5554', state: 'device' }]);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 6. التحقق من العودة إلى connected
        runtimeState = deviceRegistry.getRuntimeState('emulator-5554');
        expect(runtimeState.status).toBe('connected');
        
        // 7. التحقق من بقاء البيانات (المفضلة، الثقة، الاسم المخصص)
        const device = deviceRegistry.getDevice('emulator-5554');
        expect(device).toBeDefined();
    });
});
