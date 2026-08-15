// DownloadHandlers.security.test.js
'use strict';

/**
 * Security Tests for DownloadHandlers
 * 
 * PURPOSE: Verify that IPC handlers ONLY check parameter existence (null/undefined/empty),
 * and DO NOT sanitize or modify parameter content. Malicious data should pass through unchanged.
 * 
 * SECURITY PRINCIPLE: The IPC layer is a thin gateway. It validates presence, not content.
 * Content validation is the responsibility of the Infrastructure (Adapters) layer.
 */

const DownloadHandlers = require('../../../../src/main/infrastructure/ipc/DownloadHandlers');

describe('DownloadHandlers - Security', () => {
  let mockIpcMain;
  let mockOrchestrator;
  let handlers;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcMain = { handle: jest.fn() };
    mockOrchestrator = {
      inspectLink: jest.fn().mockResolvedValue({}),
      startDownload: jest.fn().mockResolvedValue({ processId: 'proc-123' }),
      stopDownload: jest.fn().mockResolvedValue({ stopped: true }),
      getMetadata: jest.fn().mockResolvedValue({}),
      getActiveDownloads: jest.fn().mockResolvedValue([])
    };
    handlers = new DownloadHandlers(mockOrchestrator);
    handlers.register(mockIpcMain);
  });

  // Test #9: Command injection in url (download:inspect)
  test('should pass malicious url to orchestrator.inspectLink unchanged', async () => {
    const maliciousUrl = 'https://example.com; rm -rf /';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'download:inspect');
    
    await handlerFn({}, maliciousUrl);
    
    expect(mockOrchestrator.inspectLink).toHaveBeenCalledWith(maliciousUrl);
    // Handler does NOT sanitize - passes through as-is
  });

  // Test #10: Command injection in formatId (download:start)
  test('should pass malicious formatId to orchestrator.startDownload unchanged', async () => {
    const url = 'https://example.com/video';
    const maliciousFormatId = '137; rm -rf /';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'download:start');
    
    await handlerFn({}, url, maliciousFormatId);
    
    expect(mockOrchestrator.startDownload).toHaveBeenCalledWith(url, maliciousFormatId, null, {});
    // Handler does NOT sanitize - passes through as-is
  });

  // Test #11: Control characters in url (download:inspect)
  test('should pass control characters in url to orchestrator unchanged', async () => {
    const maliciousUrl = 'https://example.com\x00video';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'download:inspect');
    
    await handlerFn({}, maliciousUrl);
    
    expect(mockOrchestrator.inspectLink).toHaveBeenCalledWith(maliciousUrl);
    // Handler does NOT remove control characters - passes through as-is
  });

  // Test #12: download:stop with malicious processId
  test('should pass malicious processId to orchestrator.stopDownload unchanged', async () => {
    const maliciousProcessId = 'proc-123; rm -rf /';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'download:stop');
    
    await handlerFn({}, maliciousProcessId);
    
    expect(mockOrchestrator.stopDownload).toHaveBeenCalledWith(maliciousProcessId);
    // Handler does NOT sanitize - passes through as-is
  });

  // Test #13: null validation for url (download:start)
  test('should throw error when url is null and not call orchestrator', async () => {
    const formatId = '137';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'download:start');
    
    await expect(handlerFn({}, null, formatId)).rejects.toThrow('url and formatId are required');
    expect(mockOrchestrator.startDownload).not.toHaveBeenCalled();
    // This is SAFE - handler checks existence, not content
  });

  // Test #14: undefined validation for url (download:metadata)
  test('should throw error when url is undefined and not call orchestrator', async () => {
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'download:metadata');
    
    await expect(handlerFn({}, undefined)).rejects.toThrow('URL is required');
    expect(mockOrchestrator.getMetadata).not.toHaveBeenCalled();
    // This is SAFE - handler checks existence, not content
  });

  // Test #15: Large data in options (download:start)
  test('should pass large data in options to orchestrator unchanged', async () => {
    const url = 'https://example.com/video';
    const formatId = '137';
    const largeOptions = { data: Buffer.alloc(1024 * 1024) }; // 1MB buffer
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'download:start');
    
    await handlerFn({}, url, formatId, null, largeOptions);
    
    expect(mockOrchestrator.startDownload).toHaveBeenCalledWith(url, formatId, null, largeOptions);
    // Handler does NOT limit size - passes through as-is
    // Size validation should happen in the Infrastructure layer
  });
});
