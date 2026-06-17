/**
 * Unit tests for runtime/firebaseConfigs.ts
 *
 * The module loads an optional, gitignored `firebaseConfigs.json` via
 * `import.meta.glob`. Developer checkouts may or may not have that file, so
 * these tests only assert behavior that is stable in both states.
 */

import { describe, it, expect } from "vitest";
import {
  getFirebaseConfig,
  hasFirebaseConfig,
  type FirebaseEnv,
  type FirebaseProjectConfig,
} from "../firebaseConfigs.js";

const envs: FirebaseEnv[] = ["prod", "stage"];

function expectValidConfig(config: FirebaseProjectConfig) {
  expect(config).toEqual(
    expect.objectContaining({
      apiKey: expect.any(String),
      authDomain: expect.any(String),
      projectId: expect.any(String),
      storageBucket: expect.any(String),
      messagingSenderId: expect.any(String),
      appId: expect.any(String),
    }),
  );
}

describe("firebaseConfigs", () => {
  it("reports Firebase config file presence as a boolean", () => {
    expect(typeof hasFirebaseConfig).toBe("boolean");
  });

  it.each(envs)("returns null or a valid %s config", (env) => {
    const config = getFirebaseConfig(env);

    if (config === null) {
      expect(config).toBeNull();
      return;
    }

    expect(hasFirebaseConfig).toBe(true);
    expectValidConfig(config);
  });
});
