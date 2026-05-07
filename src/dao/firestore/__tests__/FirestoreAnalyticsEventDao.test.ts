import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { FirestoreAnalyticsEventDao } from "../FirestoreAnalyticsEventDao";
import { AnalyticsEventType } from "@/types/Analytics";
import type { Firestore } from "firebase/firestore";

// Extend the global firestore mock from setup.ts with `Timestamp`, which
// is needed by this DAO but not provided in the global mock.
vi.mock("firebase/firestore", async () => {
  class FakeTimestamp {
    public seconds: number;
    public nanoseconds: number;
    public constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    public static fromMillis(ms: number): FakeTimestamp {
      return new FakeTimestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
    }
    public toMillis(): number {
      return this.seconds * 1000 + this.nanoseconds / 1e6;
    }
  }
  return {
    Timestamp: FakeTimestamp,
    addDoc: vi.fn(),
    collection: vi.fn(),
    serverTimestamp: vi.fn(() => "SERVER_TS"),
  };
});

const fakeDb = {} as Firestore;
const NOW_MS = 1_700_000_000_000; // fixed "now"
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

describe("FirestoreAnalyticsEventDao", () => {
  let dao: FirestoreAnalyticsEventDao;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    dao = new FirestoreAnalyticsEventDao(fakeDb);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("logEvent", () => {
    it("writes event to the analyticsEvents collection with serverTimestamp and a 90-day expiresAt", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(addDoc).mockResolvedValue({ id: "new-event" } as any);

      const metadata = {
        viewerType: "anonymous" as const,
        sessionId: "sess-1",
        viewerFingerprint: "fp-1",
      };
      await dao.logEvent({
        eventType: AnalyticsEventType.GRID_VIEW,
        userId: null,
        layoutId: "layout-1",
        metadata,
      });

      expect(collection).toHaveBeenCalledWith(fakeDb, "analyticsEvents");
      expect(serverTimestamp).toHaveBeenCalledTimes(1);
      expect(addDoc).toHaveBeenCalledTimes(1);

      const [colArg, payload] = vi.mocked(addDoc).mock.calls[0];
      expect(colArg).toBe("colRef");
      expect(payload).toMatchObject({
        eventType: AnalyticsEventType.GRID_VIEW,
        userId: null,
        layoutId: "layout-1",
        metadata,
        timestamp: "SERVER_TS",
      });

      // expiresAt should be a Timestamp at NOW + 90d.
      const expiresAt = (payload as any).expiresAt;
      expect(expiresAt).toBeInstanceOf(Timestamp);
      expect(expiresAt.toMillis()).toBe(NOW_MS + TTL_MS);
    });

    it("forwards a non-null userId and arbitrary metadata", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(addDoc).mockResolvedValue({ id: "x" } as any);

      await dao.logEvent({
        eventType: AnalyticsEventType.USER_LOGIN,
        userId: "user-7",
        layoutId: null,
        metadata: { signInMethod: "google" },
      });

      const [, payload] = vi.mocked(addDoc).mock.calls[0];
      expect(payload).toMatchObject({
        eventType: AnalyticsEventType.USER_LOGIN,
        userId: "user-7",
        layoutId: null,
        metadata: { signInMethod: "google" },
      });
    });

    it("propagates errors from addDoc", async () => {
      vi.mocked(collection).mockReturnValue("colRef" as any);
      vi.mocked(addDoc).mockRejectedValue(new Error("write failed"));

      await expect(
        dao.logEvent({
          eventType: AnalyticsEventType.OWNER_GRID_ENTER,
          userId: "u",
          layoutId: "l",
          metadata: {},
        }),
      ).rejects.toThrow("write failed");
    });
  });
});
