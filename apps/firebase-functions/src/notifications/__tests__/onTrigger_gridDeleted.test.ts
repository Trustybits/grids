import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { writeServerAnalyticsEvent } from "../../analytics/utils_writeServerEvent.js";
import { isDevTeamMember } from "../utils_devTeam.js";
import { discordUserActivityWebhookUrl } from "../secrets.js";

const { firestoreState } = vi.hoisted(() => ({
  firestoreState: {
    userDocs: new Map<string, Record<string, unknown>>(),
    userGetShouldThrow: false,
    userGetCalls: [] as string[],
  },
}));

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    firestore: {
      document: vi.fn(() => ({
        onDelete: (handler: unknown) => handler,
      })),
    },
  })),
}));

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            if (firestoreState.userGetShouldThrow) throw new Error("lookup failed");
            const path = `${name}/${id}`;
            firestoreState.userGetCalls.push(path);
            return { data: () => firestoreState.userDocs.get(path) };
          },
        }),
      }),
    }),
  },
}));

vi.mock("../../maintenance.js", () => ({ noopIfMaintenance: vi.fn() }));
vi.mock("../../analytics/utils_writeServerEvent.js", () => ({
  writeServerAnalyticsEvent: vi.fn(),
}));
vi.mock("../utils_devTeam.js", () => ({ isDevTeamMember: vi.fn() }));
vi.mock("../secrets.js", () => ({
  discordUserActivityWebhookUrl: { value: vi.fn() },
}));

import { onGridDeleted as handlerExport } from "../onTrigger_gridDeleted.js";

const onGridDeleted = handlerExport as unknown as (
  snapshot: { data: () => Record<string, unknown> },
  context: { params: { gridId: string } },
) => Promise<unknown>;

function snapshot(data: Record<string, unknown>) {
  return { data: () => data };
}

function context(gridId = "grid-1") {
  return { params: { gridId } };
}

beforeEach(() => {
  firestoreState.userDocs = new Map([["users/user-1", { email: "person@example.com" }]]);
  firestoreState.userGetShouldThrow = false;
  firestoreState.userGetCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(writeServerAnalyticsEvent).mockReset().mockResolvedValue(undefined);
  vi.mocked(isDevTeamMember).mockReset().mockReturnValue(false);
  vi.mocked(discordUserActivityWebhookUrl.value).mockReset().mockReturnValue("https://discord.test/hook");
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onGridDeleted", () => {
  it("returns null without analytics or Firestore when maintenance is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(onGridDeleted(snapshot({ userId: "user-1" }), context())).resolves.toBeNull();

    expect(writeServerAnalyticsEvent).not.toHaveBeenCalled();
    expect(firestoreState.userGetCalls).toEqual([]);
  });

  it("writes grid_deleted analytics with default Untitled name", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" }));

    await onGridDeleted(snapshot({ userId: "user-1" }), context("grid-1"));

    expect(writeServerAnalyticsEvent).toHaveBeenCalledWith({
      eventType: "grid_deleted",
      userId: "user-1",
      gridId: "grid-1",
      metadata: { gridName: "Untitled" },
    });
  });

  it("skips Discord for dev team members using owner email lookup", async () => {
    vi.mocked(isDevTeamMember).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onGridDeleted(snapshot({ userId: "user-1", name: "Grid" }), context());

    expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "person@example.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("continues without owner email if lookup fails", async () => {
    firestoreState.userGetShouldThrow = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" }));

    await onGridDeleted(snapshot({ userId: "user-1", name: "Grid" }), context());

    expect(isDevTeamMember).toHaveBeenCalledWith("user-1", undefined);
  });

  it("logs and returns null when the webhook secret is missing", async () => {
    vi.mocked(discordUserActivityWebhookUrl.value).mockReturnValue("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onGridDeleted(snapshot({ userId: "user-1", name: "Grid" }), context());

    expect(logger.error).toHaveBeenCalledWith(
      "DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a Discord deletion payload when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "ok" });
    vi.stubGlobal("fetch", fetchMock);

    await onGridDeleted(snapshot({ userId: "user-1", name: "Deleted Grid" }), context("grid-1"));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        { name: "Grid Name", value: "Deleted Grid", inline: true },
        { name: "Grid ID", value: "grid-1", inline: true },
        { name: "User ID", value: "user-1", inline: false },
      ]),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Discord grid deletion notification sent successfully",
      { gridId: "grid-1", status: 204 },
    );
  });

  it("logs Discord error responses and fetch failures without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: async () => "failed",
      }),
    );

    await expect(onGridDeleted(snapshot({ userId: "user-1" }), context())).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      "Discord webhook returned error status",
      expect.objectContaining({ gridId: "grid-1", status: 500 }),
    );

    vi.mocked(logger.error).mockClear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(onGridDeleted(snapshot({ userId: "user-1" }), context())).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith("Failed to send Discord webhook", {
      error: "Error: network down",
      gridId: "grid-1",
    });
  });
});
