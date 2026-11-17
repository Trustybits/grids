import { useGridController } from "@/controllers/useGridController";
import { useThemeStore } from "@/stores/theme";
import type {
  ProfileBioContent,
  TextContent,
  SmartTextContent,
  ImageContent,
  VideoContent,
  LinkContent,
  DocumentsContent,
} from "@grids/contracts/types";
import { computed, unref, watch, type ComputedRef, type Ref } from "vue";
import {
  colorModePatch,
  fillOptionsFor,
  fillPatch,
  overlayPatch,
  readPickerFill,
  readPickerOverlay,
  resolveColorMode,
  resolveOverlayColor,
  storedFillColor,
  type FillContent,
  type FillOptions,
} from "@/utils/tileFill";

type ColorPickerContent =
  | TextContent
  | SmartTextContent
  | ProfileBioContent
  | ImageContent
  | VideoContent
  | LinkContent
  | DocumentsContent;

type ColorPickerContentSource = ColorPickerContent | Readonly<Ref<ColorPickerContent>>;

export interface ColorPickerValues {
  backgroundColor: ComputedRef<string>;
  textColor: ComputedRef<string>;
  overlayColor: ComputedRef<string | null>;
  // Raw values the color picker should present as "current" for each target.
  // These mirror the remembered color for each treatment (independent of which
  // one is currently active) so the Fill/Overlay toggle reflects real values.
  pickerFillColor: ComputedRef<string>;
  pickerOverlayColor: ComputedRef<string>;
  // Which treatment is active on the tile, and a setter for the toggle.
  colorMode: ComputedRef<"fill" | "overlay">;
  setColorMode: (mode: "fill" | "overlay") => void;
  handleBackgroundColorChange: (color: string) => void;
  handleOverlayColorChange: (color: string) => void;
}

/** How a tile type stores its fill — see `utils/tileFill`. */
export type ColorPickerOptions = FillOptions;

// Reads/writes for the optional overlay fields. The shared ColorPickerContent
// union includes non-overlay tiles, so access is narrowed through this shape
// rather than the union directly.
type OverlayContent = ColorPickerContent & FillContent;

export const useColorPicker = (
  tileId: string | null,
  content: ColorPickerContentSource,
  emit: (type: "background-color-change" | "text-color-change", value: string) => void,
  // Defaults to the tile type's own fill rules, the same table the phone
  // toolbars read, so the two surfaces can't drift apart.
  options: ColorPickerOptions = fillOptionsFor(
    (unref(content) as { type: string }).type,
  ) ?? {},
): ColorPickerValues => {
  const controller = useGridController();
  const canEdit = computed(() => controller.canEditCurrentGrid());

  // `content` may be a ref whose identity is swapped by undo/redo, so always
  // read and write through the unwrapped current value.
  const currentContent = computed(() => unref(content) as OverlayContent);

  // The remembered overlay tint, independent of whether the overlay is the
  // active treatment (legacy chromatic backgrounds included).
  const resolvedOverlayColor = computed(() =>
    resolveOverlayColor(currentContent.value ?? {}, options),
  );

  // Which treatment is active on the tile.
  const colorMode = computed(() =>
    resolveColorMode(currentContent.value ?? {}, options),
  );

  // The overlay actually rendered — only when the overlay treatment is active.
  const overlayColor = computed((): string | null =>
    colorMode.value === "overlay" ? resolvedOverlayColor.value : null,
  );

  // A legacy image/video tint in backgroundColor renders as the default fill
  // until the user first edits a color (which persists an explicit overlay).
  const backgroundColor = computed(() =>
    resolveBackgroundColor(storedFillColor(currentContent.value ?? {}, options)),
  );

  const textColor = computed(() => {
    return computeTextColor(backgroundColor.value);
  });

  // What the picker shows as current for each target.
  const pickerFillColor = computed(() =>
    readPickerFill(currentContent.value ?? {}, options),
  );
  const pickerOverlayColor = computed(() =>
    readPickerOverlay(currentContent.value ?? {}, options),
  );

  const persist = (patch: Partial<OverlayContent>) => {
    if (tileId) {
      // Live grid: the controller owns the canonical write and persistence.
      controller.patchTileContent(tileId, patch);
      return;
    }
    // Non-live preview (e.g. demo/landing) with no tile identity: keep the
    // change local and never touch grid persistence. Demo isolation is Step 6.
    Object.assign(currentContent.value, patch);
  };

  // Toggle which treatment is active without losing either color.
  const setColorMode = (mode: "fill" | "overlay") => {
    if (!canEdit.value) return;
    persist(colorModePatch(mode));
  };

  const handleBackgroundColorChange = (color: string) => {
    if (!canEdit.value) return;
    persist(fillPatch(currentContent.value ?? {}, color, options));
  };

  const handleOverlayColorChange = (color: string) => {
    if (!canEdit.value) return;
    persist(overlayPatch(currentContent.value ?? {}, color, options));
  };

  watch(backgroundColor, (color) => emit("background-color-change", color), {
    immediate: true,
  });

  watch(textColor, (color) => emit("text-color-change", color), {
    immediate: true,
  });

  return {
    backgroundColor,
    textColor,
    overlayColor,
    pickerFillColor,
    pickerOverlayColor,
    colorMode,
    setColorMode,
    handleBackgroundColorChange,
    handleOverlayColorChange,
  };
};

const colors: Record<string, string> = {
  "var(--color-red)": "#FFAFA3",
  "var(--color-orange)": "#FFD3A8",
  "var(--color-yellow)": "#FFE299",
  "var(--color-green)": "#B3EFBD",
  "var(--color-cyan)": "#B3F4EF",
  "var(--color-blue)": "#A8DAFF",
  "var(--color-purple)": "#D3BDFF",
  "var(--color-pink)": "#FFA8DB",
  "var(--color-light-100)": "#FEFDEC",
  "var(--color-dark-0)": "#33312C",
  "var(--color-tile-background)": "#000000",
  "var(--color-content-background)": "#10100E",
};

export const computeTextColor = (backgroundColor: string, modifier: string = "none"): string => {
  const bg = backgroundColor;
  let hex: string | undefined;

  if (bg.startsWith("#")) {
    hex = bg;
  } else if (bg === "var(--color-tile-background)") {
    const ts = useThemeStore();
    hex = ts.isDarkMode ? "#000000" : "#FFFEF5";
  } else if (bg === "var(--color-content-background)" || bg === "transparent") {
    // A transparent (no-fill) tile shows the page/grid background behind it, so
    // pick legible text against that page background rather than the tile fill.
    const ts = useThemeStore();
    hex = ts.isDarkMode ? "#10100E" : "#FFFEF5";
  } else {
    hex = colors[bg];
  }

  if (!hex) return "";
  let textColor = getLuminance(hex) > 0.5 ? "#000000" : "#FFFFFF";
  if (modifier === "low") {
    textColor = textColor === "#000000" ? "#00000057" : "#FFFFFF57";
  }
  return textColor;
};

const getLuminance = (hex: string): number => {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};

// The "no fill" swatch persists the page-background token as its sentinel.
// That token is an opaque, theme-dependent color (the same one painted behind
// the whole page), so it only *looks* fill-less while no grid background image
// is set. With a grid background active it covers the image instead of dropping
// out. Render it as a truly transparent fill so "no fill" removes the tile
// background everywhere and the grid background shows through.
export const NO_FILL_COLOR = "var(--color-content-background)";
const TRANSPARENT_FILL = "transparent";

const resolveBackgroundColor = (
  backgroundColor?: string,
  fallback: string = "var(--color-tile-background)",
): string => {
  // Treat an empty string (a cleared fill) the same as an unset one.
  const resolved = backgroundColor || fallback;
  return resolved === NO_FILL_COLOR ? TRANSPARENT_FILL : resolved;
};
