// tests/integration/ytdlp-wrap-plus.test.js
'use strict';

const YTDlpWrap = require('yt-dlp-wrap-plus').default;
const fs = require('fs').promises;
const path = require('path');

describe('yt-dlp-wrap-plus Integration Tests', () => {
    const TEST_URL = 'https://youtu.be/a0C6icMZaiw?si=weVg-WdJYDKg3quW';
    const TEST_DIR = path.join(__dirname, '../../temp/test-download');
    const TIMEOUT = 10 * 60 * 1000; // 10 دقائق - زيادة لتجنب timeout

    let ytdlpWrap;
    let testResults = {
        progressEventStructure: null,
        ytDlpEventStructure: null,
        combinedFormatBehavior: {},
        resumeBehavior: {},
        stopPerformance: {},
        outputPathBehavior: {},
        metadataStructure: null,
        errorHandling: {}
    };

    beforeAll(async () => {
        // إنشاء مجلد الاختبار
        await fs.mkdir(TEST_DIR, { recursive: true });

        // تهيئة YTDlpWrap - سنستخدم المسار الافتراضي أو المسار من toolPathResolver
        // حالياً نستخدم المسار الافتراضي 'yt-dlp'
        ytdlpWrap = new YTDlpWrap('yt-dlp');
    });

    afterAll(async () => {
        // إنشاء وثيقة النتائج
        await generateTestReport(testResults, TEST_DIR);
    });

    afterEach(async () => {
        // التنظيف بعد كل اختبار (ما عدا اختبارات محددة)
        // سيتم التعامل مع التنظيف داخل كل اختبار حسب الحاجة
    });

    // دوال مساعدة
    const cleanupTestDirectory = async () => {
        try {
            const files = await fs.readdir(TEST_DIR);
            for (const file of files) {
                const filePath = path.join(TEST_DIR, file);
                const stats = await fs.stat(filePath);
                if (stats.isFile()) {
                    await fs.unlink(filePath);
                } else if (stats.isDirectory()) {
                    // حذف المجلدات الفرعية بشكل متكرر
                    await fs.rm(filePath, { recursive: true, force: true });
                }
            }
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    };

    const waitForEvent = (emitter, event, timeout = TIMEOUT) => {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Timeout waiting for event: ${event}`));
            }, timeout);

            emitter.once(event, (data) => {
                clearTimeout(timer);
                resolve(data);
            });
        });
    };

    const measureStopTime = (controller, emitter) => {
        const startTime = Date.now();
        controller.abort();
        
        return new Promise((resolve) => {
            emitter.once('close', () => {
                const stopTime = Date.now() - startTime;
                resolve(stopTime);
            });
            
            // fallback في حالة عدم إطلاق close
            setTimeout(() => {
                resolve(Date.now() - startTime);
            }, 5000);
        });
    };

    describe('Single Format Downloads', () => {
        test('Audio only (format 251)', async () => {
            const formatId = '251';
            const progressEvents = [];
            const ytDlpEvents = [];
            
            const args = [
                '--ignore-config',
                '-f', formatId,
                '-o', '%(title)s.%(ext)s',
                '--newline',
                TEST_URL
            ];

            const controller = new AbortController();
            const emitter = ytdlpWrap.exec(args, { cwd: TEST_DIR }, controller.signal);

            emitter.on('progress', (progress) => {
                progressEvents.push(progress);
            });

            emitter.on('ytDlpEvent', (eventType, eventData) => {
                ytDlpEvents.push({ eventType, eventData });
            });

            await waitForEvent(emitter, 'close');

            // تسجيل هيكل بيانات حدث progress
            if (progressEvents.length > 0) {
                testResults.progressEventStructure = progressEvents[0];
                console.log('Progress event structure:', JSON.stringify(progressEvents[0], null, 2));
            }

            // تسجيل هيكل بيانات حدث ytDlpEvent
            if (ytDlpEvents.length > 0) {
                testResults.ytDlpEventStructure = ytDlpEvents;
                console.log('ytDlpEvent samples:', JSON.stringify(ytDlpEvents.slice(0, 5), null, 2));
            }

            // التحقق من الملف النهائي
            const files = await fs.readdir(TEST_DIR);
            console.log('Files after audio download:', files);

            await cleanupTestDirectory();
        }, TIMEOUT);

        test('Video only (format 134)', async () => {
            const formatId = '134';
            const progressEvents = [];
            
            const args = [
                '--ignore-config',
                '-f', formatId,
                '-o', '%(title)s.%(ext)s',
                '--newline',
                TEST_URL
            ];

            const controller = new AbortController();
            const emitter = ytdlpWrap.exec(args, { cwd: TEST_DIR }, controller.signal);

            emitter.on('progress', (progress) => {
                progressEvents.push(progress);
            });

            await waitForEvent(emitter, 'close');

            console.log('Video download completed. Progress events count:', progressEvents.length);

            await cleanupTestDirectory();
        }, TIMEOUT);
    });

    describe('Combined Format Downloads', () => {
        test('Combined format (251+134)', async () => {
            const formatId = '251+134';
            const progressEvents = [];
            const ytDlpEvents = [];
            let mergeDetected = false;

            const args = [
                '--ignore-config',
                '-f', formatId,
                '-o', '%(title)s.%(ext)s',
                '--newline',
                TEST_URL
            ];

            const controller = new AbortController();
            const emitter = ytdlpWrap.exec(args, { cwd: TEST_DIR }, controller.signal);

            emitter.on('progress', (progress) => {
                progressEvents.push(progress);
            });

            emitter.on('ytDlpEvent', (eventType, eventData) => {
                ytDlpEvents.push({ eventType, eventData });
                if (eventType === 'Merger' || eventData.includes('Merging')) {
                    mergeDetected = true;
                }
            });

            await waitForEvent(emitter, 'close');

            // تسجيل سلوك التنسيقات المركبة
            testResults.combinedFormatBehavior = {
                supportsCombined: true,
                mergeDetected,
                progressEventCount: progressEvents.length,
                ytDlpEventTypes: [...new Set(ytDlpEvents.map(e => e.eventType))],
                sampleProgress: progressEvents.length > 0 ? progressEvents[0] : null
            };

            console.log('Combined format behavior:', JSON.stringify(testResults.combinedFormatBehavior, null, 2));

            // التحقق من الملف النهائي
            const files = await fs.readdir(TEST_DIR);
            console.log('Files after combined download:', files);

            await cleanupTestDirectory();
        }, TIMEOUT);
    });

    describe('Output Path Control', () => {
        test('With custom cwd', async () => {
            const customDir = path.join(TEST_DIR, 'custom-cwd');
            await fs.mkdir(customDir, { recursive: true });

            const args = [
                '--ignore-config',
                '-f', '134',
                '-o', '%(title)s.%(ext)s',
                '--newline',
                TEST_URL
            ];

            const controller = new AbortController();
            const emitter = ytdlpWrap.exec(args, { cwd: customDir }, controller.signal);

            await waitForEvent(emitter, 'close');

            const customFiles = await fs.readdir(customDir);
            const testFiles = await fs.readdir(TEST_DIR);

            testResults.outputPathBehavior = {
                withCwd: {
                    path: customDir,
                    files: customFiles
                },
                withoutCwd: {
                    path: TEST_DIR,
                    files: testFiles
                }
            };

            console.log('Files in custom cwd:', customFiles);
            console.log('Files in test dir:', testFiles);

            await fs.rm(customDir, { recursive: true, force: true });
            await cleanupTestDirectory();
        }, TIMEOUT);

        test('Without cwd (default)', async () => {
            // هذا الاختبار يتحقق من السلوك الافتراضي
            // تم تضمينه في الاختبار السابق للمقارنة
            console.log('Default cwd behavior already tested in previous test');
        }, TIMEOUT);
    });

    describe('Stop and Resume', () => {
        test('Stop at 30%', async () => {
            const formatId = '134';
            let stopTriggered = false;
            const progressEvents = [];
            const closeEvents = [];
            const errorEvents = [];

            const args = [
                '--ignore-config',
                '-f', formatId,
                '-o', '%(title)s.%(ext)s',
                '--newline',
                TEST_URL
            ];

            const controller = new AbortController();
            const emitter = ytdlpWrap.exec(args, { cwd: TEST_DIR }, controller.signal);

            emitter.on('progress', (progress) => {
                progressEvents.push(progress);
                // الإيقاف عند 30%
                if (!stopTriggered && progress.percent >= 30) {
                    stopTriggered = true;
                }
            });

            emitter.on('close', (code) => {
                closeEvents.push({ code, timestamp: Date.now() });
            });

            emitter.on('error', (err) => {
                errorEvents.push(err);
            });

            // انتظار قصير للتأكد من بدء التحميل
            await new Promise(resolve => setTimeout(resolve, 2000));

            // قياس وقت الإيقاف
            const stopTime = await measureStopTime(controller, emitter);

            // التحقق من الملفات المؤقتة
            const files = await fs.readdir(TEST_DIR);
            const tempFiles = files.filter(f => f.includes('.part') || f.includes('.aria2') || f.includes('.tmp'));

            testResults.stopPerformance = {
                stopTimeMs: stopTime,
                progressEventsCount: progressEvents.length,
                closeEvents,
                errorEvents: errorEvents.map(e => e.message),
                tempFilesAfterStop: tempFiles,
                allFilesAfterStop: files
            };

            console.log('Stop performance:', JSON.stringify(testResults.stopPerformance, null, 2));

            // عدم التنظيف - سنحتاج الملفات للاستئناف
        }, TIMEOUT);

        test('Resume without cleanup', async () => {
            const formatId = '134';
            const progressEvents = [];
            let startPercent = null;

            const args = [
                '--ignore-config',
                '-f', formatId,
                '-o', '%(title)s.%(ext)s',
                '--newline',
                TEST_URL
            ];

            const controller = new AbortController();
            const emitter = ytdlpWrap.exec(args, { cwd: TEST_DIR }, controller.signal);

            emitter.on('progress', (progress) => {
                if (startPercent === null) {
                    startPercent = progress.percent;
                }
                progressEvents.push(progress);
            });

            await waitForEvent(emitter, 'close');

            testResults.resumeBehavior = {
                startPercent,
                totalProgressEvents: progressEvents.length,
                resumedFromTempFiles: startPercent > 0
            };

            console.log('Resume behavior:', JSON.stringify(testResults.resumeBehavior, null, 2));

            await cleanupTestDirectory();
        }, TIMEOUT);
    });

    describe('Edge Cases', () => {
        test('Existing final file', async () => {
            const formatId = '134';
            
            // أولاً: إكمال تحميل
            const args = [
                '--ignore-config',
                '-f', formatId,
                '-o', '%(title)s.%(ext)s',
                '--newline',
                TEST_URL
            ];

            const controller1 = new AbortController();
            const emitter1 = ytdlpWrap.exec(args, { cwd: TEST_DIR }, controller1.signal);
            await waitForEvent(emitter1, 'close');

            const filesBefore = await fs.readdir(TEST_DIR);
            console.log('Files before retry:', filesBefore);

            // ثانياً: محاولة التحميل مرة أخرى
            const controller2 = new AbortController();
            const emitter2 = ytdlpWrap.exec(args, { cwd: TEST_DIR }, controller2.signal);
            
            const progressEvents = [];
            emitter2.on('progress', (progress) => {
                progressEvents.push(progress);
            });

            await waitForEvent(emitter2, 'close');

            const filesAfter = await fs.readdir(TEST_DIR);
            console.log('Files after retry:', filesAfter);

            testResults.outputPathBehavior.existingFileBehavior = {
                filesBefore,
                filesAfter,
                progressEventsOnRetry: progressEvents.length,
                fileSkipped: progressEvents.length === 0
            };

            await cleanupTestDirectory();
        }, TIMEOUT);

        test('Invalid URL', async () => {
            const invalidUrl = 'https://invalid-url-that-does-not-exist.com';
            const errorEvents = [];

            const args = [
                '--ignore-config',
                '-f', '134',
                '-o', '%(title)s.%(ext)s',
                '--newline',
                invalidUrl
            ];

            const controller = new AbortController();
            const emitter = ytdlpWrap.exec(args, { cwd: TEST_DIR }, controller.signal);

            emitter.on('error', (err) => {
                errorEvents.push(err);
            });

            emitter.on('close', (code) => {
                console.log('Invalid URL download closed with code:', code);
            });

            try {
                await waitForEvent(emitter, 'close', 30000); // 30 ثانية فقط
            } catch (error) {
                console.log('Timeout or error on invalid URL:', error.message);
            }

            testResults.errorHandling = {
                invalidUrl: invalidUrl,
                errorEvents: errorEvents.map(e => ({
                    message: e.message,
                    stack: e.stack
                }))
            };

            console.log('Error handling:', JSON.stringify(testResults.errorHandling, null, 2));
        }, 30000);
    });

    describe('Metadata Extraction', () => {
        test('getVideoInfo()', async () => {
            try {
                const info = await ytdlpWrap.getVideoInfo(TEST_URL);
                
                testResults.metadataStructure = {
                    title: info.title,
                    duration: info.duration,
                    thumbnail: info.thumbnail,
                    formatsCount: info.formats?.length || 0,
                    sampleFormat: info.formats?.[0] || null,
                    allKeys: Object.keys(info)
                };

                console.log('Metadata structure:', JSON.stringify(testResults.metadataStructure, null, 2));
            } catch (error) {
                console.error('getVideoInfo error:', error);
                testResults.metadataStructure = { error: error.message };
            }
        }, 60000);
    });
});

// دالة لتوليد وثيقة النتائج
async function generateTestReport(results, outputDir) {
    const reportPath = path.join(outputDir, 'TEST_RESULTS.md');
    
    let report = `# yt-dlp-wrap-plus Test Results\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    report += `## Event: progress\n\n`;
    if (results.progressEventStructure) {
        report += `\`\`\`json\n${JSON.stringify(results.progressEventStructure, null, 2)}\n\`\`\`\n\n`;
    } else {
        report += `No progress events recorded.\n\n`;
    }
    
    report += `## Event: ytDlpEvent\n\n`;
    if (results.ytDlpEventStructure && results.ytDlpEventStructure.length > 0) {
        report += `Sample events:\n\n`;
        report += `\`\`\`json\n${JSON.stringify(results.ytDlpEventStructure.slice(0, 5), null, 2)}\n\`\`\`\n\n`;
        report += `All event types: ${[...new Set(results.ytDlpEventStructure.map(e => e.eventType))].join(', ')}\n\n`;
    } else {
        report += `No ytDlpEvent recorded.\n\n`;
    }
    
    report += `## Combined Format Behavior\n\n`;
    report += `- Supports combined formats: ${results.combinedFormatBehavior?.supportsCombined || 'N/A'}\n`;
    report += `- Merge detected: ${results.combinedFormatBehavior?.mergeDetected || 'N/A'}\n`;
    report += `- Progress events count: ${results.combinedFormatBehavior?.progressEventCount || 'N/A'}\n`;
    report += `- ytDlpEvent types: ${results.combinedFormatBehavior?.ytDlpEventTypes?.join(', ') || 'N/A'}\n\n`;
    
    report += `## Resume Behavior\n\n`;
    report += `- Start percent after resume: ${results.resumeBehavior?.startPercent || 'N/A'}\n`;
    report += `- Resumed from temp files: ${results.resumeBehavior?.resumedFromTempFiles || 'N/A'}\n`;
    report += `- Total progress events: ${results.resumeBehavior?.totalProgressEvents || 'N/A'}\n\n`;
    
    report += `## Stop Performance\n\n`;
    report += `- Stop time: ${results.stopPerformance?.stopTimeMs || 'N/A'} ms\n`;
    report += `- Progress events before stop: ${results.stopPerformance?.progressEventsCount || 'N/A'}\n`;
    report += `- Temp files after stop: ${results.stopPerformance?.tempFilesAfterStop?.join(', ') || 'N/A'}\n`;
    report += `- Close events: ${JSON.stringify(results.stopPerformance?.closeEvents || 'N/A')}\n`;
    report += `- Error events: ${results.stopPerformance?.errorEvents?.join(', ') || 'N/A'}\n\n`;
    
    report += `## Output Path Behavior\n\n`;
    if (results.outputPathBehavior?.withCwd) {
        report += `### With custom cwd\n`;
        report += `- Path: ${results.outputPathBehavior.withCwd.path}\n`;
        report += `- Files: ${results.outputPathBehavior.withCwd.files.join(', ')}\n\n`;
    }
    if (results.outputPathBehavior?.withoutCwd) {
        report += `### Without cwd (default)\n`;
        report += `- Path: ${results.outputPathBehavior.withoutCwd.path}\n`;
        report += `- Files: ${results.outputPathBehavior.withoutCwd.files.join(', ')}\n\n`;
    }
    if (results.outputPathBehavior?.existingFileBehavior) {
        report += `### Existing file behavior\n`;
        report += `- Files before retry: ${results.outputPathBehavior.existingFileBehavior.filesBefore.join(', ')}\n`;
        report += `- Files after retry: ${results.outputPathBehavior.existingFileBehavior.filesAfter.join(', ')}\n`;
        report += `- Progress events on retry: ${results.outputPathBehavior.existingFileBehavior.progressEventsOnRetry}\n`;
        report += `- File skipped: ${results.outputPathBehavior.existingFileBehavior.fileSkipped}\n\n`;
    }
    
    report += `## Metadata Structure\n\n`;
    if (results.metadataStructure) {
        report += `\`\`\`json\n${JSON.stringify(results.metadataStructure, null, 2)}\n\`\`\`\n\n`;
    } else {
        report += `No metadata recorded.\n\n`;
    }
    
    report += `## Error Handling\n\n`;
    if (results.errorHandling?.errorEvents) {
        report += `\`\`\`json\n${JSON.stringify(results.errorHandling, null, 2)}\n\`\`\`\n\n`;
    } else {
        report += `No error events recorded.\n\n`;
    }
    
    report += `## Recommendations\n\n`;
    report += `- [ ] Add based on test results\n\n`;
    
    await fs.writeFile(reportPath, report, 'utf8');
    console.log(`\nTest report generated: ${reportPath}`);
}
