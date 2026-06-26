import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Resolve @grids/contracts to its TypeScript source instead of its built
  // `dist/` output so the test suite is self-contained and does not require
  // `npm run build:contracts` to have run first. Only value imports (e.g. the
  // AnalyticsEventType enum) actually trip the missing-dist resolution error,
  // but aliasing every subpath keeps tests from depending on build artifacts.
  resolve: {
    alias: {
      '@grids/contracts/types': fileURLToPath(
        new URL('../contracts/src/types/index.ts', import.meta.url),
      ),
      '@grids/contracts/dao': fileURLToPath(
        new URL('../contracts/src/dao/index.ts', import.meta.url),
      ),
      '@grids/contracts/auth': fileURLToPath(
        new URL('../contracts/src/auth/index.ts', import.meta.url),
      ),
      '@grids/contracts': fileURLToPath(
        new URL('../contracts/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.test.ts',
      'scripts/__tests__/**/*.test.ts',
    ],
  },
})
