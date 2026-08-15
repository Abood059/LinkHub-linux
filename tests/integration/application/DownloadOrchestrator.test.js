'use strict';

/**
 * اختبار التحقق من تطابق مخرجات getDownloadHistory()
 * بعد تعديلها للاعتماد على الذاكرة بدلاً من قاعدة البيانات
 */

const DownloadOrchestrator = require('../../../src/main/application/orchestrators/DownloadOrchestrator');
const DownloadManager = require('../../../src/main/infrastructure/media/DownloadManager');

describe('DownloadOrchestrator.getDownloadHistory() - Format Compatibility', () => {
    let downloadOrchestrator;
    let downloadManager;

    beforeEach(() => {
        // إنشاء DownloadManager
        downloadManager = new DownloadManager();

        // إنشاء YtdlpAdapter mock
        const ytdlpAdapter = {
            inspectFormats: jest.fn(),
            extractMetadata: jest.fn(),
            startDownload: jest.fn(),
            stopDownload: jest.fn(),
            stopProcessOnly: jest.fn(),
            getDownloadStatus: jest.fn(),
            findActiveDownload: jest.fn(),
            getDownloadEntry: jest.fn(),
            isProcessRunning: jest.fn(),
            emit: jest.fn(),
            getActiveDownloads: jest.fn(() => downloadManager.getActiveDownloads()),
            _downloadManager: downloadManager
        };

        // إنشاء DownloadOrchestrator
        downloadOrchestrator = new DownloadOrchestrator({
            ytdlpAdapter,
            downloadManager,
            deviceRegistry: null,
            adbPushService: null,
            logger: null
        });
    });

    test('getAllDownloads() returns data in snake_case format matching database schema', () => {
        // إضافة بيانات تجريبية للذاكرة بتنسيق camelCase (داخلي)
        downloadManager._stateManager._activeDownloads.set('download1', {
            url: 'https://example.com/video1',
            formatId: 'best',
            outputPath: '/downloads/video1.mp4',
            deviceId: 'device123',
            title: 'Test Video 1',
            status: 'completed',
            totalSize: 1024000,
            downloadedBytes: 1024000,
            percent: 100,
            speed: 5000,
            eta: null,
            retryCount: 0,
            completedAt: '2024-01-01T12:00:00Z',
            failedAt: null
        });

        downloadManager._stateManager._activeDownloads.set('download2', {
            url: 'https://example.com/video2',
            formatId: '720p',
            outputPath: '/downloads/video2.mp4',
            deviceId: null,
            title: 'Test Video 2',
            status: 'downloading',
            totalSize: 2048000,
            downloadedBytes: 1024000,
            percent: 50,
            speed: 3000,
            eta: 340,
            retryCount: 1,
            completedAt: null,
            failedAt: null
        });

        // استدعاء getAllDownloads()
        const result = downloadManager.getAllDownloads();

        // التحقق من أن النتيجة مصفوفة
        expect(Array.isArray(result)).toBe(true);

        // التحقق من أن جميع العناصر تحتوي على الحقول بتنسيق snake_case
        result.forEach(download => {
            expect(download).toHaveProperty('id');
            expect(download).toHaveProperty('url');
            expect(download).toHaveProperty('format_id'); // snake_case
            expect(download).toHaveProperty('output_path'); // snake_case
            expect(download).toHaveProperty('device_id'); // snake_case
            expect(download).toHaveProperty('title');
            expect(download).toHaveProperty('status');
            expect(download).toHaveProperty('total_size'); // snake_case
            expect(download).toHaveProperty('downloaded_bytes'); // snake_case
            expect(download).toHaveProperty('percent');
            expect(download).toHaveProperty('speed');
            expect(download).toHaveProperty('eta');
            expect(download).toHaveProperty('retry_count'); // snake_case
            expect(download).toHaveProperty('completed_at'); // snake_case
            expect(download).toHaveProperty('failed_at'); // snake_case

            // التحقق من عدم وجود الحقول بتنسيق camelCase
            expect(download).not.toHaveProperty('formatId');
            expect(download).not.toHaveProperty('outputPath');
            expect(download).not.toHaveProperty('deviceId');
            expect(download).not.toHaveProperty('totalSize');
            expect(download).not.toHaveProperty('downloadedBytes');
            expect(download).not.toHaveProperty('retryCount');
        });

        // التحقق من تطابق القيم
        expect(result[0].format_id).toBe('best');
        expect(result[0].output_path).toBe('/downloads/video1.mp4');
        expect(result[0].device_id).toBe('device123');
        expect(result[0].total_size).toBe(1024000);
        expect(result[0].downloaded_bytes).toBe(1024000);
        expect(result[0].retry_count).toBe(0);

        expect(result[1].format_id).toBe('720p');
        expect(result[1].device_id).toBeNull();
        expect(result[1].total_size).toBe(2048000);
        expect(result[1].downloaded_bytes).toBe(1024000);
        expect(result[1].retry_count).toBe(1);
    });

    test('getDownloadHistory() returns data matching database format', () => {
        // إضافة بيانات تجريبية
        downloadManager._stateManager._activeDownloads.set('download1', {
            url: 'https://example.com/video1',
            formatId: 'best',
            outputPath: '/downloads/video1.mp4',
            deviceId: 'device123',
            title: 'Test Video 1',
            status: 'completed',
            totalSize: 1024000,
            downloadedBytes: 1024000,
            percent: 100,
            speed: 5000,
            eta: null,
            retryCount: 0,
            completedAt: '2024-01-01T12:00:00Z',
            failedAt: null
        });

        // استدعاء getDownloadHistory()
        const result = downloadOrchestrator.getDownloadHistory();

        // التحقق من أن النتيجة مصفوفة
        expect(Array.isArray(result)).toBe(true);

        // التحقق من تنسيق البيانات
        expect(result[0]).toHaveProperty('id', 'download1');
        expect(result[0]).toHaveProperty('url', 'https://example.com/video1');
        expect(result[0]).toHaveProperty('format_id', 'best');
        expect(result[0]).toHaveProperty('output_path', '/downloads/video1.mp4');
        expect(result[0]).toHaveProperty('device_id', 'device123');
        expect(result[0]).toHaveProperty('title', 'Test Video 1');
        expect(result[0]).toHaveProperty('status', 'completed');
        expect(result[0]).toHaveProperty('total_size', 1024000);
        expect(result[0]).toHaveProperty('downloaded_bytes', 1024000);
        expect(result[0]).toHaveProperty('percent', 100);
        expect(result[0]).toHaveProperty('speed', 5000);
        expect(result[0]).toHaveProperty('retry_count', 0);
        expect(result[0]).toHaveProperty('completed_at', '2024-01-01T12:00:00Z');
    });

    test('getAllDownloads() handles null values correctly', () => {
        // إضافة بيانات مع قيم null
        downloadManager._stateManager._activeDownloads.set('download1', {
            url: 'https://example.com/video1',
            formatId: 'best',
            outputPath: '/downloads/video1.mp4',
            deviceId: null,
            title: 'Test Video 1',
            status: 'pending',
            totalSize: 0,
            downloadedBytes: 0,
            percent: 0,
            speed: null,
            eta: null,
            retryCount: 0,
            completedAt: null,
            failedAt: null
        });

        const result = downloadManager.getAllDownloads();

        expect(result[0].device_id).toBeNull();
        expect(result[0].speed).toBeNull();
        expect(result[0].eta).toBeNull();
        expect(result[0].completed_at).toBeNull();
        expect(result[0].failed_at).toBeNull();
    });

    test('getAllDownloads() returns results sorted by id (descending)', () => {
        // إضافة بيانات بترتيب عشوائي
        downloadManager._stateManager._activeDownloads.set('download3', {
            url: 'https://example.com/video3',
            formatId: 'best',
            outputPath: '/downloads/video3.mp4',
            deviceId: null,
            title: 'Test Video 3',
            status: 'completed',
            totalSize: 1000,
            downloadedBytes: 1000,
            percent: 100,
            speed: null,
            eta: null,
            retryCount: 0,
            completedAt: null,
            failedAt: null
        });

        downloadManager._stateManager._activeDownloads.set('download1', {
            url: 'https://example.com/video1',
            formatId: 'best',
            outputPath: '/downloads/video1.mp4',
            deviceId: null,
            title: 'Test Video 1',
            status: 'completed',
            totalSize: 1000,
            downloadedBytes: 1000,
            percent: 100,
            speed: null,
            eta: null,
            retryCount: 0,
            completedAt: null,
            failedAt: null
        });

        downloadManager._stateManager._activeDownloads.set('download2', {
            url: 'https://example.com/video2',
            formatId: 'best',
            outputPath: '/downloads/video2.mp4',
            deviceId: null,
            title: 'Test Video 2',
            status: 'completed',
            totalSize: 1000,
            downloadedBytes: 1000,
            percent: 100,
            speed: null,
            eta: null,
            retryCount: 0,
            completedAt: null,
            failedAt: null
        });

        const result = downloadManager.getAllDownloads();

        // التحقق من الترتيب التنازلي
        expect(result[0].id).toBe('download3');
        expect(result[1].id).toBe('download2');
        expect(result[2].id).toBe('download1');
    });
});
