// Unit tests for StubbedDbUtils — a thin in-memory implementation of the
// DbUtils contract. sanitizeValue delegates to sanitizeStubbedValue and
// serverTimestamp returns a fresh Date.
import { describe, it, expect } from "vitest";
import { StubbedDbUtils } from "../StubbedDbUtils";
import { STUBBED_DELETE_FIELD } from "../StubbedMemoryDatabase";

describe("StubbedDbUtils", () => {
  describe("sanitizeValue", () => {
    it("drops undefined-valued keys from objects", () => {
      const utils = new StubbedDbUtils();
      expect(utils.sanitizeValue({ a: 1, b: undefined })).toEqual({ a: 1 });
    });

    it("converts undefined array elements to null", () => {
      const utils = new StubbedDbUtils();
      expect(utils.sanitizeValue([1, undefined, 3])).toEqual([1, null, 3]);
    });

    it("returns primitives unchanged", () => {
      const utils = new StubbedDbUtils();
      expect(utils.sanitizeValue("hello")).toBe("hello");
      expect(utils.sanitizeValue(null)).toBeNull();
    });
  });

  describe("serverTimestamp", () => {
    it("returns a Date instance", () => {
      const utils = new StubbedDbUtils();
      expect(utils.serverTimestamp()).toBeInstanceOf(Date);
    });

    it("returns the current time", () => {
      const utils = new StubbedDbUtils();
      const before = Date.now();
      const result = utils.serverTimestamp() as Date;
      const after = Date.now();

      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it("returns a new Date on each call", () => {
      const utils = new StubbedDbUtils();
      expect(utils.serverTimestamp()).not.toBe(utils.serverTimestamp());
    });
  });

  describe("deleteField", () => {
    it("returns the shared delete-field sentinel", () => {
      const utils = new StubbedDbUtils();
      expect(utils.deleteField()).toBe(STUBBED_DELETE_FIELD);
    });
  });
});
