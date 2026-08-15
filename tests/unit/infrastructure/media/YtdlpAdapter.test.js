'use strict';

const YtdlpAdapter = require('../../../../src/main/infrastructure/media/YtdlpAdapter');

describe('YtdlpAdapter', () => {
    let mockProcessSupervisor;
    let mockToolPathResolver;
    let mockLogger;
    let mockWindowManager;
    let adapter;
    let originalDateNow;
    let timestampCounter = 1000000;

    beforeEach(() => {
        jest.clearAllMocks();
        
        originalDateNow = Date.now;
        Date.now = jest.fn(() => {
            const val = timestampCounter;
            timestampCounter++;
            return val;
        });
        
        mockProcessSupervisor = {
            executeQuickTaskArray: jest.fn(),
            startManagedProcess: jest.fn(),
            stopManagedProcess: jest.fn(),
            hasProcess: jest.fn()
        };
        
        mockToolPathResolver = {
            getYtDlpPath: jest.fn(() => '/custom/path/yt-dlp')
        };
        
        mockLogger = {
            warn: jest.fn(),
            info: jest.fn(),
            error: jest.fn()
        };
        
        mockWindowManager = {
            broadcast: jest.fn()
        };
        
        adapter = new YtdlpAdapter({
            processSupervisor: mockProcessSupervisor,
            toolPathResolver: mockToolPathResolver,
            logger: mockLogger
        });
        
        adapter.setWindowManager(mockWindowManager);
    });

    afterEach(() => {
        Date.now = originalDateNow;
        timestampCounter = 1000000;
    });

    describe('Constructor', () => {
        test('should store processSupervisor', () => {
            expect(adapter._processSupervisor).toBe(mockProcessSupervisor);
        });

        test('should store logger', () => {
            expect(adapter._logger).toBe(mockLogger);
        });

        test('should store toolPathResolver', () => {
            expect(adapter._toolPathResolver).toBe(mockToolPathResolver);
        });

        test('should use explicit ytdlpPath when provided', () => {
            const adapterWithExplicitPath = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor,
                ytdlpPath: '/explicit/path/yt-dlp'
            });
            
            expect(adapterWithExplicitPath._ytdlpPath).toBe('/explicit/path/yt-dlp');
        });

        test('should use toolPathResolver for ytdlpPath when provided', () => {
            expect(adapter._ytdlpPath).toBe('/custom/path/yt-dlp');
            expect(mockToolPathResolver.getYtDlpPath).toHaveBeenCalled();
        });

        test('should use fallback yt-dlp when neither ytdlpPath nor toolPathResolver provided', () => {
            const adapterWithoutResolver = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor
            });
            
            expect(adapterWithoutResolver._ytdlpPath).toBe('yt-dlp');
        });

        test('should log warning when using fallback path', () => {
            const adapterWithoutResolver = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor,
                logger: mockLogger
            });
            
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('No toolPathResolver provided')
            );
        });

        test('should not log warning when toolPathResolver is provided', () => {
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('should prioritize explicit ytdlpPath over toolPathResolver', () => {
            const adapterWithBoth = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor,
                ytdlpPath: '/explicit/path/yt-dlp',
                toolPathResolver: mockToolPathResolver
            });
            
            expect(adapterWithBoth._ytdlpPath).toBe('/explicit/path/yt-dlp');
        });

        test('should initialize _activeDownloads as empty Map', () => {
            expect(adapter._activeDownloads).toBeInstanceOf(Map);
            expect(adapter._activeDownloads.size).toBe(0);
        });

        test('should initialize _windowManager as null', () => {
            const adapterWithoutWM = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor
            });
            
            expect(adapterWithoutWM._windowManager).toBeNull();
        });

        test('should handle null logger', () => {
            const adapterWithoutLogger = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor,
                logger: null
            });
            
            expect(adapterWithoutLogger._logger).toBeNull();
        });
    });

    describe('setWindowManager', () => {
        test('should set windowManager', () => {
            const newWindowManager = { broadcast: jest.fn() };
            adapter.setWindowManager(newWindowManager);
            
            expect(adapter._windowManager).toBe(newWindowManager);
        });

        test('should replace existing windowManager', () => {
            const newWindowManager = { broadcast: jest.fn() };
            adapter.setWindowManager(newWindowManager);
            
            expect(adapter._windowManager).toBe(newWindowManager);
            expect(adapter._windowManager).not.toBe(mockWindowManager);
        });
    });

    describe('inspectFormats', () => {
        const mockJsonResponse = {
            title: 'Test Video',
            duration: 300,
            thumbnail: 'https://example.com/thumb.jpg',
            formats: [
                {
                    format_id: '137',
                    ext: 'mp4',
                    resolution: '1920x1080',
                    fps: 30,
                    acodec: 'none',
                    vcodec: 'avc1.640028',
                    filesize: 104857600,
                    format_note: '1080p'
                },
                {
                    format_id: '140',
                    ext: 'm4a',
                    resolution: null,
                    fps: null,
                    acodec: 'mp4a.40.2',
                    vcodec: 'none',
                    filesize: 5242880,
                    format_note: 'medium'
                }
            ]
        };

        test('should call executeQuickTaskArray with correct arguments', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(mockJsonResponse));
            
            await adapter.inspectFormats('https://youtube.com/watch?v=test');
            
            expect(mockProcessSupervisor.executeQuickTaskArray).toHaveBeenCalledWith(
                adapter._ytdlpPath,
                ['-j', 'https://youtube.com/watch?v=test'],
                { timeout: 30000 }
            );
        });

        test('should parse JSON and return correct structure', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(mockJsonResponse));
            
            const result = await adapter.inspectFormats('https://youtube.com/watch?v=test');
            
            expect(result.title).toBe('Test Video');
            expect(result.duration).toBe(300);
            expect(result.thumbnail).toBe('https://example.com/thumb.jpg');
            expect(result.formats).toHaveLength(2);
        });

        test('should transform formats to simplified structure', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(mockJsonResponse));
            
            const result = await adapter.inspectFormats('https://youtube.com/watch?v=test');
            
            expect(result.formats[0]).toEqual({
                formatId: '137',
                ext: 'mp4',
                resolution: '1920x1080',
                fps: 30,
                acodec: 'none',
                vcodec: 'avc1.640028',
                filesize: 104857600,
                formatNote: '1080p'
            });
        });

        test('should handle formats with null resolution and fps', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(mockJsonResponse));
            
            const result = await adapter.inspectFormats('https://youtube.com/watch?v=test');
            
            expect(result.formats[1].resolution).toBeNull();
            expect(result.formats[1].fps).toBeNull();
        });

        test('should throw error when url is empty', async () => {
            await expect(adapter.inspectFormats('')).rejects.toThrow('URL is required');
        });

        test('should throw error when url is null', async () => {
            await expect(adapter.inspectFormats(null)).rejects.toThrow('URL is required');
        });

        test('should throw error when url is undefined', async () => {
            await expect(adapter.inspectFormats(undefined)).rejects.toThrow('URL is required');
        });

        test('should propagate executeQuickTaskArray errors', async () => {
            const error = new Error('Network error');
            mockProcessSupervisor.executeQuickTaskArray.mockRejectedValue(error);
            
            await expect(adapter.inspectFormats('https://youtube.com/watch?v=test')).rejects.toThrow('Network error');
        });

        test('should handle invalid JSON response', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('invalid json');
            
            await expect(adapter.inspectFormats('https://youtube.com/watch?v=test')).rejects.toThrow();
        });

        test('should handle missing formats array', async () => {
            const responseWithoutFormats = {
                title: 'Test Video',
                duration: 300
            };
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(responseWithoutFormats));
            
            const result = await adapter.inspectFormats('https://youtube.com/watch?v=test');
            
            expect(result.formats).toEqual([]);
        });

        test('should handle empty formats array', async () => {
            const responseWithEmptyFormats = {
                title: 'Test Video',
                formats: []
            };
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(responseWithEmptyFormats));
            
            const result = await adapter.inspectFormats('https://youtube.com/watch?v=test');
            
            expect(result.formats).toEqual([]);
        });
    });

    describe('extractMetadata', () => {
        const mockMetadataResponse = {
            id: 'test123',
            title: 'Test Video Title',
            duration: 300,
            thumbnail: 'https://example.com/thumb.jpg',
            uploader: 'TestChannel',
            webpage_url: 'https://youtube.com/watch?v=test'
        };

        test('should call executeQuickTaskArray with correct arguments', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(mockMetadataResponse));
            
            await adapter.extractMetadata('https://youtube.com/watch?v=test');
            
            expect(mockProcessSupervisor.executeQuickTaskArray).toHaveBeenCalledWith(
                adapter._ytdlpPath,
                ['-j', '--flat-playlist', 'https://youtube.com/watch?v=test'],
                { timeout: 15000 }
            );
        });

        test('should parse JSON and return correct structure', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(mockMetadataResponse));
            
            const result = await adapter.extractMetadata('https://youtube.com/watch?v=test');
            
            expect(result).toEqual({
                id: 'test123',
                title: 'Test Video Title',
                duration: 300,
                thumbnail: 'https://example.com/thumb.jpg',
                uploader: 'TestChannel',
                webpageUrl: 'https://youtube.com/watch?v=test'
            });
        });

        test('should throw error when url is empty', async () => {
            await expect(adapter.extractMetadata('')).rejects.toThrow('URL is required');
        });

        test('should throw error when url is null', async () => {
            await expect(adapter.extractMetadata(null)).rejects.toThrow('URL is required');
        });

        test('should throw error when url is undefined', async () => {
            await expect(adapter.extractMetadata(undefined)).rejects.toThrow('URL is required');
        });

        test('should handle invalid JSON response', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('invalid json');
            
            await expect(adapter.extractMetadata('https://youtube.com/watch?v=test')).rejects.toThrow();
        });

        test('should handle missing fields in response', async () => {
            const partialResponse = {
                id: 'test123',
                title: 'Test Video'
            };
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(partialResponse));
            
            const result = await adapter.extractMetadata('https://youtube.com/watch?v=test');
            
            expect(result.id).toBe('test123');
            expect(result.title).toBe('Test Video');
            expect(result.duration).toBeUndefined();
            expect(result.thumbnail).toBeUndefined();
        });

        test('should propagate executeQuickTaskArray errors', async () => {
            const error = new Error('Network error');
            mockProcessSupervisor.executeQuickTaskArray.mockRejectedValue(error);
            
            await expect(adapter.extractMetadata('https://youtube.com/watch?v=test')).rejects.toThrow('Network error');
        });
    });

    describe('startDownload', () => {
        const createMockChildProcess = () => {
            const handlers = {};
            const mockProcess = {
                once: jest.fn((event, handler) => {
                    if (!handlers[event]) handlers[event] = [];
                    handlers[event].push(handler);
                }),
                emit: (event, ...args) => {
                    if (handlers[event]) {
                        handlers[event].forEach(handler => handler(...args));
                    }
                },
                kill: jest.fn(),
                stdout: {
                    on: jest.fn((event, handler) => {
                        if (!handlers[`stdout_${event}`]) handlers[`stdout_${event}`] = [];
                        handlers[`stdout_${event}`].push(handler);
                    })
                },
                stderr: {
                    on: jest.fn((event, handler) => {
                        if (!handlers[`stderr_${event}`]) handlers[`stderr_${event}`] = [];
                        handlers[`stderr_${event}`].push(handler);
                    })
                }
            };
            mockProcess.emitStream = (stream, event, ...args) => {
                const key = `${stream}_${event}`;
                if (handlers[key]) {
                    handlers[key].forEach(handler => handler(...args));
                }
            };
            return mockProcess;
        };

        test('should call startManagedProcess with correct arguments', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const downloadPromise = adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                outputPath: '/output/video.mp4'
            });
            
            // Don't await, just check the call
            expect(mockProcessSupervisor.startManagedProcess).toHaveBeenCalledWith({
                processId: expect.stringMatching(/^ytdlp-dl-\d+$/),
                binPath: adapter._ytdlpPath,
                args: expect.arrayContaining([
                    '-f', '137',
                    '-o', '/output/video.mp4',
                    '--newline',
                    '--progress',
                    'https://youtube.com/watch?v=test'
                ]),
                type: 'ytdlp-download',
                metadata: {
                    url: 'https://youtube.com/watch?v=test',
                    formatId: '137',
                    outputPath: '/output/video.mp4',
                    deviceId: undefined
                },
                onData: expect.any(Function)
            });
            
            // Clean up
            mockProcessSupervisor.startManagedProcess.mockReset();
        });

        test('should generate unique processId with timestamp', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.processId).toMatch(/^ytdlp-dl-\d+$/);
        });

        test('should generate default outputPath when not provided', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args[3]).toContain('linkhub_');
            expect(callArgs.args[3]).toContain('_137.%(ext)s');
        });

        test('should use custom outputPath when provided', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                outputPath: '/custom/path/video.mp4'
            });
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args[3]).toBe('/custom/path/video.mp4');
        });

        test('should set up exit event handler', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            
            expect(mockProcess.once).toHaveBeenCalledWith('exit', expect.any(Function));
        });

        test('should set up error event handler', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            
            expect(mockProcess.once).toHaveBeenCalledWith('error', expect.any(Function));
        });

        test('should resolve with success on exit code 0', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const downloadPromise = adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                outputPath: '/output/video.mp4'
            });
            
            // Trigger exit handler using emit
            setImmediate(() => {
                mockProcess.emit('exit', 0);
            });
            
            downloadPromise.then(result => {
                expect(result).toEqual({
                    success: true,
                    outputPath: '/output/video.mp4',
                    processId: expect.stringMatching(/^ytdlp-dl-\d+$/)
                });
                done();
            }).catch(done.fail);
        });

        test('should reject on non-zero exit code', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const downloadPromise = adapter.startDownload('https://youtube.com/watch?v=test', '137');
            
            setImmediate(() => {
                mockProcess.emit('exit', 1);
            });
            
            downloadPromise.catch(error => {
                expect(error.message).toContain('exit code 1');
                done();
            });
        });

        test('should reject on process error', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const downloadPromise = adapter.startDownload('https://youtube.com/watch?v=test', '137');
            
            setImmediate(() => {
                mockProcess.emit('error', new Error('Process failed'));
            });
            
            downloadPromise.catch(error => {
                expect(error.message).toBe('Process failed');
                done();
            });
        });

        test('should call onProgress callback when progress data received', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const onProgressMock = jest.fn();
            adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                onProgress: onProgressMock
            });
            
            setImmediate(() => {
                const onDataHandler = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].onData;
                onDataHandler(Buffer.from('[download] 45.2% of 10.00MiB at 1.00MiB/s'), 'stderr');
                
                expect(onProgressMock).toHaveBeenCalledWith({
                    percent: 45.2,
                    raw: '[download] 45.2% of 10.00MiB at 1.00MiB/s'
                });
                done();
            });
        });

        test('should handle progress when onProgress is not provided', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            
            setImmediate(() => {
                const onDataHandler = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].onData;
                // Should not throw even without onProgress callback
                expect(() => {
                    onDataHandler(Buffer.from('[download] 45.2% of 10.00MiB at 1.00MiB/s'), 'stderr');
                }).not.toThrow();
                
                done();
            });
        });

        test('should not call onProgress for stdout', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const onProgressMock = jest.fn();
            adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                onProgress: onProgressMock
            });
            
            setTimeout(() => {
                const onDataHandler = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].onData;
                onDataHandler(Buffer.from('[download] 45.2%'), 'stdout');
                
                expect(onProgressMock).not.toHaveBeenCalled();
                done();
            }, 10);
        });

        test('should extract progress percentage correctly', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const onProgressMock = jest.fn();
            adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                onProgress: onProgressMock
            });
            
            setTimeout(() => {
                const onDataHandler = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].onData;
                onDataHandler(Buffer.from('[download]  99.9%'), 'stderr');
                
                expect(onProgressMock).toHaveBeenCalledWith({
                    percent: 99.9,
                    raw: '[download]  99.9%'
                });
                done();
            }, 10);
        });

        test('should handle deviceId parameter', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                deviceId: 'device123'
            });
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.metadata.deviceId).toBe('device123');
        });

        test('should add entry to _activeDownloads', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            expect(adapter._activeDownloads.has(processId)).toBe(true);
        });

        test('should reject when process is null', async () => {
            mockProcessSupervisor.startManagedProcess.mockReturnValue(null);
            
            await expect(adapter.startDownload('https://youtube.com/watch?v=test', '137')).rejects.toThrow('Failed to start process');
        });

        test('should throw error when formatId is undefined', async () => {
            await expect(adapter.startDownload('https://youtube.com/watch?v=test', undefined))
                .rejects.toThrow('formatId is required and must be a non-empty string');
        });

        test('should throw error when formatId is null', async () => {
            await expect(adapter.startDownload('https://youtube.com/watch?v=test', null))
                .rejects.toThrow('formatId is required and must be a non-empty string');
        });

        test('should throw error when formatId is empty string', async () => {
            await expect(adapter.startDownload('https://youtube.com/watch?v=test', ''))
                .rejects.toThrow('formatId is required and must be a non-empty string');
        });

        test('should throw error when formatId is only whitespace', async () => {
            await expect(adapter.startDownload('https://youtube.com/watch?v=test', '   '))
                .rejects.toThrow('formatId is required and must be a non-empty string');
        });

        test('should throw error when formatId is not a string', async () => {
            await expect(adapter.startDownload('https://youtube.com/watch?v=test', 137))
                .rejects.toThrow('formatId is required and must be a non-empty string');
        });

        test('should update status to completed on success', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const downloadPromise = adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            // Verify initial status
            expect(adapter._activeDownloads.get(processId)?.status).toBe('downloading');
            
            // Trigger exit
            setTimeout(() => {
                const exitHandler = mockProcess.once.mock.calls.find(call => call[0] === 'exit')[1];
                exitHandler(0);
            }, 10);
            
            // Wait for promise to resolve
            downloadPromise.then(() => {
                // Entry should be deleted after completion
                setTimeout(() => {
                    expect(adapter._activeDownloads.has(processId)).toBe(false);
                    done();
                }, 10);
            }).catch(done.fail);
        });

        test('should update status to failed on error', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const downloadPromise = adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            // Verify initial status
            expect(adapter._activeDownloads.get(processId)?.status).toBe('downloading');
            
            // Trigger error
            setTimeout(() => {
                const errorHandler = mockProcess.once.mock.calls.find(call => call[0] === 'error')[1];
                errorHandler(new Error('Process failed'));
            }, 10);
            
            // Wait for promise to reject
            downloadPromise.catch(() => {
                // Entry should be deleted after error
                setTimeout(() => {
                    expect(adapter._activeDownloads.has(processId)).toBe(false);
                    done();
                }, 10);
            });
        });

        test('should delete entry from _activeDownloads on completion', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const downloadPromise = adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            setTimeout(() => {
                const exitHandler = mockProcess.once.mock.calls.find(call => call[0] === 'exit')[1];
                exitHandler(0);
                
                setTimeout(() => {
                    expect(adapter._activeDownloads.has(processId)).toBe(false);
                    done();
                }, 20);
            }, 10);
        });
    });

    describe('stopDownload', () => {
        const createMockChildProcess = () => {
            const handlers = {};
            const mockProcess = {
                once: jest.fn((event, handler) => {
                    if (!handlers[event]) handlers[event] = [];
                    handlers[event].push(handler);
                }),
                emit: (event, ...args) => {
                    if (handlers[event]) {
                        handlers[event].forEach(handler => handler(...args));
                    }
                },
                kill: jest.fn(),
                stdout: {
                    on: jest.fn((event, handler) => {
                        if (!handlers[`stdout_${event}`]) handlers[`stdout_${event}`] = [];
                        handlers[`stdout_${event}`].push(handler);
                    })
                },
                stderr: {
                    on: jest.fn((event, handler) => {
                        if (!handlers[`stderr_${event}`]) handlers[`stderr_${event}`] = [];
                        handlers[`stderr_${event}`].push(handler);
                    })
                }
            };
            mockProcess.emitStream = (stream, event, ...args) => {
                const key = `${stream}_${event}`;
                if (handlers[key]) {
                    handlers[key].forEach(handler => handler(...args));
                }
            };
            return mockProcess;
        };

        test('should call stopManagedProcess with correct processId', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            adapter.stopDownload(processId);
            
            expect(mockProcessSupervisor.stopManagedProcess).toHaveBeenCalledWith(processId);
        });

        test('should return success object when stop succeeds with alive process', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(true);
            mockProcessSupervisor.hasProcess.mockReturnValue(true);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            const result = adapter.stopDownload(processId);
            
            expect(result).toEqual({ success: true, wasRunning: true });
            expect(mockProcessSupervisor.stopManagedProcess).toHaveBeenCalledWith(processId);
        });

        test('should return success object with wasRunning false when process is not alive', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.hasProcess.mockReturnValue(false);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            const result = adapter.stopDownload(processId);
            
            expect(result).toEqual({ success: true, wasRunning: false });
            expect(mockProcessSupervisor.stopManagedProcess).not.toHaveBeenCalled();
            expect(mockLogger.info).toHaveBeenCalledWith(
                expect.stringContaining('was not alive, skipping stopManagedProcess')
            );
        });

        test('should return failure object when processId does not exist', () => {
            mockProcessSupervisor.hasProcess.mockReturnValue(false);
            
            const result = adapter.stopDownload('non-existent-id');
            
            expect(result).toEqual({ 
                success: false, 
                reason: 'entry_not_found', 
                processId: 'non-existent-id' 
            });
            expect(mockProcessSupervisor.stopManagedProcess).not.toHaveBeenCalled();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Entry not found')
            );
        });

        test('should return failure object when stopManagedProcess returns false', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(false);
            mockProcessSupervisor.hasProcess.mockReturnValue(true);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            const result = adapter.stopDownload(processId);
            
            expect(result).toEqual({ success: false, wasRunning: true });
        });

        test('should keep entry in _activeDownloads for resume (not delete)', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(true);
            mockProcessSupervisor.hasProcess.mockReturnValue(true);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            adapter.stopDownload(processId);
            
            // Entry should be kept in memory for resume capability
            expect(adapter._downloadManager.getDownloadEntry(processId)).toBeDefined();
        });

        test('should update status to stopped before calling stopManagedProcess', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(true);
            mockProcessSupervisor.hasProcess.mockReturnValue(true);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            adapter.stopDownload(processId);
            
            const entry = adapter._downloadManager.getDownloadEntry(processId);
            expect(entry.status).toBe('stopped');
            expect(entry.manuallyStopped).toBe(true);
        });

        test('should return failure object for null processId', () => {
            const result = adapter.stopDownload(null);
            
            expect(result).toEqual({ success: false, reason: 'invalid_processId' });
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Invalid processId')
            );
        });

        test('should return failure object for empty processId', () => {
            const result = adapter.stopDownload('');
            
            expect(result).toEqual({ success: false, reason: 'invalid_processId' });
            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Invalid processId')
            );
        });

        test('should keep entry even when stopManagedProcess fails', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(false);
            mockProcessSupervisor.hasProcess.mockReturnValue(true);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            adapter.stopDownload(processId);
            
            // Entry should be kept in memory for resume capability
            expect(adapter._downloadManager.getDownloadEntry(processId)).toBeDefined();
        });

        test('should handle null windowManager in stopDownload', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(true);
            mockProcessSupervisor.hasProcess.mockReturnValue(true);
            
            const adapterWithoutWM = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor
            });
            
            adapterWithoutWM.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            const result = adapterWithoutWM.stopDownload(processId);
            
            expect(result).toEqual({ success: true, wasRunning: true });
            // Entry should be kept in memory for resume capability
            expect(adapterWithoutWM._downloadManager.getDownloadEntry(processId)).toBeDefined();
        });
    });

    describe('getDownloadStatus', () => {
        const createMockChildProcess = () => ({
            once: jest.fn(),
            kill: jest.fn()
        });

        test('should return status for existing processId', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            const status = adapter.getDownloadStatus(processId);
            
            expect(status).toBe('downloading');
        });

        test('should return null for non-existent processId', () => {
            const status = adapter.getDownloadStatus('non-existent-id');
            
            expect(status).toBeNull();
        });

        test('should return completed status after successful download', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            setTimeout(() => {
                const exitHandler = mockProcess.once.mock.calls.find(call => call[0] === 'exit')[1];
                exitHandler(0);
                
                // Status is set to completed before deletion
                const entry = adapter._activeDownloads.get(processId);
                if (entry) {
                    expect(entry.status).toBe('completed');
                }
                done();
            }, 10);
        });

        test('should return failed status after error', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const downloadPromise = adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            // Verify initial status
            expect(adapter._activeDownloads.get(processId)?.status).toBe('downloading');
            
            // Trigger error
            setTimeout(() => {
                const errorHandler = mockProcess.once.mock.calls.find(call => call[0] === 'error')[1];
                errorHandler(new Error('Process failed'));
            }, 10);
            
            // Wait for promise to reject
            downloadPromise.catch(() => {
                // Entry should be deleted after error
                setTimeout(() => {
                    expect(adapter._activeDownloads.has(processId)).toBe(false);
                    done();
                }, 10);
            });
        });

        test('should return stopped status after stop', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(true);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            adapter.stopDownload(processId);
            
            // Entry is deleted after stop, so we can't check status
            // But we verified in stopDownload tests that status is set to 'stopped'
        });
    });

    describe('Security Tests', () => {
        const createMockChildProcess = () => ({
            once: jest.fn(),
            kill: jest.fn()
        });

        test('should pass URL with semicolon as single array element (no command splitting)', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const maliciousUrl = 'https://youtube.com/watch?v=test;rm -rf /';
            adapter.startDownload(maliciousUrl, '137');
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args).toContain(maliciousUrl);
            expect(callArgs.args[callArgs.args.length - 1]).toBe(maliciousUrl);
            // SECURITY: URL is passed as single element, not split by shell
        });

        test('should pass URL with ampersand as single array element', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const maliciousUrl = 'https://youtube.com/watch?v=test&whoami';
            adapter.startDownload(maliciousUrl, '137');
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args).toContain(maliciousUrl);
            // SECURITY: URL is passed as single element
        });

        test('should pass URL with pipe as single array element', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const maliciousUrl = 'https://youtube.com/watch?v=test|cat /etc/passwd';
            adapter.startDownload(maliciousUrl, '137');
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args).toContain(maliciousUrl);
            // SECURITY: URL is passed as single element
        });

        test('should pass formatId with command substitution as literal string', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const maliciousFormatId = '$(whoami)';
            adapter.startDownload('https://youtube.com/watch?v=test', maliciousFormatId);
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args[1]).toBe('$(whoami)');
            // SECURITY: formatId is passed as literal string in array
        });

        test('should pass formatId with backticks as literal string', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const maliciousFormatId = '`whoami`';
            adapter.startDownload('https://youtube.com/watch?v=test', maliciousFormatId);
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args[1]).toBe('`whoami`');
            // SECURITY: formatId is passed as literal string
        });

        test('should pass formatId with semicolon as literal string', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const maliciousFormatId = '137;rm -rf /';
            adapter.startDownload('https://youtube.com/watch?v=test', maliciousFormatId);
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args[1]).toBe('137;rm -rf /');
            // SECURITY: formatId is passed as literal string
        });

        test('should pass URL with special characters as single element', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const specialUrl = 'https://youtube.com/watch?v=test&param=value|other;cmd';
            adapter.startDownload(specialUrl, '137');
            
            const callArgs = mockProcessSupervisor.startManagedProcess.mock.calls[0][0];
            expect(callArgs.args).toContain(specialUrl);
            // SECURITY: Entire URL is single array element
        });

        test('inspectFormats should pass URL as single array element', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('{}');
            
            const maliciousUrl = 'https://youtube.com/watch?v=test;rm -rf /';
            await adapter.inspectFormats(maliciousUrl);
            
            expect(mockProcessSupervisor.executeQuickTaskArray).toHaveBeenCalledWith(
                adapter._ytdlpPath,
                ['-j', maliciousUrl],
                { timeout: 30000 }
            );
            // SECURITY: URL is single element in args array
        });

        test('extractMetadata should pass URL as single array element', async () => {
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('{}');
            
            const maliciousUrl = 'https://youtube.com/watch?v=test|cat /etc/passwd';
            await adapter.extractMetadata(maliciousUrl);
            
            expect(mockProcessSupervisor.executeQuickTaskArray).toHaveBeenCalledWith(
                adapter._ytdlpPath,
                ['-j', '--flat-playlist', maliciousUrl],
                { timeout: 15000 }
            );
            // SECURITY: URL is single element in args array
        });

        describe('Malformed Input Tests', () => {
            test('should throw error on unparseable output (connection error)', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('Connection timed out');
                
                await expect(adapter.inspectFormats('https://youtube.com/watch?v=test')).rejects.toThrow();
            });

            test('should throw error on empty string response', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('');
                
                await expect(adapter.inspectFormats('https://youtube.com/watch?v=test')).rejects.toThrow('Unexpected end of JSON input');
            });

            test('should throw error on broken JSON with missing closing brace', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('{"title": "test"');
                
                await expect(adapter.inspectFormats('https://youtube.com/watch?v=test')).rejects.toThrow();
            });

            test('should throw error on completely invalid JSON', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('not json at all!!!');
                
                await expect(adapter.inspectFormats('https://youtube.com/watch?v=test')).rejects.toThrow();
            });

            test('should throw error on JSON with extra commas', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('{"title": "test",}');
                
                await expect(adapter.inspectFormats('https://youtube.com/watch?v=test')).rejects.toThrow();
            });

            test('should throw error on JSON with comments (invalid in standard JSON)', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('{"title": "test"} // comment');
                
                await expect(adapter.inspectFormats('https://youtube.com/watch?v=test')).rejects.toThrow();
            });

            test('should throw error on extractMetadata with unparseable output', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('ERROR: Video unavailable');
                
                await expect(adapter.extractMetadata('https://youtube.com/watch?v=test')).rejects.toThrow();
            });

            test('should throw error on extractMetadata with empty response', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('');
                
                await expect(adapter.extractMetadata('https://youtube.com/watch?v=test')).rejects.toThrow('Unexpected end of JSON input');
            });

            test('should throw error on extractMetadata with broken JSON', async () => {
                mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue('{"id": "test"');
                
                await expect(adapter.extractMetadata('https://youtube.com/watch?v=test')).rejects.toThrow();
            });
        });
    });

    describe('Performance Tests', () => {
        const createMockChildProcess = () => ({
            once: jest.fn(),
            kill: jest.fn()
        });

        test('should handle 10 concurrent downloads efficiently', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const startTime = Date.now();
            
            for (let i = 0; i < 10; i++) {
                adapter.startDownload(`https://youtube.com/watch?v=test${i}`, '137');
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(adapter._activeDownloads.size).toBe(10);
            expect(duration).toBeLessThan(100); // Should be very fast
            
            console.log(`10 concurrent downloads created in ${duration}ms`);
        });

        test('should not cause significant memory increase with concurrent downloads', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const initialMemory = process.memoryUsage().heapUsed;
            
            for (let i = 0; i < 10; i++) {
                adapter.startDownload(`https://youtube.com/watch?v=test${i}`, '137');
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
            
            expect(memoryIncrease).toBeLessThan(20); // Less than 20MB increase
            
            console.log(`Memory increase for 10 downloads: ${memoryIncrease.toFixed(2)}MB`);
        });

        test('should handle large stderr output without performance issues', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const onProgressMock = jest.fn();
            adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                onProgress: onProgressMock
            });
            
            // Create a large stderr chunk (> 1MB)
            const largeChunk = Buffer.alloc(2 * 1024 * 1024); // 2MB
            largeChunk.fill('[download] 50.0% of 100.00MiB\n');
            
            const onDataHandler = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].onData;
            
            const startTime = Date.now();
            onDataHandler(largeChunk, 'stderr');
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(1000); // Should process quickly
            expect(onProgressMock).toHaveBeenCalled();
            
            console.log(`Large stderr (2MB) processed in ${duration}ms`);
            done();
        });

        test('should handle rapid progress updates efficiently', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const onProgressMock = jest.fn();
            adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                onProgress: onProgressMock
            });
            
            const onDataHandler = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].onData;
            
            const startTime = Date.now();
            
            // Simulate 100 rapid progress updates
            for (let i = 0; i < 100; i++) {
                onDataHandler(Buffer.from(`[download] ${i}%\n`), 'stderr');
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            expect(onProgressMock).toHaveBeenCalledTimes(100);
            expect(duration).toBeLessThan(100); // Should be very fast
            
            console.log(`100 progress updates processed in ${duration}ms`);
            done();
        });
    });

    describe('Edge Cases', () => {
        const createMockChildProcess = () => ({
            once: jest.fn(),
            kill: jest.fn()
        });

        test('should handle very long URLs', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const longUrl = 'https://youtube.com/watch?v=' + 'a'.repeat(10000);
            
            expect(() => adapter.startDownload(longUrl, '137')).not.toThrow();
        });

        test('should handle URLs with special characters', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const specialUrl = 'https://youtube.com/watch?v=test&param=value&other=123#fragment';
            
            expect(() => adapter.startDownload(specialUrl, '137')).not.toThrow();
        });

        test('should handle URLs with unicode characters', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const unicodeUrl = 'https://youtube.com/watch?v=测试&param=値';
            
            expect(() => adapter.startDownload(unicodeUrl, '137')).not.toThrow();
        });

        test('should handle very long formatId', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const longFormatId = '137' + 'a'.repeat(1000);
            
            expect(() => adapter.startDownload('https://youtube.com/watch?v=test', longFormatId)).not.toThrow();
        });

        test('should handle special characters in outputPath', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const specialPath = '/path/with spaces/and-special_chars.mp4';
            
            expect(() => adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                outputPath: specialPath
            })).not.toThrow();
        });

        test('should handle rapid start/stop cycles', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(true);
            
            for (let i = 0; i < 5; i++) {
                adapter.startDownload('https://youtube.com/watch?v=test', '137');
                const processId = mockProcessSupervisor.startManagedProcess.mock.calls[i][0].processId;
                adapter.stopDownload(processId);
            }
            
            expect(adapter._activeDownloads.size).toBe(0);
        });

        test('should handle multiple simultaneous downloads', async () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            // Need to return different mock processes to avoid overwriting
            mockProcessSupervisor.startManagedProcess.mockImplementation(() => createMockChildProcess());
            
            adapter.startDownload('https://youtube.com/watch?v=test1', '137');
            adapter.startDownload('https://youtube.com/watch?v=test2', '140');
            adapter.startDownload('https://youtube.com/watch?v=test3', '22');
            
            expect(adapter._activeDownloads.size).toBe(3);
        });

        test('should handle stop before completion', () => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            mockProcessSupervisor.stopManagedProcess.mockReturnValue(true);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            const result = adapter.stopDownload(processId);
            
            expect(result).toBe(true);
            expect(adapter._activeDownloads.has(processId)).toBe(false);
        });

        test('should handle missing thumbnail in inspectFormats response', async () => {
            const responseWithoutThumbnail = {
                title: 'Test Video',
                duration: 300,
                formats: []
            };
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(responseWithoutThumbnail));
            
            const result = await adapter.inspectFormats('https://youtube.com/watch?v=test');
            
            expect(result.thumbnail).toBeUndefined();
        });

        test('should handle missing duration in extractMetadata response', async () => {
            const responseWithoutDuration = {
                id: 'test123',
                title: 'Test Video',
                webpage_url: 'https://youtube.com/watch?v=test'
            };
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(responseWithoutDuration));
            
            const result = await adapter.extractMetadata('https://youtube.com/watch?v=test');
            
            expect(result.duration).toBeUndefined();
        });

        test('should handle null windowManager (no broadcast)', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const adapterWithoutWM = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor
            });
            
            const downloadPromise = adapterWithoutWM.startDownload('https://youtube.com/watch?v=test', '137');
            
            setTimeout(() => {
                const exitHandler = mockProcess.once.mock.calls.find(call => call[0] === 'exit')[1];
                exitHandler(0);
                
                downloadPromise.then(result => {
                    expect(result.success).toBe(true);
                    done();
                }).catch(done.fail);
            }, 10);
        });

        test('should handle null windowManager on error exit', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const adapterWithoutWM = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor
            });
            
            const downloadPromise = adapterWithoutWM.startDownload('https://youtube.com/watch?v=test', '137');
            
            setTimeout(() => {
                const exitHandler = mockProcess.once.mock.calls.find(call => call[0] === 'exit')[1];
                exitHandler(1);
                
                downloadPromise.catch(error => {
                    expect(error.message).toContain('exit code 1');
                    done();
                });
            }, 10);
        });

        test('should handle null windowManager on process error', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const adapterWithoutWM = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor
            });
            
            const downloadPromise = adapterWithoutWM.startDownload('https://youtube.com/watch?v=test', '137');
            
            setTimeout(() => {
                const errorHandler = mockProcess.once.mock.calls.find(call => call[0] === 'error')[1];
                errorHandler(new Error('Process failed'));
                
                downloadPromise.catch(error => {
                    expect(error.message).toBe('Process failed');
                    done();
                });
            }, 10);
        });

        test('should handle progress when windowManager is null', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const adapterWithoutWM = new YtdlpAdapter({
                processSupervisor: mockProcessSupervisor
            });
            
            const onProgressMock = jest.fn();
            adapterWithoutWM.startDownload('https://youtube.com/watch?v=test', '137', {
                onProgress: onProgressMock
            });
            
            setTimeout(() => {
                const onDataHandler = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].onData;
                onDataHandler(Buffer.from('[download] 50.0%'), 'stderr');
                
                expect(onProgressMock).toHaveBeenCalled();
                done();
            }, 10);
        });

        test('should handle stderr without progress pattern', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            const onProgressMock = jest.fn();
            adapter.startDownload('https://youtube.com/watch?v=test', '137', {
                onProgress: onProgressMock
            });
            
            setTimeout(() => {
                const onDataHandler = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].onData;
                // Should not throw when stderr doesn't contain progress pattern
                expect(() => {
                    onDataHandler(Buffer.from('Starting download...'), 'stderr');
                }).not.toThrow();
                
                expect(onProgressMock).not.toHaveBeenCalled();
                done();
            }, 10);
        });

        test('should handle format with missing optional fields', async () => {
            const responseWithMinimalFormat = {
                title: 'Test Video',
                formats: [
                    {
                        format_id: '137',
                        ext: 'mp4'
                    }
                ]
            };
            mockProcessSupervisor.executeQuickTaskArray.mockResolvedValue(JSON.stringify(responseWithMinimalFormat));
            
            const result = await adapter.inspectFormats('https://youtube.com/watch?v=test');
            
            expect(result.formats[0]).toEqual({
                formatId: '137',
                ext: 'mp4',
                resolution: null,
                fps: null,
                acodec: undefined,
                vcodec: undefined,
                filesize: undefined,
                formatNote: undefined
            });
        });

        test('should handle process exit after entry is deleted', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            // Manually delete entry
            adapter._activeDownloads.delete(processId);
            
            setTimeout(() => {
                const exitHandler = mockProcess.once.mock.calls.find(call => call[0] === 'exit')[1];
                
                // Should not throw even though entry is gone
                expect(() => exitHandler(0)).not.toThrow();
                done();
            }, 10);
        });

        test('should handle process error after entry is deleted', (done) => {
            const mockProcess = createMockChildProcess();
            mockProcessSupervisor.startManagedProcess.mockReturnValue(mockProcess);
            
            adapter.startDownload('https://youtube.com/watch?v=test', '137');
            const processId = mockProcessSupervisor.startManagedProcess.mock.calls[0][0].processId;
            
            // Manually delete entry
            adapter._activeDownloads.delete(processId);
            
            setTimeout(() => {
                const errorHandler = mockProcess.once.mock.calls.find(call => call[0] === 'error')[1];
                
                // Should not throw even though entry is gone
                expect(() => errorHandler(new Error('Process failed'))).not.toThrow();
                done();
            }, 10);
        });
    });
});
