// Unit tests for StubbedAuthProvider — the local fallback AuthProvider used when
// no Firebase config is present. It holds a single in-memory `currentUser`,
// notifies subscribers asynchronously (via queueMicrotask), and derives a
// display name from the email local-part during the passwordless flows.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StubbedAuthProvider } from "../StubbedAuthProvider";
import type { AuthUser } from "@grids/contracts/auth";

/** Drain the microtask queue so scheduled subscriber callbacks have fired. */
function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

const STUBBED_USER: AuthUser = {
  uid: "stubbed-user-id",
  email: "stubbed-user-email@realemail.com",
  displayName: "stubbed-user",
  photoURL: null,
};

let provider: StubbedAuthProvider;
let assignSpy: ReturnType<typeof vi.fn>;
const originalLocation = window.location;

/** Replace window.location with a stub exposing `search` and `assign`. */
function setLocation(search: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search, assign: assignSpy },
  });
}

beforeEach(() => {
  provider = new StubbedAuthProvider();
  assignSpy = vi.fn();
  setLocation("");
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

describe("StubbedAuthProvider construction", () => {
  it("starts signed in as the stubbed user", () => {
    expect(provider.getCurrentUser()).toEqual(STUBBED_USER);
  });

  it("exposes the stubbed user template", () => {
    expect(provider.stubbedUser).toEqual(STUBBED_USER);
  });
});

describe("StubbedAuthProvider.getCurrentUserId", () => {
  it("returns the uid when signed in", () => {
    expect(provider.getCurrentUserId()).toBe("stubbed-user-id");
  });

  it("returns null when signed out", async () => {
    await provider.signOut();
    expect(provider.getCurrentUserId()).toBeNull();
  });
});

describe("StubbedAuthProvider.getCurrentUser", () => {
  it("returns the current user when signed in", () => {
    expect(provider.getCurrentUser()).toEqual(STUBBED_USER);
  });

  it("returns null when signed out", async () => {
    await provider.signOut();
    expect(provider.getCurrentUser()).toBeNull();
  });
});

describe("StubbedAuthProvider.waitForAuthReady", () => {
  it("resolves with the current user", async () => {
    await expect(provider.waitForAuthReady()).resolves.toEqual(STUBBED_USER);
  });

  it("resolves with null when signed out", async () => {
    await provider.signOut();
    await expect(provider.waitForAuthReady()).resolves.toBeNull();
  });
});

describe("StubbedAuthProvider.onAuthStateChanged", () => {
  it("delivers the current user asynchronously after subscribing", async () => {
    const callback = vi.fn();
    provider.onAuthStateChanged(callback);

    // The callback is scheduled via queueMicrotask, not invoked synchronously.
    expect(callback).not.toHaveBeenCalled();

    await flushMicrotasks();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(STUBBED_USER);
  });

  it("notifies all subscribers on a state change", async () => {
    const a = vi.fn();
    const b = vi.fn();
    provider.onAuthStateChanged(a);
    provider.onAuthStateChanged(b);
    await flushMicrotasks();
    a.mockClear();
    b.mockClear();

    await provider.signOut();
    await flushMicrotasks();

    expect(a).toHaveBeenCalledWith(null);
    expect(b).toHaveBeenCalledWith(null);
  });

  it("stops delivering after unsubscribe", async () => {
    const callback = vi.fn();
    const unsubscribe = provider.onAuthStateChanged(callback);
    await flushMicrotasks();
    callback.mockClear();

    unsubscribe();
    await provider.signOut();
    await flushMicrotasks();

    expect(callback).not.toHaveBeenCalled();
  });

  it("does not fire the initial callback when unsubscribed before the microtask runs", async () => {
    const callback = vi.fn();
    const unsubscribe = provider.onAuthStateChanged(callback);
    unsubscribe();

    await flushMicrotasks();
    expect(callback).not.toHaveBeenCalled();
  });

  it("schedules an initial delivery per subscribe call, even for a repeated callback", async () => {
    const callback = vi.fn();
    provider.onAuthStateChanged(callback);
    provider.onAuthStateChanged(callback);
    await flushMicrotasks();

    // Each onAuthStateChanged call schedules its own initial delivery, so the
    // same callback subscribed twice is delivered the initial state twice.
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("notifies a repeated callback only once per state change (Set dedup)", async () => {
    const callback = vi.fn();
    provider.onAuthStateChanged(callback);
    provider.onAuthStateChanged(callback);
    await flushMicrotasks();
    callback.mockClear();

    // notify() iterates the listener Set, which holds the callback once.
    await provider.signOut();
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("coalesces transitions queued before the microtasks drain (reads currentUser lazily)", async () => {
    const seen: (AuthUser | null)[] = [];
    provider.onAuthStateChanged((u) => seen.push(u));
    await flushMicrotasks();
    seen.length = 0;

    // Two transitions fired synchronously (no await between, so no microtask
    // drain). schedule() reads this.currentUser at run time, so both queued
    // callbacks observe the final state — the intermediate `null` from signOut
    // is never delivered.
    void provider.signOut();
    void provider.signInWithGoogle();
    await flushMicrotasks();

    expect(seen).toEqual([STUBBED_USER, STUBBED_USER]);
  });

  it("uses the setTimeout fallback when queueMicrotask is unavailable", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("queueMicrotask", undefined);
    const callback = vi.fn();
    try {
      provider.onAuthStateChanged(callback);
      expect(callback).not.toHaveBeenCalled();

      vi.runAllTimers();
      expect(callback).toHaveBeenCalledWith(STUBBED_USER);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("delivers each transition in order to a persistent subscriber", async () => {
    const seen: (AuthUser | null)[] = [];
    provider.onAuthStateChanged((u) => seen.push(u));
    await flushMicrotasks();

    await provider.signOut();
    await flushMicrotasks();
    await provider.signInWithGoogle();
    await flushMicrotasks();

    expect(seen).toEqual([STUBBED_USER, null, STUBBED_USER]);
  });

  it("only unsubscribes the listener it returned, leaving others active", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = provider.onAuthStateChanged(a);
    provider.onAuthStateChanged(b);
    await flushMicrotasks();
    a.mockClear();
    b.mockClear();

    unsubA();
    await provider.signOut();
    await flushMicrotasks();

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(null);
  });
});

describe("StubbedAuthProvider.signInWithGoogle", () => {
  it("resolves with the stubbed user", async () => {
    await expect(provider.signInWithGoogle()).resolves.toEqual(STUBBED_USER);
  });

  it("restores the stubbed user after sign-out", async () => {
    await provider.signOut();
    await provider.signInWithGoogle();
    expect(provider.getCurrentUser()).toEqual(STUBBED_USER);
  });

  it("notifies subscribers of the signed-in user", async () => {
    await provider.signOut();
    const callback = vi.fn();
    provider.onAuthStateChanged(callback);
    await flushMicrotasks();
    callback.mockClear();

    await provider.signInWithGoogle();
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(STUBBED_USER);
  });
});

describe("StubbedAuthProvider.sendEmailSignInLink", () => {
  // NOTE: per the AuthProvider contract, sendEmailSignInLink only *sends* the
  // link — it should not sign anyone in. The stub diverges: it mutates
  // currentUser and notifies subscribers immediately, signing the user in on
  // link request. These tests document the stub's actual (dev-convenience)
  // behavior; see the discrepancy report.
  it("sets the current user with the given email and derived display name", async () => {
    await provider.sendEmailSignInLink("alice@example.com", "/redirect");

    expect(provider.getCurrentUser()).toEqual({
      uid: "stubbed-user-id",
      email: "alice@example.com",
      displayName: "alice",
      photoURL: null,
    });
  });

  it("falls back to the stubbed display name when the local-part is empty", async () => {
    await provider.sendEmailSignInLink("@example.com", "/redirect");

    expect(provider.getCurrentUser()).toEqual(
      expect.objectContaining({
        email: "@example.com",
        displayName: "stubbed-user",
      }),
    );
  });

  it("stores an empty email and falls back to the stubbed display name", async () => {
    await provider.sendEmailSignInLink("", "/redirect");

    expect(provider.getCurrentUser()).toEqual(
      expect.objectContaining({ email: "", displayName: "stubbed-user" }),
    );
  });

  it("uses the whole string as display name for an email with no @", async () => {
    await provider.sendEmailSignInLink("noatsign", "/redirect");

    expect(provider.getCurrentUser()).toEqual(
      expect.objectContaining({ email: "noatsign", displayName: "noatsign" }),
    );
  });

  it("notifies subscribers", async () => {
    const callback = vi.fn();
    provider.onAuthStateChanged(callback);
    await flushMicrotasks();
    callback.mockClear();

    await provider.sendEmailSignInLink("bob@example.com", "/redirect");
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ email: "bob@example.com" }),
    );
  });

  it("redirects to a safe relative redirect param", async () => {
    setLocation("?redirect=/settings");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/settings");
  });

  it("redirects to /dashboard when no redirect param is present", async () => {
    setLocation("");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("allows a bare '/' redirect", async () => {
    setLocation("?redirect=/");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/");
  });

  it("redirects to /dashboard for an empty redirect param", async () => {
    setLocation("?redirect=");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("does not redirect when window is undefined (SSR guard)", async () => {
    vi.stubGlobal("window", undefined);
    try {
      await expect(
        provider.sendEmailSignInLink("bob@example.com", "/redirect"),
      ).resolves.toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }

    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("ignores a protocol-relative redirect (open-redirect guard)", async () => {
    setLocation("?redirect=//evil.com");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("ignores an absolute-URL redirect", async () => {
    setLocation("?redirect=https://evil.com");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("ignores a URL-encoded protocol-relative redirect", async () => {
    // URLSearchParams decodes %2F%2F to //, which the guard then rejects.
    setLocation("?redirect=%2F%2Fevil.com");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
  });

  // Browsers normalize backslashes to forward slashes, so "/\evil.com" would
  // become a protocol-relative navigation to evil.com. The guard normalizes the
  // same way and rejects it.
  it("ignores a backslash protocol-relative redirect", async () => {
    setLocation("?redirect=/\\evil.com");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
  });

  // Browsers strip tab/newline characters from URLs, so "/<tab>/evil.com" would
  // become "//evil.com". The guard strips them before validating.
  it("ignores a redirect with an embedded tab that would become protocol-relative", async () => {
    setLocation("?redirect=/%09/evil.com");
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");

    expect(assignSpy).toHaveBeenCalledWith("/dashboard");
  });

  it("preserves the stubbed uid", async () => {
    await provider.sendEmailSignInLink("bob@example.com", "/redirect");
    expect(provider.getCurrentUserId()).toBe("stubbed-user-id");
  });
});

describe("StubbedAuthProvider.isEmailSignInLink", () => {
  it("returns true when the url carries the stubbed marker", () => {
    expect(
      provider.isEmailSignInLink("https://app/login?stubbedEmailSignIn=true"),
    ).toBe(true);
  });

  it("returns false for an unrelated url", () => {
    expect(provider.isEmailSignInLink("https://app/login")).toBe(false);
  });

  it("is case-sensitive on the marker", () => {
    expect(
      provider.isEmailSignInLink("https://app/login?STUBBEDEMAILSIGNIN=TRUE"),
    ).toBe(false);
  });

  it("matches the marker anywhere in the url (naive substring check)", () => {
    // Uses url.includes(), so the marker need not be a real query param.
    expect(
      provider.isEmailSignInLink("https://app/stubbedEmailSignIn=true/path"),
    ).toBe(true);
  });
});

describe("StubbedAuthProvider.completeEmailSignIn", () => {
  it("resolves with a user carrying the given email and derived display name", async () => {
    const user = await provider.completeEmailSignIn(
      "carol@example.com",
      "https://app/login?stubbedEmailSignIn=true",
    );

    expect(user).toEqual({
      uid: "stubbed-user-id",
      email: "carol@example.com",
      displayName: "carol",
      photoURL: null,
    });
  });

  it("falls back to the stubbed display name when the local-part is empty", async () => {
    const user = await provider.completeEmailSignIn("@example.com", "url");
    expect(user).toEqual(
      expect.objectContaining({
        email: "@example.com",
        displayName: "stubbed-user",
      }),
    );
  });

  it("uses the whole string as display name for an email with no @", async () => {
    const user = await provider.completeEmailSignIn("noatsign", "url");
    expect(user).toEqual(
      expect.objectContaining({ email: "noatsign", displayName: "noatsign" }),
    );
  });

  it("stores an empty email and falls back to the stubbed display name", async () => {
    const user = await provider.completeEmailSignIn("", "url");
    expect(user).toEqual(
      expect.objectContaining({ email: "", displayName: "stubbed-user" }),
    );
  });

  it("updates the current user", async () => {
    await provider.completeEmailSignIn("carol@example.com", "url");
    expect(provider.getCurrentUser()?.email).toBe("carol@example.com");
  });

  it("does not perform a redirect", async () => {
    await provider.completeEmailSignIn("carol@example.com", "url");
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("notifies subscribers", async () => {
    const callback = vi.fn();
    provider.onAuthStateChanged(callback);
    await flushMicrotasks();
    callback.mockClear();

    await provider.completeEmailSignIn("carol@example.com", "url");
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({ email: "carol@example.com" }),
    );
  });
});

describe("StubbedAuthProvider.signOut", () => {
  it("clears the current user", async () => {
    await provider.signOut();
    expect(provider.getCurrentUser()).toBeNull();
  });

  it("notifies subscribers with null", async () => {
    const callback = vi.fn();
    provider.onAuthStateChanged(callback);
    await flushMicrotasks();
    callback.mockClear();

    await provider.signOut();
    await flushMicrotasks();

    expect(callback).toHaveBeenCalledWith(null);
  });
});
