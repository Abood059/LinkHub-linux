// tests/e2e/setup.js
'use strict';

// Increase timeout for E2E tests
jest.setTimeout(30000);

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
