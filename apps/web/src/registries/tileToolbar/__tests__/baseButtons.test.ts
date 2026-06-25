/**
 * Tests for tileToolbar/baseButtons.ts
 *
 * Covers the resize-button factory output and the appearance buttons:
 *  - RESIZE_* presets: metadata, action (resizeTile + onResize), isActive
 *  - RESIZE_PRESETS membership/order
 *  - BORDER_TOGGLE: dynamic title, action, isActive (borderEnabled tri-state)
 *  - COLOR_BUTTON: metadata + no-op action
 *
 * ToolbarContext is built as a plain stub — the buttons only read `.tile`,
 * `.gridView`, and `.childComponent.value`, so no real Pinia store or Vue
 * ref is needed.
 */

import { describe, it, expect, vi } from "vitest";
import type { ToolbarContext } from "@/types/TileToolbar";
import {
  RESIZE_1x1,
  RESIZE_2x2,
  RESIZE_2x3,
  RESIZE_2x4,
  RESIZE_3x1,
  RESIZE_3x2,
  RESIZE_4x2,
  RESIZE_4x4,
  RESIZE_5x1,
  RESIZE_8x1,
  RESIZE_PRESETS,
  BORDER_TOGGLE,
  COLOR_BUTTON,
} from "@/registries/tileToolbar/baseButtons";

interface CtxOptions {
  tile?: Record<string, unknown>;
  child?: Record<string, unknown> | null;
}

function makeCtx(opts: CtxOptions = {}) {
  const gridView = {
    resizeTile: vi.fn(),
    toggleTileBorder: vi.fn(),
    toggleLinkBackground: vi.fn(),
    setPanelActive: vi.fn(),
  };
  const ctx = {
    tile: { i: "tile-1", w: 1, h: 1, ...opts.tile },
    childComponent: { value: opts.child === undefined ? {} : opts.child },
    gridView,
    isEditing: { value: false },
    isExitingCropMode: { value: false },
  } as unknown as ToolbarContext;
  return { ctx, gridView };
}

describe("resize button factory (RESIZE_* presets)", () => {
  it("exposes the expected metadata for RESIZE_2x2", () => {
    expect(RESIZE_2x2.id).toBe("resize-2x2");
    expect(RESIZE_2x2.group).toBe("resize");
    expect(RESIZE_2x2.title).toBe("Resize to 2x2");
    expect(RESIZE_2x2.icon).toBeDefined();
  });

  it("action resizes the tile to the button's dimensions and triggers onResize", () => {
    const onResize = vi.fn();
    const { ctx, gridView } = makeCtx({
      tile: { i: "t9", w: 1, h: 1 },
      child: { onResize },
    });

    RESIZE_4x4.action(ctx);

    expect(gridView.resizeTile).toHaveBeenCalledWith("t9", 4, 4);
    expect(onResize).toHaveBeenCalledOnce();
  });

  it("action still resizes when the child component is null (no onResize)", () => {
    const { ctx, gridView } = makeCtx({ tile: { i: "t" }, child: null });

    expect(() => RESIZE_3x1.action(ctx)).not.toThrow();
    expect(gridView.resizeTile).toHaveBeenCalledWith("t", 3, 1);
  });

  it("action does not throw when the child component lacks onResize", () => {
    const { ctx, gridView } = makeCtx({ child: {} });

    expect(() => RESIZE_1x1.action(ctx)).not.toThrow();
    expect(gridView.resizeTile).toHaveBeenCalledWith("tile-1", 1, 1);
  });

  it("isActive is true only when the tile dimensions match the button", () => {
    const { ctx: match } = makeCtx({ tile: { w: 4, h: 4 } });
    const { ctx: noMatch } = makeCtx({ tile: { w: 4, h: 2 } });

    expect(RESIZE_4x4.isActive?.(match)).toBe(true);
    expect(RESIZE_4x4.isActive?.(noMatch)).toBe(false);
  });

  it("isActive distinguishes width from height (non-square)", () => {
    const { ctx: match } = makeCtx({ tile: { w: 5, h: 1 } });
    const { ctx: swapped } = makeCtx({ tile: { w: 1, h: 5 } });

    expect(RESIZE_5x1.isActive?.(match)).toBe(true);
    expect(RESIZE_5x1.isActive?.(swapped)).toBe(false);
  });

  // The remaining exported presets are used by real tile toolbars
  // (music.ts, chat.ts, map.ts). Pin each one's id and the dimensions its
  // action/isActive operate on, derived through the same shared factory.
  it.each([
    [RESIZE_1x1, "resize-1x1", 1, 1],
    [RESIZE_2x2, "resize-2x2", 2, 2],
    [RESIZE_2x3, "resize-2x3", 2, 3],
    [RESIZE_2x4, "resize-2x4", 2, 4],
    [RESIZE_3x1, "resize-3x1", 3, 1],
    [RESIZE_3x2, "resize-3x2", 3, 2],
    [RESIZE_4x2, "resize-4x2", 4, 2],
    [RESIZE_4x4, "resize-4x4", 4, 4],
    [RESIZE_5x1, "resize-5x1", 5, 1],
    [RESIZE_8x1, "resize-8x1", 8, 1],
  ])("%# preset %s resizes to %ix%i and matches those dimensions", (
    btn,
    id,
    w,
    h,
  ) => {
    expect(btn.id).toBe(id);
    expect(btn.group).toBe("resize");

    const { ctx, gridView } = makeCtx({ tile: { i: "t", w: 0, h: 0 } });
    btn.action(ctx);
    expect(gridView.resizeTile).toHaveBeenCalledWith("t", w, h);

    expect(btn.isActive?.(makeCtx({ tile: { w, h } }).ctx)).toBe(true);
    expect(btn.isActive?.(makeCtx({ tile: { w: w + 1, h } }).ctx)).toBe(false);
  });
});

describe("RESIZE_PRESETS", () => {
  it("contains the four default presets in order", () => {
    expect(RESIZE_PRESETS).toEqual([
      RESIZE_1x1,
      RESIZE_3x1,
      RESIZE_4x4,
      RESIZE_2x2,
    ]);
  });
});

describe("BORDER_TOGGLE", () => {
  const titleFn = BORDER_TOGGLE.title as (ctx: ToolbarContext) => string;
  const isActiveFn = BORDER_TOGGLE.isActive as (ctx: ToolbarContext) => boolean;

  it('title reads "Hide border" when border is enabled (true)', () => {
    const { ctx } = makeCtx({ tile: { borderEnabled: true } });
    expect(titleFn(ctx)).toBe("Hide border");
  });

  it('title reads "Hide border" when borderEnabled is undefined (default on)', () => {
    const { ctx } = makeCtx({ tile: {} });
    expect(titleFn(ctx)).toBe("Hide border");
  });

  it('title reads "Show border" only when border is explicitly disabled', () => {
    const { ctx } = makeCtx({ tile: { borderEnabled: false } });
    expect(titleFn(ctx)).toBe("Show border");
  });

  it("action toggles the tile border via the grid view", () => {
    const { ctx, gridView } = makeCtx({ tile: { i: "border-tile" } });
    BORDER_TOGGLE.action(ctx);
    expect(gridView.toggleTileBorder).toHaveBeenCalledWith("border-tile");
  });

  it("isActive mirrors the enabled state (undefined and true => active)", () => {
    expect(isActiveFn(makeCtx({ tile: {} }).ctx)).toBe(true);
    expect(isActiveFn(makeCtx({ tile: { borderEnabled: true } }).ctx)).toBe(
      true,
    );
    expect(isActiveFn(makeCtx({ tile: { borderEnabled: false } }).ctx)).toBe(
      false,
    );
  });

  it("has appearance group and a border css class", () => {
    expect(BORDER_TOGGLE.group).toBe("appearance");
    expect(BORDER_TOGGLE.cssClass).toBe("toolbar-btn--border");
  });
});

describe("COLOR_BUTTON", () => {
  it("has a colorSelect panel and appearance group", () => {
    expect(COLOR_BUTTON.panelId).toBe("colorSelect");
    expect(COLOR_BUTTON.group).toBe("appearance");
    expect(COLOR_BUTTON.title).toBe("Tile color");
  });

  it("has a no-op action that does not touch the grid view", () => {
    const { ctx, gridView } = makeCtx();
    expect(() => COLOR_BUTTON.action(ctx)).not.toThrow();
    expect(gridView.resizeTile).not.toHaveBeenCalled();
    expect(gridView.toggleTileBorder).not.toHaveBeenCalled();
  });
});
