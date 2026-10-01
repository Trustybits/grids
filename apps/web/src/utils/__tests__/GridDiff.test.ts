import { describe, expect, it } from "vitest";
import {
  ContentType,
  type Grid,
  type TextContent,
  type Tile,
} from "@grids/contracts/types";
import { describeGridChanges, summarizeGridChanges } from "../GridDiff";

function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    i: "tile-1",
    x: 0,
    y: 0,
    w: 2,
    h: 2,
    borderEnabled: true,
    caption: "",
    content: { type: ContentType.TEXT, text: "Hello" } as TextContent,
    ...overrides,
  } as Tile;
}

function makeGrid(overrides: Partial<Grid> = {}): Grid {
  return {
    id: "grid-1",
    userId: "user-1",
    name: "Test Grid",
    colNum: 12,
    verticalCompact: true,
    backgroundImageSrc: "",
    backgroundEmbed: false,
    tiles: [makeTile()],
    overrides: {},
    ...overrides,
  };
}

describe("summarizeGridChanges", () => {
  it("reports nothing for identical content regardless of metadata", () => {
    const published = makeGrid({ rev: 3, status: "published" });
    const draft = makeGrid({
      id: "draft__grid-1",
      rev: 9,
      status: "draft",
      draftOf: "grid-1",
      draftOfRev: 3,
    });

    const summary = summarizeGridChanges(published, draft);

    expect(summary).toEqual({
      tilesAdded: 0,
      tilesRemoved: 0,
      tilesEdited: 0,
      tilesMoved: 0,
      settingsChanged: [],
    });
    expect(describeGridChanges(summary)).toEqual([]);
  });

  it("counts added and removed tiles by id", () => {
    const published = makeGrid({
      tiles: [makeTile({ i: "a" }), makeTile({ i: "b" })],
    });
    const draft = makeGrid({
      tiles: [makeTile({ i: "a" }), makeTile({ i: "c" }), makeTile({ i: "d" })],
    });

    const summary = summarizeGridChanges(published, draft);

    expect(summary.tilesAdded).toBe(2);
    expect(summary.tilesRemoved).toBe(1);
    expect(describeGridChanges(summary)).toEqual([
      "2 tiles added",
      "1 tile removed",
    ]);
  });

  it("classifies a tile as edited over moved when both changed", () => {
    const published = makeGrid({
      tiles: [makeTile({ i: "a" }), makeTile({ i: "b" }), makeTile({ i: "c" })],
    });
    const draft = makeGrid({
      tiles: [
        // content + position → edited
        makeTile({
          i: "a",
          x: 4,
          content: { type: ContentType.TEXT, text: "Changed" } as TextContent,
        }),
        // caption only → edited
        makeTile({ i: "b", caption: "New caption" }),
        // size only → moved
        makeTile({ i: "c", w: 4 }),
      ],
    });

    const summary = summarizeGridChanges(published, draft);

    expect(summary.tilesEdited).toBe(2);
    expect(summary.tilesMoved).toBe(1);
    expect(describeGridChanges(summary)).toEqual([
      "2 tiles edited",
      "1 tile moved or resized",
    ]);
  });

  it("treats a breakpoint override change as a move", () => {
    const published = makeGrid({
      overrides: { md: { "tile-1": { x: 0, y: 0, w: 2, h: 2 } } },
    });
    const draft = makeGrid({
      overrides: { md: { "tile-1": { x: 2, y: 0, w: 2, h: 2 } } },
    });

    expect(summarizeGridChanges(published, draft).tilesMoved).toBe(1);

    // Adding an override where none existed also counts.
    const added = makeGrid({
      overrides: { sm: { "tile-1": { x: 0, y: 1, w: 1, h: 1 } } },
    });
    expect(summarizeGridChanges(makeGrid(), added).tilesMoved).toBe(1);
  });

  it("lists changed grid-level settings in a fixed order", () => {
    const published = makeGrid();
    const draft = makeGrid({
      name: "Renamed",
      backgroundColor: "#123456",
      backgroundActiveSource: "color",
      themeId: "dark",
      colNum: 8,
      verticalCompact: false,
      ogImageSrc: "https://example.com/og.png",
      duplicatable: true,
    });

    const summary = summarizeGridChanges(published, draft);

    expect(summary.settingsChanged).toEqual([
      "Name",
      "Background",
      "Theme",
      "Columns",
      "Compact layout",
      "Share image",
      "Template setting",
    ]);
    expect(describeGridChanges(summary)).toEqual([
      "Name, Background, Theme, Columns, Compact layout, Share image, Template setting changed",
    ]);
  });

  it("ignores absent-vs-default differences in optional settings", () => {
    const published = makeGrid({
      themeId: undefined,
      duplicatable: undefined,
      backgroundColor: undefined,
      overrides: undefined,
    });
    const draft = makeGrid({
      themeId: "",
      duplicatable: false,
      backgroundColor: "",
      overrides: {},
    });

    expect(summarizeGridChanges(published, draft).settingsChanged).toEqual([]);
  });
});
