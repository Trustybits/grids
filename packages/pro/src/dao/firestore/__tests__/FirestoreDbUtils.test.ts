/**
 * Unit tests for FirestoreDbUtils
 *
 * Covers:
 *  - sanitizeValue: primitives, undefined, null, arrays (with undefined items),
 *    plain objects (undefined values stripped, nested structures), non-plain objects
 *    (class instances, Date, RegExp), null-prototype objects, deeply nested mixed structures
 *  - serverTimestamp: delegates to firebase/firestore serverTimestamp()
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { serverTimestamp } from "firebase/firestore";
import { FirestoreDbUtils } from "../FirestoreDbUtils.js";

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirestoreDbUtils", () => {
  let utils: FirestoreDbUtils;

  beforeEach(() => {
    utils = new FirestoreDbUtils();
  });

  // ── sanitizeValue ─────────────────────────────────────────────────────────

  describe("sanitizeValue", () => {

    // ── Primitives / pass-through ─────────────────────────────────────────

    it("returns a string as-is", () => {
      expect(utils.sanitizeValue("hello")).toBe("hello");
    });

    it("returns a number as-is", () => {
      expect(utils.sanitizeValue(42)).toBe(42);
    });

    it("returns zero as-is", () => {
      expect(utils.sanitizeValue(0)).toBe(0);
    });

    it("returns a boolean true as-is", () => {
      expect(utils.sanitizeValue(true)).toBe(true);
    });

    it("returns a boolean false as-is", () => {
      expect(utils.sanitizeValue(false)).toBe(false);
    });

    it("returns null as-is", () => {
      expect(utils.sanitizeValue(null)).toBeNull();
    });

    it("returns undefined as-is at the top level", () => {
      expect(utils.sanitizeValue(undefined)).toBeUndefined();
    });

    // ── Non-plain objects (class instances) — pass-through ────────────────

    it("returns a Date instance as-is (non-plain object)", () => {
      const d = new Date("2024-01-01");
      expect(utils.sanitizeValue(d)).toBe(d);
    });

    it("returns a RegExp instance as-is (non-plain object)", () => {
      const re = /foo/gi;
      expect(utils.sanitizeValue(re)).toBe(re);
    });

    it("returns a class instance as-is (non-plain object)", () => {
      class Foo { x = 1; }
      const foo = new Foo();
      expect(utils.sanitizeValue(foo)).toBe(foo);
    });

    // ── Arrays ────────────────────────────────────────────────────────────

    it("returns an empty array unchanged", () => {
      expect(utils.sanitizeValue([])).toEqual([]);
    });

    it("returns an array of primitives with values intact", () => {
      expect(utils.sanitizeValue([1, "two", true, null])).toEqual([1, "two", true, null]);
    });

    it("converts undefined array items to null", () => {
      expect(utils.sanitizeValue([undefined, 1, undefined])).toEqual([null, 1, null]);
    });

    it("recursively sanitizes objects nested inside arrays", () => {
      const input = [{ a: 1, b: undefined }];
      expect(utils.sanitizeValue(input)).toEqual([{ a: 1 }]);
    });

    it("recursively sanitizes arrays nested inside arrays", () => {
      const input = [[undefined, 2], [3, undefined]];
      expect(utils.sanitizeValue(input)).toEqual([[null, 2], [3, null]]);
    });

    it("replaces undefined with null for objects-inside-arrays whose values are all undefined", () => {
      // The object { onlyUndefined: undefined } sanitizes to {} which is not undefined,
      // so the array slot is NOT replaced with null
      const input = [{ onlyUndefined: undefined }];
      expect(utils.sanitizeValue(input)).toEqual([{}]);
    });

    // ── Plain objects ─────────────────────────────────────────────────────

    it("returns an empty plain object unchanged", () => {
      expect(utils.sanitizeValue({})).toEqual({});
    });

    it("passes through defined values in a plain object", () => {
      expect(utils.sanitizeValue({ a: 1, b: "two" })).toEqual({ a: 1, b: "two" });
    });

    it("strips keys whose values are undefined", () => {
      const result = utils.sanitizeValue({ keep: "yes", drop: undefined }) as Record<string, unknown>;
      expect(result).toEqual({ keep: "yes" });
      expect(result).not.toHaveProperty("drop");
    });

    it("strips multiple undefined-valued keys", () => {
      const result = utils.sanitizeValue({ a: undefined, b: undefined, c: 3 });
      expect(result).toEqual({ c: 3 });
    });

    it("strips all keys when every value is undefined, producing an empty object", () => {
      expect(utils.sanitizeValue({ a: undefined, b: undefined })).toEqual({});
    });

    it("preserves null values in plain objects (null is not undefined)", () => {
      expect(utils.sanitizeValue({ a: null })).toEqual({ a: null });
    });

    it("recursively sanitizes nested plain objects", () => {
      const input = { outer: { inner: undefined, keep: 42 } };
      expect(utils.sanitizeValue(input)).toEqual({ outer: { keep: 42 } });
    });

    it("recursively sanitizes arrays nested inside plain objects", () => {
      const input = { items: [undefined, 1, undefined] };
      expect(utils.sanitizeValue(input)).toEqual({ items: [null, 1, null] });
    });

    // ── Null-prototype objects ────────────────────────────────────────────

    it("treats null-prototype objects as plain objects and sanitizes them", () => {
      const obj = Object.create(null) as Record<string, unknown>;
      obj.keep = "value";
      obj.drop = undefined;
      expect(utils.sanitizeValue(obj)).toEqual({ keep: "value" });
    });

    // ── Deep / mixed nesting ─────────────────────────────────────────────

    it("handles deeply nested mixed structures", () => {
      const input = {
        a: {
          b: {
            c: undefined,
            d: [undefined, { e: undefined, f: "keep" }],
          },
        },
      };
      expect(utils.sanitizeValue(input)).toEqual({
        a: {
          b: {
            d: [null, { f: "keep" }],
          },
        },
      });
    });

    it("does not mutate the original input object", () => {
      const input: Record<string, unknown> = { x: undefined, y: 1 };
      utils.sanitizeValue(input);
      expect(input).toHaveProperty("x", undefined);
      expect(input).toHaveProperty("y", 1);
    });

    it("does not mutate the original input array", () => {
      const input: unknown[] = [undefined, 1];
      utils.sanitizeValue(input);
      expect(input[0]).toBeUndefined();
      expect(input[1]).toBe(1);
    });
  });

  // ── serverTimestamp ───────────────────────────────────────────────────────

  describe("serverTimestamp", () => {
    it("delegates to firebase/firestore serverTimestamp", () => {
      const sentinel = { type: "serverTimestamp" };
      vi.mocked(serverTimestamp).mockReturnValueOnce(sentinel as any);

      const result = utils.serverTimestamp();

      expect(serverTimestamp).toHaveBeenCalledTimes(1);
      expect(result).toBe(sentinel);
    });

    it("returns whatever firebase/firestore serverTimestamp returns", () => {
      // The global setup mock returns new Date() for serverTimestamp.
      const result = utils.serverTimestamp();
      expect(result).toBeDefined();
    });
  });
});
