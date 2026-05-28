// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  addDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { FirebaseAnalyticsEventDao } from "../FirebaseAnalyticsEventDao.js";
import { AnalyticsEventType } from "@grids/contracts/types";
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

const BEACON_URL = "https://example.com/beacon";

describe("FirebaseAnalyticsEventDao", () => {
  let dao: FirebaseAnalyticsEventDao;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
    dao = new FirebaseAnalyticsEventDao(fakeDb, BEACON_URL);
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
        gridId: "grid-1",
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
        gridId: "grid-1",
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
        gridId: null,
        metadata: { signInMethod: "google" },
      });

      const [, payload] = vi.mocked(addDoc).mock.calls[0];
      expect(payload).toMatchObject({
        eventType: AnalyticsEventType.USER_LOGIN,
        userId: "user-7",
        gridId: null,
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
          gridId: "l",
          metadata: {},
        }),
      ).rejects.toThrow("write failed");
    });
  });

  describe("logGridViewEndEventBeacon", () => {
    const sampleEvent = {
      eventType: AnalyticsEventType.GRID_VIEW_END,
      userId: "user-1",
      gridId: "grid-1",
      metadata: { sessionId: "sess-1", durationMs: 12345 },
    } as const;

    let sendBeaconSpy: ReturnType<typeof vi.fn>;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      sendBeaconSpy = vi.fn().mockReturnValue(true);
      Object.defineProperty(navigator, "sendBeacon", {
        configurable: true,
        writable: true,
        value: sendBeaconSpy,
      });
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      // Remove the stub so other suites see the original navigator.
      delete (navigator as any).sendBeacon;
      warnSpy.mockRestore();
    });

    it("calls navigator.sendBeacon with the URL and a text/plain Blob containing the flattened payload, returning the browser's result", () => {
      const result = dao.logGridViewEndEventBeacon(sampleEvent);

      expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
      const [urlArg, blobArg] = sendBeaconSpy.mock.calls[0];
      expect(urlArg).toBe(BEACON_URL);
      expect(blobArg).toBeInstanceOf(Blob);
      expect((blobArg as Blob).type).toBe("text/plain");
      expect(result).toBe(true);
    });

    it("serializes the payload as JSON with legacy gridId, userId, sessionId, and durationMs", () => {
      // Replace globalThis.Blob with a subclass that records its constructor
      // args. vi.spyOn doesn't reliably proxy `new`-calls in Vitest 4, and
      // jsdom's Blob lacks .text(), so we capture parts at construction time.
      const OriginalBlob = globalThis.Blob;
      const capturedParts: BlobPart[][] = [];
      class CapturingBlob extends OriginalBlob {
        public constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          if (parts) capturedParts.push(parts);
        }
      }
      (globalThis as { Blob: typeof Blob }).Blob = CapturingBlob;

      try {
        dao.logGridViewEndEventBeacon(sampleEvent);
        expect(capturedParts).toHaveLength(1);
        expect(JSON.parse(String(capturedParts[0][0]))).toEqual({
          gridId: "grid-1",
          userId: "user-1",
          sessionId: "sess-1",
          durationMs: 12345,
        });
      } finally {
        (globalThis as { Blob: typeof Blob }).Blob = OriginalBlob;
      }
    });

    it("returns the browser's false result when sendBeacon refuses", () => {
      sendBeaconSpy.mockReturnValue(false);
      expect(dao.logGridViewEndEventBeacon(sampleEvent)).toBe(false);
    });

    it("returns false and does not call sendBeacon when gridId is null", () => {
      const result = dao.logGridViewEndEventBeacon({
        ...sampleEvent,
        gridId: null,
      });
      expect(result).toBe(false);
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    });

    it("returns false and does not call sendBeacon when the beacon URL is not configured", () => {
      const daoWithoutUrl = new FirebaseAnalyticsEventDao(fakeDb, null);
      const result = daoWithoutUrl.logGridViewEndEventBeacon(sampleEvent);
      expect(result).toBe(false);
      expect(sendBeaconSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
    });

    it("returns false when navigator.sendBeacon is unavailable", () => {
      delete (navigator as any).sendBeacon;
      expect(dao.logGridViewEndEventBeacon(sampleEvent)).toBe(false);
    });

    it("returns false when sendBeacon throws", () => {
      sendBeaconSpy.mockImplementation(() => {
        throw new Error("beacon kaboom");
      });
      expect(dao.logGridViewEndEventBeacon(sampleEvent)).toBe(false);
    });
  });
});
