/**
 * Tests for useTileInput — turns a user-entered link/embed string into a tile,
 * either adding a new tile or replacing an existing one, and enriches plain
 * links with server-fetched OG preview metadata.
 *
 * The grid store, CloudFunctions service, and TileUtils factories are mocked so
 * we control detection results and assert which content is applied where.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentType } from "@grids/contracts/types";
import { useTileInput } from "@/composables/useTileInput";
import {
  createTileContent,
  createTileContentFromEmbedUrl,
} from "@/utils/TileUtils";

const { mockGridStore, mockUseGridStore } = vi.hoisted(() => {
  const mockGridStore = {
    addTile: vi.fn(),
    setTileContent: vi.fn(),
    patchTileContent: vi.fn(),
  };
  return {
    mockGridStore,
    mockUseGridStore: vi.fn(() => mockGridStore),
  };
});
const { mockCallFunction } = vi.hoisted(() => ({ mockCallFunction: vi.fn() }));

vi.mock("@/stores/grid", () => ({ useGridStore: mockUseGridStore }));
vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getCloudFunctionsService: () => ({ callFunction: mockCallFunction }),
  }),
}));
vi.mock("@/utils/TileUtils", () => ({
  createTileContent: vi.fn(),
  createTileContentFromEmbedUrl: vi.fn(),
}));

const mockCreateTileContent = vi.mocked(createTileContent);
const mockCreateFromEmbed = vi.mocked(createTileContentFromEmbedUrl);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("setup", () => {
  it("does not resolve the live grid store until content is applied", async () => {
    const { submitLink } = useTileInput();

    expect(mockUseGridStore).not.toHaveBeenCalled();

    const result = await submitLink("   ", { mode: "add" });

    expect(result).toBeNull();
    expect(mockUseGridStore).not.toHaveBeenCalled();
  });
});

describe("submitLink — empty input", () => {
  it("returns null and does nothing for blank input", async () => {
    const { submitLink } = useTileInput();
    const result = await submitLink("   ", { mode: "add" });
    expect(result).toBeNull();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
  });
});

describe("submitLink — non-web links (mailto/tel)", () => {
  it("creates a LINK tile for a mailto: link without fetching a preview", async () => {
    const linkContent = { type: ContentType.LINK, link: "mailto:a@b.com" };
    mockCreateTileContent.mockReturnValue(linkContent as never);
    mockGridStore.addTile.mockReturnValue("tile-1");

    const { submitLink } = useTileInput();
    const result = await submitLink("mailto:a@b.com", { mode: "add" });

    expect(mockCreateTileContent).toHaveBeenCalledWith(ContentType.LINK, {
      link: "mailto:a@b.com",
    });
    expect(mockGridStore.addTile).toHaveBeenCalledWith(linkContent);
    expect(mockCreateFromEmbed).not.toHaveBeenCalled();
    expect(mockCallFunction).not.toHaveBeenCalled();
    expect(result).toBe("tile-1");
  });

  it("creates a LINK tile for a tel: link", async () => {
    const linkContent = { type: ContentType.LINK, link: "tel:+15551234" };
    mockCreateTileContent.mockReturnValue(linkContent as never);
    mockGridStore.addTile.mockReturnValue("tile-2");

    const { submitLink } = useTileInput();
    const result = await submitLink("tel:+15551234", { mode: "add" });

    expect(result).toBe("tile-2");
    expect(mockCallFunction).not.toHaveBeenCalled();
  });
});

describe("submitLink — auto-detected rich content", () => {
  it("applies a detected YouTube tile directly, skipping link preview", async () => {
    mockCreateFromEmbed.mockReturnValue({ type: ContentType.YOUTUBE } as never);
    mockGridStore.addTile.mockReturnValue("yt-1");

    const { submitLink } = useTileInput();
    const result = await submitLink(
      "https://youtube.com/watch?v=abc",
      { mode: "add" },
    );

    expect(mockGridStore.addTile).toHaveBeenCalledWith({
      type: ContentType.YOUTUBE,
    });
    expect(mockCallFunction).not.toHaveBeenCalled();
    expect(result).toBe("yt-1");
  });

  it("replaces an existing tile with detected image content", async () => {
    mockCreateFromEmbed.mockReturnValue({ type: ContentType.IMAGE } as never);

    const { submitLink } = useTileInput();
    const result = await submitLink("https://x/a.png", {
      mode: "replace",
      tileId: "tile-9",
    });

    expect(mockGridStore.setTileContent).toHaveBeenCalledWith("tile-9", {
      type: ContentType.IMAGE,
    });
    expect(result).toBe("tile-9");
  });
});

describe("submitLink — plain web links with preview enrichment", () => {
  beforeEach(() => {
    // First call (detection) returns a non-rich embed; the composable then
    // builds a LINK content via createTileContent.
    mockCreateFromEmbed.mockReturnValue({ type: ContentType.EMBED } as never);
    mockCreateTileContent.mockReturnValue({
      type: ContentType.LINK,
      link: "https://example.com",
    } as never);
  });

  it("adds a LINK tile and patches it with fetched OG metadata", async () => {
    mockGridStore.addTile.mockReturnValue("tile-5");
    mockCallFunction.mockResolvedValue({
      url: "https://example.com/",
      domain: "example.com",
      faviconUrl: "https://example.com/favicon.ico",
      title: "Example",
      description: "An example site",
      imageUrl: "https://example.com/og.png",
      siteName: "Example Inc",
    });

    const { submitLink } = useTileInput();
    const result = await submitLink("https://example.com", { mode: "add" });

    expect(mockCallFunction).toHaveBeenCalledWith("getLinkPreview", {
      url: "https://example.com",
    });
    expect(mockGridStore.patchTileContent).toHaveBeenCalledWith("tile-5", {
      link: "https://example.com/",
      domain: "example.com",
      faviconUrl: "https://example.com/favicon.ico",
      metaTitle: "Example",
      metaDescription: "An example site",
      metaImageUrl: "https://example.com/og.png",
      metaSiteName: "Example Inc",
    });
    expect(result).toBe("tile-5");
  });

  it("returns null without fetching when the tile could not be created", async () => {
    mockGridStore.addTile.mockReturnValue(null);

    const { submitLink } = useTileInput();
    const result = await submitLink("https://example.com", { mode: "add" });

    expect(result).toBeNull();
    expect(mockCallFunction).not.toHaveBeenCalled();
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
  });

  it("swallows a preview fetch error but still returns the tile id", async () => {
    mockGridStore.addTile.mockReturnValue("tile-6");
    mockCallFunction.mockRejectedValue(new Error("preview down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { submitLink } = useTileInput();
    const result = await submitLink("https://example.com", { mode: "add" });

    expect(result).toBe("tile-6");
    expect(mockGridStore.patchTileContent).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("falls back to the link's own favicon when the preview omits one", async () => {
    mockGridStore.addTile.mockReturnValue("tile-7");
    mockCreateTileContent.mockReturnValue({
      type: ContentType.LINK,
      link: "https://example.com",
      faviconUrl: "https://example.com/local.ico",
    } as never);
    mockCallFunction.mockResolvedValue({
      url: "https://example.com/",
      faviconUrl: undefined,
    });

    const { submitLink } = useTileInput();
    await submitLink("https://example.com", { mode: "add" });

    expect(mockGridStore.patchTileContent).toHaveBeenCalledWith(
      "tile-7",
      expect.objectContaining({
        faviconUrl: "https://example.com/local.ico",
      }),
    );
  });
});

describe("submitEmbed", () => {
  it("returns null for blank input", () => {
    const { submitEmbed } = useTileInput();
    expect(submitEmbed("  ", { mode: "add" })).toBeNull();
    expect(mockGridStore.addTile).not.toHaveBeenCalled();
  });

  it("adds a new tile from the detected embed content", () => {
    mockCreateFromEmbed.mockReturnValue({ type: ContentType.EMBED } as never);
    mockGridStore.addTile.mockReturnValue("embed-1");

    const { submitEmbed } = useTileInput();
    const result = submitEmbed("https://example.com/widget", { mode: "add" });

    expect(mockCreateFromEmbed).toHaveBeenCalledWith(
      "https://example.com/widget",
    );
    expect(mockGridStore.addTile).toHaveBeenCalledWith({
      type: ContentType.EMBED,
    });
    expect(result).toBe("embed-1");
  });

  it("replaces an existing tile from the detected embed content", () => {
    mockCreateFromEmbed.mockReturnValue({ type: ContentType.EMBED } as never);

    const { submitEmbed } = useTileInput();
    const result = submitEmbed("https://example.com/widget", {
      mode: "replace",
      tileId: "tile-3",
    });

    expect(mockGridStore.setTileContent).toHaveBeenCalledWith("tile-3", {
      type: ContentType.EMBED,
    });
    expect(result).toBe("tile-3");
  });
});
