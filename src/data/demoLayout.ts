// src/data/demoLayout.ts
//
// Hand-curated in-memory demo layout used by the marketing homepage embed.
// Built fresh (not derived from createStarterTiles) so the landing page can
// evolve independently of the "new grid" experience that live users get.
//
// The homepage hero scroll-jacks through three device viewports — phone,
// tablet, desktop — so the same set of tiles needs to look great at every
// breakpoint. We model that the way the grid does for real layouts:
//
//   • Base tiles use the lg (12-col, desktop) positions/sizes.
//   • overrides.md provides an 8-col tablet layout.
//   • overrides.sm provides a 4-col phone layout.
//
// Design constraints:
//   • Every breakpoint is a single coherent page (not a re-flow of the next),
//     so each layout is hand-tuned rather than auto-packed.
//   • Sizes stay in tasteful proportions for each device:
//       lg — wide and shallow (4 rows, plenty of room horizontally).
//       md — squarish (6 rows).
//       sm — tall and narrow (8 rows).
//   • Mix of content types showcases what a real grid looks like:
//     profile/image, text, gif, music, youtube embed, quote, links.
//   • Tile IDs are stable for the lifetime of the layout instance so the
//     overrides correctly map onto the same tiles.

import type { Layout } from "@/types/Layout";
import type { Breakpoint, TilePosition } from "@/types/Tile";
import { createDefaultLayout } from "@/utils/LayoutUtils";
import { createTile } from "@/utils/TileUtils";
import { ContentType } from "@/types/TileContent";
import { v4 as uuidv4 } from "uuid";
import heroGif from "@/assets/images/hero.gif";

export const DEMO_LAYOUT_ID = "__homepage_demo__";
export const DEMO_USER_ID = "__homepage_demo_user__";

// Small helper: TipTap doc JSON, kept inline so callers don't need to know
// about the TipTap schema. Accepts an array of lines; lines starting with
// "# "/"## "/... become headings, everything else becomes a paragraph.
const textDoc = (lines: string[]): string => {
  const content = lines.map((line) => {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      return {
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: [{ type: "text", text: headingMatch[2] }],
      };
    }
    if (line.trim() === "") {
      return { type: "paragraph", content: [{ type: "hardBreak" }] };
    }
    return {
      type: "paragraph",
      content: [{ type: "text", text: line }],
    };
  });
  return JSON.stringify({ type: "doc", content });
};

// Stable IDs for each tile — used both as the base tile.i and as the keys
// of the breakpoint overrides. Keeping them human-readable also makes the
// overrides table below easy to scan.
const ID = {
  IMAGE: "demo-image",
  WELCOME: "demo-welcome",
  GIF: "demo-gif",
  MUSIC: "demo-music",
  YT: "demo-yt",
  QUOTE: "demo-quote",
  LINK_STRIP: "demo-link-strip",
  LINK_X: "demo-link-x",
  LINK_GH: "demo-link-gh",
  LINK_IG: "demo-link-ig",
  LINK_DRIBBBLE: "demo-link-dribbble",
} as const;

// Desktop layout (lg, 12 columns, 6 rows tall ≈ 786px @ rowHeight 75)
//
//   c:   0  1  2  3  4  5  6  7  8  9 10 11
//   r=0  [   IMG 3×3   ][    WLC 5×2     ][   MUS 4×2  ]
//   r=1  [             ][                ][            ]
//   r=2  [             ][   GIF 4×2  ][        YT 5×3  ]
//   r=3  [   QTE 3×2   ][            ][                ]
//   r=4  [             ][ STRIP 4×1  ][                ]
//   r=5  [  LK 3×1  ][  LK 3×1  ][  LK 3×1  ][  LK 3×1 ]
//
// Variety beats: IMG is a big 3×3 square, YT is a tall 5×3 video (the
// "hero" of the desktop view), GIF and MUSIC are wide rectangles, QUOTE
// tucks under the profile photo, and the four social links span 3 cols
// each so they're full-width buttons rather than tiny icons.
const createDesktopBaseTiles = () => [
  createTile(
    ContentType.IMAGE,
    ID.IMAGE,
    0,
    0,
    3,
    3,
    {
      src: "https://plus.unsplash.com/premium_photo-1674917000586-b7564f21540e?q=80&w=1288&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    },
    "",
  ),
  {
    ...createTile(
      ContentType.TEXT,
      ID.WELCOME,
      3,
      0,
      5,
      2,
      {
        text: textDoc([
          "# 👋",
          "#### Welcome to my grid",
          "A living page of what I'm making, listening to, and reading.",
        ]),
      },
      "",
    ),
    borderEnabled: false,
  },
  createTile(
    ContentType.IMAGE,
    ID.GIF,
    3,
    2,
    4,
    2,
    { src: heroGif },
    "",
  ),
  createTile(
    ContentType.MUSIC,
    ID.MUSIC,
    8,
    0,
    4,
    2,
    {
      platform: "spotify",
      trackId: "1u8c2t2Cy7UBoG4ArRcF5g",
      trackName: "Blank Space",
      artistName: "Taylor Swift",
      trackUrl: "https://open.spotify.com/track/1u8c2t2Cy7UBoG4ArRcF5g",
      artistUrl: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02",
      albumArt:
        "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029abdf14e6058bd3903686148",
      backgroundColor: "rgba(96, 81, 53, 255)",
      backgroundTinted: "rgba(62, 49, 21, 255)",
      previewUrl:
        "https://p.scdn.co/mp3-preview/e5cb812c19b14f4dc4c92a4c996bb92d05e2bf39",
      textSubdued: "rgba(220, 204, 171, 255)",
    },
    "",
  ),
  createTile(
    ContentType.EMBED,
    ID.YT,
    7,
    2,
    5,
    3,
    { src: "https://www.youtube.com/embed/7ccH8u8fj8Y?si=hnB1rbMIsMCWpPO8" },
    "",
  ),
  {
    ...createTile(
      ContentType.TEXT,
      ID.QUOTE,
      0,
      3,
      3,
      2,
      {
        text: textDoc([
          '## "Simple,',
          '## but significant."',
          "",
          "— my favorite design note",
        ]),
        backgroundColor: "rgba(0, 0, 0, 0)",
        color: "rgba(255, 255, 255, 255)",
      },
      "",
    ),
    borderEnabled: false,
  },
  createTile(
    ContentType.LINK,
    ID.LINK_STRIP,
    3,
    4,
    4,
    1,
    {
      link: "https://grids.so",
      customTitle: "Visit the Grid",
      customSubtitle: "Notes on building grids.so",
      linkBackgroundEnabled: true,
    },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_X,
    0,
    5,
    3,
    1,
    { link: "https://twitter.com", customTitle: "x" },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_GH,
    3,
    5,
    3,
    1,
    { link: "https://github.com", customTitle: "github" },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_IG,
    6,
    5,
    3,
    1,
    { link: "https://instagram.com", customTitle: "ig" },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_DRIBBBLE,
    9,
    5,
    3,
    1,
    { link: "https://dribbble.com", customTitle: "dribbble" },
    "",
  ),
];

// Tablet layout (md, 8 columns, 6 rows tall ≈ 786px)
//
//   c:   0  1  2  3  4  5  6  7
//   r=0  [IMG 2×2][   WLC 4×2  ][MUS 2×2]
//   r=1  [       ][             ][       ]
//   r=2  [    YT 4×3      ][   GIF 4×2  ]
//   r=3  [                ][             ]
//   r=4  [                ][   QTE 4×1  ]
//   r=5  [   STRIP 4×1    ][LK][LK][LK][LK]
//
// Notably different from lg: YT is the tall portrait hero (4×3) rather
// than a wide block, GIF sits beside it as a squarer chunk, and the four
// social links collapse to 1×1 favicon dots after a half-width strip.
const tabletPositions: Record<string, TilePosition> = {
  [ID.IMAGE]: { x: 0, y: 0, w: 2, h: 2 },
  [ID.WELCOME]: { x: 2, y: 0, w: 4, h: 2 },
  [ID.MUSIC]: { x: 6, y: 0, w: 2, h: 2 },
  [ID.YT]: { x: 0, y: 2, w: 4, h: 3 },
  [ID.GIF]: { x: 4, y: 2, w: 4, h: 2 },
  [ID.QUOTE]: { x: 4, y: 4, w: 4, h: 1 },
  [ID.LINK_STRIP]: { x: 0, y: 5, w: 4, h: 1 },
  [ID.LINK_X]: { x: 4, y: 5, w: 1, h: 1 },
  [ID.LINK_GH]: { x: 5, y: 5, w: 1, h: 1 },
  [ID.LINK_IG]: { x: 6, y: 5, w: 1, h: 1 },
  [ID.LINK_DRIBBBLE]: { x: 7, y: 5, w: 1, h: 1 },
};

// Phone layout (sm, 4 columns, 8 rows tall ≈ 1032px)
//
//   y=0   [IMG 2×2 ][TXT 2×2 ]
//   y=2   [GIF 2×2 ][MUS 2×2 ]
//   y=4   [YT  2×2 ][QTE 2×2 ]
//   y=6   [───── LINK strip 4×1 ─────]
//   y=7   [L 1×1][L 1×1][L 1×1][L 1×1]
const phonePositions: Record<string, TilePosition> = {
  [ID.IMAGE]: { x: 0, y: 0, w: 2, h: 2 },
  [ID.WELCOME]: { x: 2, y: 0, w: 2, h: 2 },
  [ID.GIF]: { x: 0, y: 2, w: 2, h: 2 },
  [ID.MUSIC]: { x: 2, y: 2, w: 2, h: 2 },
  [ID.YT]: { x: 0, y: 4, w: 2, h: 2 },
  [ID.QUOTE]: { x: 2, y: 4, w: 2, h: 2 },
  [ID.LINK_STRIP]: { x: 0, y: 6, w: 4, h: 1 },
  [ID.LINK_X]: { x: 0, y: 7, w: 1, h: 1 },
  [ID.LINK_GH]: { x: 1, y: 7, w: 1, h: 1 },
  [ID.LINK_IG]: { x: 2, y: 7, w: 1, h: 1 },
  [ID.LINK_DRIBBBLE]: { x: 3, y: 7, w: 1, h: 1 },
};

// Natural pixel dimensions of each breakpoint, given Grid.vue's defaults
// (rowHeight = 75, margin = 48). Useful for the homepage scroll-jacker
// when computing how much to scale the embed to fit a target frame width.
//
//   width  = colNum × rowHeight + (colNum + 1) × margin
//   height = rowCount × rowHeight + (rowCount + 1) × margin
export const DEMO_GRID_DIMENSIONS: Record<
  Breakpoint,
  { width: number; height: number }
> = {
  // 12 cols × 75 + 13 × 48 = 1524, 6 rows × 75 + 7 × 48 = 786
  lg: { width: 1524, height: 786 },
  // 8 cols × 75 + 9 × 48 = 1032, 6 rows × 75 + 7 × 48 = 786
  md: { width: 1032, height: 786 },
  // 4 cols × 75 + 5 × 48 = 540, 8 rows × 75 + 9 × 48 = 1032
  sm: { width: 540, height: 1032 },
};

export function createDemoLayout(): Layout {
  const layout = createDefaultLayout(DEMO_USER_ID, "Demo");
  layout.id = DEMO_LAYOUT_ID;
  layout.tiles = createDesktopBaseTiles();
  layout.overrides = {
    md: tabletPositions,
    sm: phonePositions,
  };
  return layout;
}
