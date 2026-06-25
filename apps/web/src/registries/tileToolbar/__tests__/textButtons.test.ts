/**
 * Tests for tileToolbar/textButtons.ts
 *
 * Covers:
 *  - TEXT_ALIGN_BUTTON: panel metadata + no-op action
 *  - TEXT_MORE_MENU menu items:
 *      bold-toggle / italic-toggle: isActive from child flags, action delegates
 *      tile-link: dynamic icon, tooltip, danger, and action that branch on
 *        whether the tile content already has a tileLink
 */

import { describe, it, expect, vi } from "vitest";
import type { ToolbarContext } from "@/types/TileToolbar";
import {
  TEXT_ALIGN_BUTTON,
  TEXT_MORE_MENU,
} from "@/registries/tileToolbar/textButtons";

function makeCtx(
  content: Record<string, unknown> = {},
  child: Record<string, unknown> | null = {},
) {
  return {
    tile: { i: "text-1", content },
    childComponent: { value: child },
    gridView: {},
    isEditing: { value: false },
    isExitingCropMode: { value: false },
  } as unknown as ToolbarContext;
}

const items = TEXT_MORE_MENU.menuItems ?? [];
const byId = (id: string) => items.find((i) => i.id === id)!;

describe("TEXT_ALIGN_BUTTON", () => {
  it("opens the textAlign panel and has a no-op action", () => {
    expect(TEXT_ALIGN_BUTTON.panelId).toBe("textAlign");
    expect(() => TEXT_ALIGN_BUTTON.action(makeCtx())).not.toThrow();
  });
});

describe("TEXT_MORE_MENU structure", () => {
  it("lays out menu items horizontally", () => {
    expect(TEXT_MORE_MENU.menuItemsLayoutDirection).toBe("horizontal");
  });

  it("declares the expected menu items", () => {
    expect(items.map((i) => i.id)).toEqual([
      "font-family",
      "font-size",
      "bold-toggle",
      "italic-toggle",
      "tile-link",
    ]);
  });
});

describe("TEXT_MORE_MENU bold-toggle", () => {
  it("isActive reflects the child's isBoldActive flag", () => {
    expect(byId("bold-toggle").isActive?.(makeCtx({}, { isBoldActive: true }))).toBe(
      true,
    );
    expect(byId("bold-toggle").isActive?.(makeCtx({}, {}))).toBe(false);
  });

  it("action calls toggleBold on the child", () => {
    const toggleBold = vi.fn();
    byId("bold-toggle").action(makeCtx({}, { toggleBold }));
    expect(toggleBold).toHaveBeenCalledOnce();
  });

  it("action is safe when the child omits toggleBold", () => {
    expect(() => byId("bold-toggle").action(makeCtx({}, {}))).not.toThrow();
  });
});

describe("TEXT_MORE_MENU italic-toggle", () => {
  it("isActive reflects the child's isItalicActive flag", () => {
    expect(
      byId("italic-toggle").isActive?.(makeCtx({}, { isItalicActive: true })),
    ).toBe(true);
    expect(byId("italic-toggle").isActive?.(makeCtx({}, {}))).toBe(false);
  });

  it("action calls toggleItalic on the child", () => {
    const toggleItalic = vi.fn();
    byId("italic-toggle").action(makeCtx({}, { toggleItalic }));
    expect(toggleItalic).toHaveBeenCalledOnce();
  });
});

describe("TEXT_MORE_MENU tile-link", () => {
  const tileLink = byId("tile-link");
  const iconFn = tileLink.icon as (ctx: ToolbarContext) => unknown;
  const tooltipFn = tileLink.tooltip as (ctx: ToolbarContext) => string;
  const dangerFn = tileLink.danger as (ctx: ToolbarContext) => boolean;

  it("uses distinct icons for the link-present and link-absent states", () => {
    const withLink = iconFn(makeCtx({ tileLink: "https://x.com" }));
    const withoutLink = iconFn(makeCtx({}));
    expect(withLink).toBeDefined();
    expect(withoutLink).toBeDefined();
    expect(withLink).not.toBe(withoutLink);
  });

  it('tooltip is "Add a Link" when no tileLink is set', () => {
    expect(tooltipFn(makeCtx({}))).toBe("Add a Link");
  });

  it("tooltip reports the URL to remove when a tileLink is set", () => {
    expect(tooltipFn(makeCtx({ tileLink: "https://grids.so" }))).toBe(
      "Remove link to https://grids.so",
    );
  });

  it("danger is true only when a tileLink is present", () => {
    expect(dangerFn(makeCtx({ tileLink: "https://x.com" }))).toBe(true);
    expect(dangerFn(makeCtx({}))).toBe(false);
  });

  it("action opens the URL input when no link exists", () => {
    const openUrlInput = vi.fn();
    const clearLink = vi.fn();
    tileLink.action(makeCtx({}, { openUrlInput, clearLink }));
    expect(openUrlInput).toHaveBeenCalledOnce();
    expect(clearLink).not.toHaveBeenCalled();
  });

  it("action clears the link when one already exists", () => {
    const openUrlInput = vi.fn();
    const clearLink = vi.fn();
    tileLink.action(
      makeCtx({ tileLink: "https://x.com" }, { openUrlInput, clearLink }),
    );
    expect(clearLink).toHaveBeenCalledOnce();
    expect(openUrlInput).not.toHaveBeenCalled();
  });

  it("treats an empty-string tileLink as no link", () => {
    expect(dangerFn(makeCtx({ tileLink: "" }))).toBe(false);
    expect(tooltipFn(makeCtx({ tileLink: "" }))).toBe("Add a Link");
  });
});
