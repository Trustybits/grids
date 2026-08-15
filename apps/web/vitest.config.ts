import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    // Disable asset-URL transformation in tests. Outside a dev server,
    // @vitejs/plugin-vue defaults to `transformAssetUrls.includeAbsolute = true`,
    // which rewrites template `src="/grids_logo.png"` into a real module import
    // of the absolute public path. Vite then resolves that path to a file URL;
    // on Windows the result (`file:///grids_logo.png`, no drive letter) makes
    // Node's fileURLToPath throw, breaking the dynamic component import even for
    // branches that never render the image. Tests only need the literal `src`
    // string, so skip the rewrite entirely.
    vue({ template: { transformAssetUrls: false } }),
  ],
  envDir: fileURLToPath(new URL("../../", import.meta.url)),
  test: {
    // Use jsdom to simulate a browser environment
    environment: "jsdom",
    // Node 25 enables an incomplete native Web Storage by default that
    // shadows jsdom's localStorage (clear/getItem become undefined). Disable
    // it so jsdom can provide a real Storage implementation.
    // See https://github.com/vitest-dev/vitest/issues/8757
    execArgv: ["--no-webstorage"],
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
        new URL("../../packages/contracts/src/types/index.ts", import.meta.url),
      ),
      "@grids/contracts/dao": fileURLToPath(
        new URL("../../packages/contracts/src/dao/index.ts", import.meta.url),
      ),
      "@grids/contracts/auth": fileURLToPath(
        new URL("../../packages/contracts/src/auth/index.ts", import.meta.url),
      ),
      "@grids/contracts/storage": fileURLToPath(
        new URL(
          "../../packages/contracts/src/storage/index.ts",
          import.meta.url,
        ),
      ),
      "@grids/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
    },
  },
});
