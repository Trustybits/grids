import { db, functions } from '@/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { UserProfile, SlugAvailabilityResponse, SlugClaimResponse } from '@/types/UserProfile';

/**
 * Service for managing user profile data including slugs and default grids
 */

/**
 * Get user profile data by user ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return null;
    }
    
    return userSnap.data() as UserProfile;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

/**
 * Get user ID by slug from the public slugs collection
 */
export async function getUserIdBySlug(slug: string): Promise<string | null> {
  try {
    const slugRef = doc(db, 'slugs', slug.toLowerCase());
    const slugSnap = await getDoc(slugRef);
    
    if (!slugSnap.exists()) {
      return null;
    }
    
    return slugSnap.data()?.userId || null;
  } catch (error) {
    console.error('Error fetching user by slug:', error);
    throw error;
  }
}

/**
 * Check if a slug is available using Cloud Function
 */
export async function checkSlugAvailability(slug: string): Promise<SlugAvailabilityResponse> {
  try {
    const checkAvailability = httpsCallable<{ slug: string }, SlugAvailabilityResponse>(
      functions,
      'checkSlugAvailability'
    );
    const result = await checkAvailability({ slug });
    return result.data;
  } catch (error: any) {
    console.error('Error checking slug availability:', error);
    throw new Error(error.message || 'Failed to check slug availability');
  }
}

/**
 * Claim a slug for the current user using Cloud Function
 */
export async function claimSlug(slug: string): Promise<SlugClaimResponse> {
  try {
    const claim = httpsCallable<{ slug: string }, SlugClaimResponse>(
      functions,
      'claimSlug'
    );
    const result = await claim({ slug });
    return result.data;
  } catch (error: any) {
    console.error('Error claiming slug:', error);
    throw new Error(error.message || 'Failed to claim slug');
  }
}

/**
 * Set the default grid for a user
 * Uses Cloud Function to sync defaultGridId to slugs collection for public access
 */
export async function setDefaultGrid(userId: string, gridId: string | null): Promise<void> {
  try {
    const updateGrid = httpsCallable<{ gridId: string | null }, { success: boolean }>(
      functions,
      'updateDefaultGrid'
    );
    await updateGrid({ gridId });
  } catch (error) {
    console.error('Error setting default grid:', error);
    throw error;
  }
}

/**
 * Update user profile data
 */
export async function updateUserProfile(userId: string, data: Partial<UserProfile>): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, data, { merge: true });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}
