/**
 * functions/src/ogImage.ts — Dynamic OG Image Generator
 *
 * Renders a 1200×630 share card matching the Figma "Grid OG Image" frames:
 *
 *   1. Captures individual screenshots of every public tile in the grid via
 *      Puppeteer's per-element clip API (single browser, two phases).
 *   2. Builds an HTML composition with proper Oxanium + Nunito Sans web fonts,
 *      scatters the tile screenshots at deterministic random positions and
 *      rotations, and centers the avatar + name + subtitle + /handle pill.
 *   3. Screenshots the composition at 1200×630 → PNG.
 *   4. Caches the result in Firebase Storage and 302-redirects clients there.
 *
 * Theme:
 *   - gridDoc.themeId === "light" → light tokens (white bg, dark text, soft shadows)
 *   - otherwise                     → dark  tokens (#10100e bg, white text, heavy shadows)
 *
 * Storage paths:
 *   og-images/slug/{slug}.png
 *   og-images/grid/{gridId}.png
 *
 * Query params:
 *   ?slug=matt      generates for grids.so/matt
 *   ?gridId=abc123  generates for grids.so/grid/abc123
 *   ?refresh=1      bypasses cache and regenerates
 *   ?check=1        existence probe — responds with JSON {exists, custom, url}
 *                   and NEVER generates. Used by the app's share-image modal.
 *   ?seed=foo       overrides the deterministic seed (slug/gridId) so you
 *                   can preview alternate scatter compositions for the same
 *                   grid; also bypasses cache.
 *   ?positions=A1,I1,B5,...
 *                   overrides tile anchor positions. Accepts letter-column +
 *                   1-based row (A1 = col 0, row 0) or numeric col-row
 *                   (0-0, 8-0). Bypasses cache.
 *   ?minCov=0.20    override minimum tile-coverage fraction (default 0.20)
 *   ?maxCov=0.60    override maximum tile-coverage fraction (default 0.60)
 */

import * as functions from "firebase-functions/v1";
import admin from "firebase-admin";
import type { Request, Response } from "firebase-functions/v1";
import { respondWithMaintenanceIfEnabled } from "../maintenance.js";
import {
  getFirestoreRestBase,
  getStorageBucket,
} from "../shared/utils_projectConfig.js";
import { launchChromiumBrowser } from "./utils_browser.js";

// chromium and puppeteer are lazy-loaded inside the handler so the Firebase
// CLI's function-introspection server doesn't time out at deploy time.

// ─── Constants ────────────────────────────────────────────────────────────────

// Grids icon — pre-rasterised from the brand SVG so no runtime SVG rendering needed.
// Generated from: functions/src/assets/grids-icon.svg → 96×96 PNG → base64
const GRIDS_ICON_B64 =
  "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";

const BUCKET_NAME = getStorageBucket();
const FIRESTORE_BASE = getFirestoreRestBase();
const SITE_BASE = "https://grids.so";

// Output dimensions (Twitter / Slack / Discord / iMessage all expect 1200×630).
const OG_W = 1200;
const OG_H = 630;

// The vignette + meta block live inside a 1012×630 frame centered on the
// canvas (Figma `meta_content` frame). 94px outer gutter on each side
// stays un-vignetted so tiles at the very edge of the OG show full-bleed.
const VIGNETTE_INSET = (OG_W - 1012) / 2; // 94

// Viewport used when capturing per-tile screenshots from the live grid page.
const TILE_VIEWPORT_W = 1524;
const TILE_VIEWPORT_H = 940;

// Min/max number of tiles to scatter. We always aim for MAX. If a grid has
// fewer than MIN eligible tiles we fall back to the empty composition.
// After selection, if the combined tile area is below MIN_COVERAGE or above
// MAX_COVERAGE (as fractions of the tile section area) we either render empty
// or trim tiles down to fit.
const MIN_SCATTER_TILES = 6;
const MAX_SCATTER_TILES = 20;

// Coverage thresholds — fractions of the tile section area (left + right thirds).
// Each tile section is OG_W/3 × OG_H; combined = 2 × 400 × 630 = 504 000 px².
const TILE_SECTION_AREA = 2 * (OG_W / 3) * OG_H;
const MIN_COVERAGE = 0.20;
const MAX_COVERAGE = 0.60;

// Tiles are rendered at this fraction of their on-grid pixel size so the
// composition feels intentional and tile→tile size relationships survive.
const TILE_SCALE = 0.6;

// ─── Seed grid (12 cols × 7 rows) ────────────────────────────────────────────
// The OG canvas is divided into a 12×7 cell grid. Columns A–D are the LEFT
// tile section, E–H are the META section (no tiles), and I–L are the RIGHT
// tile section. Row 4 is the META horizontal band (no tiles).
//
// Each tile has a deterministic anchor cell — tile N goes into SEED_POSITIONS[N-1].
// When we render fewer than 20 tiles we still fill them in this exact order so
// the first cells (1, 2, 3, …) are always the highest-priority anchor points.

const SEED_COLS = 12;
const SEED_ROWS = 7;
const SEED_CELL_W = OG_W / SEED_COLS; // 100 px
const SEED_CELL_H = OG_H / SEED_ROWS; // 90 px

// [colIndex, rowIndex] — both 0-based. A=0, L=11. Row 1=0, Row 7=6.
// Mirrors the "OG Layout Tile Seed Locations" Figma diagram.
const SEED_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], //  1: B1
  [11, 0], //  2: L1
  [0, 5], //  3: A6
  [11, 5], //  4: L6
  [0, 3], //  5: A4
  [11, 2], //  6: L3
  [0, 1], //  7: A2
  [10, 0], //  8: K1
  [1, 6], //  9: B7
  [10, 6], // 10: K7
  [1, 2], // 11: A6
  [11, 3], // 12: L4
  [1, 4], // 13: B5
  [10, 4], // 14: K5
  [0, 2], // 15: C6
  [10, 1], // 16: K2
  [1, 5], // 17: B6
  [10, 5], // 18: K6
  [0, 0], // 19: A1
  [10, 3], // 20: K4
];

/**
 * Parse a `?positions=` query string into an array of `[col, row]` pairs.
 *
 * Accepts two formats (mixed freely within a single value):
 *   Letter-based:  A1  → [0, 0],  L7  → [11, 6]   (col A-L, row 1-7)
 *   Numeric:       0-0 → [0, 0],  11-6 → [11, 6]  (col-row, 0-based)
 *
 * Returns `null` when the string is empty/undefined or contains no valid
 * entries, so the caller can fall back to the default SEED_POSITIONS.
 */
export function parsePositions(
  raw: string | undefined
): ReadonlyArray<readonly [number, number]> | null {
  if (!raw) return null;
  const letterPattern = /^([A-L])(\d)$/i;
  const numericPattern = /^(\d{1,2})-(\d{1,2})$/;
  const COL_LETTERS = "ABCDEFGHIJKL";

  const entries: Array<readonly [number, number]> = [];
  for (const token of raw.split(",")) {
    const t = token.trim();
    const lm = letterPattern.exec(t);
    if (lm) {
      const col = COL_LETTERS.indexOf(lm[1].toUpperCase());
      const row = parseInt(lm[2], 10) - 1; // 1-based → 0-based
      if (col >= 0 && col < SEED_COLS && row >= 0 && row < SEED_ROWS) {
        entries.push([col, row] as const);
      }
      continue;
    }
    const nm = numericPattern.exec(t);
    if (nm) {
      const col = parseInt(nm[1], 10);
      const row = parseInt(nm[2], 10);
      if (col >= 0 && col < SEED_COLS && row >= 0 && row < SEED_ROWS) {
        entries.push([col, row] as const);
      }
    }
  }
  return entries.length > 0 ? entries : null;
}

// ─── Theme tokens ────────────────────────────────────────────────────────────
// Mapped 1-to-1 from the Figma OG Image variables (`OG DarkShadow`, `OG Shadow`,
// `grid_background`, `content_full`, `content_low`, `tile_background`).

interface ThemeTokens {
  gridBackground: string;
  contentFull: string;
  contentLow: string;
  tileBackground: string;
  tileShadow: string;
  slugShadow: string;
  avatarStroke: string;
  avatarStrokeWidth: number;
  /** filter:drop-shadow() chain matching Figma's avatar_*_ogShadow */
  avatarShadow: string;
  /** CSS color stop used as the opaque end of the radial-gradient vignette */
  vignetteColor: string;
  /** `text-shadow` applied to the subtitle (CEO & FOUNDER row) */
  subtitleTextShadow: string;
}

// Each shadow layer is replicated as both `box-shadow` (tiles) and
// `filter: drop-shadow()` (avatar) — same offsets/blurs, different syntax.
const DARK_AVATAR_SHADOW = [
  "drop-shadow(0 3.318px 7.238px rgba(0, 0, 0, 1))",
  "drop-shadow(0 13.27px 13.27px rgba(0, 0, 0, 0.89))",
  "drop-shadow(0 30.16px 18.10px rgba(0, 0, 0, 0.55))",
  "drop-shadow(0 53.69px 21.41px rgba(0, 0, 0, 0.21))",
  "drop-shadow(0 83.54px 23.52px rgba(0, 0, 0, 0.08))",
].join(" ");

const LIGHT_AVATAR_SHADOW = [
  "drop-shadow(0 3.318px 7.238px rgba(0, 0, 0, 0.21))",
  "drop-shadow(0 13.27px 13.27px rgba(0, 0, 0, 0.13))",
  "drop-shadow(0 30.16px 18.10px rgba(0, 0, 0, 0.08))",
  "drop-shadow(0 53.69px 21.41px rgba(0, 0, 0, 0.03))",
  "drop-shadow(0 83.54px 23.52px rgba(0, 0, 0, 0))",
].join(" ");

const DARK_THEME: ThemeTokens = {
  gridBackground: "#10100e",
  contentFull: "#ffffff",
  contentLow: "rgba(255, 255, 255, 0.21)",
  tileBackground: "#000000",
  tileShadow: [
    "0 3.318px 7.238px rgba(0, 0, 0, 55)",
    "0 13.27px 13.27px rgba(0, 0, 0, 0.34)",
    "0 30.16px 18.10px rgba(0, 0, 0, 0.21)",
    "0 53.69px 21.41px rgba(0, 0, 0, 0.13)",
    "0 83.54px 23.52px rgba(0, 0, 0, 0.08)",
  ].join(", "),
  slugShadow: [
    "0 0.765px 1.668px rgba(0, 0, 0, 0.10)",
    "0 3.058px 3.058px rgba(0, 0, 0, 0.09)",
    "0 6.951px 4.171px rgba(0, 0, 0, 0.05)",
    "0 12.373px 4.935px rgba(0, 0, 0, 0.01)",
  ].join(", "),
  avatarStroke: "rgba(255, 255, 255, 0.14)",
  avatarStrokeWidth: 4,
  avatarShadow: DARK_AVATAR_SHADOW,
  vignetteColor: "rgba(16, 16, 14, 1)",
  subtitleTextShadow: "0 1px 0 rgba(255, 255, 255, 0.44)",
};

const LIGHT_THEME: ThemeTokens = {
  gridBackground: "#ffffff",
  contentFull: "#33312c",
  contentLow: "rgba(51, 49, 44, 0.34)",
  tileBackground: "#ffffff",
  tileShadow: [
    "0 3.318px 7.238px rgba(0, 0, 0, 0.10)",
    "0 13.27px 13.27px rgba(0, 0, 0, 0.09)",
    "0 30.16px 18.10px rgba(0, 0, 0, 0.05)",
    "0 53.69px 21.41px rgba(0, 0, 0, 0.01)",
    "0 83.54px 23.52px rgba(0, 0, 0, 0)",
  ].join(", "),
  slugShadow: [
    "0 0.765px 1.668px rgba(0, 0, 0, 0.10)",
    "0 3.058px 3.058px rgba(0, 0, 0, 0.09)",
    "0 6.951px 4.171px rgba(0, 0, 0, 0.05)",
    "0 12.373px 4.935px rgba(0, 0, 0, 0.01)",
  ].join(", "),
  avatarStroke: "rgba(51, 49, 44, 0.10)",
  avatarStrokeWidth: 4,
  avatarShadow: LIGHT_AVATAR_SHADOW,
  vignetteColor: "rgba(255, 255, 255, 1)",
  subtitleTextShadow: "0 1px 0 rgba(255, 255, 255, 0.44)",
};

export function themeFor(themeId: string | undefined): ThemeTokens {
  return themeId === "light" ? LIGHT_THEME : DARK_THEME;
}

/**
 * Parse a `?minCov=` / `?maxCov=` query value, falling back to the supplied
 * default when the value is missing or not a finite number.
 */
export function parseCoverageOverride(
  raw: string | undefined,
  fallback: number
): number {
  const parsed = parseFloat(raw as string);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// ─── Firestore REST helpers ──────────────────────────────────────────────────

type FsValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { nullValue: null }
  | { arrayValue: { values?: FsValue[] } }
  | { mapValue: { fields?: Record<string, FsValue> } };

function parseValue(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v)
    return (v.arrayValue.values ?? []).map((item) => parseValue(item));
  if ("mapValue" in v) {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v.mapValue.fields ?? {}))
      out[k] = parseValue(val);
    return out;
  }
  return null;
}

function parseDoc(raw: {
  fields?: Record<string, FsValue>;
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw.fields ?? {})) out[k] = parseValue(v);
  return out;
}

async function firestoreGet(
  collection: string,
  id: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `${FIRESTORE_BASE}/${collection}/${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    return parseDoc(await res.json());
  } catch {
    return null;
  }
}

// ─── TipTap rich-text → plain text ───────────────────────────────────────────
// Profile-tile fields (name, title) are stored as serialised TipTap JSON.

export function extractTiptapText(raw: unknown): string {
  if (typeof raw === "string") {
    try {
      return extractTiptapText(JSON.parse(raw));
    } catch {
      return raw.trim();
    }
  }
  if (!raw || typeof raw !== "object") return "";
  const node = raw as Record<string, unknown>;
  if (typeof node.text === "string") return node.text;
  const children = (node.content as unknown[]) ?? [];
  return children
    .map((c) => extractTiptapText(c))
    .join("")
    .trim();
}

// ─── Custom OG image resolution ──────────────────────────────────────────────

/**
 * Returns the grid owner's custom OG image URL (grid doc `ogImageSrc`) for
 * the requested slug/gridId, or null when none is set. A custom image always
 * wins over the generated pipeline — including `?refresh=1` — so user
 * uploads can never be clobbered by a regeneration.
 */
async function resolveCustomOgImageUrl(
  slug: string | undefined,
  gridId: string | undefined
): Promise<string | null> {
  let gridDoc: Record<string, unknown> | null = null;
  if (gridId) {
    gridDoc = await firestoreGet("grids", gridId);
  } else if (slug) {
    const slugDoc = await firestoreGet("slugs", slug.toLowerCase());
    const defaultGridId = slugDoc?.defaultGridId as string | undefined;
    if (defaultGridId) gridDoc = await firestoreGet("grids", defaultGridId);
  }
  const src = gridDoc?.ogImageSrc;
  return typeof src === "string" && src.length > 0 ? src : null;
}

// ─── Grid info resolution ────────────────────────────────────────────────────

interface GridInfo {
  screenshotUrl: string;
  themeId: string;
  avatarUrl: string | null;
  avatarShape: "circle" | "square" | "polygon";
  avatarSides: number;
  displayName: string;
  handle: string | null;
  subtitle: string | null;
  /** Indices (in DOM/layout order) of tiles to skip when scattering — typically the profile tile. */
  skipTileIndices: number[];
  /** Stable seed for deterministic scatter (so a given grid always renders the same layout). */
  seed: string;
}

async function resolveGridInfo(
  slug: string | undefined,
  gridId: string | undefined,
  screenshotBase: string
): Promise<GridInfo | null> {
  // Resolve which grid doc to load.
  let gridDoc: Record<string, unknown> | null = null;
  let resolvedHandle: string | null = null;
  let resolvedScreenshotUrl: string;
  let seed: string;

  if (slug) {
    const slugDoc = await firestoreGet("slugs", slug.toLowerCase());
    if (!slugDoc) return null;
    const defaultGridId = slugDoc.defaultGridId as string | undefined;
    if (!defaultGridId) return null;
    gridDoc = await firestoreGet("grids", defaultGridId);
    resolvedHandle = slug;
    resolvedScreenshotUrl = `${screenshotBase}/${slug}`;
    seed = `slug:${slug}`;
  } else if (gridId) {
    gridDoc = await firestoreGet("grids", gridId);
    resolvedScreenshotUrl = `${screenshotBase}/grid/${gridId}`;
    seed = `grid:${gridId}`;
  } else {
    return null;
  }
  if (!gridDoc) return null;

  const tiles = (gridDoc.tiles ?? []) as Array<Record<string, unknown>>;

  // Find profile tile (for avatar + name + title) and remember its index.
  const profileIdx = tiles.findIndex(
    (t) => (t?.content as Record<string, unknown> | undefined)?.type === "profile"
  );
  const profileContent =
    profileIdx >= 0
      ? ((tiles[profileIdx]?.content ?? {}) as Record<string, unknown>)
      : {};

  const displayName =
    extractTiptapText(profileContent.name) ||
    (gridDoc.name as string | undefined) ||
    resolvedHandle ||
    "Untitled Grid";
  const subtitle = extractTiptapText(profileContent.title) || null;

  return {
    screenshotUrl: resolvedScreenshotUrl,
    themeId: (gridDoc.themeId as string | undefined) ?? "dark",
    avatarUrl: (profileContent.profilePhotoUrl as string) || null,
    avatarShape:
      (profileContent.avatarShape as GridInfo["avatarShape"]) || "circle",
    avatarSides: (profileContent.avatarSides as number) || 6,
    displayName,
    handle: resolvedHandle,
    subtitle,
    skipTileIndices: profileIdx >= 0 ? [profileIdx] : [],
    seed,
  };
}

// ─── Seeded PRNG (Mulberry32 + FNV-1a) ───────────────────────────────────────
// Deterministic so the same grid always gets the same scatter pattern.

export function fnv1a(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Avatar SVG (clipped + stroked to user's chosen shape) ──────────────────

function roundedPolygonPath(
  cx: number,
  cy: number,
  radius: number,
  n: number,
  cornerRadius: number
): string {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  });

  let d = "";
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];

    const in0 = { x: p0.x - p1.x, y: p0.y - p1.y };
    const in2 = { x: p2.x - p1.x, y: p2.y - p1.y };
    const len0 = Math.hypot(in0.x, in0.y);
    const len2 = Math.hypot(in2.x, in2.y);

    const cr = Math.min(cornerRadius, len0 / 2, len2 / 2);
    const start = {
      x: p1.x + (in0.x / len0) * cr,
      y: p1.y + (in0.y / len0) * cr,
    };
    const end = {
      x: p1.x + (in2.x / len2) * cr,
      y: p1.y + (in2.y / len2) * cr,
    };

    d += i === 0 ?
      `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}` :
      ` L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
    d += ` Q ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }
  d += " Z";
  return d;
}

function avatarSvg(
  size: number,
  shape: GridInfo["avatarShape"],
  sides: number,
  imageHref: string,
  theme: ThemeTokens
): string {
  const stroke = theme.avatarStroke;
  const sw = theme.avatarStrokeWidth;
  // Inset the clip path slightly so the stroke isn't clipped at the edge.
  const inset = sw / 2;
  const r = size / 2;

  let pathD: string;
  if (shape === "circle") {
    // Circle approximated as a path so the same stroke pipeline works.
    const rr = r - inset;
    pathD =
      `M ${r - rr} ${r}` +
      ` A ${rr} ${rr} 0 1 0 ${r + rr} ${r}` +
      ` A ${rr} ${rr} 0 1 0 ${r - rr} ${r} Z`;
  } else if (shape === "polygon") {
    const n = Math.max(3, sides);
    const cornerRadius = Math.max(16, Math.round(r * 0.18));
    pathD = roundedPolygonPath(r, r, r - inset, n, cornerRadius);
  } else {
    // square — rounded corners (~12% of size, minimum 16px).
    const rx = Math.max(16, Math.round(size * 0.12));
    const x0 = inset;
    const x1 = size - inset;
    pathD =
      `M ${x0 + rx} ${x0}` +
      ` L ${x1 - rx} ${x0}` +
      ` Q ${x1} ${x0} ${x1} ${x0 + rx}` +
      ` L ${x1} ${x1 - rx}` +
      ` Q ${x1} ${x1} ${x1 - rx} ${x1}` +
      ` L ${x0 + rx} ${x1}` +
      ` Q ${x0} ${x1} ${x0} ${x1 - rx}` +
      ` L ${x0} ${x0 + rx}` +
      ` Q ${x0} ${x0} ${x0 + rx} ${x0} Z`;
  }

  const clipId = `avClip-${Math.floor(Math.random() * 1e9)}`;

  return `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${size}" height="${size}"
         viewBox="0 0 ${size} ${size}">
      <defs>
        <clipPath id="${clipId}"><path d="${pathD}"/></clipPath>
      </defs>
      ${
        imageHref ?
          `<image href="${imageHref}" width="${size}" height="${size}"
                 preserveAspectRatio="xMidYMid slice"
                 clip-path="url(#${clipId})" />` :
          ""
      }
      <path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${sw}" />
    </svg>
  `;
}

// ─── HTML escape ─────────────────────────────────────────────────────────────

function htmlEsc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Storage public URL ──────────────────────────────────────────────────────

/** Cloud Storage emulator host (host:port, optionally with scheme), if running. */
function storageEmulatorHost(): string | undefined {
  return (
    process.env.STORAGE_EMULATOR_HOST ??
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ??
    undefined
  );
}

function storageUrl(path: string): string {
  // When the Storage emulator is running, the admin SDK writes objects there,
  // so download URLs must point at the emulator rather than production GCS.
  const emulatorHost = storageEmulatorHost();
  if (emulatorHost) {
    const origin = emulatorHost.startsWith("http")
      ? emulatorHost
      : `http://${emulatorHost}`;
    return `${origin}/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(path)}?alt=media`;
  }
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET_NAME}/o/${encodeURIComponent(path)}?alt=media`;
}

/** Stream a PNG inline — used in the emulator so browser tabs show a preview. */
function sendOgImageInline(res: Response, image: Buffer): void {
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Disposition", "inline");
  res.end(image);
}

async function sendCachedOgImageInline(
  file: { download: () => Promise<[Buffer]> },
  res: Response
): Promise<void> {
  const [buf] = await file.download();
  sendOgImageInline(res, buf);
}

// ─── Per-tile capture from the live grid page ────────────────────────────────

interface CapturedTile {
  /** base64 PNG data (no `data:` prefix) */
  base64: string;
  /** natural rendered width — used to preserve aspect ratio */
  width: number;
  /** natural rendered height */
  height: number;
  /** ContentType value from the grid app (`music`, `map`, `link`, etc.) */
  type: string;
  /** tile column span (1-12) */
  cols: number;
  /** tile row span (1-10) */
  rows: number;
}

/**
 * Skip tiles whose footprint is larger than this in either axis. Big tiles
 * (5×5 dashboards, hero embeds, etc.) tend to dominate the OG composition
 * and eat the seed grid; we want a denser scatter of smaller content.
 */
const MAX_TILE_SPAN = 4;

/**
 * Categories the OG composition tries to include before doubling up. Order
 * controls the priority when seats are scarce — the first category present
 * in the grid is guaranteed a slot first, then the next, and so on.
 */
const PRIORITY_CATEGORIES = [
  "music",
  "map",
  "visual",
  "link",
  "text",
] as const;
type Category = (typeof PRIORITY_CATEGORIES)[number] | "other";

function categoryFor(type: string): Category {
  switch (type) {
    case "music":
      return "music";
    case "map":
      return "map";
    case "image":
    case "video":
    case "youtube":
      return "visual";
    case "link":
    case "embed":
      return "link";
    case "text":
    case "smart_text":
    case "chat":
      return "text";
    default:
      return "other";
  }
}

/** Strip trailing slash from the screenshot base URL. Host is kept as-is — do not
 * rewrite localhost to 127.0.0.1; Vite often binds IPv6-only (localhost → ::1)
 * and an explicit 127.0.0.1 URL will get ERR_CONNECTION_REFUSED. */
export function normalizeScreenshotBaseUrl(raw: string): string {
  return raw.replace(/\/$/, "");
}

function gridContainerWaitMs(): number {
  // Local Vite cold starts + Firebase emulator round-trips can exceed 20s.
  return process.env.FUNCTIONS_EMULATOR === "true" ? 60_000 : 20_000;
}

/** Whether ?refresh= should bypass the Storage cache and regenerate. */
export function parseRefreshQuery(raw: unknown): boolean {
  const value = String(raw ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

async function isScreenshotPageReachable(pageUrl: string): Promise<boolean> {
  try {
    const res = await fetch(pageUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function captureGridTiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  pageUrl: string,
  skipIndices: number[]
): Promise<CapturedTile[]> {
  if (!(await isScreenshotPageReachable(pageUrl))) {
    functions.logger.warn(
      `[og] screenshot page unreachable at ${pageUrl}. ` +
        "Start the web app (npm run dev:emulators) and ensure " +
        "OG_SCREENSHOT_BASE_URL matches its host/port."
    );
    return [];
  }

  functions.logger.info(`[og] capturing tiles from ${pageUrl}`);

  try {
  // Allow images, fonts, AND video. Tile content (photos, link previews,
  // video first-frames) is what we're capturing — blocking media kills
  // every <video> tile and they render as opaque black rectangles.
  await page.setRequestInterception(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page.on("request", (req: any) => {
    req.continue();
  });

  // `domcontentloaded` is enough — the production app keeps long-lived
  // connections (Firebase, analytics) so `networkidle0` never resolves.
  // The explicit waits below (images, fonts, paint buffer) handle the
  // real "tiles are rendered" signal.
  await page.goto(pageUrl, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });

  await page.waitForSelector(".grid-container", {
    timeout: gridContainerWaitMs(),
  });

  // Strip UI chrome by walking from .grid-container up to <body> and removing
  // every sibling at each level. Also remove per-tile UI overlays (toolbars,
  // actions, captions, meta) so only the rendered tile content remains.
  await page.evaluate(() => {
    document
      .querySelectorAll(
        "#vue-devtools-anchor, #vite-plugin-vue-devtools, #__vite-plugin-vue-devtools, [id*='devtools'], [class*='devtools']"
      )
      .forEach((el: Element) => el.remove());

    const grid = document.querySelector(".grid-container");
    if (!grid) return;
    let node: Element | null = grid;
    while (node && node !== document.body) {
      const parent: HTMLElement | null = node.parentElement;
      if (parent) {
        (Array.from(parent.children) as Element[]).forEach((sibling) => {
          if (sibling !== node) sibling.remove();
        });
      }
      node = parent as Element | null;
    }

    // Hide per-tile editor chrome that survived the chrome-stripping walk.
    document
      .querySelectorAll(
        ".tile-actions-layer, .tile-toolbar-layer, .header-options, .meta-data, .resize-indicator, .tile-caption"
      )
      .forEach((el: Element) => ((el as HTMLElement).style.display = "none"));

    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
  });

  await page.addStyleTag({
    content:
      "::-webkit-scrollbar { display: none !important; } body { overflow: hidden !important; margin: 0 !important; }",
  });

  // Resize the viewport to fit the entire grid BEFORE waiting on images.
  // Two reasons:
  //   1. Tiles below the original 940px fold have to be inside the screenshot
  //      or sharp throws "bad extract area".
  //   2. Tile images / dynamic components frequently use lazy loading +
  //      IntersectionObserver. If we wait on images while the tiles are
  //      below the fold they never start loading and we get blank rectangles.
  const docHeight: number = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      document.documentElement.offsetHeight,
      document.body.offsetHeight
    )
  );
  const captureHeight = Math.max(TILE_VIEWPORT_H, Math.ceil(docHeight) + 32);
  await page.setViewport({
    width: TILE_VIEWPORT_W,
    height: captureHeight,
    deviceScaleFactor: 1,
  });

  // Force-eager every image we know about and nudge any IntersectionObserver
  // listeners by scrolling the document. With the viewport sized to the full
  // grid, every tile is already in view — we just have to convince listeners
  // that wired up before the resize that yes, the tile is visible.
  await page.evaluate(() => {
    document.querySelectorAll("img").forEach((img) => {
      const el = img as HTMLImageElement;
      el.loading = "eager";
      // Some lazy-image libraries swap data-src → src on intersect; do it now.
      const dataSrc = el.dataset.src;
      if (dataSrc && !el.src) el.src = dataSrc;
    });
    // Prepare videos so their first frame actually decodes and paints by the
    // time we screenshot. Default `preload="metadata"` only fetches headers
    // and may never paint frame 0 for paused <video> elements — we need
    // `preload="auto"` plus a play+pause nudge below.
    document.querySelectorAll("video").forEach((v) => {
      const vid = v as HTMLVideoElement;
      vid.preload = "auto";
      vid.muted = true; // required by Chromium's autoplay policy for play()
      vid.playsInline = true;
      // If the element already errored (e.g. a previous load attempt was
      // aborted before this run), trigger a fresh load now that media
      // requests are allowed through.
      if (
        vid.error ||
        vid.networkState === HTMLMediaElement.NETWORK_NO_SOURCE
      ) {
        vid.load();
      }
    });
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("scroll"));
  });

  // Now wait for all tile images to finish loading.
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.querySelectorAll(".grid-container img")).map(
        (img: Element) =>
          (img as HTMLImageElement).complete ?
            Promise.resolve() :
            new Promise((r) => {
              img.addEventListener("load", r, { once: true });
              img.addEventListener("error", r, { once: true });
            })
      )
    )
  );

  // Web fonts inside tiles (text, profile, etc.) need to settle.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fonts = (document as any).fonts;
    return fonts && fonts.ready ? fonts.ready : Promise.resolve();
  });

  // Generous paint buffer — tile components mount asynchronously via dynamic
  // import, and link previews fetch metadata after that. 4s gives slow tile
  // types (embeds, link previews, dynamic charts) time to land.
  await new Promise((r) => setTimeout(r, 4_000));

  // Final image sweep — by now any deferred / dynamic-import tiles have
  // mounted and inserted their own <img> elements. Wait for those too.
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.querySelectorAll(".grid-container img")).map(
        (img: Element) =>
          (img as HTMLImageElement).complete ?
            Promise.resolve() :
            new Promise((r) => {
              img.addEventListener("load", r, { once: true });
              img.addEventListener("error", r, { once: true });
              setTimeout(r, 1_500);
            })
      )
    )
  );

  // Wait for videos to reach HAVE_CURRENT_DATA (readyState >= 2) — i.e. the
  // first frame has been decoded and is available to paint. Without this
  // gate, screenshots capture the default empty <video> rectangle (black).
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.querySelectorAll(".grid-container video")).map(
        (v: Element) => {
          const vid = v as HTMLVideoElement;
          if (vid.readyState >= 2) return Promise.resolve();
          if (vid.error) return Promise.resolve(); // genuinely broken — let blank-tile filter drop it
          return new Promise((r) => {
            const done = (): void => {
              vid.removeEventListener("loadeddata", done);
              vid.removeEventListener("error", done);
              r(undefined);
            };
            vid.addEventListener("loadeddata", done, { once: true });
            vid.addEventListener("error", done, { once: true });
            // Hard ceiling so a single slow video can't blow the 90s
            // function budget. Tiles still missing first-frame data will
            // be filtered out by the per-tile videosReady gate below.
            setTimeout(done, 6_000);
          });
        }
      )
    )
  );

  // Seek each video past any fade-in / production-logo intro so the
  // captured frame has actual content. Empirically many uploaded clips
  // open with ~0.5–0.8s of black or a logo splash, which would otherwise
  // be scattered as flat dark rectangles in the OG.
  //
  // Target = min(0.8s, 15% of duration) so very short clips don't get
  // seeked past meaningful content. We also still play()+pause() after
  // the seek because some Chromium builds won't flush the first decoded
  // frame to the compositor for a paused video until play() runs at
  // least once. Videos are muted so autoplay policy allows play().
  await page.evaluate(async () => {
    const videos = Array.from(
      document.querySelectorAll(".grid-container video")
    ) as HTMLVideoElement[];
    await Promise.all(
      videos.map(async (vid) => {
        try {
          vid.muted = true;

          const dur = isFinite(vid.duration) ? vid.duration : 0;
          const target = dur > 0 ? Math.min(0.8, dur * 0.15) : 0.5;
          if (vid.readyState >= 2 && vid.currentTime < target) {
            await new Promise((r) => {
              const done = (): void => {
                vid.removeEventListener("seeked", done);
                vid.removeEventListener("error", done);
                r(undefined);
              };
              vid.addEventListener("seeked", done, { once: true });
              vid.addEventListener("error", done, { once: true });
              setTimeout(done, 1500);
              vid.currentTime = target;
            });
          }

          try {
            await vid.play();
            vid.pause();
          } catch {
            // play() rejection (autoplay policy, src error). Seeked frame
            // should still composite; if not, the tile filters drop it.
          }
        } catch {
          /* fall through — blank-tile filter handles unrendered videos */
        }
      })
    );
  });

  // Small settle so the seeked-and-paused frame is definitely composited.
  await new Promise((r) => setTimeout(r, 250));

  // CRITICAL: read rects + take screenshot back-to-back inside the page
  // context. If we screenshot first and read rects later (or vice-versa with
  // any awaitable Node work in between), a slow tile image can finish loading
  // between the two and shift layout. The rects then point to regions that
  // no longer match what was screenshotted → half-rendered tiles where the
  // extract straddles two layout positions. We do them as one evaluate +
  // screenshot pair with no awaitable Node work in between.
  interface TileMeta {
    x: number;
    y: number;
    w: number;
    h: number;
    type: string;
    cols: number;
    rows: number;
    /** true if the tile's `.card-body` contains any visible content */
    hasContent: boolean;
    /** true if every <img> inside has finished loading (naturalWidth > 0) */
    imagesReady: boolean;
    /** true if every <video> inside reached readyState>=2 and has nonzero dimensions */
    videosReady: boolean;
  }
  const rects: Array<TileMeta | null> = await page.evaluate(() => {
    window.scrollTo(0, 0);
    const sx = window.scrollX || 0;
    const sy = window.scrollY || 0;
    const items = Array.from(
      document.querySelectorAll(".vue-grid-item")
    ) as HTMLElement[];

    // First pass: find the smallest non-trivial tile rect. Vue3-grid-layout
    // sizes tiles as `cols * unitW + (cols-1) * marginX` so the smallest
    // rect should be a 1×1 tile. We use that as the cell unit when the
    // explicit data-tile-w/h attributes are missing.
    let unitW = Infinity;
    let unitH = Infinity;
    for (const item of items) {
      const r = item.getBoundingClientRect();
      if (r.width > 16 && r.width < unitW) unitW = r.width;
      if (r.height > 16 && r.height < unitH) unitH = r.height;
    }
    if (!isFinite(unitW)) unitW = 0;
    if (!isFinite(unitH)) unitH = 0;

    // Class-based type detection — catches builds that haven't yet
    // deployed the data-tile-type attribute on .tile-wrapper. Each tile
    // content component renders a unique outer class we can look for.
    // Order matters: more specific classes first so e.g. an embed tile
    // that contains an <img> is still classified as "embed", not "image".
    const TYPE_CLASS_MAP: Array<[string, string]> = [
      [".music-player", "music"],
      [".map-tile", "map"],
      [".youtube-content", "youtube"],
      [".video-container", "video"],
      [".link-tile-content", "link"],
      [".embed-wrapper", "embed"],
      [".roadmap-feed", "roadmap_feed"],
      [".chat-tile", "chat"],
      [".profile-bio", "profile"],
      [".image-container", "image"],
      [".text-container", "text"],
    ];

    return items.map((item) => {
      const wrapper = item.querySelector(
        ".tile-wrapper"
      ) as HTMLElement | null;
      const card =
        (item.querySelector(".card-body") as HTMLElement | null) ?? wrapper;
      if (!card) return null;
      const r = card.getBoundingClientRect();

      let type = wrapper?.dataset.tileType ?? "";
      let typeRoot: Element | null = null;
      for (const [sel, t] of TYPE_CLASS_MAP) {
        const found = card.querySelector(sel);
        if (found) {
          typeRoot = found;
          if (!type) type = t;
          break;
        }
      }

      const colsAttr = Number(wrapper?.dataset.tileW ?? 0) || 0;
      const rowsAttr = Number(wrapper?.dataset.tileH ?? 0) || 0;
      // Estimate cols/rows from the rendered .vue-grid-item rect when the
      // explicit attributes aren't deployed yet. Round to nearest int.
      const itemRect = item.getBoundingClientRect();
      const colsEst =
        unitW > 0 ? Math.max(1, Math.round(itemRect.width / unitW)) : 0;
      const rowsEst =
        unitH > 0 ? Math.max(1, Math.round(itemRect.height / unitH)) : 0;
      const cols = colsAttr || colsEst;
      const rows = rowsAttr || rowsEst;

      // DOM-based blank check — does the tile actually render anything?
      // Catches dynamic components that never resolved (the .card-body
      // is still empty waiting on a dynamic import). If the content
      // component HAS mounted (`typeRoot` is non-null) we trust it —
      // mapbox / link previews / etc. populate their inner DOM async,
      // and the pixel-based stdev check below is the real backstop for
      // truly blank captures.
      const hasMedia = !!card.querySelector(
        "img, svg, video, canvas, picture, iframe"
      );
      const text = (card.textContent || "").trim();
      const hasContent = !!typeRoot || hasMedia || text.length > 0;

      // Per-tile image readiness — if any <img> hasn't finished decoding
      // (naturalWidth === 0) then the screenshot will show that image as
      // empty space inside an otherwise-laid-out tile, producing the
      // "half rendered" look. Skip these tiles and let other capture
      // cycles (or the next deploy) catch them.
      const imgs = Array.from(
        card.querySelectorAll("img")
      ) as HTMLImageElement[];
      const imagesReady = imgs.every(
        (img) => img.complete && img.naturalWidth > 0
      );

      // Per-tile video readiness — drop tiles whose <video> never reached
      // HAVE_CURRENT_DATA or has 0×0 dimensions. Without this gate broken
      // videos render as opaque black rectangles in the OG: videos with
      // networkState NETWORK_NO_SOURCE were sailing through and producing
      // flat black tiles.
      const videosInTile = Array.from(
        card.querySelectorAll("video")
      ) as HTMLVideoElement[];
      const videosReady = videosInTile.every(
        (vid) => vid.readyState >= 2 && vid.videoWidth > 0 && !vid.error
      );

      return {
        x: r.x + sx,
        y: r.y + sy,
        w: r.width,
        h: r.height,
        type,
        cols,
        rows,
        hasContent,
        imagesReady,
        videosReady,
      };
    });
  });

  // Now — with no awaits in between that could trigger lazy loaders or
  // shift the layout — take the full screenshot. The rects above describe
  // exactly this layout state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sharp: any = (await import("sharp")).default;
  const fullPng: Buffer = (await page.screenshot({
    type: "png",
    fullPage: false,
    omitBackground: false,
  })) as Buffer;

  const meta: { width?: number; height?: number } = await sharp(
    fullPng
  ).metadata();
  const imgW = meta.width ?? TILE_VIEWPORT_W;
  const imgH = meta.height ?? captureHeight;

  const skip = new Set(skipIndices);
  const captured: CapturedTile[] = [];

  for (let i = 0; i < rects.length; i++) {
    if (skip.has(i)) continue;
    const r = rects[i];
    if (!r || r.w < 16 || r.h < 16) continue;
    // Drop suggestion (placeholder) tiles — they're internal-only chrome.
    if (r.type === "suggestion") continue;
    // Drop tiles whose `.card-body` had no rendered media or text. Catches
    // tiles whose dynamic component never mounted, link previews that
    // failed to fetch, and profile / embed tiles with no content.
    if (!r.hasContent) {
      functions.logger.info(
        `[og] tile ${i} no rendered content (type=${r.type}) — skipping`
      );
      continue;
    }
    // Drop tiles that have <img> elements still decoding. Capturing them
    // produces "half renders" where the layout shows but the image hole
    // is blank. Better to drop and let another tile take the slot.
    if (!r.imagesReady) {
      functions.logger.info(
        `[og] tile ${i} images not loaded (type=${r.type}) — skipping`
      );
      continue;
    }
    // Same gate for <video> — without first-frame data the video element
    // composites as a flat black rectangle which then sneaks past the
    // pixel-stdev blank check thanks to corner anti-aliasing.
    if (!r.videosReady) {
      functions.logger.info(
        `[og] tile ${i} video not ready (type=${r.type}) — skipping`
      );
      continue;
    }
    // Drop oversized tiles. Anything wider/taller than MAX_TILE_SPAN cells
    // would dominate the OG and we're going for a scattered, varied feel.
    if (r.cols > MAX_TILE_SPAN || r.rows > MAX_TILE_SPAN) {
      functions.logger.info(
        `[og] tile ${i} too big (${r.cols}x${r.rows}) — skipping`
      );
      continue;
    }

    // Clamp to the actual screenshot bounds so sharp doesn't reject the
    // extract. With fullPage:true the screenshot height matches the doc
    // scrollHeight, so off-viewport tiles are included.
    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const w = Math.max(1, Math.floor(Math.min(r.w, imgW - x)));
    const h = Math.max(1, Math.floor(Math.min(r.h, imgH - y)));
    if (x >= imgW || y >= imgH) continue;

    try {
      const tileBuf: Buffer = await sharp(fullPng)
        .extract({ left: x, top: y, width: w, height: h })
        .png()
        .toBuffer();

      // Drop tiles that came out as a near-uniform color OR essentially
      // black. Causes:
      //   - dynamic component never resolved before the paint buffer
      //   - link/embed preview failed or hadn't fetched
      //   - tile genuinely has no rendered content (missing image, etc.)
      //   - video first frame is fade-in / production-logo black even
      //     after seeking past it (very short or all-dark clips)
      // Either way, scattering a flat dark rectangle in the OG looks worse
      // than just picking a different tile from the pool.
      const stats = await sharp(tileBuf).stats();
      const meaningfulChannels = stats.channels.slice(0, 3); // RGB only
      const lowStdev = meaningfulChannels.every(
        (ch: { stdev: number }) => ch.stdev < 4
      );
      // Mean luminance threshold catches near-black tiles where the
      // pixel-stdev is dragged up by anti-aliasing on the rounded
      // corners (~30) but the actual content is still essentially black.
      // 8/255 is dark enough that a real image/video frame will easily
      // clear it (dim-but-visible night scenes typically read 20–40+).
      const lowMean = meaningfulChannels.every(
        (ch: { mean: number }) => ch.mean < 8
      );
      const isBlank = lowStdev || lowMean;
      if (isBlank) {
        functions.logger.info(
          `[og] tile ${i} captured blank (type=${r.type}, ${r.cols}x${r.rows}) — skipping`
        );
        continue;
      }

      captured.push({
        base64: tileBuf.toString("base64"),
        width: w,
        height: h,
        type: r.type,
        cols: r.cols,
        rows: r.rows,
      });
    } catch (err) {
      functions.logger.warn(`[og] tile crop ${i} failed:`, err);
    }
  }

  return captured;
  } catch (err) {
    let diagnostics: Record<string, unknown> = {};
    try {
      diagnostics = await page.evaluate(() => ({
        title: document.title,
        href: location.href,
        hasGrid: !!document.querySelector(".grid-container"),
        hasLoading: !!document.querySelector(".loading-state"),
        hasError: !!document.querySelector(".error-state"),
        errorText:
          document.querySelector(".error-description")?.textContent?.trim() ??
          null,
      }));
    } catch {
      // Page may not have loaded enough to inspect.
    }

    functions.logger.warn("[og] tile capture failed — rendering meta-only layout", {
      pageUrl,
      error: err instanceof Error ? err.message : String(err),
      ...diagnostics,
    });
    return [];
  }
}

/**
 * Pick which captured tiles to scatter. Guarantees one tile from each
 * priority category (music, map, visual, link, text) before doubling up,
 * up to `MAX_SCATTER_TILES`. Selection inside each phase is driven by the
 * seeded RNG so the same grid produces the same OG.
 */
function selectScatterTiles(
  pool: CapturedTile[],
  rng: () => number,
  max: number
): CapturedTile[] {
  if (pool.length === 0) return [];

  // Deterministic shuffle — Fisher–Yates with the seeded RNG.
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const limit = Math.min(max, shuffled.length);
  const groups = new Map<Category, CapturedTile[]>();
  for (const t of shuffled) {
    const cat = categoryFor(t.type);
    let group = groups.get(cat);
    if (!group) {
      group = [];
      groups.set(cat, group);
    }
    group.push(t);
  }

  const selected: CapturedTile[] = [];
  const used = new Set<CapturedTile>();

  // Phase 1 — guarantee 1 of each priority category that exists in the grid.
  for (const cat of PRIORITY_CATEGORIES) {
    if (selected.length >= limit) break;
    const group = groups.get(cat);
    const t = group?.shift();
    if (t) {
      selected.push(t);
      used.add(t);
    }
  }

  // Phase 2 — fill remaining slots from the shuffled pool (any category,
  // including "other"), naturally doubling up once each priority category
  // has at least one representative.
  for (const t of shuffled) {
    if (selected.length >= limit) break;
    if (used.has(t)) continue;
    selected.push(t);
    used.add(t);
  }

  return selected;
}

// ─── Scatter layout: area-balanced sections + deterministic jitter ───────────

interface ScatterPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

// Section boundaries (column ranges, 0-based):
//   LEFT  = cols 0–2  (A–D)
//   META  = cols 3–8  (E–H) — center, behind the vignette
//   RIGHT = cols 9–11 (I–L)
type Section = "left" | "meta" | "right";

function sectionOf(col: number): Section {
  if (col <= 2) return "left";
  if (col >= 9) return "right";
  return "meta";
}

// Pre-split the default seed positions into per-section lists so the
// balancer can assign tiles into each bucket's indices independently.
function splitPositionsBySection(
  positions: ReadonlyArray<readonly [number, number]>
): Record<Section, Array<readonly [number, number]>> {
  const out: Record<Section, Array<readonly [number, number]>> = {
    left: [],
    meta: [],
    right: [],
  };
  for (const pos of positions) {
    out[sectionOf(pos[0])].push(pos);
  }
  return out;
}

/**
 * Area-balanced tile scatter.
 *
 * 1. Compute scaled width/height/area for every tile.
 * 2. Sort tiles by area descending (big → small).
 * 3. Greedy assignment: for each tile pick the section (left / right / meta)
 *    whose `totalArea / sectionCapacity` ratio is currently lowest —
 *    capacity = number of seed slots for that section.
 * 4. Within each section, tiles (still largest-first) are mapped 1:1 to that
 *    section's seed positions, jitter + rotation applied as usual.
 * 5. Global z-index: largest tile area = z 0 (back), smallest = highest z.
 *
 * When `positionsOverride` is provided (via `?positions=`) the override
 * positions are used directly in order (no balancing), preserving the manual
 * layout the user specified.
 */
function scatterTiles(
  tiles: CapturedTile[],
  rng: () => number,
  positionsOverride?: ReadonlyArray<readonly [number, number]> | null
): ScatterPlacement[] {
  if (tiles.length === 0) return [];

  const JITTER_FRACTION = 0.7;

  // Helper: place one tile at a seed cell with jitter + rotation.
  function place(
    t: CapturedTile,
    col: number,
    row: number
  ): ScatterPlacement {
    const w = t.width * TILE_SCALE;
    const h = t.height * TILE_SCALE;
    const cx = (col + 0.5) * SEED_CELL_W;
    const cy = (row + 0.5) * SEED_CELL_H;
    const jitterX = (rng() - 0.5) * SEED_CELL_W * JITTER_FRACTION;
    const jitterY = (rng() - 0.5) * SEED_CELL_H * JITTER_FRACTION;
    return {
      left: cx + jitterX - w / 2,
      top: cy + jitterY - h / 2,
      width: w,
      height: h,
      rotation: (rng() - 0.5) * 30,
      zIndex: 0,
    };
  }

  // ── Manual override path — honour the exact order provided ──
  if (positionsOverride && positionsOverride.length > 0) {
    const placements: ScatterPlacement[] = tiles.map((t, i) => {
      const [col, row] =
        positionsOverride[i % positionsOverride.length];
      return place(t, col, row);
    });
    assignZIndex(placements);
    return placements;
  }

  // ── Auto-balance path ──
  // Step 1+2: compute area per tile and sort descending.
  const indexed = tiles.map((t, origIdx) => ({
    tile: t,
    origIdx,
    area: t.width * TILE_SCALE * (t.height * TILE_SCALE),
  }));
  indexed.sort((a, b) => b.area - a.area);

  // Pre-split seed positions by section.
  const sectionSlots = splitPositionsBySection(SEED_POSITIONS);
  const SECTIONS: Section[] = ["left", "right", "meta"];
  const capacity: Record<Section, number> = {
    left: sectionSlots.left.length,
    right: sectionSlots.right.length,
    meta: sectionSlots.meta.length,
  };

  // Track running totals.
  const buckets: Record<Section, typeof indexed> = {
    left: [],
    right: [],
    meta: [],
  };
  const totalArea: Record<Section, number> = { left: 0, right: 0, meta: 0 };

  // Step 3: greedy assignment by lowest area/capacity ratio.
  for (const entry of indexed) {
    let bestSection: Section = SECTIONS[0];
    let bestRatio = Infinity;
    for (const sec of SECTIONS) {
      if (capacity[sec] === 0) continue;
      if (buckets[sec].length >= capacity[sec]) continue;
      const ratio = totalArea[sec] / capacity[sec];
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestSection = sec;
      }
    }
    // If all sections are full, wrap around to the one with lowest ratio.
    if (buckets[bestSection].length >= capacity[bestSection]) {
      bestRatio = Infinity;
      for (const sec of SECTIONS) {
        if (capacity[sec] === 0) continue;
        const ratio = totalArea[sec] / capacity[sec];
        if (ratio < bestRatio) {
          bestRatio = ratio;
          bestSection = sec;
        }
      }
    }
    buckets[bestSection].push(entry);
    totalArea[bestSection] += entry.area;
  }

  // Step 4: within each section, map tiles (largest→smallest, already sorted)
  // to that section's seed indices in order. Build the final placements array
  // indexed by the original tile order so HTML rendering stays consistent.
  const placements: ScatterPlacement[] = new Array(tiles.length);
  for (const sec of SECTIONS) {
    const slots = sectionSlots[sec];
    for (let i = 0; i < buckets[sec].length; i++) {
      const entry = buckets[sec][i];
      const [col, row] = slots[i % slots.length];
      placements[entry.origIdx] = place(entry.tile, col, row);
    }
  }

  // Step 5: z-index — largest area at back, smallest in front.
  assignZIndex(placements);
  return placements;
}

function assignZIndex(placements: ScatterPlacement[]): void {
  const byAreaDesc = placements
    .map((p, idx) => ({ idx, area: p.width * p.height }))
    .sort((a, b) => b.area - a.area);
  byAreaDesc.forEach((entry, z) => {
    placements[entry.idx].zIndex = z;
  });
}

// ─── HTML composition ────────────────────────────────────────────────────────

export function buildOgHtml(
  info: GridInfo,
  tiles: CapturedTile[],
  placements: ScatterPlacement[],
  theme: ThemeTokens
): string {
  const avatarSize = 200;
  const gridsIconDataUri = `data:image/png;base64,${GRIDS_ICON_B64}`;
  const avatarUrl = info.avatarUrl;
  const hasAvatar = Boolean(avatarUrl);

  const avatarMarkup =
    avatarUrl ?
      avatarSvg(
        avatarSize,
        info.avatarShape,
        info.avatarSides,
        avatarUrl,
        theme
      )
    : "";

  const scatterHtml = placements
    .map((p, i) => {
      const tile = tiles[i];
      if (!tile) return "";
      return `
        <div class="scatter-tile" style="
          left:${p.left.toFixed(2)}px;
          top:${p.top.toFixed(2)}px;
          width:${p.width.toFixed(2)}px;
          height:${p.height.toFixed(2)}px;
          transform: rotate(${p.rotation.toFixed(3)}deg);
          z-index:${p.zIndex};
        ">
          <img src="data:image/png;base64,${tile.base64}" alt="" />
        </div>
      `;
    })
    .join("\n");

  const slugRow = info.handle ?
    `
    <div class="slug-row">
      <div class="slug-icon"><img src="${gridsIconDataUri}" alt="" /></div>
      <div class="slug-text">/${htmlEsc(info.handle)}</div>
    </div>` :
    `
    <div class="slug-row">
      <div class="slug-icon"><img src="${gridsIconDataUri}" alt="" /></div>
    </div>`;

  const subtitleRow = info.subtitle ?
    `<div class="subtitle" id="subtitle">${htmlEsc(info.subtitle.toUpperCase())}</div>` :
    "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Oxanium:wght@800&family=Nunito+Sans:opsz,wght@6..12,900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: ${OG_W}px;
      height: ${OG_H}px;
      background: ${theme.gridBackground};
      overflow: hidden;
      position: relative;
      font-family: 'Nunito Sans', system-ui, sans-serif;
    }

    .scatter-tile {
      position: absolute;
      border-radius: 19.578px;
      overflow: hidden;
      background: ${theme.tileBackground};
      box-shadow: ${theme.tileShadow};
      transform-origin: center center;
    }
    .scatter-tile img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Vignette — radial gradient that darkens (or lightens, in light mode)
     * the center of the OG so any tile that bleeds into the meta area
     * fades out. Sits OVER the tiles and UNDER the meta. The frame is
     * the inner 1012px (94px margin per side) so tiles at the very edge
     * of the OG show through cleanly. Mapped 1:1 from the Figma SVG
     * radialGradient transform: matrix(50.6, 0, 0, 83.581, 506, 315). */
    .vignette {
      position: absolute;
      left: ${VIGNETTE_INSET}px;
      top: 0;
      width: ${OG_W - VIGNETTE_INSET * 2}px;
      height: ${OG_H}px;
      background: radial-gradient(
        ellipse 506px 835.81px at center,
        ${theme.vignetteColor} 41.348%,
        transparent 100%
      );
      z-index: 100;
      pointer-events: none;
    }

    /* Meta block — 1012×630 flex container centered on the canvas, with the
     * profile (avatar + name + title) centered and the slug row beneath.
     * Sits above the vignette. */
    .meta {
      position: absolute;
      left: ${VIGNETTE_INSET}px;
      top: 0;
      width: ${OG_W - VIGNETTE_INSET * 2}px;
      height: ${OG_H}px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 200;
      pointer-events: none;
    }

    .profile {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .profile.no-avatar .text-container {
      padding-top: 0;
    }

    .avatar {
      width: ${avatarSize}px;
      height: ${avatarSize}px;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: ${theme.avatarShadow};
    }
    .avatar svg { display: block; width: 100%; height: 100%; }

    .text-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 32px;
      width: 554px;
      max-width: 100%;
      position: relative;
      z-index: 1;
    }

    .name {
      font-family: 'Oxanium', system-ui, sans-serif;
      font-weight: 800;
      font-size: 76.478px;
      line-height: 82.516px;
      color: ${theme.contentFull};
      text-align: center;
      width: 554px;
      letter-spacing: -0.01em;
      margin: 0;
      word-break: break-word;
    }

    .subtitle {
      font-family: 'Nunito Sans', system-ui, sans-serif;
      font-weight: 900;
      font-size: 35.22px;
      line-height: 1;
      letter-spacing: 1.761px;
      color: ${theme.contentLow};
      text-align: center;
      text-transform: uppercase;
      white-space: nowrap;
      text-shadow: ${theme.subtitleTextShadow};
      margin: 0;
      width: 100%;
    }

    .slug-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding-top: 64px;
      position: relative;
      z-index: 1;
    }
    .slug-icon {
      width: 32px;
      height: 32px;
      background: ${theme.tileBackground};
      border-radius: 5.211px;
      box-shadow: ${theme.slugShadow};
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .slug-icon img { width: 100%; height: 100%; object-fit: cover; }
    .slug-text {
      font-family: 'Nunito Sans', system-ui, sans-serif;
      font-weight: 900;
      font-size: 35.22px;
      line-height: 32px;
      letter-spacing: 1.761px;
      color: ${theme.contentFull};
    }
  </style>
</head>
<body>
  ${scatterHtml}
  <div class="vignette"></div>
  <div class="meta">
    <div class="profile${hasAvatar ? "" : " no-avatar"}">
      ${hasAvatar ? `<div class="avatar">${avatarMarkup}</div>` : ""}
      <div class="text-container">
        <div class="name">${htmlEsc(info.displayName)}</div>
        ${subtitleRow}
      </div>
      ${slugRow}
    </div>
  </div>
  <script type="module">
    import { prepare, layout } from 'https://esm.sh/@chenglou/pretext';
    const el = document.getElementById('subtitle');
    if (el) {
      const text = el.textContent || '';
      const cs = getComputedStyle(el.parentElement);
      const maxW = el.parentElement.clientWidth
        - parseFloat(cs.paddingLeft)
        - parseFloat(cs.paddingRight);
      const LS = 1.761;
      let lo = 12, hi = 35.22;
      while (hi - lo > 0.25) {
        const mid = (lo + hi) / 2;
        const p = prepare(text, '900 ' + mid + 'px "Nunito Sans"', { letterSpacing: LS });
        const r = layout(p, maxW, mid);
        if (r.lineCount <= 1) lo = mid; else hi = mid;
      }
      if (lo < 35.22) {
        el.style.fontSize = lo.toFixed(2) + 'px';
        el.style.letterSpacing = LS + 'px';
      }
    }
    document.documentElement.dataset.subtitleReady = '1';
  </script>
</body>
</html>`;
}

// ─── OG render — screenshot the composition page ─────────────────────────────

async function renderOgImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  html: string
): Promise<Buffer> {
  // This page renders fonts and brand assets, so allow font/image loads.
  // The previous request interceptor (set during tile capture) is removed
  // by setting `setRequestInterception(false)` before calling this.
  await page.setViewport({
    width: OG_W,
    height: OG_H,
    deviceScaleFactor: 1,
  });

  // `domcontentloaded` — same rationale as tile capture: external font/CDN
  // requests (Google Fonts, esm.sh pretext) can keep connections open so
  // `networkidle0` never resolves within the timeout.
  const contentTimeout =
    process.env.FUNCTIONS_EMULATOR === "true" ? 45_000 : 25_000;
  await page.setContent(html, {
    waitUntil: "domcontentloaded",
    timeout: contentTimeout,
  });

  // Belt-and-braces: ensure web fonts are ready before we screenshot.
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fonts = (document as any).fonts;
    return fonts && fonts.ready ? fonts.ready : Promise.resolve();
  });

  // Wait for the pretext subtitle-fitting script to finish its binary
  // search and apply the computed font-size. The module script sets
  // data-subtitle-ready="1" on <html> when done (or immediately if
  // there is no subtitle).
  try {
    await page.waitForFunction(
      () => document.documentElement.dataset.subtitleReady === "1",
      { timeout: 8_000 }
    );
  } catch {
    // If the CDN script fails to load, proceed with default sizing.
  }

  await new Promise((r) => setTimeout(r, 300));

  return (await page.screenshot({ type: "png", omitBackground: false })) as Buffer;
}

// ─── Main handler ────────────────────────────────────────────────────────────

async function handler(req: Request, res: Response): Promise<void> {
  // Public image endpoint — allow cross-origin fetches. The app's share-image
  // modal calls this directly in emulator/dev setups (in production it goes
  // through the Vercel proxy, which sets its own CORS header).
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (respondWithMaintenanceIfEnabled("generateOgImage", res)) return;

  const slug = req.query.slug as string | undefined;
  const gridId = req.query.gridId as string | undefined;
  const refresh = parseRefreshQuery(req.query.refresh);
  // Existence probe — report whether an OG image exists without generating.
  const check = req.query.check === "1";
  // Optional override seed — useful for previewing alternate scatter
  // compositions without changing the slug. Skips the storage cache.
  const seedOverride = req.query.seed as string | undefined;
  // Override seed positions so you can experiment with tile anchor cells
  // directly from the URL.  Two formats accepted:
  //   ?positions=A1,I1,B5      letter-column + 1-based row (A=col0, L=col11)
  //   ?positions=0-0,8-0,1-4   col-row, both 0-based
  const positionsRaw = req.query.positions as string | undefined;
  // Override coverage thresholds for testing.
  //   ?minCov=0.15  → treat 15% as the minimum tile coverage
  //   ?maxCov=0.50  → treat 50% as the maximum tile coverage
  const minCovRaw = req.query.minCov as string | undefined;
  const maxCovRaw = req.query.maxCov as string | undefined;
  const minCov = parseCoverageOverride(minCovRaw, MIN_COVERAGE);
  const maxCov = parseCoverageOverride(maxCovRaw, MAX_COVERAGE);
  const minCovProvided = Number.isFinite(parseFloat(minCovRaw as string));
  const maxCovProvided = Number.isFinite(parseFloat(maxCovRaw as string));

  if (!slug && !gridId) {
    res.status(400).json({ error: "Provide ?slug= or ?gridId=" });
    return;
  }

  // ── 0. Custom (user-uploaded) OG image takes precedence ──────────────────
  const customOgUrl = await resolveCustomOgImageUrl(slug, gridId);
  if (customOgUrl) {
    if (check) {
      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ exists: true, custom: true, url: customOgUrl });
      return;
    }
    res.redirect(302, customOgUrl);
    return;
  }

  const cachePath = slug ?
    `og-images/slug/${slug}.png` :
    `og-images/grid/${gridId}.png`;

  const bucket = admin.storage().bucket(BUCKET_NAME);
  const file = bucket.file(cachePath);

  // ── 0.5 Existence probe — never generates ─────────────────────────────────
  if (check) {
    let exists = false;
    try {
      [exists] = await file.exists();
    } catch (checkErr) {
      functions.logger.warn("[og] check probe failed:", checkErr);
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      exists,
      custom: false,
      url: exists ? storageUrl(cachePath) : null,
    });
    return;
  }

  // ── 1. Serve from Storage cache if available ─────────────────────────────
  // In the emulator we can only use Storage when the Storage emulator is
  // running (admin writes target it); otherwise there are no credentials and
  // we fall back to streaming a freshly rendered image (see step 4).
  const isEmulatorEnv = process.env.FUNCTIONS_EMULATOR === "true";
  const canUseStorage = !isEmulatorEnv || !!storageEmulatorHost();
  const hasOverrides = seedOverride || positionsRaw || minCovProvided || maxCovProvided;
  if (!refresh && canUseStorage && !hasOverrides) {
    try {
      const [exists] = await file.exists();
      if (exists) {
        if (isEmulatorEnv) {
          functions.logger.info(
            `[og] serving cached: ${cachePath} (add ?refresh=1 to regenerate)`
          );
          await sendCachedOgImageInline(file, res);
          return;
        }
        res.redirect(302, storageUrl(cachePath));
        return;
      }
    } catch (cacheErr) {
      functions.logger.warn("[og] cache check failed, regenerating:", cacheErr);
    }
  }

  // ── 2. Resolve grid/profile data ──────────────────────────────────────────
  const screenshotBase = normalizeScreenshotBaseUrl(
    process.env.OG_SCREENSHOT_BASE_URL ?? SITE_BASE
  );

  const info = await resolveGridInfo(slug, gridId, screenshotBase);
  if (!info) {
    res.status(404).json({ error: "Grid not found" });
    return;
  }

  const theme = themeFor(info.themeId);

  // ── 3. Launch Chromium (one browser, two pages) ───────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let browser: any = null;

  try {
    browser = await launchChromiumBrowser({
      width: TILE_VIEWPORT_W,
      height: TILE_VIEWPORT_H,
      deviceScaleFactor: 1,
    });

    // Phase A — capture per-tile screenshots from the live grid page
    const tilePage = await browser.newPage();
    let captured = await captureGridTiles(
      tilePage,
      info.screenshotUrl,
      info.skipTileIndices
    );
    await tilePage.close();

    const rawCaptureCount = captured.length;

    if (rawCaptureCount === 0) {
      functions.logger.warn(
        "[og] no tiles captured — rendering meta-only layout"
      );
    } else {
      functions.logger.info(
        `[og] captured ${rawCaptureCount} tile(s) from page`
      );
    }

    // Diversity-aware selection: prefer one of each content category
    // (music / map / visual / link / text), then fill up to MAX. After
    // selection we enforce two area rules against the tile section area
    // (left + right thirds = 504 000 px²):
    //   - If total scaled tile area < 20% of tile sections → render empty
    //   - If total scaled tile area > 60% of tile sections → trim smallest
    //     tiles until we're under the cap (but never below MIN).
    const seedString = seedOverride ?? info.seed;
    const rng = mulberry32(fnv1a(seedString));
    captured = selectScatterTiles(captured, rng, MAX_SCATTER_TILES);

    if (captured.length < MIN_SCATTER_TILES) {
      if (rawCaptureCount > 0) {
        functions.logger.warn(
          `[og] ${rawCaptureCount} tile(s) captured but ${MIN_SCATTER_TILES} required for scatter — meta-only layout`
        );
      }
      captured = [];
    }

    // Coverage enforcement — measured against the tile section area
    // (left + right thirds combined = 504 000 px²), NOT the full canvas.
    if (captured.length > 0) {
      const tileArea = (t: CapturedTile) =>
        t.width * TILE_SCALE * (t.height * TILE_SCALE);

      let totalArea = captured.reduce((s, t) => s + tileArea(t), 0);

      // Over maxCov? Drop the smallest tiles (last in a descending-area
      // sort) until we drop back under the cap — but never below MIN.
      if (totalArea > maxCov * TILE_SECTION_AREA) {
        const byArea = captured
          .map((t, i) => ({ i, a: tileArea(t) }))
          .sort((a, b) => b.a - a.a);
        const keep = new Set<number>();
        let acc = 0;
        for (const entry of byArea) {
          if (acc + entry.a > maxCov * TILE_SECTION_AREA && keep.size >= MIN_SCATTER_TILES) break;
          keep.add(entry.i);
          acc += entry.a;
        }
        captured = captured.filter((_, i) => keep.has(i));
        totalArea = acc;
      }

      // Under minCov? Render empty — too few/tiny tiles to look good.
      if (totalArea < minCov * TILE_SECTION_AREA) {
        functions.logger.info(
          `[og] tile coverage ${((totalArea / TILE_SECTION_AREA) * 100).toFixed(1)}% < ${(minCov * 100).toFixed(0)}% — meta-only layout`
        );
        captured = [];
      }
    }

    const positionsOverride = parsePositions(positionsRaw);
    const placements = scatterTiles(captured, rng, positionsOverride);

    // Phase B — render the OG composition HTML
    const html = buildOgHtml(info, captured, placements, theme);
    const composePage = await browser.newPage();
    const finalImage = await renderOgImage(composePage, html);
    await composePage.close();

    await browser.close();
    browser = null;

    // ── 4. Upload + respond ──────────────────────────────────────────────────
    // In the emulator, stream the PNG inline after caching. Redirecting to the
    // Storage emulator's ?alt=media URL sets Content-Disposition: attachment,
    // which triggers a download instead of an in-browser preview.
    if (isEmulatorEnv && !storageEmulatorHost()) {
      functions.logger.info(
        `[og] emulator — no Storage emulator; streaming image directly for: ${cachePath}`
      );
      sendOgImageInline(res, finalImage);
      return;
    }

    await file.save(finalImage, {
      contentType: "image/png",
      metadata: {
        cacheControl: "public, max-age=86400",
        generatedAt: new Date().toISOString(),
        themeId: info.themeId,
      },
    });

    functions.logger.info(`[og] generated and cached: ${cachePath}`);

    if (isEmulatorEnv) {
      sendOgImageInline(res, finalImage);
      return;
    }

    res.redirect(302, storageUrl(cachePath));
  } catch (err) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
    functions.logger.error("[og] generation failed:", err);
    res.status(500).json({ error: "OG image generation failed" });
  }
}

// Export as a v1 onRequest function with boosted memory for Chromium.
export const generateOgImage = functions
  .runWith({ memory: "2GB", timeoutSeconds: 90 })
  .https.onRequest(handler);
