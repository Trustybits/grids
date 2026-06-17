import * as logger from "firebase-functions/logger";

/**
 * The active GCP/Firebase project ID. Firebase injects this into the runtime
 * environment for both deployed functions and the local emulator, so it never
 * needs to be hardcoded in source or committed to a config file. Returns an
 * empty string only when neither variable is set (e.g. a bare script run
 * outside the Firebase runtime), in which case callers degrade gracefully
 * rather than crash.
 */
export function getProjectId(): string {
  const projectId =
    process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? "";
  if (!projectId) {
    logger.warn(
      "No GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT in env; project-derived values will be empty",
    );
  }
  return projectId;
}

/** Default Cloud Storage bucket for the active project. */
export function getStorageBucket(): string {
  return `${getProjectId()}.firebasestorage.app`;
}

/**
 * Base URL for the Firestore REST API of the active project's default
 * database (no trailing slash). Inside the emulator suite the functions
 * runtime gets FIRESTORE_EMULATOR_HOST injected, so REST reads target the
 * local Firestore emulator instead of production.
 */
export function getFirestoreRestBase(): string {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const origin = emulatorHost
    ? `http://${emulatorHost}`
    : "https://firestore.googleapis.com";
  return `${origin}/v1/projects/${getProjectId()}/databases/(default)/documents`;
}
