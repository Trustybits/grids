/**
 * Unit tests for the server-side object hasher used to verify uploads on
 * finalize (see notes/storage-refactor-implementation-plan.md, Phase 1.1 and
 * Phase 1.3 hash-mismatch verification).
 *
 * The Admin Storage SDK is mocked so `createReadStream` emits controlled
 * chunks; the expected digest is computed independently with node:crypto so
 * the assertions catch a genuinely wrong hash rather than re-deriving it from
 * the implementation.
 */
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { storageState } = vi.hoisted(() => ({
  storageState: {
    // Maps a `${bucketName}:${path}` key to the chunks its stream should emit.
    chunks: new Map<string, Buffer[]>(),
    // Keys that should emit a stream error instead of data.
    errorKeys: new Set<string>(),
    bucketCalls: [] as Array<string | undefined>,
    fileCalls: [] as string[],
  },
}));

vi.mock("../../admin.js", () => ({
  default: {
    storage: () => ({
      bucket: (bucketName?: string) => {
        storageState.bucketCalls.push(bucketName);
        return {
          file: (path: string) => {
            storageState.fileCalls.push(path);
            const key = `${bucketName ?? "default"}:${path}`;
            return {
              createReadStream: () => {
                if (storageState.errorKeys.has(key)) {
                  return new Readable({
                    read() {
                      this.destroy(new Error("stream failed"));
                    },
                  });
                }
                const chunks = storageState.chunks.get(key) ?? [];
                return Readable.from(chunks);
              },
            };
          },
        };
      },
    }),
  },
}));

import { hashStorageObject } from "../utils_storageHash.js";

const PATH = "users/user-1/images/object.png";

function sha256(buffers: Buffer[]): string {
  const hash = createHash("sha256");
  for (const buffer of buffers) hash.update(buffer);
  return hash.digest("hex");
}

beforeEach(() => {
  storageState.chunks = new Map();
  storageState.errorKeys = new Set();
  storageState.bucketCalls = [];
  storageState.fileCalls = [];
});

describe("hashStorageObject", () => {
  it("streams the object and returns its sha256 hex digest", async () => {
    const buffers = [Buffer.from("hello "), Buffer.from("world")];
    storageState.chunks.set(`default:${PATH}`, buffers);

    await expect(hashStorageObject(PATH)).resolves.toBe(sha256(buffers));
    expect(storageState.fileCalls).toEqual([PATH]);
  });

  it("hashes multi-chunk content the same as a single concatenated buffer", async () => {
    const whole = [Buffer.from("abcdefghijklmnopqrstuvwxyz")];
    const chunked = [
      Buffer.from("abcdefghij"),
      Buffer.from("klmnopqrst"),
      Buffer.from("uvwxyz"),
    ];
    storageState.chunks.set("default:whole", whole);
    storageState.chunks.set("default:chunked", chunked);

    const [wholeDigest, chunkedDigest] = await Promise.all([
      hashStorageObject("whole"),
      hashStorageObject("chunked"),
    ]);
    expect(chunkedDigest).toBe(wholeDigest);
  });

  it("hashes an empty object to the sha256 of no bytes", async () => {
    storageState.chunks.set(`default:${PATH}`, []);

    await expect(hashStorageObject(PATH)).resolves.toBe(
      createHash("sha256").digest("hex"),
    );
  });

  it("targets the named bucket when one is provided", async () => {
    const buffers = [Buffer.from("named-bucket")];
    storageState.chunks.set(`other-bucket:${PATH}`, buffers);

    await expect(hashStorageObject(PATH, "other-bucket")).resolves.toBe(
      sha256(buffers),
    );
    expect(storageState.bucketCalls).toEqual(["other-bucket"]);
  });

  it("rejects when the read stream errors", async () => {
    storageState.errorKeys.add(`default:${PATH}`);

    await expect(hashStorageObject(PATH)).rejects.toThrow("stream failed");
  });
});
