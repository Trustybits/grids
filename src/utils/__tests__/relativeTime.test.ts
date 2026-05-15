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
import { formatRelativeSince, formatDuration } from "@/utils/relativeTime";

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

// ── formatDuration ─────────────────────────────────────────────────────────
//
// Covers:
//  - Invalid inputs (NaN, +/-Infinity, 0, negatives) → "0s"
//  - Seconds bucket (< 60s) rounds to nearest integer
//  - Minutes bucket (< 60m): one decimal under 10, rounded at/above 10
//  - Hours bucket (>= 60m): one decimal under 10, rounded at/above 10
//  - Boundary transitions between buckets

describe("formatDuration", () => {
  describe("invalid / non-positive inputs return '0s'", () => {
    it("returns '0s' for 0", () => {
      expect(formatDuration(0)).toBe("0s");
    });

    it("returns '0s' for a negative value", () => {
      expect(formatDuration(-1)).toBe("0s");
      expect(formatDuration(-10_000)).toBe("0s");
    });

    it("returns '0s' for NaN", () => {
      expect(formatDuration(NaN)).toBe("0s");
    });

    it("returns '0s' for Infinity", () => {
      expect(formatDuration(Infinity)).toBe("0s");
    });

    it("returns '0s' for -Infinity", () => {
      expect(formatDuration(-Infinity)).toBe("0s");
    });
  });

  describe("seconds bucket (ms > 0 and seconds < 60)", () => {
    it("rounds sub-second values toward zero seconds", () => {
      // 1ms → 0.001s → rounds to 0 → "0s"
      expect(formatDuration(1)).toBe("0s");
      expect(formatDuration(499)).toBe("0s");
    });

    it("rounds 500ms up to 1s", () => {
      expect(formatDuration(500)).toBe("1s");
    });

    it("returns whole-second values", () => {
      expect(formatDuration(1_000)).toBe("1s");
      expect(formatDuration(30_000)).toBe("30s");
      expect(formatDuration(59_000)).toBe("59s");
    });

    it("rounds fractional seconds to nearest integer", () => {
      expect(formatDuration(1_499)).toBe("1s");
      expect(formatDuration(1_500)).toBe("2s");
    });
  });

  describe("minutes bucket (60s <= duration < 60m)", () => {
    it("formats exactly 60s as '1.0m' (under 10 → one decimal)", () => {
      expect(formatDuration(60_000)).toBe("1.0m");
    });

    it("formats 90s as '1.5m'", () => {
      expect(formatDuration(90_000)).toBe("1.5m");
    });

    it("formats values just under 10 minutes with one decimal", () => {
      // 9.5 minutes = 570_000 ms
      expect(formatDuration(570_000)).toBe("9.5m");
    });

    it("formats exactly 10 minutes as '10m' (>= 10 → rounded)", () => {
      expect(formatDuration(10 * 60_000)).toBe("10m");
    });

    it("rounds minute values >= 10 to nearest integer", () => {
      // 15.4 minutes → 15
      expect(formatDuration(15.4 * 60_000)).toBe("15m");
      // 15.6 minutes → 16
      expect(formatDuration(15.6 * 60_000)).toBe("16m");
    });

    it("formats 59 minutes as '59m'", () => {
      expect(formatDuration(59 * 60_000)).toBe("59m");
    });
  });

  describe("hours bucket (duration >= 60m)", () => {
    it("formats exactly 60 minutes as '1.0h'", () => {
      expect(formatDuration(60 * 60_000)).toBe("1.0h");
    });

    it("formats 90 minutes as '1.5h'", () => {
      expect(formatDuration(90 * 60_000)).toBe("1.5h");
    });

    it("formats values just under 10 hours with one decimal", () => {
      // 9.5h
      expect(formatDuration(9.5 * 60 * 60_000)).toBe("9.5h");
    });

    it("formats exactly 10 hours as '10h' (>= 10 → rounded)", () => {
      expect(formatDuration(10 * 60 * 60_000)).toBe("10h");
    });

    it("rounds hour values >= 10 to nearest integer", () => {
      // 23.4 h → 23
      expect(formatDuration(23.4 * 60 * 60_000)).toBe("23h");
      // 23.6 h → 24
      expect(formatDuration(23.6 * 60 * 60_000)).toBe("24h");
    });

    it("handles very large durations (multi-day) in hours", () => {
      // 100 hours
      expect(formatDuration(100 * 60 * 60_000)).toBe("100h");
    });
  });

  describe("bucket boundary transitions", () => {
    it("transitions from seconds to minutes at exactly 60s", () => {
      // Just under: seconds = 59.999, still in seconds bucket, rounds to 60 → "60s"
      expect(formatDuration(59_999)).toBe("60s");
      expect(formatDuration(60_000)).toBe("1.0m");
    });

    it("transitions from minutes to hours at exactly 60 minutes", () => {
      // Just under 60m: still in minutes bucket
      const justUnder = 60 * 60_000 - 1;
      expect(formatDuration(justUnder)).toBe("60m");
      expect(formatDuration(60 * 60_000)).toBe("1.0h");
    });
  });
});
