import { beforeEach, describe, expect, it, vi } from "vitest";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { discordUserActivityWebhookUrl } from "../secrets.js";
import { sendDiscordWebhook } from "../utils_discord.js";

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    firestore: {
      document: () => ({
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

vi.mock("../secrets.js", () => ({
  discordUserActivityWebhookUrl: { value: vi.fn() },
}));

vi.mock("../utils_discord.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils_discord.js")>();
  return { ...actual, sendDiscordWebhook: vi.fn() };
});

import {
  buildEmailRecoveryRequestFields,
  onEmailRecoveryRequestCreated as handlerExport,
} from "../onTrigger_emailRecoveryRequestCreated.js";

const onCreate = handlerExport as unknown as (
  snapshot: { data: () => Record<string, unknown> },
  context: { params: { requestId: string } },
) => Promise<unknown>;

const request = {
  uid: "uid-1",
  lostEmail: "old@example.com",
  requestedEmail: "new@example.com",
  contact: "rochdi",
  details: "Grid: Studio",
  signedIn: true,
  status: "pending" as const,
};

describe("onEmailRecoveryRequestCreated", () => {
  beforeEach(() => {
    resetMaintenanceMock(noopIfMaintenance);
    vi.mocked(sendDiscordWebhook).mockReset().mockResolvedValue(true);
    vi.mocked(discordUserActivityWebhookUrl.value).mockReturnValue(
      "https://discord.test/webhook",
    );
  });

  it("posts the request to Discord with the issue command", async () => {
    await onCreate({ data: () => request }, { params: { requestId: "req-1" } });

    expect(sendDiscordWebhook).toHaveBeenCalledTimes(1);
    const { webhookUrl, payload } = vi.mocked(sendDiscordWebhook).mock.calls[0][0];
    expect(webhookUrl).toBe("https://discord.test/webhook");
    const embed = payload.embeds[0];
    expect(embed.title).toContain("Email Recovery Request");
    expect(embed.footer.text).toContain("req-1");
    const nextStep = embed.fields.find((field) => field.name === "Next step");
    expect(nextStep?.value).toContain("issue uid-1 --request req-1");
  });

  it("skips sending when the webhook secret is missing", async () => {
    vi.mocked(discordUserActivityWebhookUrl.value).mockReturnValue("");
    await onCreate({ data: () => request }, { params: { requestId: "req-1" } });
    expect(sendDiscordWebhook).not.toHaveBeenCalled();
  });

  it("no-ops in maintenance mode", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    await onCreate({ data: () => request }, { params: { requestId: "req-1" } });
    expect(sendDiscordWebhook).not.toHaveBeenCalled();
  });
});

describe("buildEmailRecoveryRequestFields", () => {
  it("flags requests with no matching account", () => {
    const fields = buildEmailRecoveryRequestFields("req-2", { ...request, uid: null });
    expect(fields.find((f) => f.name === "User ID")?.value).toContain("No account found");
    expect(fields.find((f) => f.name === "Next step")?.value).toContain("issue <uid>");
  });

  it("truncates long values to Discord's field limit", () => {
    const fields = buildEmailRecoveryRequestFields("req-3", {
      ...request,
      details: "x".repeat(3000),
    });
    const details = fields.find((f) => f.name === "Details")?.value ?? "";
    expect(details.length).toBe(1024);
    expect(details.endsWith("…")).toBe(true);
  });
});
