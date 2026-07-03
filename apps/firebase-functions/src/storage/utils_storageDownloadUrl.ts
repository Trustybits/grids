/**
 * Firebase Storage download-URL helpers.
 *
 * Cloud Functions persist `?alt=media` download URLs into Firestore (archive
 * docs, thumbnail references, etc.). When the Storage emulator is running the
 * Admin SDK writes objects there, so those URLs must point at the emulator
 * host — otherwise a reloaded/re-authenticated client requests the object from
 * production GCS (where it does not exist) and gets a permission error. Every
 * server-built download URL should go through these helpers so the host is
 * chosen consistently.
 */

/** Origin for download URLs: the Storage emulator host when set, else prod GCS. */
export function storageDownloadOrigin(): string {
  const emulatorHost =
    process.env.STORAGE_EMULATOR_HOST ??
    process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (emulatorHost) {
    return emulatorHost.startsWith("http")
      ? emulatorHost
      : `http://${emulatorHost}`;
  }
  return "https://firebasestorage.googleapis.com";
}

/**
 * Build an emulator-aware `?alt=media` download URL for an object, appending an
 * encoded download token when one is provided.
 */
export function buildStorageDownloadUrl(
  bucketName: string,
  path: string,
  token?: string,
): string {
  const base =
    `${storageDownloadOrigin()}/v0/b/${bucketName}/o/` +
    `${encodeURIComponent(path)}?alt=media`;
  return token ? `${base}&token=${encodeURIComponent(token)}` : base;
}
