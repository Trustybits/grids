import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

import {
  getResendApiKey,
  getResendFromEmail,
  sendResendEmail,
} from "../utils_resend.js";

beforeEach(() => {
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.FUNCTIONS_EMULATOR;
});

describe("getResendApiKey", () => {
  it("returns the api key when configured", () => {
    expect(getResendApiKey("re_test_key", "RESEND_API_KEY")).toBe("re_test_key");
  });

  it("returns null and logs when missing", () => {
    expect(getResendApiKey("", "RESEND_API_KEY")).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      "RESEND_API_KEY secret is not configured",
    );
  });
});

describe("getResendFromEmail", () => {
  it("returns the from address when configured", () => {
    expect(
      getResendFromEmail("Grids <hello@grids.so>", "RESEND_FROM_EMAIL"),
    ).toBe("Grids <hello@grids.so>");
  });

  it("returns null and logs when missing", () => {
    expect(getResendFromEmail("", "RESEND_FROM_EMAIL")).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      "RESEND_FROM_EMAIL secret is not configured",
    );
  });
});

describe("sendResendEmail", () => {
  const payload = {
    from: "Grids <hello@grids.so>",
    to: "person@example.com",
    subject: "Test",
    html: "<p>Hi</p>",
  };

  it("skips sending in the emulator", async () => {
    process.env.FUNCTIONS_EMULATOR = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendResendEmail({
      apiKey: "re_test",
      payload,
      successMessage: "sent",
      successContext: {},
      sendErrorContext: {},
    });

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "Skipping Resend email send in emulator environment",
      expect.objectContaining({
        to: "person@example.com",
        subject: "Test",
        hint: expect.stringContaining("email:preview"),
      }),
    );
  });

  it("posts to the Resend API when not in emulator", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => '{"id":"email-1"}',
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendResendEmail({
      apiKey: "re_test",
      payload,
      successMessage: "Resend ok",
      successContext: ({ status }) => ({ status }),
      sendErrorContext: {},
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer re_test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith("Resend ok", { status: 200 });
  });

  it("logs API errors without throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        text: async () => "invalid from",
      }),
    );

    const result = await sendResendEmail({
      apiKey: "re_test",
      payload,
      successMessage: "sent",
      successContext: {},
      responseErrorContext: { uid: "user-1" },
      sendErrorContext: {},
    });

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      "Resend API returned error status",
      expect.objectContaining({
        uid: "user-1",
        status: 422,
        responseBody: "invalid from",
      }),
    );
  });

  it("logs fetch failures without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await sendResendEmail({
      apiKey: "re_test",
      payload,
      successMessage: "sent",
      successContext: {},
      sendErrorContext: { uid: "user-1" },
    });

    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to send Resend email",
      expect.objectContaining({
        error: "Error: network down",
        uid: "user-1",
      }),
    );
  });
});
