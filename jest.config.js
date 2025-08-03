module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'server',
      testMatch: ['<rootDir>/server/**/*.test.js'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.js'],
      collectCoverageFrom: [
        'server/src/**/*.js',
        '!server/src/**/*.test.js',
        '!server/src/index.js'
      ]
    },
    {
      displayName: 'client',
      testMatch: ['<rootDir>/client/**/*.test.{ts,tsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/client/__tests__/setup.ts'],
      moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/client/$1',
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
      },
      transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
      },
      collectCoverageFrom: [
        'client/**/*.{ts,tsx}',
        '!client/**/*.test.{ts,tsx}',
        '!client/pages/_app.tsx',
        '!client/pages/_document.tsx',
        '!client/next.config.js'
      ]
    }
  ],
  collectCoverageFrom: [
    'server/src/**/*.js',
    'client/**/*.{ts,tsx}',
    '!**/*.test.{js,ts,tsx}',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};