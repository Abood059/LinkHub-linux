// DeviceHandlers.security.test.js
'use strict';

/**
 * Security Tests for DeviceHandlers
 * 
 * PURPOSE: Verify that IPC handlers ONLY check parameter existence (null/undefined/empty),
 * and DO NOT sanitize or modify parameter content. Malicious data should pass through unchanged.
 * 
 * SECURITY PRINCIPLE: The IPC layer is a thin gateway. It validates presence, not content.
 * Content validation is the responsibility of the Infrastructure (Adapters) layer.
 */

const DeviceHandlers = require('../../../../src/main/infrastructure/ipc/DeviceHandlers');

describe('DeviceHandlers - Security', () => {
  let mockIpcMain;
  let mockOrchestrator;
  let handlers;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIpcMain = { handle: jest.fn() };
    mockOrchestrator = {
      getAllDevices: jest.fn().mockResolvedValue([]),
      getDevice: jest.fn().mockResolvedValue(null),
      pairDevice: jest.fn().mockResolvedValue([]),
      connectDevice: jest.fn().mockResolvedValue({}),
      startStreaming: jest.fn().mockReturnValue('pid'),
      stopStreaming: jest.fn().mockReturnValue(true)
    };
    handlers = new DeviceHandlers(mockOrchestrator);
    handlers.register(mockIpcMain);
  });

  // Test #1: Command injection in target (device:connect)
  test('should pass malicious target to orchestrator.connectDevice unchanged', async () => {
    const maliciousTarget = 'device; rm -rf /';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:connect');
    
    await handlerFn({}, maliciousTarget);
    
    expect(mockOrchestrator.connectDevice).toHaveBeenCalledWith(maliciousTarget, null);
    // Handler does NOT sanitize - passes through as-is
  });

  // Test #2: Command injection in host (device:pair)
  test('should pass malicious host to orchestrator.pairDevice unchanged', async () => {
    const maliciousHost = '192.168.1.10:37000 & whoami';
    const pairingCode = '123456';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:pair');
    
    await handlerFn({}, maliciousHost, pairingCode);
    
    expect(mockOrchestrator.pairDevice).toHaveBeenCalledWith(maliciousHost, pairingCode);
    // Handler does NOT sanitize - passes through as-is
  });

  // Test #3: XSS attempt in friendlyName (device:connect)
  test('should pass XSS attempt in friendlyName to orchestrator unchanged', async () => {
    const target = 'emulator';
    const maliciousFriendlyName = '<script>alert(1)</script>';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:connect');
    
    await handlerFn({}, target, maliciousFriendlyName);
    
    expect(mockOrchestrator.connectDevice).toHaveBeenCalledWith(target, maliciousFriendlyName);
    // Handler does NOT sanitize - passes through as-is
  });

  // Test #4: Path traversal in deviceId (device:stream:start)
  test('should pass path traversal in deviceId to orchestrator unchanged', async () => {
    const maliciousDeviceId = '../../../etc/passwd';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:stream:start');
    
    await handlerFn({}, maliciousDeviceId);
    
    expect(mockOrchestrator.startStreaming).toHaveBeenCalledWith(maliciousDeviceId, {});
    // Handler does NOT sanitize - passes through as-is
  });

  // Test #5: Prototype pollution in options (device:stream:start)
  test('should pass prototype-polluted options to orchestrator unchanged', async () => {
    const deviceId = 'device-123';
    const pollutedOptions = { __proto__: { polluted: true } };
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:stream:start');
    
    await handlerFn({}, deviceId, pollutedOptions);
    
    expect(mockOrchestrator.startStreaming).toHaveBeenCalledWith(deviceId, pollutedOptions);
    // Handler does NOT sanitize or freeze - passes through as-is
  });

  // Test #6: null/undefined validation for required params (device:pair)
  test('should throw error when pairingCode is null (existence check only)', async () => {
    const host = '192.168.1.10';
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:pair');
    
    await expect(handlerFn({}, host, null)).rejects.toThrow('host and pairingCode are required');
    expect(mockOrchestrator.pairDevice).not.toHaveBeenCalled();
    // This is SAFE - handler checks existence, not content
  });

  // Test #7: null validation for deviceId (device:get)
  test('should throw error when deviceId is null and not call orchestrator', async () => {
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:get');
    
    await expect(handlerFn({}, null)).rejects.toThrow('deviceId is required');
    expect(mockOrchestrator.getDevice).not.toHaveBeenCalled();
    // This is SAFE - handler checks existence, not content
  });

  // Test #8: Empty string validation for target (device:connect)
  test('should throw error when target is empty string', async () => {
    const [, handlerFn] = mockIpcMain.handle.mock.calls.find(c => c[0] === 'device:connect');
    
    await expect(handlerFn({}, '')).rejects.toThrow('target is required (USB serial or host:port)');
    expect(mockOrchestrator.connectDevice).not.toHaveBeenCalled();
    // This is SAFE - handler checks existence, not content
  });
});
