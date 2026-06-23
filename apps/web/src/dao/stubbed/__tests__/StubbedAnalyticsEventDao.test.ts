// Unit tests for StubbedAnalyticsEventDao — logEvent appends an enriched event
// (timestamp + 90-day expiry) to the in-memory log; the beacon variant is a
// no-op that always reports failure.
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { StubbedAnalyticsEventDao } from "../StubbedAnalyticsEventDao";
import { AnalyticsEventType } from "@grids/contracts/types";
import type { GridViewEndEvent, LogEventInput } from "@grids/contracts/dao";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase } from "./memoryTestUtils";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function sampleEvent(): LogEventInput<AnalyticsEventType.GRID_VIEW> {
  return {
    eventType: AnalyticsEventType.GRID_VIEW,
    gridId: "grid-1",
    metadata: {
      viewerType: "anonymous",
      sessionId: "session-1",
      viewerFingerprint: "fp-1",
    },
  } as unknown as LogEventInput<AnalyticsEventType.GRID_VIEW>;
}

let dao: StubbedAnalyticsEventDao;

beforeEach(() => {
  resetMemoryDatabase();
  dao = new StubbedAnalyticsEventDao();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StubbedAnalyticsEventDao.logEvent", () => {
  it("appends the event to the in-memory log", async () => {
    await dao.logEvent(sampleEvent());
    expect(memoryDatabase.analyticsEvents).toHaveLength(1);
    expect(memoryDatabase.analyticsEvents[0]).toMatchObject({
      eventType: AnalyticsEventType.GRID_VIEW,
      gridId: "grid-1",
    });
  });

  it("stamps the event with the current time and a 90-day expiry", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-06-18T12:00:00.000Z");
    vi.setSystemTime(now);

    await dao.logEvent(sampleEvent());

    const stored = memoryDatabase.analyticsEvents[0];
    expect(stored.timestamp).toBeInstanceOf(Date);
    expect(stored.timestamp.getTime()).toBe(now.getTime());
    expect(stored.expiresAt.getTime()).toBe(now.getTime() + NINETY_DAYS_MS);
  });

  it("preserves the order of multiple appended events", async () => {
    await dao.logEvent({ ...sampleEvent(), gridId: "a" });
    await dao.logEvent({ ...sampleEvent(), gridId: "b" });

    expect(memoryDatabase.analyticsEvents.map((e) => e.gridId)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("StubbedAnalyticsEventDao.logGridViewEndEventBeacon", () => {
  it("always returns false and records nothing", () => {
    const result = dao.logGridViewEndEventBeacon(
      {} as unknown as GridViewEndEvent,
    );
    expect(result).toBe(false);
    expect(memoryDatabase.analyticsEvents).toHaveLength(0);
  });
});
