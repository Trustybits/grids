/**
 * Whole-tile text formatting on stored Tiptap JSON, without an editor.
 *
 * The phone toolbar formats a text tile that is only selected, not being typed
 * in, and multi-edit formats tiles that aren't even mounted. Going through the
 * live editor can't do either: its commands focus it (opening the keyboard)
 * and it only saves while typing. So these read and rewrite the saved
 * document directly; the caller writes the result with `patchTileContent`.
 *
 * "All the text" means every text node outside code blocks. Readers answer
 * "mixed" when the nodes disagree, which is what a multi-tile or partly
 * formatted tile shows.
 *
 * Mirrors the editor's own rules:
 *   - `code` excludes every other mark, so turning code on strips them and
 *     other marks are never added to code text;
 *   - an empty `textStyle` (no font, size or color left) is dropped, as
 *     Tiptap's `removeEmptyTextStyle` does.
 */

import { FONT_FAMILIES } from "@/constants/textStyles";
import type { ToggleableMark } from "./formatting";

export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
}

export const MIXED = "mixed" as const;
export type Mixed = typeof MIXED;

export type TextStyleAttr = "fontFamily" | "fontSize" | "color";

/** Nodes whose text can't carry marks (Tiptap code blocks: `marks: ""`). */
const MARKLESS_PARENTS = new Set(["codeBlock"]);
/** Blocks that take a `textAlign` attribute (Tiptap TextAlign `types`). */
const ALIGNABLE_BLOCKS = new Set(["paragraph", "heading"]);

const DEFAULT_FONT_FAMILY = FONT_FAMILIES[0];

// ── Parse / serialize ───────────────────────────────────────────────────────

/**
 * The stored `text` as a doc: a stringified Tiptap doc, "" for an empty tile
 * (→ null, nothing to format), or plain text from very old tiles (→ wrapped
 * in a paragraph, as the editor loads it).
 */
export function parseStoredDoc(text: string | undefined): DocNode | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as DocNode;
    }
  } catch {
    // Plain text — fall through.
  }
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export function serializeDoc(doc: DocNode): string {
  return JSON.stringify(doc);
}

/**
 * Apply a doc transform to stored text. Empty text stays empty; the result is
 * the stored form again, ready for `patchTileContent({ text })`.
 */
export function transformStoredText(
  text: string | undefined,
  transform: (doc: DocNode) => DocNode,
): string {
  const doc = parseStoredDoc(text);
  if (!doc) return text ?? "";
  return serializeDoc(transform(doc));
}

// ── Walking ─────────────────────────────────────────────────────────────────

/** Every formattable text node, in document order. */
function collectText(node: DocNode, out: DocNode[] = []): DocNode[] {
  if (node.type === "text") {
    if (node.text) out.push(node);
    return out;
  }
  if (MARKLESS_PARENTS.has(node.type)) return out;
  for (const child of node.content ?? []) collectText(child, out);
  return out;
}

/** Rebuild the tree, replacing each formattable text node via `map`. */
function mapText(node: DocNode, map: (text: DocNode) => DocNode): DocNode {
  if (node.type === "text") return node.text ? map(node) : node;
  if (MARKLESS_PARENTS.has(node.type) || !node.content) return node;
  return { ...node, content: node.content.map((child) => mapText(child, map)) };
}

function mapBlocks(node: DocNode, map: (block: DocNode) => DocNode): DocNode {
  const mapped = ALIGNABLE_BLOCKS.has(node.type) ? map(node) : node;
  if (!mapped.content) return mapped;
  return {
    ...mapped,
    content: mapped.content.map((child) => mapBlocks(child, map)),
  };
}

/** One answer for all of `values`, or "mixed"; `fallback` when empty. */
function agree<T>(values: T[], fallback: T): T | Mixed {
  if (values.length === 0) return fallback;
  const first = values[0];
  return values.every((value) => value === first) ? first : MIXED;
}

const hasMark = (node: DocNode, type: string): boolean =>
  !!node.marks?.some((mark) => mark.type === type);

function withMarks(node: DocNode, marks: DocMark[]): DocNode {
  const next = { ...node };
  if (marks.length) next.marks = marks;
  else delete next.marks;
  return next;
}

// ── Marks (bold, italic, underline, strike, code) ───────────────────────────

/** Whether all the text has `mark`: true, false, or "mixed". */
export function readMark(doc: DocNode, mark: ToggleableMark): boolean | Mixed {
  return agree(
    collectText(doc).map((node) => hasMark(node, mark)),
    false,
  );
}

/** Turn `mark` on or off across all the text. */
export function setMark(
  doc: DocNode,
  mark: ToggleableMark,
  on: boolean,
): DocNode {
  return mapText(doc, (node) => {
    const marks = node.marks ?? [];
    if (!on) return withMarks(node, marks.filter((m) => m.type !== mark));
    if (mark === "code") return withMarks(node, [{ type: "code" }]);
    // Code text can't carry other marks.
    if (hasMark(node, "code") || hasMark(node, mark)) return node;
    return withMarks(node, [...marks, { type: mark }]);
  });
}

// ── textStyle attributes (font family, size, color) ─────────────────────────

const readStyle = (node: DocNode, attr: TextStyleAttr): string | null => {
  const value = node.marks?.find((m) => m.type === "textStyle")?.attrs?.[attr];
  return typeof value === "string" && value ? value : null;
};

/**
 * The shared value of a textStyle attribute, `null` when the text uses the
 * default (no font / size / color set), or "mixed".
 */
export function readTextStyle(
  doc: DocNode,
  attr: TextStyleAttr,
): string | null | Mixed {
  return agree(
    collectText(doc).map((node) => readStyle(node, attr)),
    null,
  );
}

/** The font family in use, with an unset family read as the default. */
export function readFontFamily(doc: DocNode): string | Mixed {
  const family = readTextStyle(doc, "fontFamily");
  return family === null ? DEFAULT_FONT_FAMILY : family;
}

/**
 * Set a textStyle attribute on all the text; `null` removes it (back to the
 * default). An emptied textStyle mark is dropped.
 */
export function setTextStyle(
  doc: DocNode,
  attr: TextStyleAttr,
  value: string | null,
): DocNode {
  return mapText(doc, (node) => {
    if (hasMark(node, "code")) return node;
    const marks = node.marks ?? [];
    const existing = marks.find((m) => m.type === "textStyle");
    const attrs: Record<string, unknown> = { ...(existing?.attrs ?? {}) };
    if (value === null) delete attrs[attr];
    else attrs[attr] = value;

    const others = marks.filter((m) => m.type !== "textStyle");
    const empty = Object.values(attrs).every(
      (v) => v === null || v === undefined || v === "",
    );
    return withMarks(
      node,
      empty ? others : [...others, { type: "textStyle", attrs }],
    );
  });
}

/** Font family, with the default family stored as "unset", like the editor. */
export function setFontFamily(doc: DocNode, family: string): DocNode {
  return setTextStyle(
    doc,
    "fontFamily",
    family === DEFAULT_FONT_FAMILY ? null : family,
  );
}

/** Font size in px. */
export function setFontSizePx(doc: DocNode, px: number): DocNode {
  return setTextStyle(doc, "fontSize", `${px}px`);
}

/** A picked text color, or null for the tile's automatic color. */
export function setTextColor(doc: DocNode, color: string | null): DocNode {
  return setTextStyle(doc, "color", color);
}

// ── Block alignment ─────────────────────────────────────────────────────────

export type BlockAlign = "left" | "center" | "right";

/** Shared paragraph/heading alignment, `null` = tile default, or "mixed". */
export function readBlockAlign(doc: DocNode): BlockAlign | null | Mixed {
  const values: (BlockAlign | null)[] = [];
  mapBlocks(doc, (block) => {
    const align = block.attrs?.textAlign;
    values.push(
      align === "left" || align === "center" || align === "right"
        ? align
        : null,
    );
    return block;
  });
  return agree(values, null);
}

/** Align every paragraph and heading; null hands them back to the tile. */
export function setBlockAlign(
  doc: DocNode,
  align: BlockAlign | null,
): DocNode {
  return mapBlocks(doc, (block) => ({
    ...block,
    attrs: { ...(block.attrs ?? {}), textAlign: align },
  }));
}
