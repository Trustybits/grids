import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { writeServerAnalyticsEvent } from "../../analytics/utils_writeServerEvent.js";
import { isDevTeamMember } from "../utils_devTeam.js";
import { discordUserActivityWebhookUrl } from "../secrets.js";

const { firestoreState } = vi.hoisted(() => ({
  firestoreState: {
    docs: new Map<string, Record<string, unknown>>(),
    getShouldThrow: false,
  },
}));

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    firestore: {
      document: vi.fn(() => ({
        onCreate: (handler: unknown) => handler,
      })),
    },
  })),
}));

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

// The grid-creation notification itself does not write to Firestore; the only
// Firestore access is the dev-team email lookup in shouldSkipDevTeamNotification.
vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          path: `${name}/${id}`,
          get: async () => {
            if (firestoreState.getShouldThrow) throw new Error("lookup failed");
            const data = firestoreState.docs.get(`${name}/${id}`);
            return { exists: data !== undefined, data: () => data };
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

import { onGridCreated as handlerExport } from "../onTrigger_gridCreated.js";

const onGridCreated = handlerExport as unknown as (
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
  firestoreState.docs = new Map([["users/user-1", { email: "person@example.com" }]]);
  firestoreState.getShouldThrow = false;
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

describe("onGridCreated", () => {
  it("returns null without analytics when maintenance is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(onGridCreated(snapshot({ userId: "user-1" }), context())).resolves.toBeNull();

    expect(writeServerAnalyticsEvent).not.toHaveBeenCalled();
  });

  it("writes grid_created analytics with grid metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" }));

    await onGridCreated(snapshot({ userId: "user-1", name: "New Grid" }), context("grid-1"));

    expect(writeServerAnalyticsEvent).toHaveBeenCalledWith({
      eventType: "grid_created",
      userId: "user-1",
      gridId: "grid-1",
      metadata: { gridName: "New Grid" },
    });
  });

  it("skips the Discord notification for dev team members", async () => {
    vi.mocked(isDevTeamMember).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onGridCreated(snapshot({ userId: "user-1", name: "Grid" }), context());

    expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "person@example.com");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a Discord notification with grid details", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "ok" });
    vi.stubGlobal("fetch", fetchMock);

    await onGridCreated(snapshot({ userId: "user-1", name: "New Grid" }), context("grid-1"));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        { name: "Grid Name", value: "New Grid", inline: true },
        { name: "Grid ID", value: "grid-1", inline: true },
        { name: "Grid Link", value: "https://grids.so/grid/grid-1", inline: true },
        { name: "User ID", value: "user-1", inline: false },
      ]),
    );
  });

  it("logs a missing Discord secret and returns", async () => {
    vi.mocked(discordUserActivityWebhookUrl.value).mockReturnValue("");

    await onGridCreated(snapshot({ userId: "user-1", name: "Grid" }), context("grid-1"));

    expect(logger.error).toHaveBeenCalledWith(
      "DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured",
    );
  });

  it("logs a Discord send failure without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(onGridCreated(snapshot({ userId: "user-1", name: "Grid" }), context("grid-1"))).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith("Failed to send Discord webhook", {
      error: "Error: network down",
      gridId: "grid-1",
    });
  });

  it("writes analytics with a null userId when the grid has no userId", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" }));

    await onGridCreated(snapshot({ name: "Grid" }), context("grid-1"));

    expect(writeServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });
});
