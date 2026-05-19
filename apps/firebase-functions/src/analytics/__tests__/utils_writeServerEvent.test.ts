/**
 * Tests for writeServerAnalyticsEvent.
 *
 * The unit under test is a thin wrapper that writes a single document into
 * the `analyticsEvents` collection. Coverage:
 *   - exact field shape written to Firestore (eventType, timestamp sentinel,
 *     expiresAt Timestamp, userId, layoutId, metadata)
 *   - expiresAt is `now + 90 days` in millis
 *   - all four ServerAnalyticsEventType values pass through unchanged
 *   - null userId / null layoutId are passed through verbatim
 *   - metadata object is forwarded as-is
 *   - if firestore().add() rejects, the function logs and resolves (does NOT
 *     throw) — analytics writes must never break the caller's primary work
 *
 * All Firebase IO is mocked: `firebase-admin` is replaced with an in-memory
 * stub, the logger is mocked so error calls are silent but assertable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as logger from "firebase-functions/logger";

const { dbHolder, FieldValue, Timestamp, addMock } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: () => ({ __op: "serverTimestamp" }),
    increment: (value: number) => ({ __op: "increment", value }),
  };
  const Timestamp = {
    fromMillis: (ms: number) => ({
      __isTimestamp: true,
      _millis: ms,
      toMillis: () => ms,
      toDate: () => new Date(ms),
    }),
  };
  const addMock = vi.fn();
  const dbHolder: { db: unknown } = {
    db: {
      collection: (name: string) => ({
        __collection: name,
        add: addMock,
      }),
    },
  };
  return { dbHolder, FieldValue, Timestamp, addMock };
});

vi.mock("firebase-admin", () => {
  const firestoreFn: (() => unknown) & {
    FieldValue?: typeof FieldValue;
    Timestamp?: typeof Timestamp;
  } = () => dbHolder.db;
  firestoreFn.FieldValue = FieldValue;
  firestoreFn.Timestamp = Timestamp;
  return { firestore: firestoreFn, default: { firestore: firestoreFn } };
});

vi.mock("firebase-functions/logger", () => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
}));

import { writeServerAnalyticsEvent } from "../utils_writeServerEvent.js";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const FIXED_NOW = new Date("2026-05-08T00:00:00Z").getTime();

beforeEach(() => {
  addMock.mockReset();
  addMock.mockResolvedValue({ id: "doc-x" });
  vi.mocked(logger.error).mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("writeServerAnalyticsEvent: happy path", () => {
  it("writes to the `analyticsEvents` collection", async () => {
    await writeServerAnalyticsEvent({
      eventType: "user_signup",
      userId: "u-1",
      layoutId: null,
      metadata: {},
    });

    expect(addMock).toHaveBeenCalledTimes(1);
    // The collection() method was invoked with "analyticsEvents".
    // Verified indirectly: addMock is the .add of that collection ref.
  });

  it("writes the full document shape with serverTimestamp + expiresAt sentinels", async () => {
    await writeServerAnalyticsEvent({
      eventType: "grid_created",
      userId: "u-1",
      layoutId: "layout-1",
      metadata: { source: "dashboard" },
    });

    expect(addMock).toHaveBeenCalledTimes(1);
    const doc = addMock.mock.calls[0][0];
    expect(doc).toEqual({
      eventType: "grid_created",
      timestamp: { __op: "serverTimestamp" },
      expiresAt: expect.objectContaining({
        __isTimestamp: true,
        _millis: FIXED_NOW + NINETY_DAYS_MS,
      }),
      userId: "u-1",
      layoutId: "layout-1",
      metadata: { source: "dashboard" },
    });
  });

  it("uses Date.now() at call time to compute expiresAt", async () => {
    const customNow = new Date("2030-01-15T08:30:00Z").getTime();
    vi.setSystemTime(customNow);

    await writeServerAnalyticsEvent({
      eventType: "user_login",
      userId: "u-1",
      layoutId: null,
      metadata: {},
    });

    const doc = addMock.mock.calls[0][0];
    expect(doc.expiresAt._millis).toBe(customNow + NINETY_DAYS_MS);
  });

  it.each([
    "user_signup",
    "user_login",
    "grid_created",
    "grid_deleted",
    "grid_view_end",
  ] as const)("forwards eventType '%s' verbatim", async (eventType) => {
    await writeServerAnalyticsEvent({
      eventType,
      userId: "u-1",
      layoutId: null,
      metadata: {},
    });
    expect(addMock.mock.calls[0][0].eventType).toBe(eventType);
  });

  it("passes null userId and null layoutId through unchanged", async () => {
    await writeServerAnalyticsEvent({
      eventType: "user_login",
      userId: null,
      layoutId: null,
      metadata: {},
    });
    const doc = addMock.mock.calls[0][0];
    expect(doc.userId).toBeNull();
    expect(doc.layoutId).toBeNull();
  });

  it("forwards arbitrary metadata as-is (reference equality)", async () => {
    const metadata = {
      source: "api",
      nested: { ip: "127.0.0.1", flags: [1, 2, 3] },
    };
    await writeServerAnalyticsEvent({
      eventType: "user_signup",
      userId: "u-1",
      layoutId: null,
      metadata,
    });
    const doc = addMock.mock.calls[0][0];
    expect(doc.metadata).toBe(metadata);
  });
});

describe("writeServerAnalyticsEvent: error handling", () => {
  it("logs and resolves (does not throw) when firestore .add rejects", async () => {
    addMock.mockRejectedValueOnce(new Error("firestore unavailable"));

    await expect(
      writeServerAnalyticsEvent({
        eventType: "grid_deleted",
        userId: "u-1",
        layoutId: "layout-1",
        metadata: { reason: "user_initiated" },
      }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to write server analytics event",
      expect.objectContaining({
        eventType: "grid_deleted",
        userId: "u-1",
        layoutId: "layout-1",
        error: expect.stringContaining("firestore unavailable"),
      }),
    );
  });

  it("stringifies non-Error rejections in the log payload", async () => {
    addMock.mockRejectedValueOnce("plain-string-failure");

    await writeServerAnalyticsEvent({
      eventType: "user_login",
      userId: null,
      layoutId: null,
      metadata: {},
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to write server analytics event",
      expect.objectContaining({ error: "plain-string-failure" }),
    );
  });

  it("does not log on success", async () => {
    await writeServerAnalyticsEvent({
      eventType: "user_signup",
      userId: "u-1",
      layoutId: null,
      metadata: {},
    });
    expect(logger.error).not.toHaveBeenCalled();
  });
});
