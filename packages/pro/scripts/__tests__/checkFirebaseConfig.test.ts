/**
 * Unit tests for scripts/checkFirebaseConfig.mjs — the production build guard.
 *
 * The script runs at import time and signals outcomes via process.exit, so
 * each test re-imports a fresh module instance with `node:fs` mocked and
 * process.exit stubbed to throw a sentinel.
 *
 * Covers:
 *  - no-op exit(0) when REQUIRE_FIREBASE_CONFIG is unset
 *  - fail(1) when VITE_USE_FIREBASE is "false" or unset (before any fs access)
 *  - fail(1) when firebaseConfigs.json is missing
 *  - fail(1) on invalid JSON
 *  - fail(1) when the target env config is absent, the entry is present but has
 *    no apiKey, the apiKey is an empty string, the apiKey is REPLACE_ME, or the
 *    parsed JSON is not an object
 *  - success (no exit) for a valid config; VITE_FIREBASE_ENV selects the env,
 *    defaulting to "prod"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

class ExitError extends Error {
  public constructor(public code: number) {
    super(`exit ${code}`);
  }
}

const ENV_KEYS = [
  "REQUIRE_FIREBASE_CONFIG",
  "VITE_USE_FIREBASE",
  "VITE_FIREBASE_ENV",
] as const;
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

/** Import a fresh instance of the script; resolves when it runs to completion. */
async function runScript(): Promise<void> {
  vi.resetModules();
  await import("../checkFirebaseConfig.mjs");
}

/** Run the script and return the exit code it attempted, or null if none. */
async function runScriptForExitCode(): Promise<number | null> {
  try {
    await runScript();
    return null;
  } catch (err) {
    if (err instanceof ExitError) return err.code;
    throw err;
  }
}

describe("checkFirebaseConfig script", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new ExitError(code ?? 0);
    }) as never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    vi.restoreAllMocks();
  });

  it("exits 0 without checking anything when REQUIRE_FIREBASE_CONFIG is unset", async () => {
    expect(await runScriptForExitCode()).toBe(0);
    expect(existsSync).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("fails when VITE_USE_FIREBASE is not 'true'", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "false";

    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('VITE_USE_FIREBASE is not "true"'),
    );
  });

  it("fails when VITE_USE_FIREBASE is unset", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    // VITE_USE_FIREBASE intentionally left unset (undefined !== "true").

    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('VITE_USE_FIREBASE is not "true"'),
    );
    // Should fail at the env guard before ever touching the filesystem.
    expect(existsSync).not.toHaveBeenCalled();
  });

  it("fails when firebaseConfigs.json is missing", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    vi.mocked(existsSync).mockReturnValue(false);

    expect(await runScriptForExitCode()).toBe(1);
    expect(existsSync).toHaveBeenCalledWith(
      expect.stringContaining("firebaseConfigs.json"),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("is missing"),
    );
  });

  it("fails when firebaseConfigs.json is not valid JSON", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("{ not json" as never);

    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not valid JSON"),
    );
  });

  it("fails when the target env has no config entry", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ stage: { apiKey: "real" } }) as never,
    );

    // Defaults to "prod", which is absent here.
    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no usable "prod" config'),
    );
  });

  it("fails when the target env entry is present but has no apiKey", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    vi.mocked(existsSync).mockReturnValue(true);
    // Entry exists but is empty — distinct from the entry being absent.
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ prod: {} }) as never,
    );

    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no usable "prod" config'),
    );
  });

  it("fails when the target env apiKey is an empty string", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ prod: { apiKey: "" } }) as never,
    );

    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no usable "prod" config'),
    );
  });

  it("fails when the parsed JSON is not an object", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    vi.mocked(existsSync).mockReturnValue(true);
    // Valid JSON, but null — parsed?.[env] short-circuits to undefined.
    vi.mocked(readFileSync).mockReturnValue("null" as never);

    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no usable "prod" config'),
    );
  });

  it("fails when the target env apiKey is still REPLACE_ME", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ prod: { apiKey: "REPLACE_ME" } }) as never,
    );

    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no usable "prod" config'),
    );
  });

  it("succeeds for a valid prod config without exiting", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ prod: { apiKey: "real-key" } }) as never,
    );

    expect(await runScriptForExitCode()).toBeNull();
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('valid for "prod"'),
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("validates the env selected by VITE_FIREBASE_ENV", async () => {
    process.env.REQUIRE_FIREBASE_CONFIG = "1";
    process.env.VITE_USE_FIREBASE = "true";
    process.env.VITE_FIREBASE_ENV = "stage";
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({
        prod: { apiKey: "real-key" },
        stage: { apiKey: "REPLACE_ME" },
      }) as never,
    );

    expect(await runScriptForExitCode()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('no usable "stage" config'),
    );
  });
});
