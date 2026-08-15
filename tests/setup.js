// tests/setup.js
'use strict';

// Mock better-sqlite3 to avoid native module issues in tests
jest.mock('better-sqlite3', () => {
    const mockDb = {
        prepare: jest.fn(() => ({
            run: jest.fn(),
            get: jest.fn(),
            all: jest.fn(),
            bind: jest.fn(() => ({
                run: jest.fn(),
                get: jest.fn(),
                all: jest.fn()
            }))
        })),
        exec: jest.fn(),
        close: jest.fn(),
        pragma: jest.fn()
    };
    
    const MockDatabase = jest.fn(() => mockDb);
    MockDatabase.Database = mockDb;
    
    return MockDatabase;
});

// Setup before all tests
beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
});

// Cleanup after each test
afterEach(async () => {
    // Reset all mocks between tests
    jest.clearAllMocks();
    jest.resetAllMocks();
});

// Global cleanup after all tests
afterAll(async () => {
    // Final cleanup if needed
});
