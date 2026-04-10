/**
 * Pure helper functions extracted from SmartTextContent.vue for testability.
 */

export const normalizeHttpUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export type FontSizeLabel = "Small" | "Medium" | "Large" | "Larger";

const FONT_SIZE_TO_PX: Record<FontSizeLabel, string> = {
  Small: "12px",
  Medium: "14px",
  Large: "20px",
  Larger: "26px",
};

const PX_TO_FONT_SIZE: Record<string, FontSizeLabel> = {
  "12px": "Small",
  "14px": "Medium",
  "20px": "Large",
  "26px": "Larger",
};

export const fontSizeLabelToPx = (label: string): string => {
  const normalized = label.trim().toLowerCase();
  const key = (normalized.charAt(0).toUpperCase() + normalized.slice(1)) as FontSizeLabel;
  return FONT_SIZE_TO_PX[key] ?? "14px";
};

export const pxToFontSizeLabel = (px: string | undefined | null): string => {
  if (!px) return "Medium";
  return PX_TO_FONT_SIZE[px] ?? px;
};

export const getDefaultFont = (fontFamily: string | undefined | null): string => {
  return fontFamily || "Inter";
};

export type SlashCommandDef = {
  id: string;
  label: string;
  hint: string;
  keywords: string[];
};

export const SLASH_COMMAND_DEFS: SlashCommandDef[] = [
  { id: "h1", label: "Heading 1", hint: "/h1", keywords: ["h1", "heading", "title"] },
  { id: "h2", label: "Heading 2", hint: "/h2", keywords: ["h2", "heading", "subtitle"] },
  { id: "bullet", label: "Bulleted list", hint: "/bullet", keywords: ["bullet", "list", "ul"] },
  { id: "numbered", label: "Numbered list", hint: "/numbered", keywords: ["numbered", "ordered", "ol"] },
  { id: "todo", label: "To-do list", hint: "/todo", keywords: ["todo", "task", "checkbox"] },
  { id: "quote", label: "Quote", hint: "/quote", keywords: ["quote", "blockquote"] },
  { id: "divider", label: "Divider", hint: "/divider", keywords: ["divider", "rule", "hr"] },
  { id: "image", label: "Image", hint: "/image", keywords: ["image", "photo", "upload"] },
  { id: "link", label: "Link", hint: "/link", keywords: ["link", "url"] },
  { id: "button", label: "Button link", hint: "/button", keywords: ["button", "cta", "link"] },
  { id: "table", label: "Table", hint: "/table", keywords: ["table", "grid", "spreadsheet"] },
];

export const filterSlashCommands = <T extends SlashCommandDef>(
  commands: T[],
  query: string,
): T[] => {
  const q = query.trim().toLowerCase();
  if (!q) return commands;
  return commands.filter((item) =>
    item.keywords.some((k) => k.includes(q)),
  );
};

export type TileDimensions = {
  width: number;
  height: number;
};

export const isTallOneWide = (d: TileDimensions): boolean =>
  d.width === 1 && d.height > 1;

export const isWideOneHigh = (d: TileDimensions): boolean =>
  d.width > 1 && d.height === 1;

export const isOneByOne = (d: TileDimensions): boolean =>
  d.width === 1 && d.height === 1;
