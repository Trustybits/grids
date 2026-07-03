import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { writeServerAnalyticsEvent } from "../../analytics/utils_writeServerEvent.js";
import { isDevTeamMember } from "../utils_devTeam.js";
import { syncDevAccountFlagForUser } from "../utils_devAccount.js";
import { discordNewUsersWebhookUrl } from "../secrets.js";

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    auth: {
      user: () => ({
        onCreate: (handler: unknown) => handler,
      }),
    },
  })),
}));

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
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
  discordNewUsersWebhookUrl: { value: vi.fn() },
}));

import { onNewUserSignup as handlerExport } from "../onTrigger_newUserSignup.js";

const onNewUserSignup = handlerExport as unknown as (user: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  providerData: Array<{ providerId?: string }>;
}) => Promise<unknown>;

function user(providerId: string | null = "google.com") {
  return {
    uid: "user-1",
    email: "person@example.com",
    displayName: "Person",
    providerData: providerId === null ? [] : [{ providerId }],
  };
}

beforeEach(() => {
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(writeServerAnalyticsEvent).mockReset().mockResolvedValue(undefined);
  vi.mocked(syncDevAccountFlagForUser).mockReset().mockResolvedValue(false);
  vi.mocked(isDevTeamMember).mockReset().mockReturnValue(false);
  vi.mocked(discordNewUsersWebhookUrl.value).mockReset().mockReturnValue("https://discord.test/hook");
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onNewUserSignup", () => {
  it("returns null without logging analytics or posting when maintenance is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(onNewUserSignup(user())).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("onNewUserSignup");
    expect(writeServerAnalyticsEvent).not.toHaveBeenCalled();
    expect(syncDevAccountFlagForUser).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["google.com", "Google"],
    ["password", "Email/Password"],
    ["emailLink", "Email Link"],
    [null, "Email Link"],
  ])("writes signup analytics with sign-in method for provider %s", async (providerId, signInMethod) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => "",
      }),
    );

    await onNewUserSignup(user(providerId));

    expect(writeServerAnalyticsEvent).toHaveBeenCalledWith({
      eventType: "user_signup",
      userId: "user-1",
      gridId: null,
      metadata: { signInMethod },
    });
    expect(syncDevAccountFlagForUser).toHaveBeenCalledWith(
      "user-1",
      "person@example.com",
    );
  });

  it("skips Discord notification for dev team members after analytics is written", async () => {
    vi.mocked(isDevTeamMember).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(onNewUserSignup(user())).resolves.toBeNull();

    expect(isDevTeamMember).toHaveBeenCalledWith("user-1", "person@example.com");
    expect(writeServerAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "Skipping Discord notification for dev team member",
      { uid: "user-1" },
    );
  });

  it("logs and returns null when the Discord secret is missing", async () => {
    vi.mocked(discordNewUsersWebhookUrl.value).mockReturnValue("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(onNewUserSignup(user())).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith(
      "DISCORD_NEW_USERS_WEBHOOK_URL secret is not configured",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a Discord embed with user details when configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => "ok",
    });
    vi.stubGlobal("fetch", fetchMock);

    await onNewUserSignup(user("password"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const body = JSON.parse(init.body);
    expect(body.embeds[0].fields).toEqual(
      expect.arrayContaining([
        { name: "Display Name", value: "Person", inline: true },
        { name: "Email", value: "person@example.com", inline: true },
        { name: "Sign-in Method", value: "Email/Password", inline: true },
        { name: "User ID", value: "user-1", inline: false },
      ]),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "Discord notification sent successfully",
      {
        uid: "user-1",
        email: "person@example.com",
        status: 204,
        responseBody: "ok",
      },
    );
  });

  it("logs Discord error responses without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: async () => "failed",
      }),
    );

    await expect(onNewUserSignup(user())).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith(
      "Discord webhook returned error status",
      expect.objectContaining({
        uid: "user-1",
        status: 500,
        responseBody: "failed",
      }),
    );
  });

  it("logs fetch failures without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(onNewUserSignup(user())).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send Discord webhook",
      expect.objectContaining({
        error: "Error: network down",
        uid: "user-1",
      }),
    );
  });
});
