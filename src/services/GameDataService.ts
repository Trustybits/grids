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
} from "firebase/firestore";
import type { UserGameData, LeaderboardEntry } from "@/types/GameData";
import { generateSeededDisplayName } from "@/utils/NameGenerator";

const GAME_DATA_COLLECTION = "userGameData";

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
 * Increment the total clicks for a user
 * Uses Firestore's atomic increment to handle concurrent clicks safely
 */
export async function incrementUserClicks(userId: string, amount: number = 1): Promise<void> {
  const docRef = doc(db, GAME_DATA_COLLECTION, userId);
  
  // First ensure the document exists
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    await getOrCreateUserGameData(userId);
  }
  
  // Atomically increment the clicks
  await updateDoc(docRef, {
    totalClicks: increment(amount),
    updatedAt: serverTimestamp(),
  });
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
