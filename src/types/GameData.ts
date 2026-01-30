export interface UserGameData {
  userId: string;
  displayName: string;
  totalClicks: number;
  createdAt: Date;
  updatedAt: Date;
  // Future game stats can be added here
  // e.g., totalPlayTime, achievements, etc.
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  totalClicks: number;
  rank?: number;
}
