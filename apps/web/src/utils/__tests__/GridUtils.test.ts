/**
 * Tests for GridUtils.ts
 *
 * Covers:
 *  - createDefaultGrid: building a fresh Grid with sensible defaults
 *  - findTileById: locating a tile by its `i` id
 */

import { describe, it, expect } from "vitest";
import {
  ContentType,
  GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
  LEGACY_RESPONSIVE_LAYOUT_VERSION,
  type Tile,
} from "@grids/contracts/types";
import {
  ACTIVE_NEW_GRID_RESPONSIVE_LAYOUT_VERSION,
  createDefaultGrid,
  findTileById,
} from "../GridUtils";

function makeTile(i: string, x = 0, y = 0): Tile {
  return {
    i,
    x,
    y,
    w: 1,
    h: 1,
    caption: "",
    content: { type: ContentType.TEXT } as Tile["content"],
  };
}

describe("createDefaultGrid", () => {
  it("populates the owner userId", () => {
    expect(createDefaultGrid("user-1", "My Grid").userId).toBe("user-1");
  });

  it("uses the provided name", () => {
    expect(createDefaultGrid("user-1", "My Grid").name).toBe("My Grid");
  });

  it("falls back to an empty name when name is an empty string", () => {
    expect(createDefaultGrid("user-1", "").name).toBe("");
  });

  it("falls back to an empty name when name is falsy (undefined)", () => {
    // `if (!name) name = ""` guards against missing names.
    expect(
      createDefaultGrid("user-1", undefined as unknown as string).name,
    ).toBe("");
  });

  it("applies the documented defaults", () => {
    const grid = createDefaultGrid("user-1", "Test");
    expect(grid).toMatchObject({
      id: "",
      rev: 0,
      colNum: 12,
      responsiveLayoutVersion: GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
      verticalCompact: true,
      tiles: [],
      backgroundImageSrc: "",
      backgroundEmbed: false,
      duplicatable: false,
    });
  });

  it("creates persisted production grids with the launched griddle-v1 strategy", () => {
    expect(ACTIVE_NEW_GRID_RESPONSIVE_LAYOUT_VERSION).toBe(
      GRIDDLE_RESPONSIVE_LAYOUT_VERSION,
    );
  });

  it("accepts an explicit compatibility version", () => {
    expect(
      createDefaultGrid(
        "user-1",
        "Legacy",
        LEGACY_RESPONSIVE_LAYOUT_VERSION,
      ).responsiveLayoutVersion,
    ).toBe(LEGACY_RESPONSIVE_LAYOUT_VERSION);
  });

  it("starts with an empty, fresh tiles array", () => {
    const a = createDefaultGrid("u", "a");
    const b = createDefaultGrid("u", "b");
    expect(a.tiles).toEqual([]);
    // Each call should produce its own array, not a shared reference.
    expect(a.tiles).not.toBe(b.tiles);
  });
});

describe("findTileById", () => {
  it("returns the tile whose `i` matches", () => {
    const tiles = [makeTile("a"), makeTile("b"), makeTile("c")];
    expect(findTileById(tiles, "b")).toBe(tiles[1]);
  });

  it("returns undefined when no tile matches", () => {
    const tiles = [makeTile("a"), makeTile("b")];
    expect(findTileById(tiles, "z")).toBeUndefined();
  });

  it("returns undefined for an empty array", () => {
    expect(findTileById([], "a")).toBeUndefined();
  });

  it("returns the first match when ids are duplicated", () => {
    const first = makeTile("dup", 1);
    const second = makeTile("dup", 2);
    expect(findTileById([first, second], "dup")).toBe(first);
  });
});
