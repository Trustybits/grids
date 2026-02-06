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
 * Helper function to get today's date as YYYY-MM-DD string
 */
function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

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
    });

    return newGameData;
  }
}

/**
 * Increment the total clicks for a user with daily cap enforcement
 * Uses Firestore transactions to atomically check and update, preventing race conditions
 * The server-side security rules provide an additional layer of validation
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
  
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback({
        userId,
        displayName: data.displayName,
        totalClicks: data.totalClicks || 0,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      });
    }
  });
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

  return onSnapshot(q, (querySnapshot) => {
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
  });
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
