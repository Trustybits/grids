/**
 * Unit tests for ProRuntime (composition root)
 *
 * Covers:
 *  - no Firebase config (createFirebaseServices → null): hasValidFirebaseConfig
 *    is false and daoFactory/dbUtils/authProvider are null
 *  - valid config: services are wired into FirebaseDaoFactory (including the
 *    beacon URL), FirebaseDbUtils, and FirebaseAuthProvider
 *  - config passthrough: firebaseEnv and emulatorTargets reach
 *    createFirebaseServices unchanged
 *
 * The firebase service creation and the concrete implementations are mocked —
 * the wiring is the unit under test.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProRuntime } from "../ProRuntime.js";
import { createFirebaseServices } from "../firebase.js";
import { FirebaseDaoFactory } from "../../dao/firebase/factory/FirebaseDaoFactory.js";
import { FirebaseDbUtils } from "../../dao/firebase/FirebaseDbUtils.js";
import { FirebaseAuthProvider } from "../../auth/firebase/FirebaseAuthProvider.js";
import type { FirebaseEmulatorTarget } from "../firebase.js";

vi.mock("../firebase.js", () => ({
  createFirebaseServices: vi.fn(),
  FIREBASE_EMULATOR_TARGETS: ["auth", "firestore", "functions", "storage"],
}));
vi.mock("../../dao/firebase/factory/FirebaseDaoFactory.js", () => ({
  FirebaseDaoFactory: vi.fn(),
}));
vi.mock("../../dao/firebase/FirebaseDbUtils.js", () => ({
  FirebaseDbUtils: vi.fn(),
}));
vi.mock("../../auth/firebase/FirebaseAuthProvider.js", () => ({
  FirebaseAuthProvider: vi.fn(),
}));

const services = {
  app: { kind: "app" },
  auth: { kind: "auth" },
  db: { kind: "db" },
  analytics: { kind: "analytics" },
  functions: { kind: "functions" },
  storage: { kind: "storage" },
} as any;

const baseConfig = {
  firebaseEnv: "prod" as const,
  emulatorTargets: new Set<FirebaseEmulatorTarget>(),
  viewEndAnalyticsBeaconUrl: "https://example.com/beacon",
};

describe("ProRuntime", () => {
  describe("when no Firebase config is bundled", () => {
    beforeEach(() => {
      vi.mocked(createFirebaseServices).mockReturnValue(null);
    });

    it("reports an invalid config and exposes null members", () => {
      const runtime = new ProRuntime(baseConfig);

      expect(runtime.hasValidFirebaseConfig).toBe(false);
      expect(runtime.daoFactory).toBeNull();
      expect(runtime.dbUtils).toBeNull();
      expect(runtime.authProvider).toBeNull();
    });

    it("does not construct any implementation objects", () => {
      new ProRuntime(baseConfig);

      expect(FirebaseDaoFactory).not.toHaveBeenCalled();
      expect(FirebaseDbUtils).not.toHaveBeenCalled();
      expect(FirebaseAuthProvider).not.toHaveBeenCalled();
    });
  });

  describe("when Firebase services are created", () => {
    beforeEach(() => {
      vi.mocked(createFirebaseServices).mockReturnValue(services);
    });

    it("passes firebaseEnv and emulatorTargets to createFirebaseServices", () => {
      const emulatorTargets = new Set<FirebaseEmulatorTarget>([
        "auth",
        "firestore",
      ]);

      new ProRuntime({ ...baseConfig, firebaseEnv: "stage", emulatorTargets });

      expect(createFirebaseServices).toHaveBeenCalledExactlyOnceWith(
        "stage",
        emulatorTargets,
      );
    });

    it("wires the services into the factory, db utils, and auth provider", () => {
      const runtime = new ProRuntime(baseConfig);

      expect(runtime.hasValidFirebaseConfig).toBe(true);
      expect(FirebaseDaoFactory).toHaveBeenCalledExactlyOnceWith({
        db: services.db,
        functions: services.functions,
        storage: services.storage,
        viewEndAnalyticsBeaconUrl: "https://example.com/beacon",
      });
      expect(FirebaseDbUtils).toHaveBeenCalledTimes(1);
      expect(FirebaseAuthProvider).toHaveBeenCalledExactlyOnceWith(services.auth);

      expect(runtime.daoFactory).toBe(
        vi.mocked(FirebaseDaoFactory).mock.instances[0],
      );
      expect(runtime.dbUtils).toBe(vi.mocked(FirebaseDbUtils).mock.instances[0]);
      expect(runtime.authProvider).toBe(
        vi.mocked(FirebaseAuthProvider).mock.instances[0],
      );
    });

    it("forwards a null beacon URL to the factory", () => {
      new ProRuntime({ ...baseConfig, viewEndAnalyticsBeaconUrl: null });

      expect(FirebaseDaoFactory).toHaveBeenCalledWith(
        expect.objectContaining({ viewEndAnalyticsBeaconUrl: null }),
      );
    });
  });
});
