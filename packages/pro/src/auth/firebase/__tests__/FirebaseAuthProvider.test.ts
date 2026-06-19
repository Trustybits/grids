/**
 * Unit tests for FirebaseAuthProvider
 *
 * Covers:
 *  - getCurrentUserId / getCurrentUser: signed-in and signed-out states,
 *    AuthUser reduction (uid/email/displayName/photoURL only), and
 *    null-field passthrough for users with no profile (email-link)
 *  - onAuthStateChanged: callback wrapping/mapping, unsubscribe passthrough
 *  - waitForAuthReady: resolves with the first auth state, then unsubscribes
 *  - signInWithGoogle: popup flow, mapped user, throws when no user returned
 *  - sendEmailSignInLink: redirect settings with handleCodeInApp
 *  - isEmailSignInLink: SDK delegation
 *  - completeEmailSignIn: mapped user, throws when no user returned
 *  - signOut: SDK delegation
 */

import { describe, it, expect, vi } from "vitest";
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { FirebaseAuthProvider } from "../FirebaseAuthProvider.js";
import type { Auth, User } from "firebase/auth";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fullUser = {
  uid: "uid-1",
  email: "alice@example.com",
  displayName: "Alice",
  photoURL: "https://img/alice.png",
  // Extra Firebase SDK fields that must NOT leak into AuthUser:
  emailVerified: true,
  providerId: "google.com",
} as unknown as User;

const mappedUser = {
  uid: "uid-1",
  email: "alice@example.com",
  displayName: "Alice",
  photoURL: "https://img/alice.png",
};

function makeAuth(currentUser: User | null = null): Auth {
  return { currentUser } as unknown as Auth;
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe("FirebaseAuthProvider", () => {
  // ── getCurrentUserId ──────────────────────────────────────────────────────

  describe("getCurrentUserId", () => {
    it("returns the uid when a user is signed in", () => {
      const provider = new FirebaseAuthProvider(makeAuth(fullUser));
      expect(provider.getCurrentUserId()).toBe("uid-1");
    });

    it("returns null when no user is signed in", () => {
      const provider = new FirebaseAuthProvider(makeAuth(null));
      expect(provider.getCurrentUserId()).toBeNull();
    });
  });

  // ── getCurrentUser ────────────────────────────────────────────────────────

  describe("getCurrentUser", () => {
    it("reduces the Firebase user to the AuthUser shape", () => {
      const provider = new FirebaseAuthProvider(makeAuth(fullUser));
      expect(provider.getCurrentUser()).toEqual(mappedUser);
    });

    it("returns null when no user is signed in", () => {
      const provider = new FirebaseAuthProvider(makeAuth(null));
      expect(provider.getCurrentUser()).toBeNull();
    });

    it("preserves null email/displayName/photoURL (e.g. an email-link user with no profile)", () => {
      const partialUser = {
        uid: "uid-2",
        email: null,
        displayName: null,
        photoURL: null,
        emailVerified: false,
      } as unknown as User;
      const provider = new FirebaseAuthProvider(makeAuth(partialUser));

      expect(provider.getCurrentUser()).toEqual({
        uid: "uid-2",
        email: null,
        displayName: null,
        photoURL: null,
      });
    });
  });

  // ── onAuthStateChanged ────────────────────────────────────────────────────

  describe("onAuthStateChanged", () => {
    it("maps emitted users to AuthUser before invoking the callback", () => {
      const auth = makeAuth();
      const provider = new FirebaseAuthProvider(auth);
      const callback = vi.fn();

      vi.mocked(onAuthStateChanged).mockImplementation(
        (_auth: any, observer: any) => {
          observer(fullUser);
          observer(null);
          return vi.fn();
        },
      );

      provider.onAuthStateChanged(callback);

      expect(onAuthStateChanged).toHaveBeenCalledWith(auth, expect.any(Function));
      expect(callback).toHaveBeenNthCalledWith(1, mappedUser);
      expect(callback).toHaveBeenNthCalledWith(2, null);
    });

    it("returns the SDK unsubscribe function", () => {
      const unsubFn = vi.fn();
      vi.mocked(onAuthStateChanged).mockReturnValue(unsubFn as any);
      const provider = new FirebaseAuthProvider(makeAuth());

      expect(provider.onAuthStateChanged(vi.fn())).toBe(unsubFn);
    });
  });

  // ── waitForAuthReady ──────────────────────────────────────────────────────

  describe("waitForAuthReady", () => {
    it("resolves with the mapped user from the first auth event and unsubscribes", async () => {
      const unsubFn = vi.fn();
      vi.mocked(onAuthStateChanged).mockImplementation(
        (_auth: any, observer: any) => {
          // The real SDK notifies observers asynchronously.
          queueMicrotask(() => observer(fullUser));
          return unsubFn;
        },
      );
      const provider = new FirebaseAuthProvider(makeAuth());

      const result = await provider.waitForAuthReady();

      expect(result).toEqual(mappedUser);
      expect(unsubFn).toHaveBeenCalledTimes(1);
    });

    it("resolves with null when auth settles signed-out", async () => {
      vi.mocked(onAuthStateChanged).mockImplementation(
        (_auth: any, observer: any) => {
          queueMicrotask(() => observer(null));
          return vi.fn();
        },
      );
      const provider = new FirebaseAuthProvider(makeAuth());

      await expect(provider.waitForAuthReady()).resolves.toBeNull();
    });
  });

  // ── signInWithGoogle ──────────────────────────────────────────────────────

  describe("signInWithGoogle", () => {
    it("opens a Google popup and returns the mapped user", async () => {
      const auth = makeAuth();
      const provider = new FirebaseAuthProvider(auth);
      vi.mocked(signInWithPopup).mockResolvedValue({ user: fullUser } as any);

      const result = await provider.signInWithGoogle();

      expect(GoogleAuthProvider).toHaveBeenCalledTimes(1);
      expect(signInWithPopup).toHaveBeenCalledWith(
        auth,
        vi.mocked(GoogleAuthProvider).mock.instances[0],
      );
      expect(result).toEqual(mappedUser);
    });

    it("throws when the popup result has no user", async () => {
      const provider = new FirebaseAuthProvider(makeAuth());
      vi.mocked(signInWithPopup).mockResolvedValue({ user: null } as any);

      await expect(provider.signInWithGoogle()).rejects.toThrow(
        "Google sign-in did not return a user.",
      );
    });

    it("propagates popup errors (e.g. popup closed)", async () => {
      const provider = new FirebaseAuthProvider(makeAuth());
      vi.mocked(signInWithPopup).mockRejectedValue(
        new Error("auth/popup-closed-by-user"),
      );

      await expect(provider.signInWithGoogle()).rejects.toThrow(
        "auth/popup-closed-by-user",
      );
    });
  });

  // ── sendEmailSignInLink ───────────────────────────────────────────────────

  describe("sendEmailSignInLink", () => {
    it("sends the link with the redirect URL and handleCodeInApp", async () => {
      const auth = makeAuth();
      const provider = new FirebaseAuthProvider(auth);
      vi.mocked(sendSignInLinkToEmail).mockResolvedValue(undefined);

      await provider.sendEmailSignInLink(
        "alice@example.com",
        "https://grids.so/finish",
      );

      expect(sendSignInLinkToEmail).toHaveBeenCalledWith(
        auth,
        "alice@example.com",
        { url: "https://grids.so/finish", handleCodeInApp: true },
      );
    });

    it("propagates SDK errors (e.g. invalid email or quota exceeded)", async () => {
      const provider = new FirebaseAuthProvider(makeAuth());
      vi.mocked(sendSignInLinkToEmail).mockRejectedValue(
        new Error("auth/invalid-email"),
      );

      await expect(
        provider.sendEmailSignInLink("not-an-email", "https://grids.so/finish"),
      ).rejects.toThrow("auth/invalid-email");
    });
  });

  // ── isEmailSignInLink ─────────────────────────────────────────────────────

  describe("isEmailSignInLink", () => {
    it("delegates to the SDK and returns its result", () => {
      const auth = makeAuth();
      const provider = new FirebaseAuthProvider(auth);
      vi.mocked(isSignInWithEmailLink).mockReturnValue(true);

      expect(provider.isEmailSignInLink("https://link")).toBe(true);
      expect(isSignInWithEmailLink).toHaveBeenCalledWith(auth, "https://link");

      vi.mocked(isSignInWithEmailLink).mockReturnValue(false);
      expect(provider.isEmailSignInLink("https://not-a-link")).toBe(false);
    });
  });

  // ── completeEmailSignIn ───────────────────────────────────────────────────

  describe("completeEmailSignIn", () => {
    it("completes the email-link sign-in and returns the mapped user", async () => {
      const auth = makeAuth();
      const provider = new FirebaseAuthProvider(auth);
      vi.mocked(signInWithEmailLink).mockResolvedValue({ user: fullUser } as any);

      const result = await provider.completeEmailSignIn(
        "alice@example.com",
        "https://link",
      );

      expect(signInWithEmailLink).toHaveBeenCalledWith(
        auth,
        "alice@example.com",
        "https://link",
      );
      expect(result).toEqual(mappedUser);
    });

    it("throws when the sign-in result has no user", async () => {
      const provider = new FirebaseAuthProvider(makeAuth());
      vi.mocked(signInWithEmailLink).mockResolvedValue({ user: null } as any);

      await expect(
        provider.completeEmailSignIn("alice@example.com", "https://link"),
      ).rejects.toThrow("Email-link sign-in did not return a user.");
    });

    it("propagates SDK errors (e.g. an expired or invalid link)", async () => {
      const provider = new FirebaseAuthProvider(makeAuth());
      vi.mocked(signInWithEmailLink).mockRejectedValue(
        new Error("auth/invalid-action-code"),
      );

      await expect(
        provider.completeEmailSignIn("alice@example.com", "https://link"),
      ).rejects.toThrow("auth/invalid-action-code");
    });
  });

  // ── signOut ───────────────────────────────────────────────────────────────

  describe("signOut", () => {
    it("delegates to the SDK signOut", async () => {
      const auth = makeAuth();
      const provider = new FirebaseAuthProvider(auth);
      vi.mocked(signOut).mockResolvedValue(undefined);

      await provider.signOut();

      expect(signOut).toHaveBeenCalledWith(auth);
    });

    it("propagates sign-out errors", async () => {
      const provider = new FirebaseAuthProvider(makeAuth());
      vi.mocked(signOut).mockRejectedValue(new Error("network"));

      await expect(provider.signOut()).rejects.toThrow("network");
    });
  });
});
