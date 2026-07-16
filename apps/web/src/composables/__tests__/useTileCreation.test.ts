import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentType } from "@grids/contracts/types";

const holder = vi.hoisted(() => ({
  addTile: vi.fn<(content: unknown) => string | null>(() => "tile-1"),
  setPendingFocusTileId: vi.fn(),
  submitLink: vi.fn(async () => "link-1"),
  submitEmbed: vi.fn(() => "embed-1"),
  flags: {} as Record<string, boolean>,
  isValidLink: vi.fn(() => false),
  isValidEmbed: vi.fn(() => false),
}));

vi.mock("@/controllers/useGridController", () => ({
  useGridController: () => ({ addTile: holder.addTile }),
}));

vi.mock("@/stores/grid/gridUi", () => ({
  useGridUiStore: () => ({ setPendingFocusTileId: holder.setPendingFocusTileId }),
}));

vi.mock("@/composables/useTileInput", () => ({
  useTileInput: () => ({
    submitLink: holder.submitLink,
    submitEmbed: holder.submitEmbed,
  }),
}));

vi.mock("@/composables/useFeatureFlags", () => ({
  FEATURE_FLAGS: {
    EDITOR_SMART_TEXT: "editor-smart-text",
    BETA_DOCUMENTS: "beta-documents",
  },
  useFeatureFlags: () => ({
    isEnabled: (flag: string) => holder.flags[flag] ?? false,
  }),
}));

vi.mock("@/utils/TileUtils", () => ({
  createTileContent: (type: ContentType) => ({ type }),
}));

vi.mock("@/utils/UrlValidation", () => ({
  isValidLink: holder.isValidLink,
  isValidEmbed: holder.isValidEmbed,
}));

const load = async () => {
  const { useTileCreation } = await import("../useTileCreation");
  return useTileCreation();
};

describe("useTileCreation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    holder.flags = {};
    holder.isValidLink.mockReturnValue(false);
    holder.isValidEmbed.mockReturnValue(false);
    holder.addTile.mockReturnValue("tile-1");
  });

  it("hides flag-gated tile types until their flag is enabled", async () => {
    const disabled = await load();
    const disabledIds = disabled.tileTypes.value.map((t) => t.id);
    expect(disabledIds).not.toContain("smart_text");
    expect(disabledIds).not.toContain("document");

    // A fresh instance re-reads the (now enabled) flags.
    holder.flags = { "editor-smart-text": true, "beta-documents": true };
    const enabled = await load();
    const enabledIds = enabled.tileTypes.value.map((t) => t.id);
    expect(enabledIds).toContain("smart_text");
    expect(enabledIds).toContain("document");
  });

  it("auto-focuses newly created text tiles but not other types", async () => {
    const { createTile } = await load();

    createTile(ContentType.TEXT);
    expect(holder.addTile).toHaveBeenCalledTimes(1);
    expect(holder.setPendingFocusTileId).toHaveBeenCalledWith("tile-1");

    holder.setPendingFocusTileId.mockClear();
    createTile(ContentType.PROFILE);
    expect(holder.setPendingFocusTileId).not.toHaveBeenCalled();
  });

  it("routes a pasted URL to the smart-paste link handler", async () => {
    holder.isValidLink.mockReturnValue(true);
    const { submitCommand } = await load();

    const result = await submitCommand("  https://example.com  ");
    expect(holder.submitLink).toHaveBeenCalledWith("https://example.com", {
      mode: "add",
    });
    expect(result).toBe("link-1");
  });

  it("creates a matching tile type from a keyword", async () => {
    const { submitCommand } = await load();
    const result = await submitCommand("chat");
    expect(holder.addTile).toHaveBeenCalledTimes(1);
    expect(result).toBe("tile-1");
  });

  it("returns null when the text only filters (no URL, no match)", async () => {
    const { submitCommand } = await load();
    const result = await submitCommand("zzzzzz");
    expect(result).toBeNull();
    expect(holder.addTile).not.toHaveBeenCalled();
  });

  it("pins the map type: forcedType=map builds a MAP tile from any text", async () => {
    const { submitCommand } = await load();
    const result = await submitCommand("Paris", "map");
    // No URL validation needed — a location string always builds a map.
    expect(holder.isValidLink).not.toHaveBeenCalled();
    expect(holder.addTile).toHaveBeenCalledTimes(1);
    expect(result).toBe("tile-1");
  });

  it("pins the map type: empty input still creates (current location)", async () => {
    const { submitCommand } = await load();
    const result = await submitCommand("   ", "map");
    expect(holder.addTile).toHaveBeenCalledTimes(1);
    expect(result).toBe("tile-1");
  });

  it("pins the link type: forcedType=link routes to submitLink", async () => {
    const { submitCommand } = await load();
    const result = await submitCommand("example.com", "link");
    expect(holder.submitLink).toHaveBeenCalledWith("example.com", {
      mode: "add",
    });
    expect(result).toBe("link-1");
  });

  it("pins the embed type: forcedType=embed routes to submitEmbed", async () => {
    const { submitCommand } = await load();
    const result = await submitCommand("https://youtu.be/x", "embed");
    expect(holder.submitEmbed).toHaveBeenCalledWith("https://youtu.be/x", {
      mode: "add",
    });
    expect(result).toBe("embed-1");
  });

  it("pinned link/embed with empty input creates nothing", async () => {
    const { submitCommand } = await load();
    expect(await submitCommand("  ", "link")).toBeNull();
    expect(await submitCommand("  ", "embed")).toBeNull();
    expect(holder.submitLink).not.toHaveBeenCalled();
    expect(holder.submitEmbed).not.toHaveBeenCalled();
  });

  it("recognizes an inline '<type> <content>' prefix (e.g. 'map japan')", async () => {
    const { submitCommand } = await load();
    const result = await submitCommand("map japan");
    // Routed to a MAP tile without any URL validation on the content.
    expect(holder.isValidLink).not.toHaveBeenCalled();
    expect(holder.addTile).toHaveBeenCalledTimes(1);
    expect(result).toBe("tile-1");
  });

  it("routes 'link <url>' and 'embed <url>' prefixes to the right handler", async () => {
    const { submitCommand } = await load();
    await submitCommand("link example.com");
    expect(holder.submitLink).toHaveBeenCalledWith("example.com", {
      mode: "add",
    });
    await submitCommand("embed https://youtu.be/x");
    expect(holder.submitEmbed).toHaveBeenCalledWith("https://youtu.be/x", {
      mode: "add",
    });
  });

  it("matchCommandPrefix parses the type and content, or returns null", async () => {
    const { matchCommandPrefix } = await load();
    expect(matchCommandPrefix("map japan")).toEqual({
      type: "map",
      rest: "japan",
    });
    // A trailing space alone pins the type with empty content.
    expect(matchCommandPrefix("map ")).toEqual({ type: "map", rest: "" });
    // No space, or a non-command first word → no prefix.
    expect(matchCommandPrefix("map")).toBeNull();
    expect(matchCommandPrefix("chat hello")).toBeNull();
  });
});
