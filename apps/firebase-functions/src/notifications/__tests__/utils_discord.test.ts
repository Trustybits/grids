import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import {
  buildDiscordEmbedPayload,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
} from "../utils_discord.js";

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function mockResponse({
  ok = true,
  status = 204,
  statusText = "No Content",
  body = "",
}: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: string;
} = {}) {
  return {
    ok,
    status,
    statusText,
    text: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getDiscordWebhookUrl", () => {
  it("returns the webhook url when configured", () => {
    expect(
      getDiscordWebhookUrl("https://discord.example/hook", "MY_SECRET"),
    ).toBe("https://discord.example/hook");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns null and logs an error when the secret is an empty string", () => {
    expect(getDiscordWebhookUrl("", "MY_SECRET")).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "MY_SECRET secret is not configured",
    );
  });

  it("interpolates the provided secret name into the error message", () => {
    getDiscordWebhookUrl("", "DISCORD_USER_ACTIVITY_WEBHOOK_URL");
    expect(logger.error).toHaveBeenCalledWith(
      "DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured",
    );
  });
});

describe("buildDiscordEmbedPayload", () => {
  it("wraps the provided fields/title/color/footer in a Discord embed payload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:34:56.000Z"));

    const payload = buildDiscordEmbedPayload({
      title: "Hello",
      color: 1234,
      fields: [{ name: "Field A", value: "Value A", inline: true }],
      footerText: "footer",
    });

    expect(payload).toEqual({
      embeds: [
        {
          title: "Hello",
          color: 1234,
          fields: [{ name: "Field A", value: "Value A", inline: true }],
          timestamp: "2026-01-15T12:34:56.000Z",
          footer: { text: "footer" },
        },
      ],
    });
  });

  it("supports an empty fields array", () => {
    const payload = buildDiscordEmbedPayload({
      title: "t",
      color: 0,
      fields: [],
      footerText: "f",
    });
    expect(payload.embeds[0].fields).toEqual([]);
  });

  it("generates a fresh ISO timestamp on each call", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const first = buildDiscordEmbedPayload({
      title: "t",
      color: 0,
      fields: [],
      footerText: "f",
    });
    vi.setSystemTime(new Date("2026-02-02T00:00:00.000Z"));
    const second = buildDiscordEmbedPayload({
      title: "t",
      color: 0,
      fields: [],
      footerText: "f",
    });
    expect(first.embeds[0].timestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(second.embeds[0].timestamp).toBe("2026-02-02T00:00:00.000Z");
  });
});

describe("sendDiscordWebhook", () => {
  const basePayload = {
    embeds: [
      {
        title: "t",
        color: 0,
        fields: [],
        timestamp: "2026-01-01T00:00:00.000Z",
        footer: { text: "f" },
      },
    ],
  };

  describe("happy path (response.ok)", () => {
    it("POSTs JSON to the webhook url with the correct headers and body", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ body: "ok" }));

      await sendDiscordWebhook({
        webhookUrl: "https://discord.example/hook",
        payload: basePayload,
        successMessage: "sent",
        successContext: {},
        sendErrorContext: {},
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("https://discord.example/hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload),
      });
    });

    it("returns true and logs info with a static success context", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ status: 204, body: "ok-body" }),
      );

      const result = await sendDiscordWebhook({
        webhookUrl: "https://x",
        payload: basePayload,
        successMessage: "sent",
        successContext: { gridId: "g1" },
        sendErrorContext: {},
      });

      expect(result).toBe(true);
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith("sent", { gridId: "g1" });
      expect(logger.error).not.toHaveBeenCalled();
    });

    it("invokes successContext as a function with response info when callable", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ status: 200, statusText: "OK", body: "yay" }),
      );

      const successContext = vi.fn(({ status, responseText }) => ({
        gridId: "g1",
        status,
        responseBody: responseText,
      }));

      const result = await sendDiscordWebhook({
        webhookUrl: "https://x",
        payload: basePayload,
        successMessage: "sent",
        successContext,
        sendErrorContext: {},
      });

      expect(result).toBe(true);
      expect(successContext).toHaveBeenCalledWith({
        status: 200,
        statusText: "OK",
        responseText: "yay",
      });
      expect(logger.info).toHaveBeenCalledWith("sent", {
        gridId: "g1",
        status: 200,
        responseBody: "yay",
      });
    });
  });

  describe("error response (response.ok === false)", () => {
    it("returns false and logs an error with status, statusText, responseBody plus static responseErrorContext", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          statusText: "Server Error",
          body: "boom",
        }),
      );

      const result = await sendDiscordWebhook({
        webhookUrl: "https://x",
        payload: basePayload,
        successMessage: "sent",
        successContext: {},
        responseErrorContext: { gridId: "g1" },
        sendErrorContext: {},
      });

      expect(result).toBe(false);
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "Discord webhook returned error status",
        {
          gridId: "g1",
          status: 500,
          statusText: "Server Error",
          responseBody: "boom",
        },
      );
    });

    it("invokes responseErrorContext as a function with response info when callable", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 400,
          statusText: "Bad Request",
          body: "nope",
        }),
      );

      const responseErrorContext = vi.fn(() => ({ uid: "u1" }));

      await sendDiscordWebhook({
        webhookUrl: "https://x",
        payload: basePayload,
        successMessage: "sent",
        successContext: {},
        responseErrorContext,
        sendErrorContext: {},
      });

      expect(responseErrorContext).toHaveBeenCalledWith({
        status: 400,
        statusText: "Bad Request",
        responseText: "nope",
      });
      expect(logger.error).toHaveBeenCalledWith(
        "Discord webhook returned error status",
        {
          uid: "u1",
          status: 400,
          statusText: "Bad Request",
          responseBody: "nope",
        },
      );
    });

    it("omits caller-supplied context when responseErrorContext is not provided but still logs canonical fields", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 500,
          statusText: "Server Error",
          body: "boom",
        }),
      );

      const result = await sendDiscordWebhook({
        webhookUrl: "https://x",
        payload: basePayload,
        successMessage: "sent",
        successContext: {},
        sendErrorContext: {},
      });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Discord webhook returned error status",
        {
          status: 500,
          statusText: "Server Error",
          responseBody: "boom",
        },
      );
    });
  });

  describe("fetch throws", () => {
    it("returns false and logs an error with stringified error plus static sendErrorContext", async () => {
      fetchMock.mockRejectedValueOnce(new Error("network down"));

      const result = await sendDiscordWebhook({
        webhookUrl: "https://x",
        payload: basePayload,
        successMessage: "sent",
        successContext: {},
        sendErrorContext: { gridId: "g1" },
      });

      expect(result).toBe(false);
      expect(logger.info).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send Discord webhook",
        {
          error: "Error: network down",
          gridId: "g1",
        },
      );
    });

    it("invokes sendErrorContext as a function with the thrown error when callable", async () => {
      const thrown = new Error("network down");
      fetchMock.mockRejectedValueOnce(thrown);

      const sendErrorContext = vi.fn((error) => ({
        uid: "u1",
        errorStack: error instanceof Error ? error.stack : undefined,
      }));

      await sendDiscordWebhook({
        webhookUrl: "https://x",
        payload: basePayload,
        successMessage: "sent",
        successContext: {},
        sendErrorContext,
      });

      expect(sendErrorContext).toHaveBeenCalledWith(thrown);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send Discord webhook",
        expect.objectContaining({
          error: "Error: network down",
          uid: "u1",
          errorStack: thrown.stack,
        }),
      );
    });

    it("treats a thrown error in response.text() as a send failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => {
          throw new Error("body read failed");
        },
      } as unknown as Response);

      const result = await sendDiscordWebhook({
        webhookUrl: "https://x",
        payload: basePayload,
        successMessage: "sent",
        successContext: {},
        sendErrorContext: { gridId: "g1" },
      });

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to send Discord webhook",
        {
          error: "Error: body read failed",
          gridId: "g1",
        },
      );
    });
  });
});
