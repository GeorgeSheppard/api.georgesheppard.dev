import { defineConfig } from 'vitest/config';
import path from 'path';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts', '!src/**/*.integration.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration:mise',
          include: ['src/websites/mise/**/*.integration.test.ts'],
          setupFiles: ['./test/setup-mise.ts'],
          testTimeout: 60000,
          hookTimeout: 120000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration:shelfie',
          include: ['src/websites/shelfie/**/*.integration.test.ts'],
          setupFiles: ['./test/setup-shelfie.ts'],
          testTimeout: 60000,
          hookTimeout: 120000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration:tfl',
          include: ['src/websites/tfl/**/*.integration.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration:db',
          include: ['src/core/**/*.integration.test.ts', '!src/core/auth/**/*.integration.test.ts'],
          testTimeout: 60000,
          hookTimeout: 120000,
        },
      },
      {
        extends: true,
        test: {
          name: 'integration:auth',
          include: ['src/core/auth/**/*.integration.test.ts'],
          testTimeout: 60000,
          hookTimeout: 120000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@config': path.resolve(__dirname, './src/config'),
      '@websites': path.resolve(__dirname, './src/websites'),
      '@plugins': path.resolve(__dirname, './src/plugins'),
      '@test': path.resolve(__dirname, './test'),
    },
  },
});
