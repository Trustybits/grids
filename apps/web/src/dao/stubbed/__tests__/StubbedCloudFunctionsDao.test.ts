// Unit tests for StubbedCloudFunctionsDao — callFunction routes by function name
// to canned responses; getLinkPreview derives metadata from a parsed URL and
// degrades gracefully on invalid input.
import { describe, it, expect, beforeEach } from "vitest";
import { StubbedCloudFunctionsDao } from "../StubbedCloudFunctionsDao";
import { memoryDatabase } from "../StubbedMemoryDatabase";
import { resetMemoryDatabase } from "./memoryTestUtils";

let dao: StubbedCloudFunctionsDao;

beforeEach(() => {
  resetMemoryDatabase();
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

  it("creates and accepts a local grid transfer", async () => {
    memoryDatabase.grids.set("grid-1", {
      id: "grid-1",
      userId: "sender",
      rev: 3,
      name: "Transfer Me",
      colNum: 12,
      verticalCompact: true,
      backgroundImageSrc: "",
      backgroundColor: "",
      backgroundEmbed: false,
      ogImageSrc: "",
      tiles: [],
      duplicatable: false,
      createdAt: null,
      updatedAt: null,
      lastOpenedAt: null,
    });
    memoryDatabase.slugs.set("recipient", { userId: "recipient-uid" });

    const created = await dao.callFunction("createGridTransfer", {
      gridId: "grid-1",
      recipient: { slug: "recipient" },
      removeOrphanedFiles: true,
    });
    const transferId = (created as { transferId: string }).transferId;

    expect(memoryDatabase.gridTransfers.get(transferId)).toMatchObject({
      gridId: "grid-1",
      gridName: "Transfer Me",
      fromUserId: "sender",
      toUserId: "recipient-uid",
      removeOrphanedFiles: true,
      status: "pending",
    });

    await expect(
      dao.callFunction("acceptGridTransfer", { transferId }),
    ).resolves.toMatchObject({
      transferId,
      gridId: "grid-1",
      status: "accepted",
    });
    expect(memoryDatabase.gridTransfers.get(transferId)?.status).toBe(
      "accepted",
    );
    expect(memoryDatabase.grids.get("grid-1")).toMatchObject({
      userId: "recipient-uid",
      rev: 4,
    });
  });

  it("declines and cancels local grid transfers", async () => {
    memoryDatabase.gridTransfers.set("transfer-1", {
      id: "transfer-1",
      gridId: "grid-1",
      gridName: "Grid",
      fromUserId: "sender",
      toUserId: "recipient",
      removeOrphanedFiles: false,
      status: "pending",
      expiresAt: null,
    });
    memoryDatabase.gridTransfers.set("transfer-2", {
      ...memoryDatabase.gridTransfers.get("transfer-1")!,
      id: "transfer-2",
    });

    await expect(
      dao.callFunction("declineGridTransfer", { transferId: "transfer-1" }),
    ).resolves.toEqual({ transferId: "transfer-1", status: "declined" });
    await expect(
      dao.callFunction("cancelGridTransfer", { transferId: "transfer-2" }),
    ).resolves.toEqual({ transferId: "transfer-2", status: "cancelled" });
  });
});
