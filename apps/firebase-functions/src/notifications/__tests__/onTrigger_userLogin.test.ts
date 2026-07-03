import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { writeServerAnalyticsEvent } from "../../analytics/utils_writeServerEvent.js";
import { isDevTeamMember } from "../utils_devTeam.js";
import { syncDevAccountFlagForUser } from "../utils_devAccount.js";
import { discordUserActivityWebhookUrl } from "../secrets.js";

const { adminState } = vi.hoisted(() => ({
  adminState: {
    providerId: "google.com" as string | undefined,
    getUserReject: false,
  },
}));

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

vi.mock("firebase-admin", () => ({
  default: {
    auth: () => ({
      getUser: vi.fn(async () => {
        if (adminState.getUserReject) {
          throw new Error("auth unavailable");
        }
        return {
          providerData: adminState.providerId
            ? [{ providerId: adminState.providerId }]
            : [],
        };
      }),
    }),
  },
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../../analytics/utils_writeServerEvent.js", () => ({
  writeServerAnalyticsEvent: vi.fn(),
}));

vi.mock("../utils_devTeam.js", () => ({
  isDevTeamMember: vi.fn(),
}));

vi.mock("../utils_devAccount.js", () => ({
  syncDevAccountFlagForUser: vi.fn(),
}));

vi.mock("../secrets.js", () => ({
  discordUserActivityWebhookUrl: { value: vi.fn() },
}));

import { onUserLogin as handlerExport } from "../onTrigger_userLogin.js";

const onUserLogin = handlerExport as unknown as (
  change: { before: { data: () => Record<string, unknown> }; after: { data: () => Record<string, unknown> } },
  context: { params: { userId: string } },
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

function context(userId = "user-1") {
  return { params: { userId } };
}

beforeEach(() => {
  adminState.providerId = "google.com";
  adminState.getUserReject = false;
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(writeServerAnalyticsEvent).mockReset().mockResolvedValue(undefined);
  vi.mocked(syncDevAccountFlagForUser).mockReset().mockResolvedValue(false);
  vi.mocked(isDevTeamMember).mockReset().mockReturnValue(false);
  vi.mocked(discordUserActivityWebhookUrl.value).mockReset().mockReturnValue("https://discord.test/hook");
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  vi.mocked(logger.warn).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onUserLogin", () => {
  it("returns null without reading snapshots when maintenance is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(onUserLogin(change({}, {}), context())).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("onUserLogin");
    expect(writeServerAnalyticsEvent).not.toHaveBeenCalled();
    expect(syncDevAccountFlagForUser).not.toHaveBeenCalled();
  });

  it.each([
    ["missing after lastLogin", { lastLogin: ts(1) }, {}],
    ["unchanged timestamp", { lastLogin: ts(1) }, { lastLogin: ts(1) }],
  ])("ignores updates with %s", async (_label, before, after) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(onUserLogin(change(before, after), context())).resolves.toBeNull();

    expect(writeServerAnalyticsEvent).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["google.com", "Google"],
    ["password", "Email/Password"],
    ["github.com", "Email Link"],
    [undefined, "unknown"],
  ])("writes login analytics using provider %s", async (providerId, signInMethod) => {
    adminState.providerId = providerId;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" }),
    );

    await onUserLogin(
      change({ lastLogin: ts(1) }, { lastLogin: ts(2), email: "person@example.com" }),
      context(),
    );

    expect(writeServerAnalyticsEvent).toHaveBeenCalledWith({
      eventType: "user_login",
      userId: "user-1",
      gridId: null,
      metadata: { signInMethod },
    });
    expect(syncDevAccountFlagForUser).toHaveBeenCalledWith(
      "user-1",
      "person@example.com",
    );
  });

  it("falls back to unknown when auth provider lookup fails", async () => {
    adminState.getUserReject = true;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => "" }),
    );

    await onUserLogin(
      change({ lastLogin: ts(1) }, { lastLogin: ts(2), email: "person@example.com" }),
      context(),
    );

    expect(logger.warn).toHaveBeenCalledWith(
      "Failed to look up auth provider for login event",
      { userId: "user-1", error: "Error: auth unavailable" },
    );
    expect(writeServerAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { signInMethod: "unknown" } }),
    );
  });

  it("skips Discord notification for dev team members after analytics", async () => {
    vi.mocked(isDevTeamMember).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onUserLogin(
      change({ lastLogin: ts(1) }, { lastLogin: ts(2), email: "dev@grids.so" }),
      context(),
    );

    expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "dev@grids.so");
    expect(writeServerAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs and returns null when the webhook secret is missing", async () => {
    vi.mocked(discordUserActivityWebhookUrl.value).mockReturnValue("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await onUserLogin(
      change({ lastLogin: ts(1) }, { lastLogin: ts(2), email: "person@example.com" }),
      context(),
    );

    expect(logger.error).toHaveBeenCalledWith(
      "DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the Discord login notification when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", fetchMock);

    await onUserLogin(
      change({ lastLogin: ts(1) }, { lastLogin: ts(2), email: "person@example.com" }),
      context(),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.test/hook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        { name: "Email", value: "person@example.com", inline: true },
        { name: "User ID", value: "user-1", inline: true },
      ]),
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

    await expect(
      onUserLogin(
        change({ lastLogin: ts(1) }, { lastLogin: ts(2), email: "person@example.com" }),
        context(),
      ),
    ).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith(
      "Discord webhook returned error status",
      expect.objectContaining({ userId: "user-1", status: 500 }),
    );

    vi.mocked(logger.error).mockClear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(
      onUserLogin(
        change({ lastLogin: ts(2) }, { lastLogin: ts(3), email: "person@example.com" }),
        context(),
      ),
    ).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith("Failed to send Discord webhook", {
      error: "Error: network down",
      userId: "user-1",
    });
  });
});
