import {
  AuthProviderError,
  type AuthProvider,
  type AuthProviderErrorCode,
  type AuthSignInMethod,
  type AuthUser,
} from "@grids/contracts/auth";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendSignInLinkToEmail,
  signInWithCustomToken,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
  verifyBeforeUpdateEmail,
  type Auth,
  type User,
} from "firebase/auth";

function toAuthUser(user: User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  };
}

const FIREBASE_ERROR_CODES: Record<string, AuthProviderErrorCode> = {
  "auth/requires-recent-login": "requires-recent-login",
  "auth/email-already-in-use": "email-already-in-use",
  "auth/invalid-email": "invalid-email",
  "auth/invalid-new-email": "invalid-email",
  "auth/missing-new-email": "invalid-email",
  "auth/too-many-requests": "too-many-requests",
  "auth/user-mismatch": "user-mismatch",
  "auth/invalid-action-code": "invalid-link",
  "auth/expired-action-code": "invalid-link",
  "auth/invalid-custom-token": "invalid-link",
  "auth/popup-closed-by-user": "popup-closed",
  "auth/cancelled-popup-request": "popup-closed",
  "auth/user-token-expired": "not-signed-in",
  "auth/user-disabled": "not-signed-in",
  "auth/user-not-found": "not-signed-in",
};

/** Translate a Firebase Auth error into the provider-neutral contract error. */
function toAuthProviderError(error: unknown): AuthProviderError {
  if (error instanceof AuthProviderError) return error;
  const code =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;
  const message = error instanceof Error ? error.message : undefined;
  const mapped =
    typeof code === "string" ? FIREBASE_ERROR_CODES[code] : undefined;
  return new AuthProviderError(mapped ?? "unknown", message);
}

function toSignInMethods(user: User | null): AuthSignInMethod[] {
  const methods = new Set<AuthSignInMethod>();
  for (const info of user?.providerData ?? []) {
    if (info.providerId === GoogleAuthProvider.PROVIDER_ID) {
      methods.add("google");
    } else if (info.providerId === EmailAuthProvider.PROVIDER_ID) {
      // Passwordless email-link accounts report the "password" provider.
      methods.add("emailLink");
    }
  }
  return [...methods];
}

export class FirebaseAuthProvider implements AuthProvider {
  private auth: Auth;
  // Firebase does not re-emit auth state when only profile fields change
  // (e.g. after an email change + reload), so we fan out to our own listeners.
  private listeners = new Set<(user: AuthUser | null) => void>();

  public constructor(auth: Auth) {
    this.auth = auth;
  }

  public getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid ?? null;
  }

  public getCurrentUser(): AuthUser | null {
    return toAuthUser(this.auth.currentUser);
  }

  public onAuthStateChanged(
    callback: (user: AuthUser | null) => void,
  ): () => void {
    this.listeners.add(callback);
    const unsubscribe = firebaseOnAuthStateChanged(this.auth, (user) => {
      callback(toAuthUser(user));
    });
    return () => {
      this.listeners.delete(callback);
      unsubscribe();
    };
  }

  public waitForAuthReady(): Promise<AuthUser | null> {
    return new Promise((resolve) => {
      const unsubscribe = firebaseOnAuthStateChanged(this.auth, (user) => {
        unsubscribe();
        resolve(toAuthUser(user));
      });
    });
  }

  public async signInWithGoogle(): Promise<AuthUser> {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(this.auth, provider);
    const user = toAuthUser(result.user);
    if (!user) {
      throw new Error("Google sign-in did not return a user.");
    }
    return user;
  }

  public async sendEmailSignInLink(
    email: string,
    redirectUrl: string,
  ): Promise<void> {
    await sendSignInLinkToEmail(this.auth, email, {
      url: redirectUrl,
      handleCodeInApp: true,
    });
  }

  public isEmailSignInLink(url: string): boolean {
    return isSignInWithEmailLink(this.auth, url);
  }

  public async completeEmailSignIn(
    email: string,
    url: string,
  ): Promise<AuthUser> {
    const result = await signInWithEmailLink(this.auth, email, url);
    const user = toAuthUser(result.user);
    if (!user) {
      throw new Error("Email-link sign-in did not return a user.");
    }
    return user;
  }

  public async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  public getSignInMethods(): AuthSignInMethod[] {
    return toSignInMethods(this.auth.currentUser);
  }

  public async requestEmailChange(
    newEmail: string,
    continueUrl: string,
  ): Promise<void> {
    const user = this.requireCurrentUser();
    try {
      await verifyBeforeUpdateEmail(user, newEmail, { url: continueUrl });
    } catch (error) {
      throw toAuthProviderError(error);
    }
  }

  public async reauthenticateWithGoogle(): Promise<void> {
    const user = this.requireCurrentUser();
    try {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    } catch (error) {
      throw toAuthProviderError(error);
    }
  }

  public async reauthenticateWithEmailLink(url: string): Promise<void> {
    const user = this.requireCurrentUser();
    if (!user.email) {
      throw new AuthProviderError(
        "user-mismatch",
        "This account has no email address to confirm.",
      );
    }
    try {
      const credential = EmailAuthProvider.credentialWithLink(user.email, url);
      await reauthenticateWithCredential(user, credential);
    } catch (error) {
      throw toAuthProviderError(error);
    }
  }

  public async reloadCurrentUser(): Promise<AuthUser | null> {
    const user = this.auth.currentUser;
    if (!user) return null;
    try {
      await user.reload();
      // Force a token refresh so a revoked session surfaces here, not later.
      await user.getIdToken(true);
    } catch (error) {
      throw toAuthProviderError(error);
    }
    const refreshed = toAuthUser(this.auth.currentUser);
    for (const listener of this.listeners) listener(refreshed);
    return refreshed;
  }

  public async signInWithRecoveryToken(token: string): Promise<AuthUser> {
    try {
      const result = await signInWithCustomToken(this.auth, token);
      const user = toAuthUser(result.user);
      if (!user) {
        throw new AuthProviderError(
          "unknown",
          "Recovery sign-in did not return a user.",
        );
      }
      return user;
    } catch (error) {
      throw toAuthProviderError(error);
    }
  }

  private requireCurrentUser(): User {
    const user = this.auth.currentUser;
    if (!user) {
      throw new AuthProviderError("not-signed-in", "Sign in required.");
    }
    return user;
  }
}
