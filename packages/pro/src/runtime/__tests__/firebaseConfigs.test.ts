/**
 * Unit tests for runtime/firebaseConfigs.ts
 *
 * The module loads an optional, gitignored `firebaseConfigs.json` via
 * `import.meta.glob`. In this checkout the file is absent (it only exists in
 * the private deploy repo), so these tests validate the documented fallback
 * path: the module must report "no config" instead of crashing, which is the
 * signal for the app to use the stubbed backend.
 */

import { describe, it, expect } from "vitest";
import { getFirebaseConfig, hasFirebaseConfig } from "../firebaseConfigs.js";

describe("firebaseConfigs (no firebaseConfigs.json bundled)", () => {
  it("reports that no Firebase config file is present", () => {
    expect(hasFirebaseConfig).toBe(false);
  });

  it("returns null for the prod environment", () => {
    expect(getFirebaseConfig("prod")).toBeNull();
  });

  it("returns null for the stage environment", () => {
    expect(getFirebaseConfig("stage")).toBeNull();
  });
});
