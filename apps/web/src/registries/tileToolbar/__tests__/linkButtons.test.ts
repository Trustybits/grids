/**
 * Tests for tileToolbar/linkButtons.ts
 *
 * Covers:
 *  - LINK_BG_TOGGLE: dynamic title + isActive driven by
 *    content.linkBackgroundEnabled (tri-state: undefined/true => on), action
 *    delegates to gridStore.toggleLinkBackground
 *  - LINK_MORE_MENU menu items:
 *      upload-image -> child.openCustomImagePicker
 *      use-url      -> gridStore.setPanelActive(tile.i, "imageUrl")
 *      remove-image -> child.removeImage, danger flag, and `visible`
 *        predicate based on customImageUrl / metaImageUrl
 */

import { describe, it, expect, vi } from "vitest";
import type { ToolbarContext } from "@/types/TileToolbar";
import {
  LINK_BG_TOGGLE,
  LINK_MORE_MENU,
} from "@/registries/tileToolbar/linkButtons";

function makeCtx(
  content: Record<string, unknown> = {},
  child: Record<string, unknown> | null = {},
) {
  const gridStore = {
    toggleLinkBackground: vi.fn(),
    setPanelActive: vi.fn(),
  };
  const ctx = {
    tile: { i: "link-1", content },
    childComponent: { value: child },
    gridStore,
    isEditing: { value: false },
    isExitingCropMode: { value: false },
  } as unknown as ToolbarContext;
  return { ctx, gridStore };
}

describe("LINK_BG_TOGGLE", () => {
  const titleFn = LINK_BG_TOGGLE.title as (ctx: ToolbarContext) => string;
  const isActiveFn = LINK_BG_TOGGLE.isActive as (
    ctx: ToolbarContext,
  ) => boolean;

  it('title is "Hide background image" when enabled (true)', () => {
    expect(titleFn(makeCtx({ linkBackgroundEnabled: true }).ctx)).toBe(
      "Hide background image",
    );
  });

  it('title is "Hide background image" when the flag is undefined (default on)', () => {
    expect(titleFn(makeCtx({}).ctx)).toBe("Hide background image");
  });

  it('title is "Show background image" only when explicitly disabled', () => {
    expect(titleFn(makeCtx({ linkBackgroundEnabled: false }).ctx)).toBe(
      "Show background image",
    );
  });

  it("action toggles the link background via the grid store", () => {
    const { ctx, gridStore } = makeCtx({});
    LINK_BG_TOGGLE.action(ctx);
    expect(gridStore.toggleLinkBackground).toHaveBeenCalledWith("link-1");
  });

  it("isActive is true unless the flag is explicitly false", () => {
    expect(isActiveFn(makeCtx({}).ctx)).toBe(true);
    expect(isActiveFn(makeCtx({ linkBackgroundEnabled: true }).ctx)).toBe(true);
    expect(isActiveFn(makeCtx({ linkBackgroundEnabled: false }).ctx)).toBe(
      false,
    );
  });
});

describe("LINK_MORE_MENU", () => {
  const items = LINK_MORE_MENU.menuItems ?? [];
  const byId = (id: string) => items.find((i) => i.id === id)!;

  it("declares the three expected menu items", () => {
    expect(items.map((i) => i.id)).toEqual([
      "upload-image",
      "use-url",
      "remove-image",
    ]);
  });

  it("the top-level action is a no-op (menu is rendered via menuItems)", () => {
    const { ctx } = makeCtx();
    expect(() => LINK_MORE_MENU.action(ctx)).not.toThrow();
  });

  it("upload-image opens the custom image picker on the child", () => {
    const openCustomImagePicker = vi.fn();
    const { ctx } = makeCtx({}, { openCustomImagePicker });
    byId("upload-image").action(ctx);
    expect(openCustomImagePicker).toHaveBeenCalledOnce();
  });

  it("upload-image is safe when the child does not expose the method", () => {
    const { ctx } = makeCtx({}, {});
    expect(() => byId("upload-image").action(ctx)).not.toThrow();
  });

  it("use-url activates the imageUrl panel for the tile", () => {
    const { ctx, gridStore } = makeCtx();
    byId("use-url").action(ctx);
    expect(gridStore.setPanelActive).toHaveBeenCalledWith("link-1", "imageUrl");
  });

  it("remove-image is flagged as a danger action", () => {
    expect(byId("remove-image").danger).toBe(true);
  });

  it("remove-image calls removeImage on the child", () => {
    const removeImage = vi.fn();
    const { ctx } = makeCtx({}, { removeImage });
    byId("remove-image").action(ctx);
    expect(removeImage).toHaveBeenCalledOnce();
  });

  it("remove-image is visible when a custom image URL exists", () => {
    const ctx = makeCtx({ customImageUrl: "https://x.com/a.png" }).ctx;
    expect(byId("remove-image").visible?.(ctx)).toBe(true);
  });

  it("remove-image is visible when a meta image URL exists", () => {
    const ctx = makeCtx({ metaImageUrl: "https://x.com/og.png" }).ctx;
    expect(byId("remove-image").visible?.(ctx)).toBe(true);
  });

  it("remove-image is hidden when neither image URL is present", () => {
    expect(byId("remove-image").visible?.(makeCtx({}).ctx)).toBe(false);
  });
});
