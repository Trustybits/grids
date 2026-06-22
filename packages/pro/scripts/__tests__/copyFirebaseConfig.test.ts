/**
 * Unit tests for scripts/copyFirebaseConfig.mjs
 *
 * The script runs at import time, so each test re-imports a fresh module
 * instance with `node:fs` mocked.
 *
 * Covers:
 *  - copies src/runtime/firebaseConfigs.json into dist/runtime (creating the
 *    directory) when the file exists
 *  - is a no-op when the file is absent (public/OSS checkout)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

vi.mock("node:fs", () => ({
  copyFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

async function runScript(): Promise<void> {
  vi.resetModules();
  await import("../copyFirebaseConfig.mjs");
}

describe("copyFirebaseConfig script", () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset();
    vi.mocked(mkdirSync).mockReset();
    vi.mocked(copyFileSync).mockReset();
  });

  it("creates dist/runtime and copies the config when the source exists", async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    await runScript();

    expect(existsSync).toHaveBeenCalledWith(
      expect.stringMatching(/src[\\/]runtime[\\/]firebaseConfigs\.json/),
    );
    expect(mkdirSync).toHaveBeenCalledWith(
      expect.stringMatching(/dist[\\/]runtime/),
      { recursive: true },
    );
    expect(copyFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/src[\\/]runtime[\\/]firebaseConfigs\.json/),
      expect.stringMatching(/dist[\\/]runtime[\\/]firebaseConfigs\.json/),
    );
  });

  it("does nothing when the config file is absent", async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await runScript();

    expect(mkdirSync).not.toHaveBeenCalled();
    expect(copyFileSync).not.toHaveBeenCalled();
  });
});
