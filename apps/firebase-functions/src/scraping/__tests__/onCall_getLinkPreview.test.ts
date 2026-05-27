import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { lookup } from "node:dns/promises";

const { dnsState } = vi.hoisted(() => ({
  dnsState: {
    addresses: [{ address: "93.184.216.34", family: 4 }],
    shouldReject: false,
  },
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock({ includeOnCall: true });
});

vi.mock("firebase-functions/logger", () => ({
  debug: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => {
    if (dnsState.shouldReject) {
      throw new Error("dns unavailable");
    }
    return dnsState.addresses;
  }),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

import { getLinkPreview as callable } from "../onCall_getLinkPreview.js";

const getLinkPreview = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as Error).message).toBe(message);
}

function htmlResponse(html: string, options: Partial<Response> = {}) {
  return {
    ok: true,
    status: 200,
    url: "https://example.com/final",
    headers: {
      get: (name: string) =>
        name.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null,
    },
    text: async () => html,
    ...options,
  };
}

beforeEach(() => {
  dnsState.addresses = [{ address: "93.184.216.34", family: 4 }];
  dnsState.shouldReject = false;
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(lookup).mockClear();
  vi.mocked(logger.debug).mockClear();
  vi.mocked(logger.warn).mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("getLinkPreview", () => {
  it("returns null without validating auth or resolving DNS when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getLinkPreview({ url: "example.com" }, {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("getLinkPreview");
    expect(lookup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires an authenticated caller", async () => {
    await expect(getLinkPreview({ url: "example.com" }, {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(
          error,
          "unauthenticated",
          "You must be signed in to fetch link previews.",
        );
        return true;
      },
    );
  });

  it.each([
    ["missing data", undefined],
    ["missing url", {}],
    ["empty url", { url: "" }],
    ["non-string url", { url: 123 }],
  ])("throws invalid-argument for %s", async (_label, data) => {
    await expect(
      getLinkPreview(data, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Missing url.");
      return true;
    });
  });

  it("rejects overlong URLs and malformed URLs", async () => {
    await expect(
      getLinkPreview({ url: "a".repeat(2049) }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "URL is too long.");
      return true;
    });

    await expect(
      getLinkPreview({ url: "https://%" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Invalid URL.");
      return true;
    });
  });

  it.each([
    ["localhost", "http://localhost"],
    ["localhost subdomain", "http://app.localhost"],
    ["local domain", "http://printer.local"],
    ["private IPv4", "http://192.168.1.10"],
    ["loopback IPv6", "http://[::1]"],
  ])("blocks private or local hostname: %s", async (_label, url) => {
    await expect(getLinkPreview({ url }, { auth: { uid: "user-1" } })).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "permission-denied", "This hostname is not allowed.");
        return true;
      },
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it("blocks public hostnames that resolve to private addresses", async () => {
    dnsState.addresses = [{ address: "10.0.0.5", family: 4 }];

    await expect(
      getLinkPreview({ url: "https://example.com" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "permission-denied",
        "This hostname resolves to a disallowed address.",
      );
      return true;
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "Blocked link preview request due to disallowed resolved address",
      { hostname: "example.com", disallowed: ["10.0.0.5"] },
    );
  });

  it("throws unavailable when DNS lookup fails", async () => {
    dnsState.shouldReject = true;

    await expect(
      getLinkPreview({ url: "https://example.com" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "unavailable", "Failed to resolve hostname.");
      return true;
    });
  });

  it("normalizes bare domains and fetches with crawler-compatible headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse("<title>Example</title>"));
    vi.stubGlobal("fetch", fetchMock);

    await getLinkPreview({ url: "example.com" }, { auth: { uid: "user-1" } });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/",
      expect.objectContaining({
        redirect: "follow",
        headers: expect.objectContaining({
          "user-agent": expect.stringContaining("facebookexternalhit"),
          accept: "text/html,application/xhtml+xml",
        }),
      }),
    );
  });

  it("returns a fallback preview for non-OK responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        url: "https://example.com/",
      }),
    );

    await expect(
      getLinkPreview({ url: "https://example.com" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      url: "https://example.com/",
      domain: "example.com",
      siteName: undefined,
      title: undefined,
      description: undefined,
      imageUrl: undefined,
      faviconUrl:
        "https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=https://example.com",
    });
  });

  it("returns a fallback preview for non-HTML responses using the final URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse("", {
          url: "https://cdn.example.com/file.pdf",
          headers: {
            get: () => "application/pdf",
          } as unknown as Headers,
        }),
      ),
    );

    await expect(
      getLinkPreview({ url: "https://example.com/file" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      url: "https://cdn.example.com/file.pdf",
      domain: "cdn.example.com",
      siteName: undefined,
      title: undefined,
      description: undefined,
      imageUrl: undefined,
      faviconUrl:
        "https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=https://cdn.example.com",
    });
  });

  it("extracts and resolves HTML metadata with Open Graph precedence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(`
          <html>
            <head>
              <title>Document Title</title>
              <meta name="twitter:title" content="Twitter Title">
              <meta property="og:title" content="OG Title">
              <meta name="description" content="Meta desc">
              <meta property="og:description" content="OG desc">
              <meta property="og:image" content="/image.png">
              <meta property="og:site_name" content=" Example Site ">
            </head>
          </html>
        `),
      ),
    );

    await expect(
      getLinkPreview({ url: "https://example.com/page" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      url: "https://example.com/final",
      domain: "example.com",
      siteName: "Example Site",
      title: "OG Title",
      description: "OG desc",
      imageUrl: "https://example.com/image.png",
      faviconUrl:
        "https://s2.googleusercontent.com/s2/favicons?sz=64&domain_url=https://example.com",
    });
  });

  it("maps AbortError to deadline-exceeded and other fetch failures to internal", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(abortError));

    await expect(
      getLinkPreview({ url: "https://example.com" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "deadline-exceeded", "Timed out fetching URL.");
      return true;
    });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network down")));
    await expect(
      getLinkPreview({ url: "https://example.com" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "internal", "Failed to fetch link preview.");
      return true;
    });
  });
});
