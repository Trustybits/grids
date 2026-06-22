/**
 * Tests for tileToolbar/index.ts — getTileToolbarButtons()
 *
 * The function looks up a tile definition via getTileDefinition() and decides
 * which toolbar to return:
 *   - array toolbar  -> the array as-is
 *   - function toolbar + context -> the function's result (computed from ctx)
 *   - function toolbar, NO context -> DEFAULT_BUTTONS (can't evaluate it)
 *   - no toolbar / unknown type -> DEFAULT_BUTTONS
 *
 * No tile currently ships a function toolbar (all are arrays), but the type
 * allows it and the rendering caller (TileToolbar.vue) passes its live
 * ToolbarContext, so the dynamic path is wired and exercised here.
 *
 * DEFAULT_BUTTONS is `[...RESIZE_PRESETS]`, so we assert against the real
 * RESIZE_PRESETS imported from baseButtons. getTileDefinition is mocked so the
 * unit is isolated from the registry singleton.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ContentType } from "@grids/contracts/types";
import type { TileDefinition } from "@/types/TileDefinition";
import type { ToolbarButton, ToolbarContext } from "@/types/TileToolbar";

const getTileDefinition = vi.fn();

vi.mock("@/registries/tileRegistry", () => ({
  getTileDefinition: (type: ContentType) => getTileDefinition(type),
}));

import { getTileToolbarButtons } from "@/registries/tileToolbar";
import { RESIZE_PRESETS } from "@/registries/tileToolbar/baseButtons";

function defWith(toolbar: TileDefinition["toolbar"]): TileDefinition {
  return { toolbar } as TileDefinition;
}

// A throwaway ToolbarContext stand-in; the resolver only forwards it to the
// function toolbar, so its concrete shape is irrelevant to these tests.
const fakeCtx = { tile: { i: "t" } } as unknown as ToolbarContext;

beforeEach(() => {
  getTileDefinition.mockReset();
});

describe("getTileToolbarButtons", () => {
  it("returns the definition's toolbar array unchanged when it is an array", () => {
    const customToolbar = [
      { id: "x", icon: {}, title: "X", action: () => {} },
    ] as ToolbarButton[];
    getTileDefinition.mockReturnValue(defWith(customToolbar));

    expect(getTileToolbarButtons(ContentType.TEXT)).toBe(customToolbar);
  });

  it("invokes a function toolbar with the context and returns its result", () => {
    const computed = [
      { id: "dynamic", icon: {}, title: "Dynamic", action: () => {} },
    ] as ToolbarButton[];
    const fnToolbar = vi.fn(() => computed);
    getTileDefinition.mockReturnValue(defWith(fnToolbar));

    const result = getTileToolbarButtons(ContentType.MAP, fakeCtx);

    expect(fnToolbar).toHaveBeenCalledWith(fakeCtx);
    expect(result).toBe(computed);
  });

  it("falls back to the default buttons for a function toolbar when no context is given", () => {
    const fnToolbar = vi.fn(() => [] as ToolbarButton[]);
    getTileDefinition.mockReturnValue(defWith(fnToolbar));

    expect(getTileToolbarButtons(ContentType.MAP)).toEqual([...RESIZE_PRESETS]);
    expect(fnToolbar).not.toHaveBeenCalled();
  });

  it("returns the array form even when a context is supplied (context ignored)", () => {
    const customToolbar = [
      { id: "x", icon: {}, title: "X", action: () => {} },
    ] as ToolbarButton[];
    getTileDefinition.mockReturnValue(defWith(customToolbar));

    expect(getTileToolbarButtons(ContentType.TEXT, fakeCtx)).toBe(
      customToolbar,
    );
  });

  it("returns the default buttons when the definition has no toolbar", () => {
    getTileDefinition.mockReturnValue(defWith(undefined));

    expect(getTileToolbarButtons(ContentType.CHAT)).toEqual([...RESIZE_PRESETS]);
  });

  it("returns the default buttons when the type is not registered", () => {
    getTileDefinition.mockReturnValue(undefined);

    expect(getTileToolbarButtons(ContentType.IMAGE)).toEqual([
      ...RESIZE_PRESETS,
    ]);
  });

  it("passes the requested type through to getTileDefinition", () => {
    getTileDefinition.mockReturnValue(undefined);

    getTileToolbarButtons(ContentType.VIDEO);

    expect(getTileDefinition).toHaveBeenCalledWith(ContentType.VIDEO);
  });

  it("returns a default-buttons result equal to but not aliasing RESIZE_PRESETS", () => {
    getTileDefinition.mockReturnValue(undefined);

    const result = getTileToolbarButtons(ContentType.IMAGE);

    // DEFAULT_BUTTONS is a separate array copy; mutating the result must not
    // be asserted here, but identity should differ from RESIZE_PRESETS.
    expect(result).not.toBe(RESIZE_PRESETS);
    expect(result).toEqual(RESIZE_PRESETS);
  });
});
