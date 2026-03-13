import { useLayoutStore } from "@/stores/layout";
import { useThemeStore } from "@/stores/theme";
import type { ProfileBioContent, TextContent, ImageContent, VideoContent, LinkContent } from "@/types/TileContent";
import { computed, watch, type ComputedRef } from "vue";

type ColorPickerContent =
  | TextContent
  | ProfileBioContent
  | ImageContent
  | VideoContent
  | LinkContent;

export interface ColorPickerValues {
  backgroundColor: ComputedRef<string>;
  textColor: ComputedRef<string>;
  overlayColor: ComputedRef<string | null>;
  handleBackgroundColorChange: (color: string) => void;
}

const themeStore = useThemeStore();

const STRUCTURAL_COLORS = new Set([
  "var(--color-tile-background)",
  "var(--color-light-100)",
  "var(--color-dark-0)",
  "var(--color-content-background)",
]);

const isStructuralColor = (color: string): boolean =>
  STRUCTURAL_COLORS.has(color);

export const useColorPicker = (
  tileId: string | null,
  content: ColorPickerContent,
  emit: (type: any, value: string) => void,
  mode: "background" | "overlay" = "background",
): ColorPickerValues => {
  const layoutStore = useLayoutStore();
  const backgroundColorRef = computed(() => content?.backgroundColor);

  const overlayColor = computed((): string | null => {
    const color = backgroundColorRef.value;
    if (!color || isStructuralColor(color)) return null;
    return color;
  });

  const backgroundColor = computed(() => {
    const color = backgroundColorRef.value;
    if (mode === "overlay" && color && !isStructuralColor(color)) {
      return resolveBackgroundColor(undefined);
    }
    return resolveBackgroundColor(color);
  });

  const textColor = computed(() => {
    return computeTextColor(backgroundColor.value);
  });

  const handleBackgroundColorChange = (color: string) => {
    if (!layoutStore.canEdit) return;

    content.backgroundColor = color;
    if (tileId) {
      layoutStore.patchTileContent(tileId, { backgroundColor: color });
    } else {
      layoutStore.saveLayout();
    }
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

const computeTextColor = (backgroundColor: string): string => {
  const bg = backgroundColor;
  let hex: string | undefined;

  if (bg.startsWith("#")) {
    hex = bg;
  } else if (bg === "var(--color-tile-background)") {
    hex = themeStore.isDarkMode ? "#000000" : "#FFFEF5";
  } else if (bg === "var(--color-content-background)") {
    hex = themeStore.isDarkMode ? "#10100E" : "#FFFEF5";
  } else {
    hex = colors[bg];
  }

  if (!hex) return "";
  return getLuminance(hex) > 0.5 ? "#000000" : "#FFFFFF";
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
