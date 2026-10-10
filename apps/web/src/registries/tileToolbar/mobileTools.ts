/**
 * Phone toolbar model — which tools each tile shows, in what order, and how
 * the data-backed ones read and write the tile.
 *
 * The desktop registry (`getTileToolbarButtons`) can't produce the phone rows
 * on its own: Caption, Open/Copy/Download, Duplicate/Delete and Arrange live
 * outside it, unified text hides its font controls there, and several of its
 * entries only open desktop panels. So the order and presence live here, per
 * tile type, and the plan's §5 is this table.
 *
 * Pure on purpose — no components, no stores — so a tile's whole toolbar and
 * the multi-edit intersection can be tested without mounting anything. The UI
 * layer maps tool ids to icons and popover bodies.
 *
 * Writers: a tool that changes saved data does it through `writers`, each a
 * pure read + patch over the tile. Having writers is exactly what makes a tool
 * bulk-safe, because a patch needs no live component: one tile is just a bulk
 * of one. Tools without writers (crop, pan, edit, open, …) act on the one
 * live tile through its handle, so they never show in multi-edit.
 */

import {
  ContentType,
  type AnyTileContent,
  type Tile,
} from "@grids/contracts/types";
import { getTileDefinition } from "@/registries/tileRegistry";
import {
  fillOptionsFor,
  fillPatch,
  overlayPatch,
  readPickerFill,
  readPickerOverlay,
  resolveColorMode,
  type FillContent,
} from "@/utils/tileFill";
import { normalizeTileLink, supportsTileLink } from "@/utils/tileLink";
import {
  MIXED,
  parseStoredDoc,
  readBlockAlign,
  readFontFamily,
  readMark,
  readTextStyle,
  setBlockAlign,
  setFontFamily,
  setFontSizePx,
  setMark,
  setTextColor,
  transformStoredText,
  type BlockAlign,
  type DocNode,
  type Mixed,
} from "@/utils/richText/docTransforms";
import {
  DEFAULT_FONT_SIZE_PX,
  parseFontSizePx,
  type ToggleableMark,
} from "@/utils/richText/formatting";

export type MobileToolId =
  | "font"
  | "style"
  | "color"
  | "fill"
  | "position"
  | "link"
  | "border"
  | "caption"
  | "edit"
  | "image"
  | "photo"
  | "shape"
  | "crop"
  | "interact"
  | "pan"
  | "search"
  | "recenter"
  | "mapStyle"
  | "preview"
  | "open"
  | "copy"
  | "download"
  | "more"
  | "arrange"
  | "duplicate"
  | "delete";

/**
 * - popover: opens a card above the toolbar
 * - instant: runs straight away
 * - mode: the tile enters a mode (crop, pan, interact, typing)
 * - arrange: on-canvas move/resize
 */
export type MobileToolKind = "popover" | "instant" | "mode" | "arrange";

/** What a writer changes: tile content, or the tile-level fields. */
export interface TileWrite {
  content?: Partial<AnyTileContent>;
  borderEnabled?: boolean;
  caption?: string;
}

export interface ToolWriter<V> {
  /** The tile's current value; "mixed" when it varies within the tile. */
  read(tile: Tile): V | Mixed;
  /** The write that sets `value`, or null when nothing would change. */
  patch(tile: Tile, value: V): TileWrite | null;
}

export interface MobileToolContext {
  tile: Tile;
  /** Text tiles render through the unified rich-text editor. */
  unifiedText: boolean;
  /**
   * Download is resolved asynchronously per tile (archived uploads need a
   * shareable URL), so the UI passes the answer in. Unknown → hidden.
   */
  canDownload?: boolean;
}

export interface MobileTool {
  id: MobileToolId;
  label: string;
  kind: MobileToolKind;
  /** Red, and always last. */
  danger?: boolean;
  /** Present for this tile right now. */
  visible(ctx: MobileToolContext): boolean;
  /** Data-backed reads/writes; present ⇔ bulk-safe. */
  writers?: Record<string, ToolWriter<unknown>>;
}

const always = () => true;

// ── Helpers ──────────────────────────────────────────────────────────────────

type ContentRecord = AnyTileContent & Record<string, unknown>;
const contentOf = (tile: Tile) => tile.content as ContentRecord;

const isText = (tile: Tile) =>
  tile.content.type === ContentType.TEXT ||
  tile.content.type === ContentType.SMART_TEXT;

/** The stored rich-text doc of a text tile, if it has any text. */
const docOf = (tile: Tile): DocNode | null =>
  parseStoredDoc(contentOf(tile).text as string | undefined);

/** A content patch, or null when it changes nothing. */
function contentPatch(
  tile: Tile,
  patch: Partial<AnyTileContent>,
): TileWrite | null {
  const current = contentOf(tile);
  const changed = Object.entries(patch).some(
    ([key, value]) => current[key] !== value,
  );
  return changed ? { content: patch } : null;
}

/** Rewrite a text tile's saved doc; null when the result is identical. */
function textPatch(
  tile: Tile,
  transform: (doc: DocNode) => DocNode,
): TileWrite | null {
  const text = contentOf(tile).text as string | undefined;
  const next = transformStoredText(text, transform);
  return next === (text ?? "") ? null : { content: { text: next } };
}

const definitionActions = (tile: Tile) =>
  getTileDefinition(tile.content.type)?.actions as
    | {
        copyContent?: (content: unknown) => string | null;
        downloadUrl?: (content: unknown) => string | null;
        externalUrl?: (content: unknown) => string | null;
      }
    | undefined;

// ── Writers ──────────────────────────────────────────────────────────────────

const markWriter = (mark: ToggleableMark): ToolWriter<boolean> => ({
  read: (tile) => {
    const doc = docOf(tile);
    return doc ? readMark(doc, mark) : false;
  },
  patch: (tile, on) => textPatch(tile, (doc) => setMark(doc, mark, on)),
});

const fillOptions = (tile: Tile) => fillOptionsFor(tile.content.type) ?? {};
const fillContent = (tile: Tile) => tile.content as unknown as FillContent;

export const WRITERS = {
  fill: {
    read: (tile) => readPickerFill(fillContent(tile), fillOptions(tile)),
    patch: (tile, color) =>
      contentPatch(
        tile,
        fillPatch(fillContent(tile), color, fillOptions(tile)) as Partial<
          AnyTileContent
        >,
      ),
  } satisfies ToolWriter<string>,

  overlay: {
    read: (tile) => readPickerOverlay(fillContent(tile), fillOptions(tile)),
    patch: (tile, color) =>
      contentPatch(
        tile,
        overlayPatch(fillContent(tile), color, fillOptions(tile)) as Partial<
          AnyTileContent
        >,
      ),
  } satisfies ToolWriter<string>,

  colorMode: {
    read: (tile) => resolveColorMode(fillContent(tile), fillOptions(tile)),
    patch: (tile, mode) =>
      contentPatch(tile, { colorMode: mode } as Partial<AnyTileContent>),
  } satisfies ToolWriter<"fill" | "overlay">,

  border: {
    read: (tile) => tile.borderEnabled !== false,
    patch: (tile, on) =>
      (tile.borderEnabled !== false) === on ? null : { borderEnabled: on },
  } satisfies ToolWriter<boolean>,

  caption: {
    read: (tile) => tile.caption ?? "",
    patch: (tile, caption) =>
      (tile.caption ?? "") === caption ? null : { caption },
  } satisfies ToolWriter<string>,

  /** "" clears the link; anything else must normalize to a URL. */
  link: {
    read: (tile) => (contentOf(tile).tileLink as string | undefined) ?? "",
    patch: (tile, link) => {
      const next = link.trim() ? normalizeTileLink(link) : "";
      if (link.trim() && !next) return null;
      return contentPatch(tile, { tileLink: next } as Partial<AnyTileContent>);
    },
  } satisfies ToolWriter<string>,

  verticalAlign: {
    read: (tile) =>
      (contentOf(tile).verticalAlign as
        | "top"
        | "center"
        | "bottom"
        | undefined) ?? "top",
    patch: (tile, align) =>
      contentPatch(tile, { verticalAlign: align } as Partial<AnyTileContent>),
  } satisfies ToolWriter<"top" | "center" | "bottom">,

  /**
   * Whole-tile horizontal alignment. Paragraph-level alignments are cleared
   * so every line follows it, as a "align the tile" action should.
   */
  textAlign: {
    read: (tile) => {
      const doc = docOf(tile);
      const blocks = doc ? readBlockAlign(doc) : null;
      if (blocks === MIXED) return MIXED;
      return (
        blocks ??
        ((contentOf(tile).textAlign as BlockAlign | undefined) || "left")
      );
    },
    patch: (tile, align) => {
      const text = contentOf(tile).text as string | undefined;
      const nextText = transformStoredText(text, (doc) =>
        setBlockAlign(doc, null),
      );
      const patch: Record<string, unknown> = { textAlign: align };
      if (nextText !== (text ?? "")) patch.text = nextText;
      return contentPatch(tile, patch as Partial<AnyTileContent>);
    },
  } satisfies ToolWriter<"left" | "center" | "right">,

  fontFamily: {
    read: (tile) => {
      const doc = docOf(tile);
      return doc ? readFontFamily(doc) : "Inter";
    },
    patch: (tile, family) =>
      textPatch(tile, (doc) => setFontFamily(doc, family)),
  } satisfies ToolWriter<string>,

  fontSizePx: {
    read: (tile) => {
      const doc = docOf(tile);
      const size = doc ? readTextStyle(doc, "fontSize") : null;
      if (size === MIXED) return MIXED;
      return parseFontSizePx(size) ?? DEFAULT_FONT_SIZE_PX;
    },
    patch: (tile, px) => textPatch(tile, (doc) => setFontSizePx(doc, px)),
  } satisfies ToolWriter<number>,

  /** A picked color, or null for the tile's automatic color. */
  textColor: {
    read: (tile) => {
      const doc = docOf(tile);
      return doc ? readTextStyle(doc, "color") : null;
    },
    patch: (tile, color) =>
      textPatch(tile, (doc) => setTextColor(doc, color)),
  } satisfies ToolWriter<string | null>,

  bold: markWriter("bold"),
  italic: markWriter("italic"),
  underline: markWriter("underline"),
  strike: markWriter("strike"),
  code: markWriter("code"),

  mapStyle: {
    read: (tile) =>
      ((contentOf(tile).style as string | undefined) || "default") ===
      "auto"
        ? "auto"
        : "default",
    patch: (tile, style) =>
      contentPatch(tile, { style } as Partial<AnyTileContent>),
  } satisfies ToolWriter<"default" | "auto">,
} as const;

/**
 * Erase each writer's value type for the tool table. Writers differ per field
 * (boolean, color, alignment); the popover that drives a field knows its type.
 */
const asWriters = (
  writers: object,
): Record<string, ToolWriter<unknown>> =>
  writers as Record<string, ToolWriter<unknown>>;

// ── Tools ────────────────────────────────────────────────────────────────────

/** Types with a user border toggle (matches the desktop registry). */
const BORDER_TYPES: ReadonlySet<string> = new Set([
  ContentType.TEXT,
  ContentType.SMART_TEXT,
  ContentType.IMAGE,
  ContentType.VIDEO,
  ContentType.LINK,
  ContentType.EMBED,
  ContentType.DOCUMENT,
  ContentType.PROFILE,
  ContentType.CAMPFIRE,
]);

/** Types that show a caption under the tile. */
const CAPTION_TYPES: ReadonlySet<string> = new Set([
  ContentType.IMAGE,
  ContentType.VIDEO,
  ContentType.MAP,
]);

export const MOBILE_TOOLS: Record<MobileToolId, MobileTool> = {
  font: {
    id: "font",
    label: "Font",
    kind: "popover",
    visible: (ctx) => isText(ctx.tile) && ctx.unifiedText,
    writers: asWriters({
      fontFamily: WRITERS.fontFamily,
      fontSizePx: WRITERS.fontSizePx,
    }),
  },
  style: {
    id: "style",
    label: "Style",
    kind: "popover",
    visible: (ctx) => isText(ctx.tile) && ctx.unifiedText,
    writers: asWriters({
      bold: WRITERS.bold,
      italic: WRITERS.italic,
      underline: WRITERS.underline,
      strike: WRITERS.strike,
      code: WRITERS.code,
      textAlign: WRITERS.textAlign,
    }),
  },
  color: {
    id: "color",
    label: "Color",
    kind: "popover",
    // Classic text picks its own contrasting color.
    visible: (ctx) => isText(ctx.tile) && ctx.unifiedText,
    writers: asWriters({ textColor: WRITERS.textColor }),
  },
  fill: {
    id: "fill",
    label: "Fill",
    kind: "popover",
    visible: (ctx) => fillOptionsFor(ctx.tile.content.type) !== null,
    writers: asWriters({
      fill: WRITERS.fill,
      overlay: WRITERS.overlay,
      colorMode: WRITERS.colorMode,
    }),
  },
  position: {
    id: "position",
    label: "Position",
    kind: "popover",
    visible: (ctx) => isText(ctx.tile),
    writers: asWriters({ verticalAlign: WRITERS.verticalAlign }),
  },
  link: {
    id: "link",
    label: "Link",
    kind: "popover",
    visible: (ctx) => supportsTileLink(ctx.tile.content.type),
    writers: asWriters({ link: WRITERS.link }),
  },
  border: {
    id: "border",
    label: "Border",
    kind: "popover",
    visible: (ctx) => BORDER_TYPES.has(ctx.tile.content.type),
    writers: asWriters({ border: WRITERS.border }),
  },
  caption: {
    id: "caption",
    label: "Caption",
    kind: "popover",
    // A 1-wide tile has no room for one (matches Tile.vue).
    visible: (ctx) =>
      CAPTION_TYPES.has(ctx.tile.content.type) && ctx.tile.w > 1,
    writers: asWriters({ caption: WRITERS.caption }),
  },
  edit: {
    id: "edit",
    label: "Edit",
    kind: "mode",
    visible: (ctx) =>
      ctx.tile.content.type === ContentType.LINK ||
      ctx.tile.content.type === ContentType.DOCUMENT ||
      ctx.tile.content.type === ContentType.PROFILE,
  },
  image: {
    id: "image",
    label: "Image",
    kind: "popover",
    visible: (ctx) => ctx.tile.content.type === ContentType.LINK,
  },
  photo: {
    id: "photo",
    label: "Photo",
    kind: "popover",
    visible: (ctx) => ctx.tile.content.type === ContentType.PROFILE,
  },
  shape: {
    id: "shape",
    label: "Shape",
    kind: "popover",
    visible: (ctx) => ctx.tile.content.type === ContentType.PROFILE,
  },
  crop: {
    id: "crop",
    label: "Crop",
    kind: "mode",
    visible: (ctx) =>
      ctx.tile.content.type === ContentType.IMAGE ||
      ctx.tile.content.type === ContentType.VIDEO,
  },
  interact: {
    id: "interact",
    label: "Interact",
    kind: "mode",
    visible: (ctx) => ctx.tile.content.type === ContentType.EMBED,
  },
  pan: {
    id: "pan",
    label: "Pan",
    kind: "mode",
    visible: (ctx) => ctx.tile.content.type === ContentType.MAP,
  },
  search: {
    id: "search",
    label: "Search",
    kind: "popover",
    visible: (ctx) => ctx.tile.content.type === ContentType.MAP,
  },
  recenter: {
    id: "recenter",
    label: "Re-center",
    kind: "instant",
    visible: (ctx) => ctx.tile.content.type === ContentType.MAP,
  },
  mapStyle: {
    id: "mapStyle",
    label: "Style",
    kind: "popover",
    visible: (ctx) => ctx.tile.content.type === ContentType.MAP,
    writers: asWriters({ mapStyle: WRITERS.mapStyle }),
  },
  preview: {
    id: "preview",
    label: "Preview",
    kind: "instant",
    visible: (ctx) => ctx.tile.content.type === ContentType.DOCUMENT,
  },
  open: {
    id: "open",
    label: "Open",
    kind: "instant",
    visible: (ctx) =>
      !!definitionActions(ctx.tile)?.externalUrl?.(ctx.tile.content),
  },
  copy: {
    id: "copy",
    label: "Copy",
    kind: "instant",
    // Text keeps Copy under More; elsewhere it is its own tool.
    visible: (ctx) =>
      !isText(ctx.tile) &&
      !!definitionActions(ctx.tile)?.copyContent?.(ctx.tile.content),
  },
  download: {
    id: "download",
    label: "Download",
    kind: "instant",
    visible: (ctx) =>
      ctx.canDownload === true &&
      !!definitionActions(ctx.tile)?.downloadUrl?.(ctx.tile.content),
  },
  more: {
    id: "more",
    label: "More",
    kind: "popover",
    visible: (ctx) =>
      // Text: Copy text · Open link. Link: Remove favicon.
      (isText(ctx.tile) &&
        !!definitionActions(ctx.tile)?.copyContent?.(ctx.tile.content)) ||
      ctx.tile.content.type === ContentType.LINK,
  },
  arrange: {
    id: "arrange",
    label: "Arrange",
    kind: "arrange",
    visible: (ctx) => ctx.tile.content.type !== ContentType.SUGGESTION,
  },
  duplicate: {
    id: "duplicate",
    label: "Duplicate",
    kind: "instant",
    // One-per-grid types (Campfire) can't be copied.
    visible: (ctx) => !getTileDefinition(ctx.tile.content.type)?.maxPerGrid,
    writers: {},
  },
  delete: {
    id: "delete",
    label: "Delete",
    kind: "instant",
    danger: true,
    visible: always,
    writers: {},
  },
};

/**
 * Toolbar order per tile type (plan §5). Text tools first, then look, Arrange,
 * link/actions, Border, Duplicate, and Delete always last. Visibility rules
 * then drop what doesn't apply to the specific tile.
 */
const ORDER_BY_TYPE: Partial<Record<ContentType, MobileToolId[]>> = {
  [ContentType.TEXT]: [
    "font", "style", "color", "fill", "arrange", "position", "link",
    "border", "more", "duplicate", "delete",
  ],
  [ContentType.SMART_TEXT]: [
    "font", "style", "color", "fill", "arrange", "position", "link",
    "border", "more", "duplicate", "delete",
  ],
  [ContentType.IMAGE]: [
    "crop", "fill", "arrange", "link", "caption", "border", "download",
    "open", "duplicate", "delete",
  ],
  [ContentType.VIDEO]: [
    "crop", "fill", "arrange", "link", "caption", "border", "download",
    "open", "duplicate", "delete",
  ],
  [ContentType.LINK]: [
    "edit", "image", "fill", "arrange", "open", "copy", "border", "more",
    "duplicate", "delete",
  ],
  [ContentType.EMBED]: [
    "interact", "arrange", "open", "copy", "border", "duplicate", "delete",
  ],
  [ContentType.YOUTUBE]: ["arrange", "open", "copy", "duplicate", "delete"],
  [ContentType.MUSIC]: ["arrange", "open", "copy", "duplicate", "delete"],
  [ContentType.DOCUMENT]: [
    "edit", "preview", "fill", "arrange", "border", "duplicate", "delete",
  ],
  [ContentType.MAP]: [
    "pan", "search", "recenter", "mapStyle", "arrange", "caption",
    "duplicate", "delete",
  ],
  [ContentType.PROFILE]: [
    "photo", "shape", "edit", "fill", "arrange", "border", "duplicate",
    "delete",
  ],
  [ContentType.CHAT]: ["arrange", "duplicate", "delete"],
  [ContentType.CAMPFIRE]: ["arrange", "border", "delete"],
  // Suggestion tiles turn into a real tile on tap; they get no toolbar.
  [ContentType.SUGGESTION]: [],
};

/** Anything not in the table (dev-only tiles, mini-games) gets the basics. */
const GENERIC_ORDER: MobileToolId[] = ["arrange", "duplicate", "delete"];

/** The tile's toolbar, in order, with tools that don't apply removed. */
export function getMobileTools(ctx: MobileToolContext): MobileTool[] {
  const order =
    ORDER_BY_TYPE[ctx.tile.content.type as ContentType] ?? GENERIC_ORDER;
  return order
    .map((id) => MOBILE_TOOLS[id])
    .filter((tool) => tool.visible(ctx));
}

/**
 * Tools every selected tile shares that are safe to apply to all of them —
 * multi-edit's toolbar. Order follows the first tile's toolbar.
 */
export function getSharedMobileTools(
  contexts: readonly MobileToolContext[],
): MobileTool[] {
  if (contexts.length === 0) return [];
  const perTile = contexts.map(
    (ctx) => new Set(getMobileTools(ctx).map((tool) => tool.id)),
  );
  return getMobileTools(contexts[0]).filter(
    (tool) =>
      tool.writers !== undefined &&
      // Overlay needs every tile to support it; the popover checks that.
      perTile.every((ids) => ids.has(tool.id)),
  );
}

/**
 * One value across several tiles: the shared value, or "mixed" when they
 * disagree (or any tile is itself mixed).
 */
export function readAcrossTiles<V>(
  writer: ToolWriter<V>,
  tiles: readonly Tile[],
): V | Mixed {
  const values = tiles.map((tile) => writer.read(tile));
  if (values.length === 0 || values.some((value) => value === MIXED)) {
    return MIXED;
  }
  const first = values[0];
  return values.every((value) => value === first) ? first : MIXED;
}
