import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
    rootDir: '../../',
    setupFilesAfterEnv: ['<rootDir>/config/jest/jest.setup.js'],
    testEnvironment: 'jest-environment-jsdom',
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
    },
    // Offsite tests use Node's test runner, invoked separately by npm test.
    testPathIgnorePatterns: ['<rootDir>/tests/e2e/', '<rootDir>/node_modules/', '<rootDir>/scripts/backup-offsite.test.mjs'],
    modulePathIgnorePatterns: ['<rootDir>/.next/'],
    watchPathIgnorePatterns: ['<rootDir>/.next/'],
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig);
