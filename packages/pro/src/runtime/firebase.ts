import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  type Auth,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getAnalytics, type Analytics } from "firebase/analytics";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from "firebase/functions";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";
import {
  getFirebaseConfig,
  hasFirebaseConfig,
  type FirebaseEnv,
} from "./firebaseConfigs.js";

export const FIREBASE_EMULATOR_TARGETS = [
  "auth",
  "firestore",
  "functions",
  "storage",
] as const;

export type FirebaseEmulatorTarget = (typeof FIREBASE_EMULATOR_TARGETS)[number];

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  analytics: Analytics;
  functions: Functions;
  storage: FirebaseStorage;
}

/**
 * Initializes the Firebase services for `firebaseEnv`, or returns `null` when
 * no Firebase configuration is present (the gitignored `firebaseConfigs.json`
 * was not bundled into this build). A `null` return tells the runtime to fall
 * back to the stubbed backend.
 */
export function createFirebaseServices(
  firebaseEnv: FirebaseEnv,
  emulatorTargets: ReadonlySet<FirebaseEmulatorTarget>,
): FirebaseServices | null {
  const config = getFirebaseConfig(firebaseEnv);
  if (!hasFirebaseConfig || !config) {
    return null;
  }

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const analytics = getAnalytics(app);
  const functions = getFunctions(app);
  const storage = getStorage(app);

  if (emulatorTargets.has("auth")) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
  }
  if (emulatorTargets.has("firestore")) {
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  if (emulatorTargets.has("functions")) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  if (emulatorTargets.has("storage")) {
    connectStorageEmulator(storage, "127.0.0.1", 9199);
  }

  return { app, auth, db, analytics, functions, storage };
}
