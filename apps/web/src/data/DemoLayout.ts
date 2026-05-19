// src/data/demoLayout.ts
//
// Hand-curated in-memory demo layout used by the marketing homepage embed.
// Recreated from a live grid in Firestore ("Grids Landing Page") so the
// demo matches a real, tested layout rather than being assembled in code.
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
//   • Mix of content types showcases what a real grid looks like:
//     profile, image, text, gif, music, youtube embed, quote, links.
//   • Tile IDs are stable for the lifetime of the layout instance so the
//     overrides correctly map onto the same tiles.

import type { Layout } from "@/types/Layout";
import type { Breakpoint, TilePosition } from "@/types/Tile";
import { createDefaultLayout } from "@/utils/LayoutUtils";
import { createTile } from "@/utils/TileUtils";
import { ContentType } from "@/types/TileContent";
import heroGif from "@/assets/images/hero.gif";

export const DEMO_LAYOUT_ID = "__homepage_demo__";
export const DEMO_USER_ID = "__homepage_demo_user__";

// TipTap doc with a single paragraph — used for the profile tile's
// name / title / bio fields which are stored as serialised TipTap JSON.
const paragraphDoc = (text: string): string =>
  JSON.stringify({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

// Stable IDs for each tile — used both as the base tile.i and as the keys
// of the breakpoint overrides. Keeping them human-readable also makes the
// overrides table below easy to scan.
const ID = {
  PROFILE: "demo-profile",
  GIF: "demo-gif",
  WELCOME: "demo-welcome",
  YT: "demo-yt",
  MUSIC: "demo-music",
  COVER: "demo-cover",
  QUOTE: "demo-quote",
  LINK_X: "demo-link-x",
  LINK_GH: "demo-link-gh",
  LINK_IG: "demo-link-ig",
  LINK_DRIBBBLE: "demo-link-dribbble",
  LINK_GRIDS: "demo-link-grids",
} as const;

// Desktop layout (lg, 12 columns, 6 rows tall)
//
//   c:   0  1  2  3  4  5  6  7  8  9 10 11
//   r=0  [ PROFILE 4×4 ][  GIF 3×3 ][MUS 2×3][ WLC 2×3]
//   r=1  [              ][          ][       ][        ]
//   r=2  [              ][          ][       ][        ]
//   r=3  [              ][  YT 3×2  ][ X 1×1][ CVR 3×1]
//   r=4                  [          ][IG 1×1][ QTE 3×2]
//   r=5                  [GH][ GRD 2×1][DB  ][        ]
const createDesktopBaseTiles = () => [
  {
    ...createTile(
      ContentType.PROFILE,
      ID.PROFILE,
      0, 0, 4, 4,
      {
        name: paragraphDoc("Link"),
        title: paragraphDoc("Hero of Time"),
        bio: paragraphDoc(
          "A skilled swordsman chosen to protect the kingdom of Hyrule " +
          "from evil. Often seen in his iconic green tunic, he embarks on " +
          "dangerous quests, solves ancient puzzles, and battles monsters " +
          "to rescue Princess Zelda and defeat Ganon.",
        ),
        avatarShape: "square",
        avatarRadius: 12,
        avatarSides: 6,
        profilePhotoUrl:
          "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/users%2FetuFqcE7nsPsrbo4KiVZD4KVbtr2%2Fimages%2F1778778883084_YoungLink_Squared.png?alt=media&token=f6950e93-2acc-410d-8203-26209bab8c08",
      },
      "",
    ),
    borderEnabled: false,
  },
  createTile(
    ContentType.IMAGE,
    ID.GIF,
    4, 0, 3, 3,
    { src: heroGif },
    "",
  ),
  {
    ...createTile(
      ContentType.TEXT,
      ID.WELCOME,
      9, 0, 2, 3,
      {
        text: JSON.stringify({
          type: "doc",
          content: [
            { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "\u{1F44B}" }] },
            { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Welcome to grids.so!" }] },
            { type: "paragraph", content: [{ type: "text", text: "Enjoy your new home." }, { type: "hardBreak" }] },
            { type: "horizontalRule" },
            {
              type: "paragraph",
              content: [
                { type: "text", marks: [{ type: "italic" }], text: "you can find more tile types below." },
                { type: "text", text: "\u{1F447}" },
              ],
            },
          ],
        }),
        color: "#ffffff",
      },
      "",
    ),
    borderEnabled: false,
  },
  createTile(
    ContentType.MUSIC,
    ID.MUSIC,
    7, 0, 2, 3,
    {
      platform: "spotify",
      trackId: "4Nd5HJn4EExnLmHtClk4QV",
      trackName: "Ode to Joy",
      artistName: "Ludwig van Beethoven",
      trackUrl: "https://open.spotify.com/track/4Nd5HJn4EExnLmHtClk4QV",
      artistUrl: "https://open.spotify.com/artist/2wOqMjp9TyABvtHdOSOTUS",
      albumArt:
        "https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e028dd8211c6f6e49c9185e0c7d",
      backgroundColor: "rgba(150, 38, 31, 255)",
      backgroundTinted: "rgba(97, 0, 0, 255)",
      previewUrl:
        "https://p.scdn.co/mp3-preview/bba17a4739e090eff4f06fafe55b56732ccb54aa",
      textSubdued: "rgba(255, 190, 178, 255)",
    },
    "",
  ),
  createTile(
    ContentType.EMBED,
    ID.YT,
    4, 3, 3, 2,
    { src: "https://www.youtube-nocookie.com/embed/7ccH8u8fj8Y?playsinline=1&rel=0&modestbranding=1" },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_X,
    7, 3, 1, 1,
    {
      link: "https://x.com/",
      customTitle: "X. It\u2019s what\u2019s happening",
      customSubtitle: "@x.com",
      linkBackgroundEnabled: true,
    },
    "",
  ),
  createTile(
    ContentType.IMAGE,
    ID.COVER,
    8, 3, 3, 1,
    {
      src: "https://firebasestorage.googleapis.com/v0/b/grids-one.firebasestorage.app/o/users%2FetuFqcE7nsPsrbo4KiVZD4KVbtr2%2Fimages%2F1778780234666_Cover.png?alt=media&token=1bda389a-3699-48a2-b141-7259a4871cd6",
    },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_IG,
    7, 4, 1, 1,
    {
      link: "https://www.instagram.com/",
      customTitle: "Instagram",
      customSubtitle: "@instagram.com",
      linkBackgroundEnabled: true,
    },
    "",
  ),
  createTile(
    ContentType.TEXT,
    ID.QUOTE,
    8, 4, 3, 2,
    {
      text: JSON.stringify({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "\u201cSimple, but significant.\u201d" }],
          },
          {
            type: "paragraph",
            content: [{ type: "hardBreak" }, { type: "text", text: "\u2014 unknown" }],
          },
        ],
      }),
      color: "#ffffff",
    },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_GH,
    4, 5, 1, 1,
    {
      link: "https://github.com/",
      customTitle: "GitHub",
      customSubtitle: "@github.com",
      linkBackgroundEnabled: true,
    },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_GRIDS,
    5, 5, 2, 1,
    {
      link: "https://www.grids.so/grid/3RlM4tGkJVoUPGfs9U8A",
      customTitle: "My Grid",
      customSubtitle: "@grids.so",
      linkBackgroundEnabled: true,
    },
    "",
  ),
  createTile(
    ContentType.LINK,
    ID.LINK_DRIBBBLE,
    7, 5, 1, 1,
    {
      link: "https://dribbble.com/mgalley",
      customTitle: "Matthew J. Galley",
      customSubtitle: "@dribbble.com",
      linkBackgroundEnabled: true,
    },
    "",
  ),
];

// Tablet layout (md, 8 columns, 9 rows tall)
//
//   c:   0  1  2  3  4  5  6  7
//   r=0  [      PROFILE 8×2       ]
//   r=1  [                        ]
//   r=2  [WLC 2×3][DB][GH][MUS 4×3]
//   r=3  [       ][IG][ X][       ]
//   r=4  [       ][GRD 2×1][      ]
//   r=5  [ YT 3×2][GIF 2×2][QTE 3×2]
//   r=6  [       ][       ][       ]
//   r=7  [       COVER 8×2        ]
//   r=8  [                        ]
const tabletPositions: Record<string, TilePosition> = {
  [ID.PROFILE]:       { x: 0, y: 0, w: 8, h: 2 },
  [ID.WELCOME]:       { x: 0, y: 2, w: 2, h: 3 },
  [ID.LINK_DRIBBBLE]: { x: 2, y: 2, w: 1, h: 1 },
  [ID.LINK_GH]:       { x: 3, y: 2, w: 1, h: 1 },
  [ID.MUSIC]:         { x: 4, y: 2, w: 4, h: 3 },
  [ID.LINK_IG]:       { x: 2, y: 3, w: 1, h: 1 },
  [ID.LINK_X]:        { x: 3, y: 3, w: 1, h: 1 },
  [ID.LINK_GRIDS]:    { x: 2, y: 4, w: 2, h: 1 },
  [ID.YT]:            { x: 0, y: 5, w: 3, h: 2 },
  [ID.GIF]:           { x: 3, y: 5, w: 2, h: 2 },
  [ID.QUOTE]:         { x: 5, y: 5, w: 3, h: 2 },
  [ID.COVER]:         { x: 0, y: 7, w: 8, h: 2 },
};

// Phone layout (sm, 4 columns, 10 rows tall)
//
//   c:   0  1  2  3
//   r=0  [PROFILE 4×1]
//   r=1  [GIF 2×2][IG][ X]
//   r=2  [       ][GH][DB]
//   r=3  [MUS 2×2][WLC 2×3]
//   r=4  [       ][        ]
//   r=5  [CVR 2×1][        ]
//   r=6  [ YT 3×2 ][GRD 1×2]
//   r=7  [        ][       ]
//   r=8  [   QUOTE 4×2     ]
//   r=9  [                 ]
const phonePositions: Record<string, TilePosition> = {
  [ID.PROFILE]:       { x: 0, y: 0, w: 4, h: 1 },
  [ID.GIF]:           { x: 0, y: 1, w: 2, h: 2 },
  [ID.LINK_IG]:       { x: 2, y: 1, w: 1, h: 1 },
  [ID.LINK_X]:        { x: 3, y: 1, w: 1, h: 1 },
  [ID.LINK_GH]:       { x: 2, y: 2, w: 1, h: 1 },
  [ID.LINK_DRIBBBLE]: { x: 3, y: 2, w: 1, h: 1 },
  [ID.MUSIC]:         { x: 0, y: 3, w: 2, h: 2 },
  [ID.WELCOME]:       { x: 2, y: 3, w: 2, h: 3 },
  [ID.COVER]:         { x: 0, y: 5, w: 2, h: 1 },
  [ID.YT]:            { x: 0, y: 6, w: 3, h: 2 },
  [ID.LINK_GRIDS]:    { x: 3, y: 6, w: 1, h: 2 },
  [ID.QUOTE]:         { x: 0, y: 8, w: 4, h: 2 },
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
  // 8 cols × 75 + 9 × 48 = 1032, 9 rows × 75 + 10 × 48 = 1155
  md: { width: 1032, height: 1155 },
  // 4 cols × 75 + 5 × 48 = 540, 10 rows × 75 + 11 × 48 = 1278
  sm: { width: 540, height: 1278 },
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
