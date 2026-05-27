import type { AuthProvider, AuthUser } from "@grids/contracts/auth";

export class StubbedAuthProvider implements AuthProvider {
  readonly stubbedUser: AuthUser = {
    uid: "stubbed-user-id",
    email: "stubbed-user-email@realemail.com",
    displayName: "stubbed-user",
    photoURL:
      "https://upload.wikimedia.org/wikipedia/en/c/c5/Bob_the_builder.jpg",
  };

  public getCurrentUserId(): string | null {
    return this.stubbedUser.uid;
  }

  public getCurrentUser(): AuthUser | null {
    return this.stubbedUser;
  }

  public onAuthStateChanged(
    callback: (user: AuthUser | null) => void,
  ): () => void {
    callback(this.stubbedUser);
    return () => {};
  }

  public async waitForAuthReady(): Promise<AuthUser | null> {
    return this.stubbedUser;
  }

  public async signInWithGoogle(): Promise<AuthUser> {
    return this.stubbedUser;
  }

  public async sendEmailSignInLink(
    _email: string,
    _redirectUrl: string,
  ): Promise<void> {}

  public isEmailSignInLink(_url: string): boolean {
    return false;
  }

  public async completeEmailSignIn(
    _email: string,
    _url: string,
  ): Promise<AuthUser> {
    return this.stubbedUser;
  }

  public async signOut(): Promise<void> {}
}
