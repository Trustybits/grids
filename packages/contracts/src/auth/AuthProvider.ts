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

/** How a user can prove who they are when re-authenticating. */
export type AuthSignInMethod = "google" | "emailLink";

export type AuthProviderErrorCode =
  | "requires-recent-login"
  | "email-already-in-use"
  | "invalid-email"
  | "too-many-requests"
  | "user-mismatch"
  | "invalid-link"
  | "popup-closed"
  | "not-signed-in"
  | "unknown";

/**
 * Provider-neutral auth error, so consumers can branch on a stable code
 * without depending on the underlying auth SDK's error shapes.
 */
export class AuthProviderError extends Error {
  public readonly code: AuthProviderErrorCode;

  public constructor(code: AuthProviderErrorCode, message?: string) {
    super(message ?? code);
    this.name = "AuthProviderError";
    this.code = code;
  }
}

export function isAuthProviderError(
  error: unknown,
): error is AuthProviderError {
  return (
    error instanceof AuthProviderError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "AuthProviderError" &&
      typeof (error as { code?: unknown }).code === "string")
  );
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

  /** The ways the current user can re-authenticate (empty when signed out). */
  getSignInMethods(): AuthSignInMethod[];

  /**
   * Send a verification link to `newEmail`; the account email only changes
   * once that link is opened. The old address is notified with a revert link.
   * `continueUrl` is where the user lands after verifying.
   *
   * Rejects with `AuthProviderError("requires-recent-login")` when the user
   * must re-authenticate first.
   */
  requestEmailChange(newEmail: string, continueUrl: string): Promise<void>;

  /** Re-authenticate the current user with a Google popup. */
  reauthenticateWithGoogle(): Promise<void>;

  /**
   * Re-authenticate the current user with an email sign-in link that was sent
   * to their current address. `url` is the link the user landed on.
   */
  reauthenticateWithEmailLink(url: string): Promise<void>;

  /**
   * Re-fetch the current user from the auth backend (e.g. after an email
   * change). Rejects if the session is no longer valid.
   */
  reloadCurrentUser(): Promise<AuthUser | null>;

  /**
   * Sign in with a one-time token issued by the account-recovery backend.
   * Counts as a fresh sign-in for sensitive operations.
   */
  signInWithRecoveryToken(token: string): Promise<AuthUser>;
}
