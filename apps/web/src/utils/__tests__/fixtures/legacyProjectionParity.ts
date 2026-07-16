import type { Breakpoint, TilePosition } from "@grids/contracts/types";
import type { GridLayoutItem } from "@/types/GridLayout";

export interface LegacyProjectionParityFixture {
  name: string;
  breakpoint: Exclude<Breakpoint, "lg">;
  columns: number;
  tiles: readonly GridLayoutItem[];
  overrides?: Partial<
    Record<Breakpoint, Record<string, TilePosition>>
  >;
  expectedProjection: readonly GridLayoutItem[];
  expectedWithTopGravity: readonly GridLayoutItem[];
}

function item(
  i: string,
  x: number,
  y: number,
  w: number,
  h: number,
): GridLayoutItem {
  return { i, x, y, w, h };
}

/**
 * Frozen geometry examples for the app-owned historical projection. The
 * pre-gravity expectations are the compatibility contract that Griddle v1
 * must reproduce. The gravity expectations characterize the existing, later
 * top-gravity pass and are intentionally kept separate.
 */
export const legacyProjectionParityMatrix: readonly LegacyProjectionParityFixture[] = [
  {
    name: "12 to 8 preserves valid positions, gaps, and input order",
    breakpoint: "md",
    columns: 8,
    tiles: [
      item("late", 4, 3, 3, 2),
      item("early", 0, 0, 4, 2),
      item("lower", 0, 6, 2, 1),
    ],
    expectedProjection: [
      item("late", 4, 3, 3, 2),
      item("early", 0, 0, 4, 2),
      item("lower", 0, 6, 2, 1),
    ],
    expectedWithTopGravity: [
      item("late", 4, 0, 3, 2),
      item("early", 0, 0, 4, 2),
      item("lower", 0, 2, 2, 1),
    ],
  },
  {
    name: "12 to 4 relocates horizontally out-of-bounds tiles",
    breakpoint: "sm",
    columns: 4,
    tiles: [
      item("right", 8, 2, 3, 2),
      item("left", 0, 0, 2, 2),
      item("bottom", 2, 4, 2, 2),
    ],
    expectedProjection: [
      item("right", 0, 2, 3, 2),
      item("left", 0, 0, 2, 2),
      item("bottom", 2, 4, 2, 2),
    ],
    expectedWithTopGravity: [
      item("right", 0, 2, 3, 2),
      item("left", 0, 0, 2, 2),
      item("bottom", 2, 4, 2, 2),
    ],
  },
  {
    name: "collisions use stable tile IDs while returning input order",
    breakpoint: "sm",
    columns: 4,
    tiles: [
      item("b", 0, 0, 2, 2),
      item("a", 0, 0, 2, 2),
      item("c", 2, 0, 2, 2),
    ],
    expectedProjection: [
      item("b", 2, 0, 2, 2),
      item("a", 0, 0, 2, 2),
      item("c", 0, 2, 2, 2),
    ],
    expectedWithTopGravity: [
      item("b", 2, 0, 2, 2),
      item("a", 0, 0, 2, 2),
      item("c", 0, 2, 2, 2),
    ],
  },
  {
    name: "12 to 8 scales an oversized tile and rounds height proportionally",
    breakpoint: "md",
    columns: 8,
    tiles: [item("wide", 0, 5, 12, 4)],
    expectedProjection: [item("wide", 0, 5, 8, 3)],
    expectedWithTopGravity: [item("wide", 0, 0, 8, 3)],
  },
  {
    name: "an empty override map uses automatic 12 to 4 projection",
    breakpoint: "sm",
    columns: 4,
    tiles: [
      item("lower", 0, 3, 6, 3),
      item("upper", 6, 0, 6, 3),
    ],
    overrides: { sm: {} },
    expectedProjection: [
      item("lower", 0, 3, 4, 2),
      item("upper", 0, 0, 4, 2),
    ],
    expectedWithTopGravity: [
      item("lower", 0, 2, 4, 2),
      item("upper", 0, 0, 4, 2),
    ],
  },
  {
    name: "partial overrides lead and missing tiles fill around them",
    breakpoint: "sm",
    columns: 4,
    tiles: [
      item("missing-before", 0, 0, 6, 3),
      item("custom", 4, 4, 2, 2),
      item("missing-after", 8, 0, 2, 2),
    ],
    overrides: {
      sm: {
        custom: { x: 0, y: 2, w: 2, h: 2 },
        "missing-tile-id": { x: 2, y: 10, w: 2, h: 2 },
      },
    },
    expectedProjection: [
      item("custom", 0, 2, 2, 2),
      item("missing-before", 0, 0, 4, 2),
      item("missing-after", 2, 2, 2, 2),
    ],
    expectedWithTopGravity: [
      item("custom", 0, 2, 2, 2),
      item("missing-before", 0, 0, 4, 2),
      item("missing-after", 2, 2, 2, 2),
    ],
  },
  {
    name: "complete overrides remain verbatim and preserve input order",
    breakpoint: "sm",
    columns: 4,
    tiles: [item("b", 0, 0, 2, 2), item("a", 2, 0, 2, 2)],
    overrides: {
      sm: {
        a: { x: 0, y: 3, w: 2, h: 2 },
        b: { x: 2, y: 5, w: 2, h: 2 },
        "missing-tile-id": { x: 0, y: 20, w: 4, h: 1 },
      },
    },
    expectedProjection: [
      item("b", 2, 5, 2, 2),
      item("a", 0, 3, 2, 2),
    ],
    expectedWithTopGravity: [
      item("b", 2, 0, 2, 2),
      item("a", 0, 0, 2, 2),
    ],
  },
];

/**
 * Product-shaped golden fixtures. These intentionally use explicit expected
 * geometry rather than generated snapshots so later strategy work must review
 * every compatibility change.
 */
export const realGridProjectionFixtures: readonly LegacyProjectionParityFixture[] = [
  {
    name: "editorial dashboard with a partial tablet arrangement",
    breakpoint: "md",
    columns: 8,
    tiles: [
      item("hero", 0, 0, 8, 4),
      item("notes", 8, 0, 4, 4),
      item("chart", 0, 4, 5, 3),
      item("links", 5, 4, 3, 2),
      item("map", 8, 4, 4, 5),
    ],
    overrides: {
      md: {
        hero: { x: 0, y: 0, w: 8, h: 4 },
        notes: { x: 0, y: 4, w: 4, h: 3 },
        map: { x: 4, y: 4, w: 4, h: 4 },
        archived: { x: 0, y: 30, w: 8, h: 2 },
      },
    },
    expectedProjection: [
      item("hero", 0, 0, 8, 4),
      item("notes", 0, 4, 4, 3),
      item("map", 4, 4, 4, 4),
      item("chart", 0, 8, 5, 3),
      item("links", 5, 8, 3, 2),
    ],
    expectedWithTopGravity: [
      item("hero", 0, 0, 8, 4),
      item("notes", 0, 4, 4, 3),
      item("map", 4, 4, 4, 4),
      item("chart", 0, 8, 5, 3),
      item("links", 5, 8, 3, 2),
    ],
  },
  {
    name: "media collection automatically projects to a single mobile stack",
    breakpoint: "sm",
    columns: 4,
    tiles: [
      item("video", 6, 0, 6, 4),
      item("title", 0, 0, 6, 2),
      item("quote", 0, 2, 4, 3),
      item("photo", 4, 4, 8, 6),
      item("footer", 0, 10, 12, 2),
    ],
    expectedProjection: [
      item("video", 0, 1, 4, 3),
      item("title", 0, 0, 4, 1),
      item("quote", 0, 4, 4, 3),
      item("photo", 0, 7, 4, 3),
      item("footer", 0, 10, 4, 1),
    ],
    expectedWithTopGravity: [
      item("video", 0, 1, 4, 3),
      item("title", 0, 0, 4, 1),
      item("quote", 0, 4, 4, 3),
      item("photo", 0, 7, 4, 3),
      item("footer", 0, 10, 4, 1),
    ],
  },
  {
    name: "planning board keeps saved mobile anchors and places new tiles",
    breakpoint: "sm",
    columns: 4,
    tiles: [
      item("notes", 0, 7, 6, 4),
      item("cover", 0, 0, 12, 4),
      item("status", 8, 4, 4, 3),
      item("agenda", 0, 4, 4, 3),
      item("links", 6, 7, 6, 4),
      item("people", 4, 4, 4, 3),
    ],
    overrides: {
      sm: {
        cover: { x: 0, y: 0, w: 4, h: 2 },
        status: { x: 0, y: 2, w: 2, h: 2 },
        removed: { x: 2, y: 2, w: 2, h: 2 },
      },
    },
    expectedProjection: [
      item("cover", 0, 0, 4, 2),
      item("status", 0, 2, 2, 2),
      item("notes", 0, 4, 4, 3),
      item("agenda", 0, 7, 4, 3),
      item("links", 0, 10, 4, 3),
      item("people", 0, 13, 4, 3),
    ],
    expectedWithTopGravity: [
      item("cover", 0, 0, 4, 2),
      item("status", 0, 2, 2, 2),
      item("notes", 0, 4, 4, 3),
      item("agenda", 0, 7, 4, 3),
      item("links", 0, 10, 4, 3),
      item("people", 0, 13, 4, 3),
    ],
  },
];
