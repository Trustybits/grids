import { createSHA256 } from "hash-wasm";

/**
 * Chunked, incremental SHA-256 hashing for upload deduplication.
 *
 * Files are read and hashed in bounded chunks so large videos never have to be
 * fully materialized in memory, and the loop yields to the event loop between
 * chunks to keep the UI responsive. The digest is a lowercase hex string that
 * matches the server-side `createHash("sha256")` verification, and it is the
 * authoritative archive key at `users/{uid}/uploads/{hash}`.
 *
 * NOTE: hashing runs on the main thread today. Moving it into a Web Worker is a
 * worthwhile future enhancement for very large files, but the chunked yielding
 * below keeps interaction acceptable in the meantime.
 */

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB

/** Thrown when hashing (or a wrapping upload) is cancelled via an AbortSignal. */
export class UploadCancelledError extends Error {
  public constructor(message = "Upload cancelled.") {
    super(message);
    this.name = "UploadCancelledError";
  }
}

export interface HashFileOptions {
  /** Bytes read per chunk. Defaults to 8 MiB. */
  chunkSize?: number;
  /** Receives a 0–1 fraction of bytes hashed so far. */
  onProgress?: (fraction: number) => void;
  /** Abort hashing early; rejects with {@link UploadCancelledError}. */
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new UploadCancelledError();
  }
}

/**
 * Read a blob chunk to an ArrayBuffer. Prefers `Blob.arrayBuffer()` and falls
 * back to `FileReader` for environments (older Safari, some test DOMs) where
 * sliced blobs do not expose `arrayBuffer`.
 */
async function readChunkBytes(chunk: Blob): Promise<ArrayBuffer> {
  if (typeof chunk.arrayBuffer === "function") {
    return chunk.arrayBuffer();
  }
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read file chunk."));
    reader.readAsArrayBuffer(chunk);
  });
}

/**
 * Compute the lowercase hex SHA-256 digest of a file, hashing it incrementally
 * in chunks. Reports progress and supports cancellation.
 */
export async function hashFile(
  file: Blob,
  options: HashFileOptions = {},
): Promise<string> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, onProgress, signal } = options;
  throwIfAborted(signal);

  const hasher = await createSHA256();
  hasher.init();

  const total = file.size;
  onProgress?.(total === 0 ? 1 : 0);

  let processed = 0;
  for (let offset = 0; offset < total; offset += chunkSize) {
    throwIfAborted(signal);
    const end = Math.min(offset + chunkSize, total);
    const buffer = new Uint8Array(await readChunkBytes(file.slice(offset, end)));
    hasher.update(buffer);
    processed += buffer.length;
    onProgress?.(processed / total);
    // Yield between chunks so progress renders and the UI stays interactive.
    await Promise.resolve();
  }

  throwIfAborted(signal);
  const digest = hasher.digest("hex");
  onProgress?.(1);
  return digest;
}
