import type { Swatch } from "./PopoverSwatches.vue";

/** The theme colours every picker offers, in the desktop pickers' order. */
const THEME_TOKENS: [token: string, label: string][] = [
  ["--color-red", "Red"],
  ["--color-orange", "Orange"],
  ["--color-yellow", "Yellow"],
  ["--color-green", "Green"],
  ["--color-cyan", "Cyan"],
  ["--color-blue", "Blue"],
  ["--color-purple", "Purple"],
  ["--color-pink", "Pink"],
  ["--color-light-100", "White"],
  ["--color-dark-0", "Black"],
];

const toSwatch = ([token, label]: [string, string]): Swatch => ({
  value: `var(${token})`,
  label,
});

/** Text colours (FormatControls' set); "Auto" leads them. */
export const TEXT_SWATCHES: Swatch[] = THEME_TOKENS.map(toSwatch);

/** Tile fills (ColorPicker's set: the theme colours plus the tile default). */
export const FILL_SWATCHES: Swatch[] = [
  ...THEME_TOKENS.map(toSwatch),
  { value: "var(--color-tile-background)", label: "Default" },
];
