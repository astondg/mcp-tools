/**
 * Vitest Configuration
 *
 * Test configuration for the MCP Tools project
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Test environment
    environment: 'node',

    // Setup files to run before tests
    setupFiles: ['./tests/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types.ts',
        'dist/',
        '.next/',
      ],
      // Coverage thresholds
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },

    // Test timeout
    testTimeout: 10000,

    // Hook timeouts
    hookTimeout: 10000,

    // Isolation
    isolate: true,

    // Watch options
    watch: false,

    // Include/exclude patterns
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next'],

    // Reporters
    reporters: process.env.CI ? ['verbose', 'junit'] : ['verbose'],

    // Output
    outputFile: {
      junit: './test-results/junit.xml',
    },
  },

  // Path aliases (must match tsconfig.json)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/lib': path.resolve(__dirname, './src/lib'),
      '@/app': path.resolve(__dirname, './src/app'),
    },
  },
});
