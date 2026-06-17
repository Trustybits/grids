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
import { computed, unref, watch, type ComputedRef, type Ref } from "vue";

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
  // These mirror what is actually rendered (resolving legacy data) so the
  // Fill/Overlay toggle always reflects the real applied value.
  pickerFillColor: ComputedRef<string>;
  pickerOverlayColor: ComputedRef<string>;
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
  content: ColorPickerContentSource,
  emit: (type: "background-color-change" | "text-color-change", value: string) => void,
  options: ColorPickerOptions = {},
): ColorPickerValues => {
  const gridStore = useGridStore();
  const {
    overlayCapable = false,
    legacyBackgroundAsOverlay = false,
    legacyBackgroundAlsoOverlay = false,
  } = options;

  // `content` may be a ref whose identity is swapped by undo/redo, so always
  // read and write through the unwrapped current value.
  const currentContent = computed(() => unref(content) as OverlayContent);
  const backgroundColorRef = computed(() => currentContent.value?.backgroundColor);
  const overlayColorRef = computed(() => currentContent.value?.overlayColor);

  const overlayColor = computed((): string | null => {
    if (!overlayCapable) return null;

    const explicit = overlayColorRef.value;
    if (explicit !== undefined) {
      // Explicitly set (possibly "" to clear). Empty or structural = no overlay.
      if (!explicit || isStructuralColor(explicit)) return null;
      return explicit;
    }

    // overlayColor was never set — fall back to the legacy interpretation of a
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
    // Legacy image/video stored the tint in backgroundColor. Only treat it as a
    // tint (fill resolves to default) while overlayColor has never been set;
    // once the user touches either color we persist an explicit overlayColor and
    // backgroundColor becomes a true fill.
    if (
      legacyBackgroundAsOverlay &&
      overlayColorRef.value === undefined &&
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

  // The fill the picker should show as current. Empty when a legacy chromatic
  // background is actually rendering as a tint (so Fill reads as "none").
  const pickerFillColor = computed(() => {
    const bg = backgroundColorRef.value;
    if (
      legacyBackgroundAsOverlay &&
      overlayColorRef.value === undefined &&
      bg &&
      !isStructuralColor(bg)
    ) {
      return "";
    }
    return bg ?? "";
  });

  // The overlay the picker should show as current — the resolved tint,
  // including the legacy interpretation of a chromatic background.
  const pickerOverlayColor = computed(() => overlayColor.value ?? "");

  const persist = (patch: Partial<OverlayContent>) => {
    if (tileId) {
      // Patch first so the undo snapshot captures the pre-change state, then
      // mirror onto the local content for an immediate update.
      gridStore.patchTileContent(tileId, patch);
      Object.assign(currentContent.value, patch);
    } else {
      Object.assign(currentContent.value, patch);
      gridStore.saveGrid();
    }
  };

  const handleBackgroundColorChange = (color: string) => {
    if (!gridStore.canEdit) return;

    const patch: Partial<OverlayContent> = { backgroundColor: color };

    // image/video only: backgroundColor is the fill, but legacy tiles stored the
    // tint here. Settle the ambiguity on first edit by persisting an explicit
    // overlayColor — promoting any pre-existing chromatic tint, or marking "no
    // overlay" ("") — so the fill is never re-read as a tint.
    if (legacyBackgroundAsOverlay && overlayColorRef.value === undefined) {
      const bg = backgroundColorRef.value;
      patch.overlayColor = bg && !isStructuralColor(bg) ? bg : "";
    }

    persist(patch);
  };

  const handleOverlayColorChange = (color: string) => {
    if (!gridStore.canEdit) return;

    // Structural picks (default / light / dark / no-fill) clear the overlay.
    const next = isStructuralColor(color) ? "" : color;
    const patch: Partial<OverlayContent> = { overlayColor: next };

    // Legacy image/video: the chromatic backgroundColor was actually the tint.
    // Now that the overlay is explicit, clear that legacy value so it isn't
    // re-read as a fill.
    if (legacyBackgroundAsOverlay && overlayColorRef.value === undefined) {
      const bg = backgroundColorRef.value;
      if (bg && !isStructuralColor(bg)) {
        patch.backgroundColor = "";
      }
    }

    persist(patch);
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
  // Treat an empty string (a cleared fill) the same as an unset one.
  return backgroundColor || fallback;
};
