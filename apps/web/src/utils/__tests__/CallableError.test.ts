/**
 * Tests for describeCallableError — turns a thrown callable error into a
 * user-facing string, passing real HttpsError messages through while replacing
 * opaque codes (like Firebase's "internal") and non-errors with a fallback.
 */

import { describe, it, expect } from "vitest";
import { describeCallableError } from "@/utils/CallableError";

const FALLBACK = "Something went wrong.";

describe("describeCallableError", () => {
  it("returns a meaningful HttpsError message unchanged", () => {
    const error = new Error("You cannot transfer a grid to yourself.");
    expect(describeCallableError(error, FALLBACK)).toBe(
      "You cannot transfer a grid to yourself.",
    );
  });

  it("replaces the opaque 'internal' message with the fallback", () => {
    expect(describeCallableError(new Error("internal"), FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("treats the opaque message case-insensitively", () => {
    expect(describeCallableError(new Error("INTERNAL"), FALLBACK)).toBe(
      FALLBACK,
    );
    expect(describeCallableError(new Error("Unknown"), FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("falls back on an empty or whitespace-only message", () => {
    expect(describeCallableError(new Error(""), FALLBACK)).toBe(FALLBACK);
    expect(describeCallableError(new Error("   "), FALLBACK)).toBe(FALLBACK);
  });

  it("trims surrounding whitespace from a real message", () => {
    expect(describeCallableError(new Error("  Grid not found.  "), FALLBACK)).toBe(
      "Grid not found.",
    );
  });

  it("falls back for non-Error values", () => {
    expect(describeCallableError("internal", FALLBACK)).toBe(FALLBACK);
    expect(describeCallableError(undefined, FALLBACK)).toBe(FALLBACK);
    expect(describeCallableError({ message: "nope" }, FALLBACK)).toBe(FALLBACK);
  });
});
