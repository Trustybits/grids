// Unit tests for StubbedCloudFunctionsDao — callFunction routes by function name
// to canned responses; getLinkPreview derives metadata from a parsed URL and
// degrades gracefully on invalid input.
import { describe, it, expect, beforeEach } from "vitest";
import { StubbedCloudFunctionsDao } from "../StubbedCloudFunctionsDao";

let dao: StubbedCloudFunctionsDao;

beforeEach(() => {
  dao = new StubbedCloudFunctionsDao();
});

describe("StubbedCloudFunctionsDao.callFunction", () => {
  it("returns derived metadata for getLinkPreview with a valid URL", async () => {
    const result = await dao.callFunction<{ url: string }, Record<string, unknown>>(
      "getLinkPreview",
      { url: "https://www.example.com/path" },
    );

    expect(result).toEqual({
      url: "https://www.example.com/path",
      domain: "example.com",
      faviconUrl: "https://www.example.com/favicon.ico",
      title: "www.example.com",
      description: "Preview metadata is stubbed in local memory mode.",
      siteName: "example.com",
    });
  });

  it("returns only the raw url for getLinkPreview with an invalid URL", async () => {
    const result = await dao.callFunction("getLinkPreview", {
      url: "not a url",
    });
    expect(result).toEqual({ url: "not a url" });
  });

  it("treats a missing url field as an empty string", async () => {
    const result = await dao.callFunction("getLinkPreview", {});
    expect(result).toEqual({ url: "" });
  });

  it("returns { skipped: true } for ensureDocumentItemThumbnail", async () => {
    expect(
      await dao.callFunction("ensureDocumentItemThumbnail", {}),
    ).toEqual({ skipped: true });
  });

  it("returns a dashboard portal link for the Stripe portal function", async () => {
    const result = (await dao.callFunction(
      "ext-firestore-stripe-payments-createPortalLink",
      {},
    )) as { url: string };
    expect(result.url).toBe(`${window.location.origin}/dashboard`);
  });

  it("returns { success: true } for notionOAuthExchange", async () => {
    expect(await dao.callFunction("notionOAuthExchange", {})).toEqual({
      success: true,
    });
  });

  it("returns an empty object for metadata functions", async () => {
    expect(await dao.callFunction("getYouTubeMetadata", {})).toEqual({});
    expect(await dao.callFunction("getMusicTrackMetadata", {})).toEqual({});
  });

  it("returns an empty object for unknown functions", async () => {
    expect(await dao.callFunction("somethingElse", {})).toEqual({});
  });

  it("strips a www prefix from the domain and siteName", async () => {
    const result = (await dao.callFunction("getLinkPreview", {
      url: "https://www.sub.example.co.uk/",
    })) as Record<string, unknown>;
    expect(result.domain).toBe("sub.example.co.uk");
    expect(result.siteName).toBe("sub.example.co.uk");
    expect(result.title).toBe("www.sub.example.co.uk");
  });
});
