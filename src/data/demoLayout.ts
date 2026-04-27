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
    ContentType.IMAGE,
    uuidv4(),
    0,
    0,
    2,
    2,
    {
      src: "https://plus.unsplash.com/premium_photo-1674917000586-b7564f21540e?q=80&w=1288&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
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
      trackId: "1u8c2t2Cy7UBoG4ArRcF5g",
      trackName: "Blank Space",
      artistName: "Taylor Swift",
      albumName: "1989 (Deluxe)",
      trackUrl: "https://open.spotify.com/track/1u8c2t2Cy7UBoG4ArRcF5g",
      artistUrl: "https://open.spotify.com/artist/06HL4z0CvFAxyc27GXpf02",
      albumArt:
        "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e029abdf14e6058bd3903686148",
      backgroundColor: "rgba(96, 81, 53, 255)",
      backgroundTinted: "rgba(62, 49, 21, 255)",
      previewUrl: "https://p.scdn.co/mp3-preview/e5cb812c19b14f4dc4c92a4c996bb92d05e2bf39",
      textSubdued: "rgba(220, 204, 171, 255)",
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
        backgroundColor: "rgba(0, 0, 0, 0)",
        color: "rgba(255, 255, 255, 255)",
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
      customTitle: "Visit the Grid",
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
