import type { Editor } from "@tiptap/core";
import {
  FONT_FAMILIES,
  FONT_SIZES,
  type FontSizeOption,
  type HorizontalAlignment,
} from "@/constants/textStyles";

/**
 * Reading and applying text formatting for the floating toolbar.
 *
 * Every command follows Notion: with a selection it formats the selection;
 * with only a caret it sets stored marks, so the change applies to what is
 * typed next. Block alignment applies to every block the selection touches.
 */

export const TOGGLEABLE_MARKS = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
] as const;

export type ToggleableMark = (typeof TOGGLEABLE_MARKS)[number];

/** Rendered size for each preset; also what the classic size menu stores. */
export const FONT_SIZE_PRESET_PX: Record<FontSizeOption, number> = {
  Small: 12,
  Medium: 14,
  Large: 20,
  Larger: 26,
};

export const DEFAULT_FONT_SIZE_PX = FONT_SIZE_PRESET_PX.Medium;
export const MIN_FONT_SIZE_PX = 8;
export const MAX_FONT_SIZE_PX = 200;
export const DEFAULT_FONT_FAMILY = FONT_FAMILIES[0];

export interface FormattingState {
  marks: Record<ToggleableMark, boolean>;
  fontFamily: string;
  /** Size in px at the selection or caret; the default when none is set. */
  fontSizePx: number;
  /** Matching preset, or null for a custom size. */
  fontSizePreset: FontSizeOption | null;
  /** Picked text color, or null when the tile's automatic color applies. */
  color: string | null;
  /** The block's own alignment, or null when it follows the tile default. */
  align: HorizontalAlignment | null;
  /** href of the link at the selection, if any. */
  link: string | null;
}

export function parseFontSizePx(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const px = Number.parseFloat(value);
  return Number.isFinite(px) ? px : null;
}

export function presetForPx(px: number): FontSizeOption | null {
  return FONT_SIZES.find((preset) => FONT_SIZE_PRESET_PX[preset] === px) ?? null;
}

/** Clamp a typed size into the supported range; null when not a number. */
export function normalizeFontSizeInput(input: string): number | null {
  const px = Number.parseFloat(input);
  if (!Number.isFinite(px)) return null;
  return Math.round(
    Math.min(MAX_FONT_SIZE_PX, Math.max(MIN_FONT_SIZE_PX, px)),
  );
}

export function readFormatting(editor: Editor): FormattingState {
  const textStyle = editor.getAttributes("textStyle") as {
    fontFamily?: string | null;
    fontSize?: string | null;
    color?: string | null;
  };
  const fontSizePx = parseFontSizePx(textStyle.fontSize) ?? DEFAULT_FONT_SIZE_PX;
  const marks = Object.fromEntries(
    TOGGLEABLE_MARKS.map((mark) => [mark, editor.isActive(mark)]),
  ) as Record<ToggleableMark, boolean>;
  const align =
    (["left", "center", "right"] as const).find((value) =>
      editor.isActive({ textAlign: value }),
    ) ?? null;
  const href = editor.getAttributes("link").href as string | undefined;

  return {
    marks,
    fontFamily: textStyle.fontFamily || DEFAULT_FONT_FAMILY,
    fontSizePx,
    fontSizePreset: presetForPx(fontSizePx),
    color: textStyle.color || null,
    align,
    link: href || null,
  };
}

const chain = (editor: Editor) =>
  editor.chain().focus(undefined, { scrollIntoView: false });

export function toggleMark(editor: Editor, mark: ToggleableMark): void {
  chain(editor).toggleMark(mark).run();
}

export function setFontFamily(editor: Editor, family: string): void {
  if (family === DEFAULT_FONT_FAMILY) {
    chain(editor).unsetFontFamily().run();
    return;
  }
  chain(editor).setFontFamily(family).run();
}

export function setFontSizePx(editor: Editor, px: number): void {
  chain(editor).setFontSize(`${px}px`).run();
}

/** A picked color, or null to return to the tile's automatic color. */
export function setTextColor(editor: Editor, color: string | null): void {
  if (color) {
    chain(editor).setColor(color).run();
    return;
  }
  chain(editor).unsetColor().run();
}

/**
 * Align the selected blocks. Choosing the alignment a block already has
 * clears it, handing the block back to the tile default.
 */
export function setBlockAlign(
  editor: Editor,
  align: HorizontalAlignment,
): void {
  if (editor.isActive({ textAlign: align })) {
    chain(editor).unsetTextAlign().run();
    return;
  }
  chain(editor).setTextAlign(align).run();
}

/** Link the selection (or the link under the caret); null removes it. */
export function setLink(editor: Editor, href: string | null): void {
  const base = chain(editor).extendMarkRange("link");
  if (href) {
    base.setLink({ href }).run();
    return;
  }
  base.unsetLink().run();
}
