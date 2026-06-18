/**
 * Tests for BinaryUtils.ts
 *
 * Covers uint8ArrayToArrayBuffer — converting a Uint8Array (which may be a view
 * into a larger buffer) to a standalone, correctly-sized ArrayBuffer copy.
 */

import { describe, it, expect } from "vitest";
import { uint8ArrayToArrayBuffer } from "../BinaryUtils";

describe("uint8ArrayToArrayBuffer", () => {
  it("returns an ArrayBuffer instance", () => {
    const out = uint8ArrayToArrayBuffer(new Uint8Array([1, 2, 3]));
    expect(out).toBeInstanceOf(ArrayBuffer);
  });

  it("produces a buffer whose byteLength matches the input length", () => {
    const out = uint8ArrayToArrayBuffer(new Uint8Array([1, 2, 3, 4, 5]));
    expect(out.byteLength).toBe(5);
  });

  it("copies the byte values faithfully", () => {
    const out = uint8ArrayToArrayBuffer(new Uint8Array([10, 20, 30]));
    expect(Array.from(new Uint8Array(out))).toEqual([10, 20, 30]);
  });

  it("handles an empty array", () => {
    const out = uint8ArrayToArrayBuffer(new Uint8Array([]));
    expect(out.byteLength).toBe(0);
  });

  it("returns a copy — mutating the source does not affect the output", () => {
    const src = new Uint8Array([1, 2, 3]);
    const out = uint8ArrayToArrayBuffer(src);
    src[0] = 99;
    expect(new Uint8Array(out)[0]).toBe(1);
  });

  it("returns a copy — mutating the output does not affect the source", () => {
    const src = new Uint8Array([1, 2, 3]);
    const out = uint8ArrayToArrayBuffer(src);
    new Uint8Array(out)[0] = 99;
    expect(src[0]).toBe(1);
  });

  it("copies only the view's bytes when given a subarray (respects byteOffset/length)", () => {
    // A Uint8Array view that does not start at offset 0 and is shorter than its
    // backing buffer. Only the 2 viewed bytes should be copied.
    const backing = new Uint8Array([1, 2, 3, 4, 5]);
    const view = backing.subarray(1, 3); // bytes [2, 3]
    const out = uint8ArrayToArrayBuffer(view);
    expect(out.byteLength).toBe(2);
    expect(Array.from(new Uint8Array(out))).toEqual([2, 3]);
  });
});
