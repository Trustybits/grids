/**
 * Tests for the shared toolbar buttons:
 *   - tileToolbar/sharedCropButton.ts (CROP_BUTTON)
 *   - tileToolbar/sharedTileLinkButton.ts (TILE_LINK)
 *
 * CROP_BUTTON has the only timing-sensitive logic in the toolbar: when already
 * editing it sets an "exiting" flag, then after a 450ms delay toggles edit mode
 * off and syncs flags. Fake timers drive that path deterministically.
 *
 * TILE_LINK mirrors the text more-menu tile-link item: dynamic icon/title/
 * danger/action based on whether the content already has a tileLink.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ToolbarContext } from "@/types/TileToolbar";
import { CROP_BUTTON } from "@/registries/tileToolbar/sharedCropButton";
import { TILE_LINK } from "@/registries/tileToolbar/sharedTileLinkButton";

function makeCtx(
  child: Record<string, unknown> | null = {},
  content: Record<string, unknown> = {},
) {
  return {
    tile: { i: "tile-1", content },
    childComponent: { value: child },
    gridView: {},
    isEditing: { value: false },
    isExitingCropMode: { value: false },
  } as unknown as ToolbarContext;
}

describe("CROP_BUTTON", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("titles itself by what the press will do, not by what the button is", () => {
    const resolve = (editing: boolean) => {
      const ctx = makeCtx({});
      ctx.isEditing.value = editing;
      return typeof CROP_BUTTON.title === "function"
        ? CROP_BUTTON.title(ctx)
        : CROP_BUTTON.title;
    };

    expect(resolve(false)).toBe("Crop & zoom");
    // Without this the tooltip stayed "Crop & zoom" while already cropping,
    // leaving nothing to say how to get out.
    expect(resolve(true)).toBe("Finish cropping");
  });

  it("returns early when the child has no toggleEditMode", () => {
    const ctx = makeCtx({});
    expect(() => CROP_BUTTON.action(ctx)).not.toThrow();
    expect(ctx.isEditing.value).toBe(false);
  });

  it("returns early when the child component is null", () => {
    const ctx = makeCtx(null);
    expect(() => CROP_BUTTON.action(ctx)).not.toThrow();
  });

  it("enters crop mode immediately and syncs isEditing when not editing", () => {
    const toggleEditMode = vi.fn();
    const ctx = makeCtx({ toggleEditMode, isEditing: true });

    CROP_BUTTON.action(ctx);

    expect(toggleEditMode).toHaveBeenCalledOnce();
    expect(ctx.isEditing.value).toBe(true);
    expect(ctx.isExitingCropMode.value).toBe(false);
  });

  it("does not sync isEditing on enter when the child omits the flag", () => {
    const ctx = makeCtx({ toggleEditMode: vi.fn() });
    CROP_BUTTON.action(ctx);
    expect(ctx.isEditing.value).toBe(false);
  });

  it("delays exiting crop mode by 450ms, then toggles and syncs", () => {
    const toggleEditMode = vi.fn();
    const ctx = makeCtx({ toggleEditMode, isEditing: false });
    ctx.isEditing.value = true; // currently editing -> exit path

    CROP_BUTTON.action(ctx);

    // Immediately: marks exiting, does not toggle yet
    expect(ctx.isExitingCropMode.value).toBe(true);
    expect(toggleEditMode).not.toHaveBeenCalled();

    // Before the timeout elapses, still nothing
    vi.advanceTimersByTime(449);
    expect(toggleEditMode).not.toHaveBeenCalled();

    // At 450ms it fires
    vi.advanceTimersByTime(1);
    expect(toggleEditMode).toHaveBeenCalledOnce();
    expect(ctx.isEditing.value).toBe(false);
    expect(ctx.isExitingCropMode.value).toBe(false);
  });

  it("clears the exiting flag even when the child stops exposing toggleEditMode at fire time", () => {
    const child: Record<string, unknown> = { toggleEditMode: vi.fn() };
    const ctx = makeCtx(child);
    ctx.isEditing.value = true;

    CROP_BUTTON.action(ctx);
    // Simulate the child unmounting/changing before the timer fires.
    delete child.toggleEditMode;

    vi.advanceTimersByTime(450);
    expect(ctx.isExitingCropMode.value).toBe(false);
  });

  it("isActive reflects the toolbar isEditing flag", () => {
    const ctx = makeCtx();
    expect(CROP_BUTTON.isActive?.(ctx)).toBe(false);
    ctx.isEditing.value = true;
    expect(CROP_BUTTON.isActive?.(ctx)).toBe(true);
  });
});

describe("TILE_LINK", () => {
  const iconFn = TILE_LINK.icon as (ctx: ToolbarContext) => unknown;
  const titleFn = TILE_LINK.title as (ctx: ToolbarContext) => string;
  const dangerFn = TILE_LINK.danger as (ctx: ToolbarContext) => boolean;

  it("uses different icons for the linked and unlinked states", () => {
    const linked = iconFn(makeCtx({}, { tileLink: "https://x.com" }));
    const unlinked = iconFn(makeCtx({}, {}));
    expect(linked).not.toBe(unlinked);
  });

  it('title is "Add a link" when no tileLink is present', () => {
    expect(titleFn(makeCtx({}, {}))).toBe("Add a link");
  });

  it("title reports the URL to remove when a tileLink is present", () => {
    expect(titleFn(makeCtx({}, { tileLink: "https://grids.so" }))).toBe(
      "Remove link to https://grids.so",
    );
  });

  it("danger is true only when a tileLink is present", () => {
    expect(dangerFn(makeCtx({}, { tileLink: "https://x.com" }))).toBe(true);
    expect(dangerFn(makeCtx({}, {}))).toBe(false);
  });

  it("action opens the URL input when no link exists", () => {
    const openUrlInput = vi.fn();
    const clearLink = vi.fn();
    TILE_LINK.action(makeCtx({ openUrlInput, clearLink }, {}));
    expect(openUrlInput).toHaveBeenCalledOnce();
    expect(clearLink).not.toHaveBeenCalled();
  });

  it("action clears the link when one already exists", () => {
    const openUrlInput = vi.fn();
    const clearLink = vi.fn();
    TILE_LINK.action(
      makeCtx({ openUrlInput, clearLink }, { tileLink: "https://x.com" }),
    );
    expect(clearLink).toHaveBeenCalledOnce();
    expect(openUrlInput).not.toHaveBeenCalled();
  });

  it("is grouped under appearance", () => {
    expect(TILE_LINK.group).toBe("appearance");
  });
});
