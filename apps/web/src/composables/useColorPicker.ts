import { useGridStore } from "@/stores/grid";
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
import { computed, watch, type ComputedRef } from "vue";

type ColorPickerContent =
  | TextContent
  | SmartTextContent
  | ProfileBioContent
  | ImageContent
  | VideoContent
  | LinkContent
  | DocumentsContent;

export interface ColorPickerValues {
  backgroundColor: ComputedRef<string>;
  textColor: ComputedRef<string>;
  overlayColor: ComputedRef<string | null>;
  handleBackgroundColorChange: (color: string) => void;
  handleOverlayColorChange: (color: string) => void;
}

export interface ColorPickerOptions {
  /**
   * The tile renders a `mix-blend-mode: color` overlay layer fed by
   * `overlayColor`, so the color picker should expose a separate overlay target.
   */
  overlayCapable?: boolean;
  /**
   * Legacy media tiles (image/video) historically stored the blend tint in
   * `backgroundColor`. When set, a chromatic `backgroundColor` is interpreted as
   * the overlay tint (and the fill falls back to the default) until an explicit
   * `overlayColor` is chosen.
   */
  legacyBackgroundAsOverlay?: boolean;
  /**
   * Legacy preview tiles (link/document) historically tinted their preview with
   * the fill color. When set, a chromatic `backgroundColor` also drives the
   * overlay tint until an explicit `overlayColor` is chosen, while the fill keeps
   * its color.
   */
  legacyBackgroundAlsoOverlay?: boolean;
}

const STRUCTURAL_COLORS = new Set([
  "var(--color-tile-background)",
  "var(--color-light-100)",
  "var(--color-dark-0)",
  "var(--color-content-background)",
]);

const isStructuralColor = (color: string): boolean =>
  STRUCTURAL_COLORS.has(color);

// Reads/writes for the optional `overlayColor` field. The shared
// ColorPickerContent union includes non-overlay tiles, so access is narrowed
// through this shape rather than the union directly.
type OverlayContent = ColorPickerContent & { overlayColor?: string };

export const useColorPicker = (
  tileId: string | null,
  content: ColorPickerContent,
  emit: (type: "background-color-change" | "text-color-change", value: string) => void,
  options: ColorPickerOptions = {},
): ColorPickerValues => {
  const gridStore = useGridStore();
  const {
    overlayCapable = false,
    legacyBackgroundAsOverlay = false,
    legacyBackgroundAlsoOverlay = false,
  } = options;

  const overlayContent = content as OverlayContent;
  const backgroundColorRef = computed(() => content?.backgroundColor);
  const overlayColorRef = computed(() => overlayContent?.overlayColor);

  const overlayColor = computed((): string | null => {
    if (!overlayCapable) return null;

    const explicit = overlayColorRef.value;
    if (explicit) return isStructuralColor(explicit) ? null : explicit;

    // No explicit overlay — fall back to the legacy interpretation of a
    // chromatic background color so existing grids keep their tint.
    const bg = backgroundColorRef.value;
    if (
      bg &&
      !isStructuralColor(bg) &&
      (legacyBackgroundAsOverlay || legacyBackgroundAlsoOverlay)
    ) {
      return bg;
    }
    return null;
  });

  const backgroundColor = computed(() => {
    const color = backgroundColorRef.value;
    // For image/video the chromatic background was really the tint, so the fill
    // resolves to the default until an explicit overlay has been split out.
    if (
      legacyBackgroundAsOverlay &&
      !overlayColorRef.value &&
      color &&
      !isStructuralColor(color)
    ) {
      return resolveBackgroundColor(undefined);
    }
    return resolveBackgroundColor(color);
  });

  const textColor = computed(() => {
    return computeTextColor(backgroundColor.value);
  });

  const persist = (patch: Partial<OverlayContent>) => {
    if (tileId) {
      gridStore.patchTileContent(tileId, patch);
    } else {
      gridStore.saveGrid();
    }
  };

  const handleBackgroundColorChange = (color: string) => {
    if (!gridStore.canEdit) return;

    const patch: Partial<OverlayContent> = { backgroundColor: color };

    // Promote a legacy tint out of `backgroundColor` before overwriting it, so
    // setting an explicit fill doesn't silently discard an existing overlay.
    const bg = backgroundColorRef.value;
    if (
      legacyBackgroundAsOverlay &&
      !overlayColorRef.value &&
      bg &&
      !isStructuralColor(bg)
    ) {
      overlayContent.overlayColor = bg;
      patch.overlayColor = bg;
    }

    content.backgroundColor = color;
    persist(patch);
  };

  const handleOverlayColorChange = (color: string) => {
    if (!gridStore.canEdit) return;

    // Structural picks (default / light / dark / no-fill) clear the overlay.
    const next = isStructuralColor(color) ? "" : color;
    overlayContent.overlayColor = next;
    persist({ overlayColor: next });
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
  } else if (bg === "var(--color-content-background)") {
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

const resolveBackgroundColor = (
  backgroundColor?: string,
  fallback: string = "var(--color-tile-background)",
): string => {
  return backgroundColor ?? fallback;
};
