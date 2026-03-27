import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // Use jsdom to simulate a browser environment
    environment: 'jsdom',
    // Make describe/it/expect available globally without imports
    globals: true,
    // Run this setup file before each test suite
    setupFiles: ['./src/test/setup.ts'],
    // Where to look for tests
    include: ['src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: [
        'src/test/**',
        'src/**/*.d.ts',
        'src/main.ts',
        'src/firebase.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
