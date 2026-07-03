/**
 * Tests for FileHashing.ts — chunked SHA-256 hashing with progress reporting
 * and abort-based cancellation. Digests are asserted against known SHA-256
 * vectors so they stay consistent with the server-side verification.
 */

import { describe, it, expect, vi } from "vitest";
import { hashFile, UploadCancelledError } from "../FileHashing";

// SHA-256 of the empty string.
const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
// SHA-256 of "abc".
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function blob(text: string): Blob {
  return new Blob([text]);
}

describe("hashFile", () => {
  it("hashes an empty file to the canonical empty digest", async () => {
    expect(await hashFile(blob(""))).toBe(EMPTY_SHA256);
  });

  it("produces a stable, known digest for known content", async () => {
    expect(await hashFile(blob("abc"))).toBe(ABC_SHA256);
  });

  it("produces the same digest regardless of chunk size", async () => {
    const data = "the quick brown fox jumps over the lazy dog";
    const whole = await hashFile(blob(data));
    const chunked = await hashFile(blob(data), { chunkSize: 4 });
    expect(chunked).toBe(whole);
  });

  it("reports progress from 0 to 1", async () => {
    const onProgress = vi.fn();
    await hashFile(blob("abcdefghij"), { chunkSize: 4, onProgress });
    const fractions = onProgress.mock.calls.map((c) => c[0]);
    expect(fractions[0]).toBe(0);
    expect(fractions[fractions.length - 1]).toBe(1);
    // Monotonically non-decreasing.
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]).toBeGreaterThanOrEqual(fractions[i - 1]);
    }
  });

  it("rejects with UploadCancelledError when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      hashFile(blob("abc"), { signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadCancelledError);
  });

  it("aborts partway through a chunked hash", async () => {
    const controller = new AbortController();
    // Abort as soon as the first progress callback fires.
    const onProgress = vi.fn((fraction: number) => {
      if (fraction > 0) controller.abort();
    });
    await expect(
      hashFile(blob("abcdefghijklmnop"), {
        chunkSize: 4,
        onProgress,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(UploadCancelledError);
  });
});
