// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const FIREBASE_EMULATOR_TARGETS = [
  "auth",
  "firestore",
  "functions",
  "storage",
] as const;

type FirebaseEmulatorTarget = (typeof FIREBASE_EMULATOR_TARGETS)[number];

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD1SapZGG49zaIfBv3QqZWxobQmws263zQ",
  authDomain: "grids-one.firebaseapp.com",
  projectId: "grids-one",
  storageBucket: "grids-one.firebasestorage.app",
  messagingSenderId: "598562210148",
  appId: "1:598562210148:web:6bfd6ef229fcd9fd5b3a71",
  measurementId: "G-8Q904761XS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);
const functions = getFunctions(app);
const storage = getStorage(app);

const emulatorTargets = getFirebaseEmulatorTargets(
  import.meta.env.VITE_FIREBASE_EMULATORS,
);

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

function getFirebaseEmulatorTargets(value: string | undefined) {
  const targets = new Set<FirebaseEmulatorTarget>();
  if (!value) return targets;

  for (const token of value.split(",")) {
    const target = token.trim().toLowerCase();
    if (target === "all") {
      FIREBASE_EMULATOR_TARGETS.forEach((target) => targets.add(target));
      continue;
    }

    if (isFirebaseEmulatorTarget(target)) {
      targets.add(target);
    } else if (target) {
      console.warn(`Ignoring unknown Firebase emulator target: ${target}`);
    }
  }

  return targets;
}

function isFirebaseEmulatorTarget(
  value: string,
): value is FirebaseEmulatorTarget {
  return FIREBASE_EMULATOR_TARGETS.includes(
    value as FirebaseEmulatorTarget,
  );
}

export { app, auth, db, analytics, functions, storage };
