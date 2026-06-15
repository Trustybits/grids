/**
 * Unit tests for runtime/firebase.ts — createFirebaseServices
 *
 * Covers:
 *  - returns null when no Firebase config is available for the env
 *  - returns null when no config file was bundled (hasFirebaseConfig false),
 *    even if an env config happens to be returned
 *  - initializes the app with the env config and constructs all services
 *  - connects each requested emulator with its canonical host/port
 *  - connects all emulators when every target is requested
 *  - connects no emulators when the target set is empty
 *  - FIREBASE_EMULATOR_TARGETS constant shape
 *
 * firebaseConfigs.js is mocked; the SDK init functions come from the global
 * setup mocks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { getFirebaseConfig } from "../firebaseConfigs.js";
import {
  createFirebaseServices,
  FIREBASE_EMULATOR_TARGETS,
  type FirebaseEmulatorTarget,
} from "../firebase.js";

// `hasFirebaseConfig` is a const export in the real module; expose it here via
// a getter backed by mutable hoisted state so individual tests can flip it to
// exercise the "no config file bundled" branch.
const configState = vi.hoisted(() => ({ hasFirebaseConfig: true }));

vi.mock("../firebaseConfigs.js", () => ({
  get hasFirebaseConfig() {
    return configState.hasFirebaseConfig;
  },
  getFirebaseConfig: vi.fn(),
}));

const fakeConfig = {
  apiKey: "key",
  authDomain: "x.firebaseapp.com",
  projectId: "x",
  storageBucket: "x.appspot.com",
  messagingSenderId: "1",
  appId: "1:web",
};

const noEmulators = new Set<FirebaseEmulatorTarget>();

describe("FIREBASE_EMULATOR_TARGETS", () => {
  it("lists the four supported emulator targets", () => {
    expect(FIREBASE_EMULATOR_TARGETS).toEqual([
      "auth",
      "firestore",
      "functions",
      "storage",
    ]);
  });
});

describe("createFirebaseServices", () => {
  beforeEach(() => {
    configState.hasFirebaseConfig = true;
    vi.mocked(getFirebaseConfig).mockReturnValue(fakeConfig);
  });

  it("returns null when there is no config for the requested env", () => {
    vi.mocked(getFirebaseConfig).mockReturnValue(null);

    const result = createFirebaseServices("stage", noEmulators);

    expect(getFirebaseConfig).toHaveBeenCalledWith("stage");
    expect(result).toBeNull();
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("returns null when no config file was bundled, even if an env config is returned", () => {
    configState.hasFirebaseConfig = false;
    vi.mocked(getFirebaseConfig).mockReturnValue(fakeConfig);

    const result = createFirebaseServices("prod", noEmulators);

    expect(result).toBeNull();
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("initializes the app with the env config and constructs all services", () => {
    const app = { kind: "app" };
    vi.mocked(initializeApp).mockReturnValue(app as any);
    vi.mocked(getAuth).mockReturnValue("auth" as any);
    vi.mocked(getFirestore).mockReturnValue("db" as any);
    vi.mocked(getAnalytics).mockReturnValue("analytics" as any);
    vi.mocked(getFunctions).mockReturnValue("functions" as any);
    vi.mocked(getStorage).mockReturnValue("storage" as any);

    const result = createFirebaseServices("prod", noEmulators);

    expect(getFirebaseConfig).toHaveBeenCalledWith("prod");
    expect(initializeApp).toHaveBeenCalledWith(fakeConfig);
    expect(getAuth).toHaveBeenCalledWith(app);
    expect(getFirestore).toHaveBeenCalledWith(app);
    expect(getAnalytics).toHaveBeenCalledWith(app);
    expect(getFunctions).toHaveBeenCalledWith(app);
    expect(getStorage).toHaveBeenCalledWith(app);
    expect(result).toEqual({
      app,
      auth: "auth",
      db: "db",
      analytics: "analytics",
      functions: "functions",
      storage: "storage",
    });
  });

  it("connects no emulators when the target set is empty", () => {
    createFirebaseServices("prod", noEmulators);

    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(connectFunctionsEmulator).not.toHaveBeenCalled();
    expect(connectStorageEmulator).not.toHaveBeenCalled();
  });

  it("connects only the requested emulators with their canonical endpoints", () => {
    vi.mocked(getAuth).mockReturnValue("auth" as any);
    vi.mocked(getFirestore).mockReturnValue("db" as any);

    createFirebaseServices(
      "prod",
      new Set<FirebaseEmulatorTarget>(["auth", "firestore"]),
    );

    expect(connectAuthEmulator).toHaveBeenCalledWith(
      "auth",
      "http://127.0.0.1:9099",
      { disableWarnings: true },
    );
    expect(connectFirestoreEmulator).toHaveBeenCalledWith("db", "127.0.0.1", 8080);
    expect(connectFunctionsEmulator).not.toHaveBeenCalled();
    expect(connectStorageEmulator).not.toHaveBeenCalled();
  });

  it("connects the functions and storage emulators when requested", () => {
    vi.mocked(getFunctions).mockReturnValue("functions" as any);
    vi.mocked(getStorage).mockReturnValue("storage" as any);

    createFirebaseServices(
      "prod",
      new Set<FirebaseEmulatorTarget>(["functions", "storage"]),
    );

    expect(connectFunctionsEmulator).toHaveBeenCalledWith(
      "functions",
      "127.0.0.1",
      5001,
    );
    expect(connectStorageEmulator).toHaveBeenCalledWith(
      "storage",
      "127.0.0.1",
      9199,
    );
    expect(connectAuthEmulator).not.toHaveBeenCalled();
    expect(connectFirestoreEmulator).not.toHaveBeenCalled();
  });

  it("connects every emulator when all targets are requested", () => {
    vi.mocked(getAuth).mockReturnValue("auth" as any);
    vi.mocked(getFirestore).mockReturnValue("db" as any);
    vi.mocked(getFunctions).mockReturnValue("functions" as any);
    vi.mocked(getStorage).mockReturnValue("storage" as any);

    createFirebaseServices(
      "prod",
      new Set<FirebaseEmulatorTarget>(FIREBASE_EMULATOR_TARGETS),
    );

    expect(connectAuthEmulator).toHaveBeenCalledWith(
      "auth",
      "http://127.0.0.1:9099",
      { disableWarnings: true },
    );
    expect(connectFirestoreEmulator).toHaveBeenCalledWith(
      "db",
      "127.0.0.1",
      8080,
    );
    expect(connectFunctionsEmulator).toHaveBeenCalledWith(
      "functions",
      "127.0.0.1",
      5001,
    );
    expect(connectStorageEmulator).toHaveBeenCalledWith(
      "storage",
      "127.0.0.1",
      9199,
    );
  });
});
