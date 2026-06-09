import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  envDir: fileURLToPath(new URL('../../', import.meta.url)),
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // @grids/pro uses import.meta.glob to optionally load its Firebase config.
    // Excluding it from dep pre-bundling ensures Vite (not esbuild) transforms
    // that glob, so the optional-config mechanism works in dev too.
    exclude: ['@grids/pro'],
  },
  build: {
    // Skip type checking
    outDir: 'dist',
  },
})
