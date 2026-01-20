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
  // Base colors
  mediumDark: '#000000',
  mediumLight: '#ffffff',
  
  // Primary background and content colors
  darkPrimaryBg: '#10100E',
  contentBg: '#FFFEF5',
  
  // Tile backgrounds
  tileBgLightPrimary: '#FEFDEC',
  tileBgDarkPrimary: '#33312C21', // 21% opacity
  
  // Text
  textPrimary: '#33312C',
  
  // Strokes
  strokeDarkPrimary: '#FFFEF521', // 13% opacity
  
  // Grids light collection (based on #FEFDEC)
  gridsLight100: '#FEFDEC',
  gridsLight76: '#FEFDEC76',  // 76% opacity = C2 in hex
  gridsLight55: '#FEFDEC55',  // 55% opacity = 8C in hex
  gridsLight34: '#FEFDEC34',  // 34% opacity = 57 in hex
  gridsLight8: '#FEFDEC08',   // 8% opacity
  
  // Grids dark collection (based on #33312C)
  gridsDark0: '#33312C',
  gridsDark76: '#33312CC2',   // 76% opacity = C2 in hex
  gridsDark55: '#33312C8C',   // 55% opacity = 8C in hex
  gridsDark34: '#33312C57',   // 34% opacity = 57 in hex
  gridsDark8: '#33312C08',    // 8% opacity
  
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
