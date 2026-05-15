/**
 * Tests for relativeTime.ts
 *
 * Covers:
 *  - formatRelativeSince: all time bands ("just now", Xm ago, Xh ago, Xd ago,
 *    locale date without year, locale date with year)
 *  - Boundary values at each band transition
 *  - Default nowMs parameter uses Date.now()
 *  - Cross-year date formatting includes the year
 *  - Same-year date formatting omits the year
 *  - Future dates (negative diff)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeSince } from "@/utils/relativeTime";

// Fixed reference point for deterministic tests
// 2024-06-15 12:00:00 UTC
const NOW_MS = new Date("2024-06-15T12:00:00.000Z").getTime();

/** Helper: create a Date that is `ms` milliseconds before NOW_MS */
function msAgo(ms: number): Date {
  return new Date(NOW_MS - ms);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ── formatRelativeSince ────────────────────────────────────────────────────

describe("formatRelativeSince", () => {
  // ── "just now" band (diff < 1 minute) ─────────────────────────────────

  describe("returns 'just now' for differences less than 1 minute", () => {
    it("returns 'just now' for diff = 0ms (same instant)", () => {
      const date = msAgo(0);
      expect(formatRelativeSince(date, NOW_MS)).toBe("just now");
    });

    it("returns 'just now' for diff = 1ms", () => {
      const date = msAgo(1);
      expect(formatRelativeSince(date, NOW_MS)).toBe("just now");
    });

    it("returns 'just now' for diff = 59 seconds", () => {
      const date = msAgo(59 * 1000);
      expect(formatRelativeSince(date, NOW_MS)).toBe("just now");
    });

    it("returns 'just now' for diff = 59999ms (just under 1 minute)", () => {
      const date = msAgo(MINUTE - 1);
      expect(formatRelativeSince(date, NOW_MS)).toBe("just now");
    });
  });

  // ── "Xm ago" band (1 <= minutes < 60) ─────────────────────────────────

  describe("returns 'Xm ago' for differences of 1 to 59 minutes", () => {
    it("returns '1m ago' for diff = exactly 1 minute", () => {
      const date = msAgo(MINUTE);
      expect(formatRelativeSince(date, NOW_MS)).toBe("1m ago");
    });

    it("returns '1m ago' for diff = 89 seconds (floor to 1)", () => {
      const date = msAgo(89 * 1000);
      expect(formatRelativeSince(date, NOW_MS)).toBe("1m ago");
    });

    it("returns '30m ago' for diff = 30 minutes", () => {
      const date = msAgo(30 * MINUTE);
      expect(formatRelativeSince(date, NOW_MS)).toBe("30m ago");
    });

    it("returns '59m ago' for diff = just under 60 minutes", () => {
      const date = msAgo(HOUR - 1);
      expect(formatRelativeSince(date, NOW_MS)).toBe("59m ago");
    });
  });

  // ── "Xh ago" band (1 <= hours < 24) ───────────────────────────────────

  describe("returns 'Xh ago' for differences of 1 to 23 hours", () => {
    it("returns '1h ago' for diff = exactly 60 minutes", () => {
      const date = msAgo(HOUR);
      expect(formatRelativeSince(date, NOW_MS)).toBe("1h ago");
    });

    it("returns '1h ago' for diff = 1 hour 59 minutes (floor to 1)", () => {
      const date = msAgo(HOUR + 59 * MINUTE);
      expect(formatRelativeSince(date, NOW_MS)).toBe("1h ago");
    });

    it("returns '12h ago' for diff = 12 hours", () => {
      const date = msAgo(12 * HOUR);
      expect(formatRelativeSince(date, NOW_MS)).toBe("12h ago");
    });

    it("returns '23h ago' for diff = just under 24 hours", () => {
      const date = msAgo(DAY - 1);
      expect(formatRelativeSince(date, NOW_MS)).toBe("23h ago");
    });
  });

  // ── "Xd ago" band (1 <= days < 30) ────────────────────────────────────

  describe("returns 'Xd ago' for differences of 1 to 29 days", () => {
    it("returns '1d ago' for diff = exactly 24 hours", () => {
      const date = msAgo(DAY);
      expect(formatRelativeSince(date, NOW_MS)).toBe("1d ago");
    });

    it("returns '7d ago' for diff = 7 days", () => {
      const date = msAgo(7 * DAY);
      expect(formatRelativeSince(date, NOW_MS)).toBe("7d ago");
    });

    it("returns '29d ago' for diff = just under 30 days", () => {
      const date = msAgo(30 * DAY - 1);
      expect(formatRelativeSince(date, NOW_MS)).toBe("29d ago");
    });
  });

  // ── locale date band (days >= 30) ─────────────────────────────────────

  describe("returns a locale date string for differences of 30 or more days", () => {
    it("returns locale date (no year) for exactly 30 days ago in the same year", () => {
      // 2024-06-15 minus 30 days = 2024-05-16 — same year as NOW_MS
      const date = msAgo(30 * DAY);
      const result = formatRelativeSince(date, NOW_MS);
      // Should not be in "Xd ago" format
      expect(result).not.toMatch(/^\d+d ago$/);
      // Should not contain the year 2024
      expect(result).not.toContain("2024");
    });

    it("returns locale date (no year) for 60 days ago in the same year", () => {
      // 2024-06-15 minus 60 days = 2024-04-16 — same year
      const date = msAgo(60 * DAY);
      const result = formatRelativeSince(date, NOW_MS);
      expect(result).not.toMatch(/^\d+d ago$/);
      expect(result).not.toContain("2024");
    });

    it("returns locale date with year for a date in a different year", () => {
      // 2024-06-15 minus 400 days = 2023-05-11 — different year
      const date = msAgo(400 * DAY);
      const result = formatRelativeSince(date, NOW_MS);
      // Should include the year 2023
      expect(result).toContain("2023");
    });

    it("returns a non-empty string for very old dates (different year)", () => {
      const date = new Date("2020-06-15T12:00:00.000Z");
      const result = formatRelativeSince(date, NOW_MS);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("2020");
    });
  });

  // ── default nowMs parameter ────────────────────────────────────────────

  describe("default nowMs parameter", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("uses Date.now() as the default nowMs when not provided", () => {
      // Set fake time to NOW_MS
      vi.setSystemTime(NOW_MS);
      // A date 5 minutes ago
      const date = new Date(NOW_MS - 5 * MINUTE);
      expect(formatRelativeSince(date)).toBe("5m ago");
    });

    it("uses Date.now() resulting in 'just now' for a brand-new date", () => {
      vi.setSystemTime(NOW_MS);
      const date = new Date(NOW_MS - 30 * 1000); // 30 seconds ago
      expect(formatRelativeSince(date)).toBe("just now");
    });
  });

  // ── future dates (negative diff) ──────────────────────────────────────

  describe("future dates (date is after nowMs)", () => {
    it("returns 'just now' when the date is in the future (diff < 0, minutes < 1)", () => {
      // diff = NOW_MS - futureMs = negative → minutes = Math.floor(negative / 60000) < 0 < 1
      const futureDate = new Date(NOW_MS + 5 * 1000);
      const result = formatRelativeSince(futureDate, NOW_MS);
      expect(result).toBe("just now");
    });

    it("returns 'just now' for a future date 59 seconds ahead", () => {
      const futureDate = new Date(NOW_MS + 59 * 1000);
      const result = formatRelativeSince(futureDate, NOW_MS);
      // Math.floor(negative / 60000) = -1, which is < 1, so "just now"
      expect(result).toBe("just now");
    });
  });

  // ── boundary precision ─────────────────────────────────────────────────

  describe("boundary precision at band transitions", () => {
    it("transitions from 'just now' to '1m ago' exactly at 60000ms", () => {
      expect(formatRelativeSince(msAgo(MINUTE - 1), NOW_MS)).toBe("just now");
      expect(formatRelativeSince(msAgo(MINUTE), NOW_MS)).toBe("1m ago");
    });

    it("transitions from 'Xm ago' to 'Xh ago' exactly at 3600000ms", () => {
      expect(formatRelativeSince(msAgo(HOUR - 1), NOW_MS)).toBe("59m ago");
      expect(formatRelativeSince(msAgo(HOUR), NOW_MS)).toBe("1h ago");
    });

    it("transitions from 'Xh ago' to 'Xd ago' exactly at 86400000ms", () => {
      expect(formatRelativeSince(msAgo(DAY - 1), NOW_MS)).toBe("23h ago");
      expect(formatRelativeSince(msAgo(DAY), NOW_MS)).toBe("1d ago");
    });

    it("transitions from 'Xd ago' to locale date at 30 days", () => {
      expect(formatRelativeSince(msAgo(30 * DAY - 1), NOW_MS)).toBe("29d ago");
      const result = formatRelativeSince(msAgo(30 * DAY), NOW_MS);
      expect(result).not.toMatch(/^\d+d ago$/);
    });
  });
});
