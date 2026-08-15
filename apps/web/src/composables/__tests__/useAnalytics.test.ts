/**
 * Tests for useAnalytics — the frontend integration point that emits
 * grid-view analytics events and owns the visibilitychange/unmount
 * lifecycle for view sessions.
 *
 * All collaborators are mocked: Vue lifecycle hooks (so we can drive
 * mounted/beforeUnmount manually), the auth provider, the analytics
 * service, the grid store, and the random/clock primitives that would
 * otherwise make assertions non-deterministic.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { onMounted, onBeforeUnmount } from "vue";
import { AnalyticsEventType } from "@grids/contracts/types";
import type { LogEventInput } from "@grids/contracts/dao";

// ── Hoisted mock state ──────────────────────────────────────────────────

const {
  mockGetCurrentUserId,
  mockLogEvent,
  mockLogEventBeacon,
  mockGetAnalyticsService,
  mockLayoutStore,
} = vi.hoisted(
  () => {
    const mockLogEvent = vi.fn<(event: LogEventInput) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const mockLogEventBeacon = vi.fn<(event: LogEventInput) => boolean>(
      () => true,
    );
    const mockAnalyticsService = {
      logEvent: mockLogEvent,
      logGridViewEndEventBeacon: mockLogEventBeacon,
    };

    return {
      mockGetCurrentUserId: vi.fn<() => string | null>(() => null),
      mockLogEvent,
      mockLogEventBeacon,
      mockGetAnalyticsService: vi.fn(() => mockAnalyticsService),
      mockLayoutStore: {
        currentGrid: null as { id: string } | null,
        isOwner: false,
      },
    };
  },
);

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return { ...actual, onMounted: vi.fn(), onBeforeUnmount: vi.fn() };
});

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({ getCurrentUserId: mockGetCurrentUserId }),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getAnalyticsService: mockGetAnalyticsService,
  }),
}));

vi.mock("@/stores/grid/gridSession", () => ({
  useGridSessionStore: () => mockLayoutStore,
}));

import { useAnalytics } from "@/composables/useAnalytics";

// ── Helpers ─────────────────────────────────────────────────────────────

let mountedCb: (() => void) | null = null;
let unmountCb: (() => void) | null = null;
let nowValue = 0;
let uuidCounter = 0;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

type EventInput<T extends AnalyticsEventType> = LogEventInput<T>;

function setLayoutLoaded(id: string | null, isOwner = false): void {
  mockLayoutStore.currentGrid = id ? { id } : null;
  mockLayoutStore.isOwner = isOwner;
}

function isEventOfType<T extends AnalyticsEventType>(
  event: LogEventInput,
  type: T,
): event is EventInput<T> {
  return event.eventType === type;
}

function lastEventOfType<T extends AnalyticsEventType>(
  type: T,
): EventInput<T> {
  const events = eventsOfType(type);
  const event = events[events.length - 1];
  if (!event) {
    throw new Error(`Expected analytics event of type ${type}`);
  }
  return event;
}

function eventsOfType<T extends AnalyticsEventType>(
  type: T,
): Array<EventInput<T>> {
  const fromLog = mockLogEvent.mock.calls.map((c) => c[0]);
  const fromBeacon = mockLogEventBeacon.mock.calls.map((c) => c[0]);
  return [...fromLog, ...fromBeacon].filter(
    (event): event is EventInput<T> => isEventOfType(event, type),
  );
}

beforeEach(() => {
  mockLogEvent.mockClear();
  mockLogEventBeacon.mockClear();
  mockLogEventBeacon.mockReturnValue(true);
  mockGetAnalyticsService.mockReset();
  mockGetAnalyticsService.mockReturnValue({
    logEvent: mockLogEvent,
    logGridViewEndEventBeacon: mockLogEventBeacon,
  });
  mockGetCurrentUserId.mockReset();
  mockGetCurrentUserId.mockReturnValue(null);
  setLayoutLoaded(null, false);

  // Capture lifecycle callbacks instead of letting Vue invoke them.
  vi.mocked(onMounted).mockImplementation((cb) => {
    mountedCb = cb as () => void;
  });
  vi.mocked(onBeforeUnmount).mockImplementation((cb) => {
    unmountCb = cb as () => void;
  });
  mountedCb = null;
  unmountCb = null;

  // Deterministic ids and clock.
  uuidCounter = 0;
  nowValue = 1000;
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
  );
  vi.spyOn(performance, "now").mockImplementation(() => nowValue);

  // Fresh localStorage each test.
  window.localStorage.clear();

  consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  consoleWarnSpy?.mockRestore();
  vi.restoreAllMocks();
});

// ── trackGridEnter: guards ─────────────────────────────────────────────

describe("trackGridEnter — guards", () => {
  it("warns and emits nothing when the grid store has no loaded grid", () => {
    setLayoutLoaded(null);
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  it("warns and emits nothing when the loaded grid id does not match", () => {
    setLayoutLoaded("grid-other", false);
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    expect(mockLogEvent).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalled();
  });
});

// ── trackGridEnter: owner branch ───────────────────────────────────────

describe("trackGridEnter — owner branch", () => {
  it("logs OWNER_GRID_ENTER once with userId and empty metadata", () => {
    setLayoutLoaded("grid-1", true);
    mockGetCurrentUserId.mockReturnValue("owner-1");
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith({
      eventType: AnalyticsEventType.OWNER_GRID_ENTER,
      userId: "owner-1",
      gridId: "grid-1",
      metadata: {},
    });
  });

  it("does not start a view session for an owner (no GRID_VIEW emitted)", () => {
    setLayoutLoaded("grid-1", true);
    mockGetCurrentUserId.mockReturnValue("owner-1");
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    expect(eventsOfType(AnalyticsEventType.GRID_VIEW)).toHaveLength(0);
  });

  it("ends a prior viewer session before logging OWNER_GRID_ENTER", () => {
    // First arrive as a viewer on grid-1, then as the owner of grid-2.
    setLayoutLoaded("grid-1", false);
    mockGetCurrentUserId.mockReturnValue(null);
    const { trackGridEnter } = useAnalytics();

    nowValue = 1000;
    trackGridEnter("grid-1"); // starts session

    setLayoutLoaded("grid-2", true);
    mockGetCurrentUserId.mockReturnValue("user-1");
    nowValue = 1750;
    trackGridEnter("grid-2");

    const ends = eventsOfType(AnalyticsEventType.GRID_VIEW_END);
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({
      eventType: AnalyticsEventType.GRID_VIEW_END,
      gridId: "grid-1",
      metadata: { durationMs: 750 },
    });

    // And the owner enter fired for grid-2.
    expect(lastEventOfType(AnalyticsEventType.OWNER_GRID_ENTER)).toMatchObject({
      gridId: "grid-2",
      userId: "user-1",
    });
  });
});

// ── trackGridEnter: viewer branch ──────────────────────────────────────

describe("trackGridEnter — viewer branch", () => {
  it("emits GRID_VIEW with viewerType=authenticated when a user is logged in", () => {
    setLayoutLoaded("grid-1", false);
    mockGetCurrentUserId.mockReturnValue("user-7");
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    const view = lastEventOfType(AnalyticsEventType.GRID_VIEW);
    expect(view).toMatchObject({
      eventType: AnalyticsEventType.GRID_VIEW,
      userId: "user-7",
      gridId: "grid-1",
    });
    expect(view.metadata).toMatchObject({
      viewerType: "authenticated",
      sessionId: expect.stringMatching(/^uuid-/),
      viewerFingerprint: expect.stringMatching(/^uuid-/),
    });
  });

  it("emits GRID_VIEW with viewerType=anonymous when no user is logged in", () => {
    setLayoutLoaded("grid-1", false);
    mockGetCurrentUserId.mockReturnValue(null);
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    const view = lastEventOfType(AnalyticsEventType.GRID_VIEW);
    expect(view).toMatchObject({ userId: null });
    expect(view.metadata).toMatchObject({ viewerType: "anonymous" });
  });

  it("dedupes a repeated trackGridEnter for the same gridId in the same session", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");
    trackGridEnter("grid-1");
    trackGridEnter("grid-1");

    expect(eventsOfType(AnalyticsEventType.GRID_VIEW)).toHaveLength(1);
    expect(eventsOfType(AnalyticsEventType.GRID_VIEW_END)).toHaveLength(0);
  });

  it("ends the prior session and starts a new one when navigating to a different grid", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    nowValue = 1000;
    trackGridEnter("grid-1");

    setLayoutLoaded("grid-2", false);
    nowValue = 3500;
    trackGridEnter("grid-2");

    const views = eventsOfType(AnalyticsEventType.GRID_VIEW);
    const ends = eventsOfType(AnalyticsEventType.GRID_VIEW_END);
    expect(views).toHaveLength(2);
    expect(views[0]).toMatchObject({ gridId: "grid-1" });
    expect(views[1]).toMatchObject({ gridId: "grid-2" });
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({
      gridId: "grid-1",
      metadata: { durationMs: 2500 },
    });
  });

  it("uses unique sessionIds per session but the same fingerprint across them", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");
    setLayoutLoaded("grid-2", false);
    nowValue = 2000;
    trackGridEnter("grid-2");

    const views = eventsOfType(AnalyticsEventType.GRID_VIEW);
    expect(views[0].metadata.sessionId).not.toEqual(views[1].metadata.sessionId);
    expect(views[0].metadata.viewerFingerprint).toEqual(
      views[1].metadata.viewerFingerprint,
    );
  });
});

// ── Fingerprint persistence ────────────────────────────────────────────

describe("viewer fingerprint", () => {
  const KEY = "grids:analytics:viewerFingerprint";

  it("reuses an existing fingerprint stored in localStorage", () => {
    window.localStorage.setItem(KEY, "fp-existing");
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    expect(
      lastEventOfType(AnalyticsEventType.GRID_VIEW).metadata.viewerFingerprint,
    ).toBe("fp-existing");
  });

  it("generates and persists a new fingerprint on first view", () => {
    expect(window.localStorage.getItem(KEY)).toBeNull();
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    const fp = lastEventOfType(
      AnalyticsEventType.GRID_VIEW,
    ).metadata.viewerFingerprint;
    expect(fp).toMatch(/^uuid-/);
    expect(window.localStorage.getItem(KEY)).toBe(fp);
  });

  it("falls back to a generated id when localStorage throws", () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("localStorage disabled");
      });

    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");

    const view = lastEventOfType(AnalyticsEventType.GRID_VIEW);
    expect(view.metadata.viewerFingerprint).toMatch(/^uuid-/);
    getItemSpy.mockRestore();
  });
});

// ── endSession behavior (reached via visibilitychange / unmount) ───────

describe("session end behaviour", () => {
  it("rounds durationMs from performance.now()", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    nowValue = 1000.4;
    trackGridEnter("grid-1");

    // Mounted hook wires up visibilitychange.
    mountedCb?.();

    nowValue = 4500.7; // delta = 3500.3 → rounded to 3500
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    const end = lastEventOfType(AnalyticsEventType.GRID_VIEW_END);
    expect(end.metadata.durationMs).toBe(3500);
  });

  it("does NOT emit GRID_VIEW_END when durationMs is zero or negative", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    nowValue = 5000;
    trackGridEnter("grid-1");
    mountedCb?.();

    // Same instant → durationMs = 0.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(eventsOfType(AnalyticsEventType.GRID_VIEW_END)).toHaveLength(0);
  });

  it("clears the active session after ending so a second end is a no-op", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();
    nowValue = 1000;
    trackGridEnter("grid-1");
    mountedCb?.();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    nowValue = 2000;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(eventsOfType(AnalyticsEventType.GRID_VIEW_END)).toHaveLength(1);

    // Dispatch again — no second GRID_VIEW_END should fire.
    document.dispatchEvent(new Event("visibilitychange"));
    expect(eventsOfType(AnalyticsEventType.GRID_VIEW_END)).toHaveLength(1);
  });

  it("does not emit GRID_VIEW_END when no active session exists (e.g. owner enter)", () => {
    setLayoutLoaded("grid-1", true);
    mockGetCurrentUserId.mockReturnValue("owner-1");
    const { trackGridEnter } = useAnalytics();

    trackGridEnter("grid-1");
    mountedCb?.();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(eventsOfType(AnalyticsEventType.GRID_VIEW_END)).toHaveLength(0);
  });
});

// ── Visibility lifecycle ───────────────────────────────────────────────

describe("visibilitychange lifecycle", () => {
  it("does not end the session when visibility changes to 'visible'", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();
    nowValue = 1000;
    trackGridEnter("grid-1");
    mountedCb?.();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    nowValue = 2000;
    document.dispatchEvent(new Event("visibilitychange"));

    expect(eventsOfType(AnalyticsEventType.GRID_VIEW_END)).toHaveLength(0);
  });

  it("starts a new view session when the tab becomes visible again after being hidden", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    nowValue = 1000;
    trackGridEnter("grid-1");
    mountedCb?.();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    nowValue = 2500;
    document.dispatchEvent(new Event("visibilitychange"));

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    nowValue = 3000;
    document.dispatchEvent(new Event("visibilitychange"));

    const views = eventsOfType(AnalyticsEventType.GRID_VIEW);
    const ends = eventsOfType(AnalyticsEventType.GRID_VIEW_END);
    expect(views).toHaveLength(2);
    expect(ends).toHaveLength(1);
    expect(views[0].metadata.sessionId).not.toBe(views[1].metadata.sessionId);
  });

  it("registers and removes the visibilitychange listener via the lifecycle hooks", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");

    useAnalytics();
    mountedCb?.();
    expect(addSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );

    unmountCb?.();
    expect(removeSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });

  it("ends the session via beacon (not firestore) on visibilitychange → hidden", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    nowValue = 1000;
    trackGridEnter("grid-1");
    mountedCb?.();
    mockLogEvent.mockClear(); // drop the GRID_VIEW write so we can isolate the end

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    nowValue = 2500;
    document.dispatchEvent(new Event("visibilitychange"));

    expect(mockLogEventBeacon).toHaveBeenCalledTimes(1);
    expect(mockLogEventBeacon).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AnalyticsEventType.GRID_VIEW_END,
        gridId: "grid-1",
        metadata: expect.objectContaining({ durationMs: 1500 }),
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});

// ── pagehide lifecycle ────────────────────────────────────────────────

describe("pagehide lifecycle", () => {
  it("ends the session via beacon on pagehide", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    nowValue = 1000;
    trackGridEnter("grid-1");
    mountedCb?.();
    mockLogEvent.mockClear();

    nowValue = 4000;
    window.dispatchEvent(new Event("pagehide"));

    expect(mockLogEventBeacon).toHaveBeenCalledTimes(1);
    expect(mockLogEventBeacon).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: AnalyticsEventType.GRID_VIEW_END,
        gridId: "grid-1",
        metadata: expect.objectContaining({ durationMs: 3000 }),
      }),
    );
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("is a no-op on pagehide when the session was already ended", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    nowValue = 1000;
    trackGridEnter("grid-1");
    mountedCb?.();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    nowValue = 2000;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(mockLogEventBeacon).toHaveBeenCalledTimes(1);

    // Tab close after backgrounding — pagehide should find no active session.
    window.dispatchEvent(new Event("pagehide"));
    expect(mockLogEventBeacon).toHaveBeenCalledTimes(1);
  });

  it("registers and removes the pagehide listener via the lifecycle hooks", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    useAnalytics();
    mountedCb?.();
    expect(addSpy).toHaveBeenCalledWith("pagehide", expect.any(Function));

    unmountCb?.();
    expect(removeSpy).toHaveBeenCalledWith("pagehide", expect.any(Function));
  });
});

// ── onBeforeUnmount flush ──────────────────────────────────────────────

describe("onBeforeUnmount", () => {
  it("flushes the active session as GRID_VIEW_END on unmount", () => {
    setLayoutLoaded("grid-1", false);
    const { trackGridEnter } = useAnalytics();

    nowValue = 1000;
    trackGridEnter("grid-1");
    mountedCb?.();

    nowValue = 5000;
    unmountCb?.();

    const end = lastEventOfType(AnalyticsEventType.GRID_VIEW_END);
    expect(end).toMatchObject({
      gridId: "grid-1",
      metadata: { durationMs: 4000 },
    });
    // sessionId should match the GRID_VIEW that started this session.
    const view = lastEventOfType(AnalyticsEventType.GRID_VIEW);
    expect(end.metadata.sessionId).toBe(view.metadata.sessionId);
  });

  it("is a no-op on unmount when no view session is active", () => {
    useAnalytics();
    mountedCb?.();
    unmountCb?.();
    expect(eventsOfType(AnalyticsEventType.GRID_VIEW_END)).toHaveLength(0);
  });
});

// ── Analytics unavailable ──────────────────────────────────────────────

describe("analytics not configured", () => {
  it("returns no-op trackers when analytics service lookup throws", () => {
    mockGetAnalyticsService.mockImplementation(() => {
      throw new Error("analytics disabled");
    });

    let analytics: ReturnType<typeof useAnalytics> | null = null;
    expect(() => {
      analytics = useAnalytics();
    }).not.toThrow();

    setLayoutLoaded("grid-1", false);
    expect(() => analytics?.trackGridEnter("grid-1")).not.toThrow();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  it("no-ops tracker calls when getAnalyticsService returns no service", () => {
    mockGetAnalyticsService.mockReturnValue(null as never);
    setLayoutLoaded("grid-1", false);
    const analytics = useAnalytics();

    expect(() => analytics.trackGridEnter("grid-1")).not.toThrow();
    expect(mockLogEvent).not.toHaveBeenCalled();
  });
});

// ── logEvent error isolation ───────────────────────────────────────────

describe("logEvent rejection", () => {
  it("does not throw when analyticsService.logEvent rejects (fire-and-forget)", () => {
    mockLogEvent.mockRejectedValueOnce(new Error("offline"));
    setLayoutLoaded("grid-1", true);
    mockGetCurrentUserId.mockReturnValue("owner-1");
    const { trackGridEnter } = useAnalytics();

    expect(() => trackGridEnter("grid-1")).not.toThrow();
  });
});
