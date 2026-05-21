import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import posthog from "posthog-js";
import { registerDaoFactory } from "@/dao/DaoFactorySingleton";
import { AnalyticsService } from "@/services/AnalyticsService";
import { AnalyticsEventType } from "@/types/Analytics";
import type { AnalyticsEventDao } from "@/dao/interfaces/AnalyticsEventDao";
import type { GridStatsDao } from "@/dao/interfaces/GridStatsDao";
import type { BusinessStatsDao } from "@/dao/interfaces/BusinessStatsDao";
import type { DaoFactory } from "@/dao/interfaces/factory/DaoFactory";

// ── Mock DAOs ────────────────────────────────────────────────────────────

let mockAnalyticsEventDao: Record<string, ReturnType<typeof vi.fn>>;
let mockGridStatsDao: Record<string, ReturnType<typeof vi.fn>>;
let mockBusinessStatsDao: Record<string, ReturnType<typeof vi.fn>>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  mockAnalyticsEventDao = {
    logEvent: vi.fn(),
    logGridViewEndEventBeacon: vi.fn(),
  };
  mockGridStatsDao = {
    getAggregate: vi.fn(),
    getDaily: vi.fn(),
    getDailyRange: vi.fn(),
  };
  mockBusinessStatsDao = {
    getAggregate: vi.fn(),
    getDaily: vi.fn(),
    getDailyRange: vi.fn(),
  };

  registerDaoFactory({
    getAnalyticsEventDao: () =>
      mockAnalyticsEventDao as unknown as AnalyticsEventDao,
    getGridStatsDao: () => mockGridStatsDao as unknown as GridStatsDao,
    getBusinessStatsDao: () =>
      mockBusinessStatsDao as unknown as BusinessStatsDao,
    getUserDao: () => null,
    getSlugDao: () => null,
    getGridDao: () => null,
    getUserGameDataDao: () => null,
    getChatDao: () => null,
    getUpvoteDao: () => null,
    getCustomerDao: () => null,
    getStorageDao: () => null,
  } as unknown as DaoFactory);

  // Suppress logged errors so the swallowed-error tests don't pollute output.
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.unstubAllEnvs();
});

// ── logEvent ─────────────────────────────────────────────────────────────

describe("AnalyticsService.logEvent", () => {
  const sampleEvent = {
    eventType: AnalyticsEventType.GRID_VIEW,
    userId: "user-1",
    gridId: "grid-1",
    metadata: {
      viewerType: "authenticated" as const,
      sessionId: "sess-1",
      viewerFingerprint: "fp-1",
    },
  };

  it("forwards the event to the AnalyticsEventDao", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    mockAnalyticsEventDao.logEvent.mockResolvedValue(undefined);

    const service = new AnalyticsService();
    await service.logEvent(sampleEvent);

    expect(mockAnalyticsEventDao.logEvent).toHaveBeenCalledTimes(1);
    expect(mockAnalyticsEventDao.logEvent).toHaveBeenCalledWith(sampleEvent);
  });

  it("mirrors to PostHog with the eventType and a flattened payload when VITE_POSTHOG_KEY is set", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_abc123");
    mockAnalyticsEventDao.logEvent.mockResolvedValue(undefined);

    const service = new AnalyticsService();
    await service.logEvent(sampleEvent);

    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith(AnalyticsEventType.GRID_VIEW, {
      gridId: "grid-1",
      userId: "user-1",
      viewerType: "authenticated",
      sessionId: "sess-1",
      viewerFingerprint: "fp-1",
    });
  });

  it("does not call posthog.capture when VITE_POSTHOG_KEY is not set", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    mockAnalyticsEventDao.logEvent.mockResolvedValue(undefined);

    const service = new AnalyticsService();
    await service.logEvent(sampleEvent);

    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("captures to PostHog before writing to Firestore", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_abc123");
    const order: string[] = [];
    vi.mocked(posthog.capture).mockImplementation(() => {
      order.push("posthog");
      return undefined as any;
    });
    mockAnalyticsEventDao.logEvent.mockImplementation(async () => {
      order.push("dao");
    });

    const service = new AnalyticsService();
    await service.logEvent(sampleEvent);

    expect(order).toEqual(["posthog", "dao"]);
  });

  it("swallows DAO errors so the caller's flow is not broken", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    mockAnalyticsEventDao.logEvent.mockRejectedValue(
      new Error("firestore down"),
    );

    const service = new AnalyticsService();
    await expect(service.logEvent(sampleEvent)).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("still writes to Firestore even if PostHog throws", async () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_abc123");
    vi.mocked(posthog.capture).mockImplementation(() => {
      throw new Error("posthog kaboom");
    });
    mockAnalyticsEventDao.logEvent.mockResolvedValue(undefined);

    const service = new AnalyticsService();
    await expect(service.logEvent(sampleEvent)).resolves.toBeUndefined();

    expect(mockAnalyticsEventDao.logEvent).toHaveBeenCalledWith(sampleEvent);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// ── logGridViewEndEventBeacon ────────────────────────────────────────────

describe("AnalyticsService.logGridViewEndEventBeacon", () => {
  const sampleBeaconEvent = {
    eventType: AnalyticsEventType.GRID_VIEW_END,
    userId: "user-1",
    gridId: "grid-1",
    metadata: {
      sessionId: "sess-1",
      durationMs: 12345,
    },
  } as const;

  it("forwards the event to AnalyticsEventDao.logGridViewEndEventBeacon and returns its result", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    mockAnalyticsEventDao.logGridViewEndEventBeacon.mockReturnValue(true);

    const service = new AnalyticsService();
    const result = service.logGridViewEndEventBeacon(sampleBeaconEvent);

    expect(mockAnalyticsEventDao.logGridViewEndEventBeacon).toHaveBeenCalledTimes(1);
    expect(mockAnalyticsEventDao.logGridViewEndEventBeacon).toHaveBeenCalledWith(
      sampleBeaconEvent,
    );
    expect(result).toBe(true);
  });

  it("returns false when the DAO returns false", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    mockAnalyticsEventDao.logGridViewEndEventBeacon.mockReturnValue(false);

    const service = new AnalyticsService();
    expect(service.logGridViewEndEventBeacon(sampleBeaconEvent)).toBe(false);
  });

  it("mirrors to PostHog with eventType and a flattened payload when VITE_POSTHOG_KEY is set", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_abc123");
    mockAnalyticsEventDao.logGridViewEndEventBeacon.mockReturnValue(true);

    const service = new AnalyticsService();
    service.logGridViewEndEventBeacon(sampleBeaconEvent);

    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith(
      AnalyticsEventType.GRID_VIEW_END,
      {
        gridId: "grid-1",
        userId: "user-1",
        sessionId: "sess-1",
        durationMs: 12345,
      },
    );
  });

  it("does not call posthog.capture when VITE_POSTHOG_KEY is not set", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    mockAnalyticsEventDao.logGridViewEndEventBeacon.mockReturnValue(true);

    const service = new AnalyticsService();
    service.logGridViewEndEventBeacon(sampleBeaconEvent);

    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("captures to PostHog before calling the beacon DAO", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_abc123");
    const order: string[] = [];
    vi.mocked(posthog.capture).mockImplementation(() => {
      order.push("posthog");
      return undefined as any;
    });
    mockAnalyticsEventDao.logGridViewEndEventBeacon.mockImplementation(() => {
      order.push("dao");
      return true;
    });

    const service = new AnalyticsService();
    service.logGridViewEndEventBeacon(sampleBeaconEvent);

    expect(order).toEqual(["posthog", "dao"]);
  });

  it("returns false and logs when the DAO throws", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "");
    mockAnalyticsEventDao.logGridViewEndEventBeacon.mockImplementation(() => {
      throw new Error("beacon kaboom");
    });

    const service = new AnalyticsService();
    expect(service.logGridViewEndEventBeacon(sampleBeaconEvent)).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("still calls the beacon DAO even if PostHog throws", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_abc123");
    vi.mocked(posthog.capture).mockImplementation(() => {
      throw new Error("posthog kaboom");
    });
    mockAnalyticsEventDao.logGridViewEndEventBeacon.mockReturnValue(true);

    const service = new AnalyticsService();
    expect(service.logGridViewEndEventBeacon(sampleBeaconEvent)).toBe(true);
    expect(mockAnalyticsEventDao.logGridViewEndEventBeacon).toHaveBeenCalledWith(
      sampleBeaconEvent,
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// ── getGridStats ─────────────────────────────────────────────────────────

describe("AnalyticsService.getGridStats", () => {
  it("returns the aggregate grid stats from the DAO", async () => {
    const stats = { gridId: "l1", ownerId: "u1", totalViews: 7 } as any;
    mockGridStatsDao.getAggregate.mockResolvedValue(stats);

    const service = new AnalyticsService();
    const result = await service.getGridStats("l1");

    expect(mockGridStatsDao.getAggregate).toHaveBeenCalledWith("l1");
    expect(result).toBe(stats);
  });

  it("returns null when the DAO returns null", async () => {
    mockGridStatsDao.getAggregate.mockResolvedValue(null);
    const service = new AnalyticsService();
    expect(await service.getGridStats("l1")).toBeNull();
  });

  it("rethrows DAO errors", async () => {
    mockGridStatsDao.getAggregate.mockRejectedValue(new Error("boom"));
    const service = new AnalyticsService();
    await expect(service.getGridStats("l1")).rejects.toThrow("boom");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// ── getGridStatsForDate ──────────────────────────────────────────────────

describe("AnalyticsService.getGridStatsForDate", () => {
  it("delegates to GridStatsDao.getDaily with gridId and date", async () => {
    const daily = { gridId: "l1", date: "2026-05-07" } as any;
    mockGridStatsDao.getDaily.mockResolvedValue(daily);

    const service = new AnalyticsService();
    const result = await service.getGridStatsForDate("l1", "2026-05-07");

    expect(mockGridStatsDao.getDaily).toHaveBeenCalledWith("l1", "2026-05-07");
    expect(result).toBe(daily);
  });

  it("rethrows DAO errors", async () => {
    mockGridStatsDao.getDaily.mockRejectedValue(new Error("daily fail"));
    const service = new AnalyticsService();
    await expect(
      service.getGridStatsForDate("l1", "2026-05-07"),
    ).rejects.toThrow("daily fail");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// ── getGridStatsDailyRange ───────────────────────────────────────────────

describe("AnalyticsService.getGridStatsDailyRange", () => {
  it("delegates to GridStatsDao.getDailyRange", async () => {
    const days = [{ date: "2026-05-01" }, { date: "2026-05-02" }] as any[];
    mockGridStatsDao.getDailyRange.mockResolvedValue(days);

    const service = new AnalyticsService();
    const result = await service.getGridStatsDailyRange(
      "l1",
      "2026-05-01",
      "2026-05-02",
    );

    expect(mockGridStatsDao.getDailyRange).toHaveBeenCalledWith(
      "l1",
      "2026-05-01",
      "2026-05-02",
    );
    expect(result).toBe(days);
  });

  it("rethrows DAO errors", async () => {
    mockGridStatsDao.getDailyRange.mockRejectedValue(new Error("range fail"));
    const service = new AnalyticsService();
    await expect(
      service.getGridStatsDailyRange("l1", "a", "b"),
    ).rejects.toThrow("range fail");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// ── getBusinessStats ─────────────────────────────────────────────────────

describe("AnalyticsService.getBusinessStats", () => {
  it("delegates to BusinessStatsDao.getAggregate", async () => {
    const stats = { totalUsers: 3 } as any;
    mockBusinessStatsDao.getAggregate.mockResolvedValue(stats);

    const service = new AnalyticsService();
    expect(await service.getBusinessStats()).toBe(stats);
    expect(mockBusinessStatsDao.getAggregate).toHaveBeenCalledTimes(1);
  });

  it("rethrows DAO errors", async () => {
    mockBusinessStatsDao.getAggregate.mockRejectedValue(new Error("biz fail"));
    const service = new AnalyticsService();
    await expect(service.getBusinessStats()).rejects.toThrow("biz fail");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});

// ── getBusinessStatsDailyRange ───────────────────────────────────────────

describe("AnalyticsService.getBusinessStatsDailyRange", () => {
  it("delegates to BusinessStatsDao.getDailyRange", async () => {
    const days = [{ date: "2026-05-01" }] as any[];
    mockBusinessStatsDao.getDailyRange.mockResolvedValue(days);

    const service = new AnalyticsService();
    const result = await service.getBusinessStatsDailyRange(
      "2026-05-01",
      "2026-05-02",
    );

    expect(mockBusinessStatsDao.getDailyRange).toHaveBeenCalledWith(
      "2026-05-01",
      "2026-05-02",
    );
    expect(result).toBe(days);
  });

  it("rethrows DAO errors", async () => {
    mockBusinessStatsDao.getDailyRange.mockRejectedValue(
      new Error("biz range fail"),
    );
    const service = new AnalyticsService();
    await expect(service.getBusinessStatsDailyRange("a", "b")).rejects.toThrow(
      "biz range fail",
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
