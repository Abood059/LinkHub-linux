// jest.e2e.config.js
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/e2e/**/*.test.js'],
    testTimeout: 30000,
    verbose: true,
    setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup.js'],
    collectCoverageFrom: [
        'src/main/**/*.js',
        '!src/main/index.js',
        '!**/node_modules/**'
    ],
    coverageDirectory: 'coverage/e2e',
    coverageReporters: ['text', 'lcov', 'html']
};
