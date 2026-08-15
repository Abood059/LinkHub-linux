module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/main/domain/**/*.js',
    'src/main/runtime/**/*.js',
    'src/main/infrastructure/**/*.js',
    '!src/main/**/*.test.js',
    '!src/main/**/index.js',
    '!src/main/**/constants.js'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    // Exclude tests that require native better-sqlite3 module (needs rebuild)
    '<rootDir>/tests/integration/infrastructure/DatabaseManager.integration.test.js',
    '<rootDir>/tests/performance/infrastructure/PerformanceStress.test.js',
    // Exclude long-running yt-dlp integration tests
    '<rootDir>/tests/integration/ytdlp-wrap-plus.test.js',
    '<rootDir>/tests/integration/infrastructure/media/DownloadPathVerification.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  verbose: true,
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
