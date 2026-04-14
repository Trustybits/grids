export interface AuthProvider {
  /** Return the current authenticated user's ID, or null if not signed in. */
  getCurrentUserId(): string | null;
}
