import type { AuthProvider, AuthUser } from "@grids/contracts/auth";
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut as firebaseSignOut,
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

export class FirestoreAuthProvider implements AuthProvider {
  private auth: Auth;

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
    return firebaseOnAuthStateChanged(this.auth, (user) => {
      callback(toAuthUser(user));
    });
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
}
