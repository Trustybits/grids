import { getBytes, ref as storageRef } from "firebase/storage";
import { storage } from "@/firebase";

/** Firebase Storage REST download URL: /v0/b/{bucket}/o/{urlEncodedPath}?... */
const FIREBASE_STORAGE_V0_DOWNLOAD =
  /^https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/i;

export function firebaseStorageObjectPathFromDownloadUrl(
  url: string,
): string | null {
  const m = url.match(FIREBASE_STORAGE_V0_DOWNLOAD);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/\+/g, " "));
  } catch {
    return null;
  }
}

/**
 * Load raw file bytes. Uses the Firebase SDK for Storage download URLs so
 * browser `fetch()` is not blocked by CORS on localhost / web app origins.
 */
export async function loadDocumentBytes(url: string): Promise<Uint8Array> {
  const objectPath = firebaseStorageObjectPathFromDownloadUrl(url);
  if (objectPath) {
    const bytes = await getBytes(storageRef(storage, objectPath));
    // #region agent log
    fetch("http://127.0.0.1:7798/ingest/9bdcd177-980d-473a-a0d6-90ada5c856d3", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "01bea2",
      },
      body: JSON.stringify({
        sessionId: "01bea2",
        runId: "post-fix",
        hypothesisId: "CORS",
        location: "documentBytes.ts:loadDocumentBytes",
        message: "bytes via Firebase getBytes",
        data: { byteLength: bytes.byteLength },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return bytes;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const out = new Uint8Array(buf);
  // #region agent log
  fetch("http://127.0.0.1:7798/ingest/9bdcd177-980d-473a-a0d6-90ada5c856d3", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "01bea2",
    },
    body: JSON.stringify({
      sessionId: "01bea2",
      runId: "post-fix",
      hypothesisId: "CORS",
      location: "documentBytes.ts:loadDocumentBytes",
      message: "bytes via fetch",
      data: { byteLength: out.byteLength },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return out;
}

export function uint8ArrayToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}
