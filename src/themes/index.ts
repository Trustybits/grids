import type { Theme, ThemeRegistry } from '@/types/theme';

const rgbaToHex = (r: number, g: number, b: number, a: number = 1): string => {
  const toHex = (n: number) => {
    const hex = Math.round(n * 255).toString(16).padStart(2, '0');
    return hex;
  };
  
  const hexColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  
  if (a < 1) {
    return `${hexColor}${toHex(a)}`;
  }
  
  return hexColor;
};

const rawColors = {
  mediumDark: '#000000',
  mediumLight: '#ffffff',
  
  darkPrimaryBg: rgbaToHex(0.0627, 0.0627, 0.0549),
  contentBg: rgbaToHex(1, 0.996, 0.96),
  
  tileBgLightPrimary: rgbaToHex(0.9959, 0.9918, 0.9241),
  tileBgDarkPrimary: rgbaToHex(0.2, 0.1936, 0.1725, 0.21),
  
  textPrimary: rgbaToHex(0.2, 0.1936, 0.1725),
  
  strokeDarkPrimary: rgbaToHex(1, 0.996, 0.96, 0.13),
  
  gridsLight100: rgbaToHex(0.9959, 0.9918, 0.9241),
  gridsLight76: rgbaToHex(0.9959, 0.9918, 0.9241, 0.76),
  gridsLight55: rgbaToHex(0.9959, 0.9918, 0.9241, 0.55),
  gridsLight34: rgbaToHex(0.9959, 0.9918, 0.9241, 0.34),
  gridsLight8: rgbaToHex(0.9959, 0.9918, 0.9241, 0.08),
  
  gridsDark0: rgbaToHex(0.2, 0.1936, 0.1725),
  gridsDark76: rgbaToHex(0.2, 0.1936, 0.1725, 0.76),
  gridsDark55: rgbaToHex(0.2, 0.1936, 0.1725, 0.55),
  gridsDark34: rgbaToHex(0.2, 0.1936, 0.1725, 0.34),
  gridsDark8: rgbaToHex(0.2, 0.1936, 0.1725, 0.08),
  
  substackPrimary: rgbaToHex(1, 0.4039, 0.0980),
  instagramYellow: rgbaToHex(1, 0.8392, 0),
  instagramOrange: rgbaToHex(1, 0.4784, 0),
  instagramRed: rgbaToHex(1, 0, 0.4118),
  instagramPink: rgbaToHex(0.8275, 0, 0.7725),
  instagramPurple: rgbaToHex(0.4627, 0.2196, 0.9804),
  youtubeMagenta: rgbaToHex(0.9961, 0.1529, 0.5725),
  youtubeRed: rgbaToHex(1, 0.0039, 0.1961),
  figmaPurple: rgbaToHex(0.5294, 0.3098, 1),
  figmaRed: rgbaToHex(1, 0.2157, 0.2157),
  figmaOrange: rgbaToHex(1, 0.4471, 0.2157),
  figmaBlue: rgbaToHex(0, 0.7137, 1),
  figmaGreen: rgbaToHex(0.1412, 0.7961, 0.4431),
};

export const themes: ThemeRegistry = {
  light: {
    id: 'light',
    name: 'Light',
    colors: {
      contentBackground: rawColors.contentBg,
      tileBackground: rawColors.contentBg,
      tileStroke: rawColors.textPrimary,
      textPrimary: rawColors.textPrimary,
      contentHigh: rawColors.gridsDark76,
      contentDefault: rawColors.gridsDark55,
      contentLow: rawColors.gridsDark34,
      
      substackPrimary: rawColors.substackPrimary,
      instagramYellow: rawColors.instagramYellow,
      instagramOrange: rawColors.instagramOrange,
      instagramRed: rawColors.instagramRed,
      instagramPink: rawColors.instagramPink,
      instagramPurple: rawColors.instagramPurple,
      youtubeMagenta: rawColors.youtubeMagenta,
      youtubeRed: rawColors.youtubeRed,
      figmaPurple: rawColors.figmaPurple,
      figmaRed: rawColors.figmaRed,
      figmaOrange: rawColors.figmaOrange,
      figmaBlue: rawColors.figmaBlue,
      figmaGreen: rawColors.figmaGreen,
    },
  },
  
  dark: {
    id: 'dark',
    name: 'Dark',
    colors: {
      contentBackground: rawColors.darkPrimaryBg,
      tileBackground: rawColors.mediumDark,
      tileStroke: rawColors.strokeDarkPrimary,
      textPrimary: rawColors.contentBg,
      contentHigh: rawColors.gridsLight76,
      contentDefault: rawColors.gridsLight55,
      contentLow: rawColors.gridsLight34,
      
      substackPrimary: rawColors.substackPrimary,
      instagramYellow: rawColors.instagramYellow,
      instagramOrange: rawColors.instagramOrange,
      instagramRed: rawColors.instagramRed,
      instagramPink: rawColors.instagramPink,
      instagramPurple: rawColors.instagramPurple,
      youtubeMagenta: rawColors.youtubeMagenta,
      youtubeRed: rawColors.youtubeRed,
      figmaPurple: rawColors.figmaPurple,
      figmaRed: rawColors.figmaRed,
      figmaOrange: rawColors.figmaOrange,
      figmaBlue: rawColors.figmaBlue,
      figmaGreen: rawColors.figmaGreen,
    },
  },
};

export const getTheme = (id: string): Theme => {
  return themes[id] || themes.light;
};

export const getAvailableThemes = (): Theme[] => {
  return Object.values(themes);
};
