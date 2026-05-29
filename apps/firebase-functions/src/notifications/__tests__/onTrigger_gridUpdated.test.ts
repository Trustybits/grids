import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { isDevTeamMember } from "../utils_devTeam.js";
import { discordUserActivityWebhookUrl } from "../secrets.js";

const { firestoreState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  };
  return {
    FieldValue,
    firestoreState: {
      docs: new Map<string, Record<string, unknown>>(),
      getShouldThrowPaths: new Set<string>(),
      setShouldThrow: false,
      setCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
    },
  };
});

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    firestore: {
      document: vi.fn(() => ({
        onUpdate: (handler: unknown) => handler,
      })),
    },
  })),
}));

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: (name: string) => ({
          doc: (id: string) => ({
            path: `${name}/${id}`,
            get: async () => {
              const path = `${name}/${id}`;
              if (firestoreState.getShouldThrowPaths.has(path)) {
                throw new Error(`get failed: ${path}`);
              }
              const data = firestoreState.docs.get(path);
              return { data: () => data };
            },
            set: async (data: Record<string, unknown>) => {
              if (firestoreState.setShouldThrow) {
                throw new Error("set failed");
              }
              firestoreState.setCalls.push({ path: `${name}/${id}`, data });
            },
          }),
        }),
      }),
      { FieldValue },
    ),
  },
}));

vi.mock("../../maintenance.js", () => ({ noopIfMaintenance: vi.fn() }));
vi.mock("../utils_devTeam.js", () => ({ isDevTeamMember: vi.fn() }));
vi.mock("../secrets.js", () => ({
  discordUserActivityWebhookUrl: { value: vi.fn() },
}));

import { onGridUpdated as handlerExport } from "../onTrigger_gridUpdated.js";

const onGridUpdated = handlerExport as unknown as (
  change: { before: { data: () => Record<string, unknown> }; after: { data: () => Record<string, unknown> } },
  context: { params: { gridId: string } },
) => Promise<unknown>;

function ts(ms: number) {
  return { toMillis: () => ms };
}

function change(before: Record<string, unknown>, after: Record<string, unknown>) {
  return {
    before: { data: () => before },
    after: { data: () => after },
  };
}

function context(gridId = "grid-1") {
  return { params: { gridId } };
}

const beforeGrid = {
  userId: "user-1",
  name: "Old",
  tiles: [{ i: "a" }],
  isPublic: false,
  updatedAt: ts(1_000),
};

beforeEach(() => {
  firestoreState.docs = new Map([["users/user-1", { email: "person@example.com" }]]);
  firestoreState.getShouldThrowPaths = new Set();
  firestoreState.setShouldThrow = false;
  firestoreState.setCalls = [];
  FieldValue.serverTimestamp.mockClear();
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(isDevTeamMember).mockReset().mockReturnValue(false);
  vi.mocked(discordUserActivityWebhookUrl.value).mockReset().mockReturnValue("https://discord.test/hook");
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  vi.mocked(logger.warn).mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-22T15:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("onGridUpdated", () => {
  it("returns null without reading snapshots when maintenance is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(onGridUpdated(change({}, {}), context())).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing after updatedAt", beforeGrid, { ...beforeGrid, updatedAt: undefined }],
    ["unchanged updatedAt", beforeGrid, { ...beforeGrid }],
  ])("ignores updates with %s", async (_label, before, after) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onGridUpdated(change(before, after), context());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips notification when updatedAt changed but meaningful fields did not", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onGridUpdated(
      change(beforeGrid, { ...beforeGrid, updatedAt: ts(2_000) }),
      context(),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "Grid updated but no meaningful changes detected, skipping notification",
      { gridId: "grid-1", userId: "user-1" },
    );
  });

  it.each([
    ["name", { name: "New" }],
    ["tiles", { tiles: [{ i: "a" }, { i: "b" }] }],
    ["privacy", { isPublic: true }],
  ])("posts Discord notification for meaningful %s changes", async (_label, patch) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "ok" });
    vi.stubGlobal("fetch", fetchMock);

    await onGridUpdated(
      change(beforeGrid, { ...beforeGrid, ...patch, updatedAt: ts(2_000) }),
      context("grid-1"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.test/hook",
      expect.objectContaining({ method: "POST" }),
    );
    expect(firestoreState.setCalls).toEqual([
      {
        path: "notification_tracking/grid_update_user-1",
        data: {
          lastNotifiedAt: { __op: "serverTimestamp" },
          userId: "user-1",
          gridId: "grid-1",
        },
      },
    ]);
  });

  it("skips Discord notification for dev team members", async () => {
    vi.mocked(isDevTeamMember).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onGridUpdated(
      change(beforeGrid, { ...beforeGrid, name: "New", updatedAt: ts(2_000) }),
      context(),
    );

    expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "person@example.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips notification inside the 10-minute debounce window", async () => {
    firestoreState.docs.set("notification_tracking/grid_update_user-1", {
      lastNotifiedAt: ts(Date.now() - 5 * 60 * 1000),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onGridUpdated(
      change(beforeGrid, { ...beforeGrid, name: "New", updatedAt: ts(2_000) }),
      context(),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "Skipping notification due to 10-minute debounce",
      expect.objectContaining({ userId: "user-1", gridId: "grid-1" }),
    );
  });

  it("continues when notification tracking lookup fails", async () => {
    firestoreState.getShouldThrowPaths.add("notification_tracking/grid_update_user-1");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await onGridUpdated(
      change(beforeGrid, { ...beforeGrid, name: "New", updatedAt: ts(2_000) }),
      context(),
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to check notification tracking, proceeding with notification",
      { error: "Error: get failed: notification_tracking/grid_update_user-1" },
    );
    expect(fetchMock).toHaveBeenCalled();
  });

  it("logs missing webhook and Discord failures without throwing", async () => {
    vi.mocked(discordUserActivityWebhookUrl.value).mockReturnValue("");

    await expect(
      onGridUpdated(
        change(beforeGrid, { ...beforeGrid, name: "New", updatedAt: ts(2_000) }),
        context(),
      ),
    ).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      "DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured",
    );

    vi.mocked(logger.error).mockClear();
    vi.mocked(discordUserActivityWebhookUrl.value).mockReturnValue("https://discord.test/hook");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(
      onGridUpdated(
        change(beforeGrid, { ...beforeGrid, name: "Newer", updatedAt: ts(3_000) }),
        context(),
      ),
    ).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith("Failed to send Discord webhook", {
      error: "Error: network down",
      gridId: "grid-1",
    });
  });

  it("logs but does not fail when updating notification tracking fails", async () => {
    firestoreState.setShouldThrow = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" }));

    await expect(
      onGridUpdated(
        change(beforeGrid, { ...beforeGrid, name: "New", updatedAt: ts(2_000) }),
        context(),
      ),
    ).resolves.toBeNull();

    expect(logger.warn).toHaveBeenCalledWith("Failed to update notification tracking", {
      error: "Error: set failed",
    });
  });
});
