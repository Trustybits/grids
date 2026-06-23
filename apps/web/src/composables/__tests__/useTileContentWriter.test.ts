/**
 * Tests for useTileContentWriter — the shared content-write helper used by
 * editor-backed tile content components. Verifies both writers route to the
 * matching controller command when a tileId is present, and fall back to
 * mutating the local content object directly when it is absent.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentType, type TextContent } from "@grids/contracts/types";
import { useTileContentWriter } from "@/composables/useTileContentWriter";

const { gridStore } = vi.hoisted(() => ({
  gridStore: {
    patchTileContent: vi.fn(),
    autosaveTileContent: vi.fn(),
  },
}));

vi.mock("@/stores/grid", () => ({ useGridStore: () => gridStore }));

function makeContent(): TextContent {
  return { type: ContentType.TEXT, text: "Hello" } as TextContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTileContentWriter", () => {
  it("routes patchContent through the discrete patch command for a real tile", () => {
    const content = makeContent();
    const { patchContent } = useTileContentWriter("tile-1", () => content);

    patchContent({ text: "Updated" });

    expect(gridStore.patchTileContent).toHaveBeenCalledWith("tile-1", {
      text: "Updated",
    });
    expect(gridStore.autosaveTileContent).not.toHaveBeenCalled();
    // The local content object is left untouched; the store owns persistence.
    expect(content.text).toBe("Hello");
  });

  it("routes autosaveContent through the autosave command for a real tile", () => {
    const content = makeContent();
    const { autosaveContent } = useTileContentWriter("tile-1", () => content);

    autosaveContent({ text: "Paused" });

    expect(gridStore.autosaveTileContent).toHaveBeenCalledWith("tile-1", {
      text: "Paused",
    });
    expect(gridStore.patchTileContent).not.toHaveBeenCalled();
    expect(content.text).toBe("Hello");
  });

  it("mutates the local content directly when no tileId is provided", () => {
    const content = makeContent();
    const { patchContent, autosaveContent } = useTileContentWriter(
      null,
      () => content,
    );

    patchContent({ text: "Local patch" });
    expect(content.text).toBe("Local patch");

    autosaveContent({ text: "Local autosave" });
    expect(content.text).toBe("Local autosave");

    expect(gridStore.patchTileContent).not.toHaveBeenCalled();
    expect(gridStore.autosaveTileContent).not.toHaveBeenCalled();
  });

  it("reads content lazily so the fallback targets the current content", () => {
    let content = makeContent();
    const { patchContent } = useTileContentWriter(null, () => content);

    // Simulate the component's content prop being replaced before a write.
    content = { type: ContentType.TEXT, text: "Replaced" } as TextContent;
    patchContent({ text: "After swap" });

    expect(content.text).toBe("After swap");
  });
});
