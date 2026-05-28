import type { AuthProvider, AuthUser } from "@grids/contracts/auth";

export class StubbedAuthProvider implements AuthProvider {
  private currentUser: AuthUser | null;
  private listeners = new Set<(user: AuthUser | null) => void>();

  readonly stubbedUser: AuthUser = {
    uid: "stubbed-user-id",
    email: "stubbed-user-email@realemail.com",
    displayName: "stubbed-user",
    photoURL: null,
  };

  public constructor() {
    this.currentUser = this.stubbedUser;
  }

  public getCurrentUserId(): string | null {
    return this.currentUser?.uid ?? null;
  }

  public getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  public onAuthStateChanged(
    callback: (user: AuthUser | null) => void,
  ): () => void {
    this.listeners.add(callback);
    this.schedule(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public async waitForAuthReady(): Promise<AuthUser | null> {
    return this.currentUser;
  }

  public async signInWithGoogle(): Promise<AuthUser> {
    this.currentUser = this.stubbedUser;
    this.notify();
    return this.stubbedUser;
  }

  public async sendEmailSignInLink(
    email: string,
    _redirectUrl: string,
  ): Promise<void> {
    this.currentUser = {
      ...this.stubbedUser,
      email,
      displayName: email.split("@")[0] || this.stubbedUser.displayName,
    };
    this.notify();
    this.redirectAfterStubbedSignIn();
  }

  public isEmailSignInLink(url: string): boolean {
    return url.includes("stubbedEmailSignIn=true");
  }

  public async completeEmailSignIn(
    email: string,
    _url: string,
  ): Promise<AuthUser> {
    this.currentUser = {
      ...this.stubbedUser,
      email,
      displayName: email.split("@")[0] || this.stubbedUser.displayName,
    };
    this.notify();
    return this.currentUser;
  }

  public async signOut(): Promise<void> {
    this.currentUser = null;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      this.schedule(listener);
    }
  }

  private schedule(callback: (user: AuthUser | null) => void): void {
    const run = () => {
      if (this.listeners.has(callback)) callback(this.currentUser);
    };
    if (typeof queueMicrotask === "function") {
      queueMicrotask(run);
    } else {
      setTimeout(run, 0);
    }
  }

  private redirectAfterStubbedSignIn(): void {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    const target =
      redirect && redirect.startsWith("/") && !redirect.startsWith("//")
        ? redirect
        : "/dashboard";

    window.location.assign(target);
  }
}
