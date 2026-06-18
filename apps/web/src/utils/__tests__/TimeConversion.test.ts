/**
 * Tests for TimeConversion.ts
 *
 * Covers normalization of Timestamp-like values (objects exposing toDate()),
 * native Dates, and numeric ms into Dates / millisecond counts.
 *  - valueToDate: unknown -> Date | null
 *  - valueToMillis: unknown -> number (0 when unrecognized)
 */

import { describe, it, expect } from "vitest";
import { valueToDate, valueToMillis } from "../TimeConversion";

describe("valueToDate", () => {
  it("returns null for null", () => {
    expect(valueToDate(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(valueToDate(undefined)).toBeNull();
  });

  it("returns the Date produced by a Timestamp-like toDate()", () => {
    const expected = new Date("2026-01-02T03:04:05Z");
    const timestamp = { toDate: () => expected };
    expect(valueToDate(timestamp)).toBe(expected);
  });

  it("returns a valid Date instance unchanged", () => {
    const d = new Date("2026-06-18T00:00:00Z");
    expect(valueToDate(d)).toBe(d);
  });

  it("returns null for an invalid Date instance", () => {
    expect(valueToDate(new Date("not a date"))).toBeNull();
  });

  it("returns null for a plain number (no toDate, not a Date)", () => {
    expect(valueToDate(1_700_000_000_000)).toBeNull();
  });

  it("returns null for a plain string", () => {
    expect(valueToDate("2026-01-01")).toBeNull();
  });

  it("ignores a non-function toDate property and falls through to null", () => {
    expect(valueToDate({ toDate: "nope" })).toBeNull();
  });

  it("swallows errors thrown by toDate() and falls through", () => {
    const value = {
      toDate: () => {
        throw new Error("boom");
      },
    };
    expect(valueToDate(value)).toBeNull();
  });

  it("returns null when toDate() yields a non-Date value", () => {
    // The toDate() result is validated; a non-Date return is not trusted.
    expect(
      valueToDate({ toDate: (() => 123) as unknown as () => Date }),
    ).toBeNull();
  });

  it("returns null when toDate() yields an invalid Date", () => {
    expect(valueToDate({ toDate: () => new Date("not a date") })).toBeNull();
  });

  it("falls back to a valid Date when toDate is absent but value is a Date", () => {
    const d = new Date("2026-03-03T03:03:03Z");
    // No toDate; the instanceof Date branch should handle it.
    expect(valueToDate(d)).toBe(d);
  });
});

describe("valueToMillis", () => {
  it("returns epoch millis from a Timestamp-like value", () => {
    const expected = new Date("2026-01-02T03:04:05Z");
    expect(valueToMillis({ toDate: () => expected })).toBe(expected.getTime());
  });

  it("returns epoch millis from a Date", () => {
    const d = new Date("2026-06-18T00:00:00Z");
    expect(valueToMillis(d)).toBe(d.getTime());
  });

  it("returns a numeric ms value as-is", () => {
    expect(valueToMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
  });

  it("returns 0 for a numeric value when it is provided as-is even if zero", () => {
    expect(valueToMillis(0)).toBe(0);
  });

  it("returns 0 for NaN numbers", () => {
    expect(valueToMillis(NaN)).toBe(0);
  });

  it("returns 0 for null", () => {
    expect(valueToMillis(null)).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(valueToMillis(undefined)).toBe(0);
  });

  it("returns 0 for an invalid Date", () => {
    expect(valueToMillis(new Date("not a date"))).toBe(0);
  });

  it("returns 0 for a non-date string", () => {
    expect(valueToMillis("hello")).toBe(0);
  });

  it("returns 0 when toDate() yields an invalid Date", () => {
    // valueToDate rejects the invalid Date (returns null), so valueToMillis
    // falls through to the 0 default rather than leaking NaN.
    const value = { toDate: () => new Date("not a date") };
    expect(valueToMillis(value)).toBe(0);
  });
});
