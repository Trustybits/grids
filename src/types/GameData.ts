export interface UserGameData {
  userId: string;
  displayName: string;
  totalClicks: number;
  createdAt: Date;
  updatedAt: Date;
  // Daily click cap tracking
  dailyClicks?: number; // Clicks made today
  lastClickDate?: string; // Date string (YYYY-MM-DD) of last click to track daily reset
  // Passive boost system (prestige-like mechanic)
  passiveBoost?: number; // Multiplier for passive click generation (e.g., 1.5 = 50% boost)
  totalPassiveClicks?: number; // Total clicks earned passively
  // Future game stats can be added here
  // e.g., totalPlayTime, achievements, etc.
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalClicks: number;
  rank?: number;
}
