export interface UserPresence {
  userId: string;
  userName: string;
  userColor: string;
  cursor: {
    x: number;
    y: number;
  };
  lastSeen: number; // Timestamp in milliseconds
}

// Generate a random color for user cursors
export function generateUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Light Blue
    '#F8B88B', // Peach
    '#AAB7B8', // Gray
  ];
  
  // Use userId to deterministically select a color
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}
