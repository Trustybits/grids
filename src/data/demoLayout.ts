// src/data/demoLayout.ts
//
// Hand-curated in-memory demo layout used by the marketing homepage embed.
// Built fresh (not derived from createStarterTiles) so the landing page can
// evolve independently of the "new grid" experience that live users get.
//
// Design constraints:
//   • The embed always renders at the sm (4-column) breakpoint, so every
//     tile is width ≤ 4.
//   • No 4×4 or taller mega-tiles — they dominate a mobile canvas.
//   • Sizes stay in the 1×1 / 2×2 / 4×1 / 4×2 family so tiles pack cleanly
//     with vertical-compact gravity.
//   • Mix of content types showcases what a real grid looks like:
//     profile, text, image, music, youtube embed, and link tiles.

import type { Layout } from "@/types/Layout";
import { createDefaultLayout } from "@/types/FirestoreMappers";
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

// Tile positions (4-col grid, vertical-compact on):
//
//   y=0   [PROFILE 2×2]        [TEXT 2×2]
//   y=2   [IMAGE   2×2]        [MUSIC 2×2]
//   y=4   [YT EMBED 2×2]       [QUOTE TEXT 2×2]
//   y=6   [──── LINK strip 4×1 ────]
//   y=7   [L 1×1][L 1×1][L 1×1][L 1×1]
//
// Total height ≈ 8 rows × 75px + gutters ≈ 900px — tall enough to feel like
// a real page, short enough to sit inside the hero comfortably.
const createDemoTiles = () => [
  createTile(
    ContentType.PROFILE,
    uuidv4(),
    0,
    0,
    2,
    2,
    {
      name: "Taylor Reid",
      title: "Designer · Lisbon",
      bio: "Building quiet software and loud posters.",
      avatarShape: "circle",
    },
    "",
  ),
  {
    ...createTile(
      ContentType.TEXT,
      uuidv4(),
      2,
      0,
      2,
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
    uuidv4(),
    0,
    2,
    2,
    2,
    { src: heroGif },
    "",
  ),
  createTile(
    ContentType.MUSIC,
    uuidv4(),
    2,
    2,
    2,
    2,
    {
      platform: "spotify",
      trackId: "6dOtVTDdiauQNBQEDOtlAB",
      trackName: "BIRDS OF A FEATHER",
      artistName: "Billie Eilish",
      albumName: "HIT ME HARD AND SOFT",
      trackUrl: "https://open.spotify.com/track/6dOtVTDdiauQNBQEDOtlAB",
      artistUrl: "https://open.spotify.com/artist/6qqNVTkY8uBg9cP3Jd7DAH",
      albumArt:
        "https://i.scdn.co/image/ab67616d0000b2731d4e7dfb0f42f2b74da70d93",
    },
    "",
  ),
  createTile(
    ContentType.EMBED,
    uuidv4(),
    0,
    4,
    2,
    2,
    { src: "https://www.youtube.com/embed/7ccH8u8fj8Y?si=hnB1rbMIsMCWpPO8" },
    "",
  ),
  {
    ...createTile(
      ContentType.TEXT,
      uuidv4(),
      2,
      4,
      2,
      2,
      {
        text: textDoc([
          "## \"Simple,",
          "## but significant.\"",
          "",
          "— my favorite design note",
        ]),
      },
      "",
    ),
    borderEnabled: false,
  },
  createTile(
    ContentType.LINK,
    uuidv4(),
    0,
    6,
    4,
    1,
    {
      link: "https://grids.so",
      customTitle: "Read the blog",
      customSubtitle: "Notes on building grids.so",
      linkBackgroundEnabled: true,
    },
    "",
  ),
  createTile(
    ContentType.LINK,
    uuidv4(),
    0,
    7,
    1,
    1,
    { link: "https://twitter.com", customTitle: "x" },
    "",
  ),
  createTile(
    ContentType.LINK,
    uuidv4(),
    1,
    7,
    1,
    1,
    { link: "https://github.com", customTitle: "github" },
    "",
  ),
  createTile(
    ContentType.LINK,
    uuidv4(),
    2,
    7,
    1,
    1,
    { link: "https://instagram.com", customTitle: "ig" },
    "",
  ),
  createTile(
    ContentType.LINK,
    uuidv4(),
    3,
    7,
    1,
    1,
    { link: "https://dribbble.com", customTitle: "dribbble" },
    "",
  ),
];

export function createDemoLayout(): Layout {
  const layout = createDefaultLayout(DEMO_USER_ID, "Demo");
  layout.id = DEMO_LAYOUT_ID;
  layout.tiles = createDemoTiles();
  return layout;
}
