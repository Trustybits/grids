import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  test: {
    // Use jsdom to simulate a browser environment
    environment: "jsdom",
    // Make describe/it/expect available globally without imports
    globals: true,
    // Run this setup file before each test suite
    setupFiles: ["./src/test/setup.ts"],
    // Where to look for tests
    include: ["src/**/__tests__/**/*.test.ts", "api/**/__tests__/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,vue}"],
      exclude: [
        "src/test/**",
        "src/**/*.d.ts",
        "src/main.ts",
        "src/firebase.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@grids/contracts/types": fileURLToPath(
        new URL("../contracts/src/types/index.ts", import.meta.url),
      ),
      "@grids/contracts/dao": fileURLToPath(
        new URL("../contracts/src/dao/index.ts", import.meta.url),
      ),
      "@grids/contracts/auth": fileURLToPath(
        new URL("../contracts/src/auth/index.ts", import.meta.url),
      ),
      "@grids/contracts": fileURLToPath(
        new URL("../contracts/src/index.ts", import.meta.url),
      ),
    },
  },
});
