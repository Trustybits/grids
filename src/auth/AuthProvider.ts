/**
 * Minimal domain representation of an authenticated user.
 * Keeps the auth provider's `User` type out of consumer code.
 */
export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthProvider {
  /** Return the current authenticated user's ID, or null if not signed in. */
  getCurrentUserId(): string | null;

  /** Return the current authenticated user as a domain object, or null if not signed in. */
  getCurrentUser(): AuthUser | null;

  /**
   * Subscribe to auth state changes. The callback fires whenever the user signs
   * in or out. Returns an unsubscribe function that detaches the listener.
   */
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void;

  /**
   * Resolve once the initial auth state has been hydrated. On page reload the
   * underlying auth SDK populates the current user asynchronously; callers
   * (e.g. the router guard) should await this before making redirect decisions.
   */
  waitForAuthReady(): Promise<AuthUser | null>;

  /** Start a Google sign-in popup flow and resolve with the signed-in user. */
  signInWithGoogle(): Promise<AuthUser>;

  /**
   * Send a passwordless sign-in link to the given email address. `redirectUrl`
   * is the URL the link should return the user to once clicked.
   */
  sendEmailSignInLink(email: string, redirectUrl: string): Promise<void>;

  /** Return true if the given URL is a valid email sign-in link. */
  isEmailSignInLink(url: string): boolean;

  /**
   * Complete the passwordless sign-in flow using the email the link was sent
   * to and the link URL the user landed on. Resolves with the signed-in user.
   */
  completeEmailSignIn(email: string, url: string): Promise<AuthUser>;

  /** Sign the current user out. */
  signOut(): Promise<void>;
}
