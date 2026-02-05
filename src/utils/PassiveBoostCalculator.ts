/**
 * Passive Boost Calculator
 * Handles calculation of passive click generation based on total clicks achieved
 */

export interface BoostMilestone {
  threshold: number;
  boostMultiplier: number;
  dailyPassiveClicks: number;
  name: string;
}

// Define boost milestones - users earn passive generation at these thresholds
// Passive clicks represent "gathering nearby sticks" that fell since last visit
export const BOOST_MILESTONES: BoostMilestone[] = [
  { threshold: 0, boostMultiplier: 0, dailyPassiveClicks: 0, name: "Novice" },
  { threshold: 100, boostMultiplier: 0.01, dailyPassiveClicks: 1, name: "Apprentice" },
  { threshold: 2500, boostMultiplier: 0.02, dailyPassiveClicks: 5, name: "Keeper" },
  { threshold: 20000, boostMultiplier: 0.03, dailyPassiveClicks: 15, name: "Guardian" },
  { threshold: 100000, boostMultiplier: 0.05, dailyPassiveClicks: 50, name: "Master" },
  { threshold: 250000, boostMultiplier: 0.08, dailyPassiveClicks: 200, name: "Legend" },
];

/**
 * Get the current boost tier based on total clicks
 */
export function getCurrentBoostTier(totalClicks: number): BoostMilestone {
  // Find the highest milestone the user has reached
  let currentTier = BOOST_MILESTONES[0];
  
  for (const milestone of BOOST_MILESTONES) {
    if (totalClicks >= milestone.threshold) {
      currentTier = milestone;
    } else {
      break;
    }
  }
  
  return currentTier;
}

/**
 * Get the next boost tier the user can achieve
 */
export function getNextBoostTier(totalClicks: number): BoostMilestone | null {
  for (const milestone of BOOST_MILESTONES) {
    if (totalClicks < milestone.threshold) {
      return milestone;
    }
  }
  return null; // User has reached max tier
}

/**
 * Calculate passive clicks earned based on time elapsed
 * @param totalClicks - User's total clicks to determine boost tier
 * @param lastUpdateTime - Last time passive clicks were calculated (Date)
 * @param currentTime - Current time (Date)
 * @returns Number of passive clicks earned
 */
export function calculatePassiveClicks(
  totalClicks: number,
  lastUpdateTime: Date,
  currentTime: Date = new Date()
): number {
  const currentTier = getCurrentBoostTier(totalClicks);
  
  // No passive generation at tier 0
  if (currentTier.dailyPassiveClicks === 0) {
    return 0;
  }
  
  // Calculate time elapsed in hours
  const timeElapsedMs = currentTime.getTime() - lastUpdateTime.getTime();
  const hoursElapsed = timeElapsedMs / (1000 * 60 * 60);
  
  // Calculate passive clicks based on daily rate
  const clicksPerHour = currentTier.dailyPassiveClicks / 24;
  const passiveClicks = Math.floor(clicksPerHour * hoursElapsed);
  
  return passiveClicks;
}

/**
 * Get progress to next tier as a percentage
 */
export function getProgressToNextTier(totalClicks: number): number {
  const currentTier = getCurrentBoostTier(totalClicks);
  const nextTier = getNextBoostTier(totalClicks);
  
  if (!nextTier) {
    return 100; // Max tier reached
  }
  
  const clicksIntoCurrentTier = totalClicks - currentTier.threshold;
  const clicksNeededForNextTier = nextTier.threshold - currentTier.threshold;
  
  return Math.min(100, (clicksIntoCurrentTier / clicksNeededForNextTier) * 100);
}
