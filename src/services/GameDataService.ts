import { db } from "@/firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
  runTransaction,
} from "firebase/firestore";
import type { UserGameData, LeaderboardEntry } from "@/types/GameData";
import { generateSeededDisplayName } from "@/utils/NameGenerator";

const GAME_DATA_COLLECTION = "userGameData";
const DAILY_CLICK_CAP = 100; // Maximum clicks a user can make per day

/**
 * Get or create game data for a user
 * If the user doesn't have game data yet, creates it with a random display name
 */
export async function getOrCreateUserGameData(userId: string): Promise<UserGameData> {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      userId,
      displayName: data.displayName,
      totalClicks: data.totalClicks || 0,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      dailyClicks: data.dailyClicks || 0,
      lastClickDate: data.lastClickDate || getTodayDateString(),
      passiveBoost: data.passiveBoost || 0,
      totalPassiveClicks: data.totalPassiveClicks || 0,
    };
  } else {
    // Create new game data with random display name
    const displayName = generateSeededDisplayName(userId);
    const now = new Date();
    const newGameData: UserGameData = {
      userId,
      displayName,
      totalClicks: 0,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(docRef, {
      displayName,
      totalClicks: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      dailyClicks: 0,
      lastClickDate: getTodayDateString(),
      passiveBoost: 0,
      totalPassiveClicks: 0,
    });

    return newGameData;
  }
}

/**
 * Helper function to get today's date as YYYY-MM-DD string
 */
function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Check if a user has reached their daily click cap
 * Returns an object with canClick boolean and remaining clicks
 */
export async function checkDailyClickLimit(userId: string): Promise<{ canClick: boolean; remaining: number; dailyClicks: number }> {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return { canClick: true, remaining: DAILY_CLICK_CAP, dailyClicks: 0 };
  }
  
  const data = docSnap.data();
  const today = getTodayDateString();
  const lastClickDate = data.lastClickDate || '';
  
  // Reset daily clicks if it's a new day
  if (lastClickDate !== today) {
    return { canClick: true, remaining: DAILY_CLICK_CAP, dailyClicks: 0 };
  }
  
  const dailyClicks = data.dailyClicks || 0;
  const remaining = Math.max(0, DAILY_CLICK_CAP - dailyClicks);
  
  return {
    canClick: dailyClicks < DAILY_CLICK_CAP,
    remaining,
    dailyClicks,
  };
}

/**
 * Increment the total clicks for a user with daily cap enforcement
 * Uses Firestore's atomic increment to handle concurrent clicks safely
 * Returns true if click was successful, false if daily cap reached
 */
export async function incrementUserClicks(userId: string, amount: number = 1): Promise<boolean> {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  
  try {
    // Use a transaction to atomically read, check, and update
    const result = await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(docRef);
      
      // If document doesn't exist, create it first (outside transaction)
      if (!docSnap.exists()) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }
      
      const data = docSnap.data();
      const today = getTodayDateString();
      const lastClickDate = data.lastClickDate || '';
      const currentDailyClicks = data.dailyClicks || 0;
      
      // Check if it's a new day
      const isNewDay = lastClickDate !== today;
      
      // Calculate what the new daily clicks would be
      const newDailyClicks = isNewDay ? amount : currentDailyClicks + amount;
      
      // Check daily limit (client-side check for better UX, server rules enforce it)
      if (!isNewDay && newDailyClicks > DAILY_CLICK_CAP) {
        return false; // Daily cap reached
      }
      
      // Prepare update object
      const updateData: any = {
        totalClicks: increment(amount),
        updatedAt: serverTimestamp(),
        lastClickDate: today,
      };
      
      // Reset daily clicks if it's a new day, otherwise increment
      if (isNewDay) {
        updateData.dailyClicks = amount;
      } else {
        updateData.dailyClicks = increment(amount);
      }
      
      // Atomically update the document
      transaction.update(docRef, updateData);
      return true;
    });
    
    return result;
  } catch (error: any) {
    // If document doesn't exist, create it and retry
    if (error.message === 'DOCUMENT_NOT_FOUND') {
      await getOrCreateUserGameData(userId);
      // Retry the increment
      return incrementUserClicks(userId, amount);
    }
    
    // If permission denied, likely hit the daily cap via security rules
    if (error.code === 'permission-denied') {
      console.warn('Click rejected by security rules - likely daily cap reached');
      return false;
    }
    
    // Log other errors but don't crash
    console.error('Error incrementing user clicks:', error);
    return false;
  }
}

/**
 * Subscribe to real-time updates for a user's game data
 */
export function subscribeToUserGameData(
  userId: string,
  callback: (data: UserGameData) => void
): () => void {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          userId,
          displayName: data.displayName,
          totalClicks: data.totalClicks || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          dailyClicks: data.dailyClicks || 0,
          lastClickDate: data.lastClickDate || getTodayDateString(),
          passiveBoost: data.passiveBoost || 0,
          totalPassiveClicks: data.totalPassiveClicks || 0,
        });
      }
    },
    (error) => {
      console.warn("Error subscribing to user game data:", error);
    }
  );
}

/**
 * Get the top N users by total clicks for the leaderboard
 */
export async function getLeaderboard(topN: number = 10): Promise<LeaderboardEntry[]> {
  const q = query(
    collection(db, GAME_DATA_COLLECTION),
    orderBy("totalClicks", "desc"),
    limit(topN)
  );

  const querySnapshot = await getDocs(q);
  const leaderboard: LeaderboardEntry[] = [];
  
  let rank = 1;
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    leaderboard.push({
      userId: doc.id,
      displayName: data.displayName,
      totalClicks: data.totalClicks || 0,
      rank: rank++,
    });
  });

  return leaderboard;
}

/**
 * Subscribe to real-time leaderboard updates
 */
export function subscribeToLeaderboard(
  topN: number = 10,
  callback: (leaderboard: LeaderboardEntry[]) => void
): () => void {
  const q = query(
    collection(db, GAME_DATA_COLLECTION),
    orderBy("totalClicks", "desc"),
    limit(topN)
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const leaderboard: LeaderboardEntry[] = [];
      let rank = 1;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        leaderboard.push({
          userId: doc.id,
          displayName: data.displayName,
          totalClicks: data.totalClicks || 0,
          rank: rank++,
        });
      });
      callback(leaderboard);
    },
    (error) => {
      console.warn("Error subscribing to leaderboard:", error);
      callback([]);
    }
  );
}

/**
 * Update a user's display name
 */
export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  await updateDoc(docRef, {
    displayName,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Increase a user's passive boost multiplier
 * This is like a prestige system - users can increase their passive generation
 */
export async function increasePassiveBoost(userId: string, boostAmount: number): Promise<void> {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  await updateDoc(docRef, {
    passiveBoost: increment(boostAmount),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Add passive clicks to a user's total
 * This is called when passive clicks are generated (e.g., from offline time or periodic generation)
 */
export async function addPassiveClicks(userId: string, amount: number): Promise<void> {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  await updateDoc(docRef, {
    totalClicks: increment(amount),
    totalPassiveClicks: increment(amount),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get the daily click cap constant
 */
export function getDailyClickCap(): number {
  return DAILY_CLICK_CAP;
}

/**
 * Claim passive clicks earned since last visit
 * This should be called when a user visits their campfire
 * Returns the number of passive clicks claimed
 */
export async function claimPassiveClicks(userId: string): Promise<number> {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return 0;
  }
  
  const data = docSnap.data();
  const totalClicks = data.totalClicks || 0;
  const lastUpdate = data.updatedAt?.toDate() || new Date();
  
  // Calculate passive clicks using the calculator
  const { calculatePassiveClicks } = await import('@/utils/PassiveBoostCalculator');
  const passiveClicks = calculatePassiveClicks(totalClicks, lastUpdate);
  
  if (passiveClicks > 0) {
    // Add passive clicks to user's total
    await updateDoc(docRef, {
      totalClicks: increment(passiveClicks),
      totalPassiveClicks: increment(passiveClicks),
      updatedAt: serverTimestamp(),
    });
  }
  
  return passiveClicks;
}
