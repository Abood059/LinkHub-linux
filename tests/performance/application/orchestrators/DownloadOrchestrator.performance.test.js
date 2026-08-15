// tests/performance/application/orchestrators/DownloadOrchestrator.performance.test.js
'use strict';

/**
 * Performance & Stress Tests for DownloadOrchestrator
 * 
 * Run with: npm test -- tests/performance/application/orchestrators/DownloadOrchestrator.performance.test.js
 * For accurate memory measurement, run with: node --expose-gc node_modules/.bin/jest tests/performance/application/orchestrators/DownloadOrchestrator.performance.test.js
 */

const DownloadOrchestrator = require('../../../../src/main/application/orchestrators/DownloadOrchestrator');

// Mock heavy dependencies to ensure fast execution
jest.mock('../../../../src/main/infrastructure/media/YtdlpAdapter');

const YtdlpAdapter = require('../../../../src/main/infrastructure/media/YtdlpAdapter');

describe('DownloadOrchestrator Performance', () => {
  let orchestrator;
  let mockYtdlpAdapter;

  beforeEach(() => {
    mockYtdlpAdapter = new YtdlpAdapter();

    // Instant mock functions - no delays
    mockYtdlpAdapter.startDownload = jest.fn().mockResolvedValue({ processId: 'mock-id' });
    mockYtdlpAdapter.stopDownload = jest.fn().mockReturnValue(true);
    mockYtdlpAdapter.inspectFormats = jest.fn().mockResolvedValue({ formats: [] });

    orchestrator = new DownloadOrchestrator({
      ytdlpAdapter: mockYtdlpAdapter,
      deviceRegistry: null,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
    });
  });

  test('startDownload concurrent 100 requests should complete < 500ms', async () => {
    const requestCount = 100;
    const urls = [];
    
    // Generate unique URLs
    for (let i = 0; i < requestCount; i++) {
      urls.push(`https://example.com/video${i}`);
    }

    const start = performance.now();
    
    // Start all downloads concurrently
    const promises = urls.map(url => 
      orchestrator.startDownload(url, 'best')
    );
    await Promise.all(promises);
    
    const end = performance.now();
    const totalTime = end - start;

    console.log(`[Performance] startDownload (100 concurrent) total: ${totalTime.toFixed(2)}ms`);
    expect(totalTime).toBeLessThan(500);
  });

  test('stopDownload concurrent 100 processes should complete < 500ms', () => {
    const processCount = 100;
    const processIds = [];
    
    // Generate unique process IDs
    for (let i = 0; i < processCount; i++) {
      processIds.push(`ytdlp-dl-${i}`);
    }

    const start = performance.now();
    
    // Stop all downloads concurrently
    const promises = [];
    for (let i = 0; i < processCount; i++) {
      promises.push(Promise.resolve(orchestrator.stopDownload(processIds[i])));
    }
    Promise.all(promises);
    
    const end = performance.now();
    const totalTime = end - start;

    console.log(`[Performance] stopDownload (100 concurrent) total: ${totalTime.toFixed(2)}ms`);
    expect(totalTime).toBeLessThan(500);
  });

  test('inspectLink concurrent 50 links should complete < 300ms', async () => {
    const linkCount = 50;
    const urls = [];
    
    // Generate unique URLs
    for (let i = 0; i < linkCount; i++) {
      urls.push(`https://youtube.com/watch?v=test${i}`);
    }

    const start = performance.now();
    
    // Inspect all links concurrently
    const promises = urls.map(url => 
      orchestrator.inspectLink(url)
    );
    await Promise.all(promises);
    
    const end = performance.now();
    const totalTime = end - start;

    console.log(`[Performance] inspectLink (50 concurrent) total: ${totalTime.toFixed(2)}ms`);
    expect(totalTime).toBeLessThan(300);
  });
});
