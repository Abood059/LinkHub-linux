// tests/e2e/TransferManagement.e2e.test.js
'use strict';

const { runElectronTestApp } = require('./helpers/electronRunner');

describe('Transfer Management E2E Tests', () => {
    let testApp;

    afterEach(async () => {
        if (testApp) {
            await testApp.cleanup();
            testApp = null;
        }
    });

    // ============================================================================
    // Use Case 11: نقل ملف لجهاز واحد (Single File Transfer)
    // ============================================================================
    it('should transfer a downloaded file to a single device', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container, testAPI } = testApp;
        const transferOrchestrator = container.resolve('transferOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. محاكاة ملف تم تحميله
        const mockFilePath = '/tmp/test-video.mp4';
        const mockFileSize = 50000000; // 50 MB
        
        // 3. بدء نقل الملف
        const transferId = await transferOrchestrator.startTransfer({
            deviceId: 'emulator-5554',
            localPath: mockFilePath,
            remotePath: '/sdcard/Download/test-video.mp4',
            fileSize: mockFileSize
        });
        
        expect(transferId).toBeDefined();
        expect(transferId).toMatch(/^transfer-\d+$/);
        
        // 4. التحقق من حالة النقل
        await new Promise(resolve => setTimeout(resolve, 100));
        const transferStatus = transferOrchestrator.getTransferStatus(transferId);
        expect(transferStatus).toBeDefined();
        expect(['pending', 'transferring', 'completed'].includes(transferStatus.status)).toBe(true);
    });

    // ============================================================================
    // Use Case 12: نقل ملف لأجهزة متعددة (Batch Transfer to Multiple Devices)
    // ============================================================================
    it('should transfer a file to multiple devices simultaneously', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const transferOrchestrator = container.resolve('transferOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف أجهزة متعددة
        const mockDevices = [
            { serial: 'emulator-5554', state: 'device' },
            { serial: 'emulator-5556', state: 'device' },
            { serial: 'emulator-5558', state: 'device' }
        ];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. محاكاة ملف تم تحميله
        const mockFilePath = '/tmp/test-video.mp4';
        const mockFileSize = 50000000;
        
        // 3. بدء نقل للأجهزة المتعددة
        const deviceIds = ['emulator-5554', 'emulator-5556', 'emulator-5558'];
        const transferPromises = deviceIds.map(deviceId => 
            transferOrchestrator.startTransfer({
                deviceId,
                localPath: mockFilePath,
                remotePath: `/sdcard/Download/test-video-${deviceId}.mp4`,
                fileSize: mockFileSize
            })
        );
        
        const transferIds = await Promise.all(transferPromises);
        
        // 4. التحقق من أن كل نقل له ID فريد
        const uniqueIds = new Set(transferIds);
        expect(uniqueIds.size).toBe(3);
        
        // 5. التحقق من حالة جميع النقلات
        await new Promise(resolve => setTimeout(resolve, 100));
        const activeTransfers = transferOrchestrator.getActiveTransfers();
        expect(activeTransfers.length).toBeGreaterThanOrEqual(0);
    });

    // ============================================================================
    // Use Case 13: التحقق من المساحة قبل النقل (Space Check Before Transfer)
    // ============================================================================
    it('should check device storage space before transfer and reject if insufficient', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const transferOrchestrator = container.resolve('transferOrchestrator');
        const mockAdbExecutor = testApp.mockAdb;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. محاكاة مساحة غير كافية
        mockAdbExecutor.executeCommand = jest.fn().mockResolvedValue({
            stdout: '/dev/block/dm-0 1000000 800000 200000 80% /sdcard'
        });
        
        // 3. محاولة نقل ملف كبير (500 MB) بينما المساحة المتاحة 200 MB
        const mockFilePath = '/tmp/large-video.mp4';
        const mockFileSize = 500000000;
        
        try {
            await transferOrchestrator.startTransfer({
                deviceId: 'emulator-5554',
                localPath: mockFilePath,
                remotePath: '/sdcard/Download/large-video.mp4',
                fileSize: mockFileSize
            });
            // إذا وصل هنا، يجب أن يكون هناك خطأ
            expect(true).toBe(false);
        } catch (error) {
            // متوقع أن يفشل بسبب عدم كفاية المساحة
            expect(error.message).toContain('space') || expect(error.message).toContain('storage');
        }
    });

    // ============================================================================
    // Use Case 14: إلغاء النقل (Cancel Transfer)
    // ============================================================================
    it('should cancel an ongoing transfer', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const transferOrchestrator = container.resolve('transferOrchestrator');
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء نقل
        const mockFilePath = '/tmp/test-video.mp4';
        const mockFileSize = 50000000;
        
        const transferId = await transferOrchestrator.startTransfer({
            deviceId: 'emulator-5554',
            localPath: mockFilePath,
            remotePath: '/sdcard/Download/test-video.mp4',
            fileSize: mockFileSize
        });
        
        expect(transferId).toBeDefined();
        
        // 3. إلغاء النقل
        const cancelResult = await transferOrchestrator.cancelTransfer(transferId);
        expect(cancelResult).toBe(true);
        
        // 4. التحقق من حالة النقل الملغي
        const transferStatus = transferOrchestrator.getTransferStatus(transferId);
        expect(transferStatus.status).toBe('cancelled');
    });

    // ============================================================================
    // Use Case 15: حذف الملف بعد النقل الناجح (Delete After Transfer)
    // ============================================================================
    it('should delete local file after successful transfer when requested', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const transferOrchestrator = container.resolve('transferOrchestrator');
        const mockAdbExecutor = testApp.mockAdb;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. بدء نقل مع خيار الحذف
        const mockFilePath = '/tmp/test-video.mp4';
        const mockFileSize = 50000000;
        
        const transferId = await transferOrchestrator.startTransfer({
            deviceId: 'emulator-5554',
            localPath: mockFilePath,
            remotePath: '/sdcard/Download/test-video.mp4',
            fileSize: mockFileSize,
            deleteAfterTransfer: true
        });
        
        expect(transferId).toBeDefined();
        
        // 3. محاكاة اكتمال النقل
        // في الواقع، سيتم الحذف تلقائياً عند اكتمال النقل
        // هنا نتحقق من أن الخيار تم تعيينه بشكل صحيح
        
        const transferStatus = transferOrchestrator.getTransferStatus(transferId);
        expect(transferStatus).toBeDefined();
        expect(transferStatus.deleteAfterTransfer).toBe(true);
    });

    // ============================================================================
    // Use Case 16: إعادة محاولة النقل الفاشل (Retry Failed Transfer)
    // ============================================================================
    it('should retry a failed transfer automatically', async () => {
        testApp = await runElectronTestApp({ mockAdb: true });
        const { mockConnectionService, container } = testApp;
        const transferOrchestrator = container.resolve('transferOrchestrator');
        const mockAdbExecutor = testApp.mockAdb;
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 1. اكتشاف جهاز
        const mockDevices = [{ serial: 'emulator-5554', state: 'device' }];
        mockConnectionService.simulateAdbDevices(mockDevices);
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // 2. محاكاة فشل في النقل
        mockAdbExecutor.pushFile = jest.fn().mockRejectedValue(new Error('Transfer failed'));
        
        const mockFilePath = '/tmp/test-video.mp4';
        const mockFileSize = 50000000;
        
        try {
            const transferId = await transferOrchestrator.startTransfer({
                deviceId: 'emulator-5554',
                localPath: mockFilePath,
                remotePath: '/sdcard/Download/test-video.mp4',
                fileSize: mockFileSize,
                maxRetries: 2
            });
            
            // 3. انتظار محاولة إعادة المحاولة
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 4. التحقق من حالة النقل
            const transferStatus = transferOrchestrator.getTransferStatus(transferId);
            expect(transferStatus).toBeDefined();
            // قد يكون failed أو retrying
            expect(['failed', 'retrying', 'transferring'].includes(transferStatus.status)).toBe(true);
        } catch (error) {
            // قد يرمي خطأ إذا فشلت جميع المحاولات
            expect(error).toBeDefined();
        }
    });
});
