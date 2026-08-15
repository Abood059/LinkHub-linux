'use strict';

const WindowRegistry = require('../../../../src/main/infrastructure/windows/WindowRegistry');

describe('WindowRegistry', () => {
    let registry;

    beforeEach(() => {
        registry = new WindowRegistry();
    });

    describe('Constructor', () => {
        test('should initialize with empty Map', () => {
            expect(registry._windows).toBeInstanceOf(Map);
            expect(registry._windows.size).toBe(0);
        });
    });

    describe('register', () => {
        test('should add window to registry', () => {
            const mockWindow = {};
            registry.register('window1', mockWindow);
            expect(registry._windows.size).toBe(1);
            expect(registry._windows.get('window1')).toBe(mockWindow);
        });

        test('should throw error for null id', () => {
            const mockWindow = {};
            expect(() => registry.register(null, mockWindow)).toThrow('Invalid window id');
        });

        test('should throw error for undefined id', () => {
            const mockWindow = {};
            expect(() => registry.register(undefined, mockWindow)).toThrow('Invalid window id');
        });

        test('should throw error for non-string id', () => {
            const mockWindow = {};
            expect(() => registry.register(123, mockWindow)).toThrow('Invalid window id');
        });

        test('should throw error for empty string id', () => {
            const mockWindow = {};
            expect(() => registry.register('', mockWindow)).toThrow('Invalid window id');
        });

        test('should throw error for null window', () => {
            expect(() => registry.register('window1', null)).toThrow('Invalid window object');
        });

        test('should throw error for undefined window', () => {
            expect(() => registry.register('window1', undefined)).toThrow('Invalid window object');
        });

        test('should throw error for non-object window', () => {
            expect(() => registry.register('window1', 'string')).toThrow('Invalid window object');
        });

        test('should throw error for number window', () => {
            expect(() => registry.register('window1', 123)).toThrow('Invalid window object');
        });

        test('should warn and allow override when id already exists', () => {
            const mockWindow1 = {};
            const mockWindow2 = {};
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            registry.register('window1', mockWindow1);
            registry.register('window1', mockWindow2);
            
            expect(registry._windows.get('window1')).toBe(mockWindow2);
            expect(consoleWarnSpy).toHaveBeenCalledWith('WindowRegistry: Overwriting existing window with id window1');
            
            consoleWarnSpy.mockRestore();
        });

        test('should handle window object with properties', () => {
            const mockWindow = { id: 'test', title: 'Test Window' };
            registry.register('window1', mockWindow);
            expect(registry._windows.get('window1')).toBe(mockWindow);
        });
    });

    describe('unregister', () => {
        test('should remove existing window and return true', () => {
            const mockWindow = {};
            registry.register('window1', mockWindow);
            const result = registry.unregister('window1');
            expect(result).toBe(true);
            expect(registry._windows.size).toBe(0);
        });

        test('should return false for non-existent id', () => {
            const result = registry.unregister('nonexistent');
            expect(result).toBe(false);
        });

        test('should return false for null id', () => {
            const result = registry.unregister(null);
            expect(result).toBe(false);
        });

        test('should return false for undefined id', () => {
            const result = registry.unregister(undefined);
            expect(result).toBe(false);
        });

        test('should handle unregistering from empty registry', () => {
            const result = registry.unregister('window1');
            expect(result).toBe(false);
        });

        test('should allow re-registering after unregister', () => {
            const mockWindow1 = {};
            const mockWindow2 = {};
            registry.register('window1', mockWindow1);
            registry.unregister('window1');
            registry.register('window1', mockWindow2);
            expect(registry._windows.get('window1')).toBe(mockWindow2);
        });
    });

    describe('get', () => {
        test('should return registered window', () => {
            const mockWindow = {};
            registry.register('window1', mockWindow);
            const result = registry.get('window1');
            expect(result).toBe(mockWindow);
        });

        test('should return null for non-existent id', () => {
            const result = registry.get('nonexistent');
            expect(result).toBeNull();
        });

        test('should return null for null id', () => {
            const result = registry.get(null);
            expect(result).toBeNull();
        });

        test('should return null for undefined id', () => {
            const result = registry.get(undefined);
            expect(result).toBeNull();
        });

        test('should return the actual window object (not a copy)', () => {
            const mockWindow = {};
            registry.register('window1', mockWindow);
            const result = registry.get('window1');
            result.newProperty = 'test';
            expect(mockWindow.newProperty).toBe('test');
        });
    });

    describe('has', () => {
        test('should return true for existing id', () => {
            const mockWindow = {};
            registry.register('window1', mockWindow);
            expect(registry.has('window1')).toBe(true);
        });

        test('should return false for non-existent id', () => {
            expect(registry.has('nonexistent')).toBe(false);
        });

        test('should return false for null id', () => {
            expect(registry.has(null)).toBe(false);
        });

        test('should return false for undefined id', () => {
            expect(registry.has(undefined)).toBe(false);
        });

        test('should return false for empty registry', () => {
            expect(registry.has('window1')).toBe(false);
        });
    });

    describe('getAll', () => {
        test('should return array of all registered windows', () => {
            const mockWindow1 = {};
            const mockWindow2 = {};
            registry.register('window1', mockWindow1);
            registry.register('window2', mockWindow2);
            const result = registry.getAll();
            expect(result).toHaveLength(2);
            expect(result).toContain(mockWindow1);
            expect(result).toContain(mockWindow2);
        });

        test('should return empty array for empty registry', () => {
            const result = registry.getAll();
            expect(result).toEqual([]);
        });

        test('should return array (not Map)', () => {
            const mockWindow = {};
            registry.register('window1', mockWindow);
            const result = registry.getAll();
            expect(Array.isArray(result)).toBe(true);
            expect(result).not.toBeInstanceOf(Map);
        });

        test('should return new array on each call', () => {
            const mockWindow = {};
            registry.register('window1', mockWindow);
            const result1 = registry.getAll();
            const result2 = registry.getAll();
            expect(result1).not.toBe(result2);
            expect(result1).toEqual(result2);
        });
    });

    describe('clear', () => {
        test('should remove all windows from registry', () => {
            const mockWindow1 = {};
            const mockWindow2 = {};
            registry.register('window1', mockWindow1);
            registry.register('window2', mockWindow2);
            registry.clear();
            expect(registry._windows.size).toBe(0);
        });

        test('should handle clearing empty registry', () => {
            expect(() => registry.clear()).not.toThrow();
            expect(registry._windows.size).toBe(0);
        });

        test('should allow registering after clear', () => {
            const mockWindow = {};
            registry.register('window1', mockWindow);
            registry.clear();
            registry.register('window2', mockWindow);
            expect(registry._windows.size).toBe(1);
            expect(registry.has('window2')).toBe(true);
        });
    });

    describe('Performance Tests', () => {
        test('should complete 10000 register/unregister cycles in less than 50ms', () => {
            const start = Date.now();
            for (let i = 0; i < 10000; i++) {
                registry.register(`window${i}`, {});
                registry.unregister(`window${i}`);
            }
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(50);
        });

        test('should handle 10000 registered windows efficiently', () => {
            const start = Date.now();
            for (let i = 0; i < 10000; i++) {
                registry.register(`window${i}`, {});
            }
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(100);
            expect(registry._windows.size).toBe(10000);
        });

        test('should handle getAll efficiently with many windows', () => {
            for (let i = 0; i < 10000; i++) {
                registry.register(`window${i}`, {});
            }
            const start = Date.now();
            const result = registry.getAll();
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(50);
            expect(result).toHaveLength(10000);
        });

        test('should handle has checks efficiently with many windows', () => {
            for (let i = 0; i < 10000; i++) {
                registry.register(`window${i}`, {});
            }
            const start = Date.now();
            const result = registry.has('window5000');
            const end = Date.now();
            const duration = end - start;
            expect(duration).toBeLessThan(10);
            expect(result).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('should handle special characters in id', () => {
            const mockWindow = {};
            registry.register('window-with-dashes', mockWindow);
            expect(registry.has('window-with-dashes')).toBe(true);
        });

        test('should handle unicode characters in id', () => {
            const mockWindow = {};
            registry.register('نافذة', mockWindow);
            expect(registry.has('نافذة')).toBe(true);
        });

        test('should handle very long id', () => {
            const longId = 'x'.repeat(10000);
            const mockWindow = {};
            registry.register(longId, mockWindow);
            expect(registry.has(longId)).toBe(true);
        });

        test('should handle numeric string id', () => {
            const mockWindow = {};
            registry.register('123', mockWindow);
            expect(registry.has('123')).toBe(true);
        });

        test('should handle id with spaces', () => {
            const mockWindow = {};
            registry.register('window with spaces', mockWindow);
            expect(registry.has('window with spaces')).toBe(true);
        });

        test('should handle multiple registrations with same id (override)', () => {
            const mockWindow1 = { version: 1 };
            const mockWindow2 = { version: 2 };
            const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            registry.register('window1', mockWindow1);
            registry.register('window1', mockWindow2);
            
            expect(registry._windows.size).toBe(1);
            expect(registry.get('window1').version).toBe(2);
            
            consoleWarnSpy.mockRestore();
        });

        test('should throw error for window object that is a function', () => {
            const mockWindow = function() {};
            expect(() => registry.register('window1', mockWindow)).toThrow('Invalid window object');
        });

        test('should handle window object that is an array', () => {
            const mockWindow = [];
            registry.register('window1', mockWindow);
            expect(registry.get('window1')).toBe(mockWindow);
        });
    });
});
