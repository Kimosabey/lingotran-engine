import { defineConfig } from 'vitest/config';

/**
 * Test runner configuration for the German web-extraction module.
 *
 * Unit tests live in tests/unit and must never touch the network.
 * Integration tests live in tests/integration and may render local HTML
 * fixtures (tests/fixtures) — they must not hit live websites in CI.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: [
        'adapters/**/*.ts',
        'extractors/**/*.ts',
        'parsers/**/*.ts',
        'transformers/**/*.ts',
        'validators/**/*.ts',
        'pipelines/**/*.ts',
      ],
      // Raise these as the module is implemented. Foundation ships at 0.
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
    },
  },
});
