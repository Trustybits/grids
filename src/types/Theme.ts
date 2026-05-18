export interface ThemeColors {
  contentBackground: string;
  tileBackground: string;
  tileStroke: string;
  textPrimary: string;
  contentHigh: string;
  contentDefault: string;
  contentLow: string;
  
  substackPrimary: string;
  instagramYellow: string;
  instagramOrange: string;
  instagramRed: string;
  instagramPink: string;
  instagramPurple: string;
  youtubeMagenta: string;
  youtubeRed: string;
  figmaPurple: string;
  figmaRed: string;
  figmaOrange: string;
  figmaBlue: string;
  figmaGreen: string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export interface ThemeRegistry {
  [key: string]: Theme;
}
