// Unit tests for the AuthProvider singleton registry. The module holds a single
// module-level `instance`; `registerAuthProvider` sets it and `getAuthProvider`
// returns it (throwing until one is registered). Because the state is module
// scoped, each test re-imports the module fresh via vi.resetModules() to start
// from the unregistered state.
import { describe, it, expect, vi } from "vitest";
import type { AuthProvider } from "@grids/contracts/auth";

/** A throwaway AuthProvider; only identity matters for these tests. */
function makeProvider(): AuthProvider {
  return {
    getCurrentUserId: vi.fn(),
    getCurrentUser: vi.fn(),
    onAuthStateChanged: vi.fn(),
    waitForAuthReady: vi.fn(),
    signInWithGoogle: vi.fn(),
    sendEmailSignInLink: vi.fn(),
    isEmailSignInLink: vi.fn(),
    completeEmailSignIn: vi.fn(),
    signOut: vi.fn(),
  } as unknown as AuthProvider;
}

/** Import a fresh copy of the module with its module-level state reset. */
async function freshModule() {
  vi.resetModules();
  return import("../AuthProviderSingleton");
}

describe("getAuthProvider", () => {
  it("throws when no provider has been registered", async () => {
    const { getAuthProvider } = await freshModule();
    expect(() => getAuthProvider()).toThrow(
      "AuthProvider has not been registered. Call registerAuthProvider() at app startup.",
    );
  });

  it("returns the registered provider", async () => {
    const { registerAuthProvider, getAuthProvider } = await freshModule();
    const provider = makeProvider();

    registerAuthProvider(provider);

    expect(getAuthProvider()).toBe(provider);
  });

  it("returns the same instance across repeated calls", async () => {
    const { registerAuthProvider, getAuthProvider } = await freshModule();
    const provider = makeProvider();
    registerAuthProvider(provider);

    expect(getAuthProvider()).toBe(getAuthProvider());
  });
});

describe("registerAuthProvider", () => {
  it("overwrites a previously registered provider", async () => {
    const { registerAuthProvider, getAuthProvider } = await freshModule();
    const first = makeProvider();
    const second = makeProvider();

    registerAuthProvider(first);
    registerAuthProvider(second);

    expect(getAuthProvider()).toBe(second);
  });

  it("reverts to the unregistered state when a falsy provider is registered", async () => {
    // The guard is `if (!instance)`, so registering null silently undoes a
    // prior registration rather than erroring at registration time.
    const { registerAuthProvider, getAuthProvider } = await freshModule();
    registerAuthProvider(makeProvider());
    registerAuthProvider(null as unknown as AuthProvider);

    expect(() => getAuthProvider()).toThrow(
      "AuthProvider has not been registered. Call registerAuthProvider() at app startup.",
    );
  });
});

describe("module isolation", () => {
  it("does not leak registration between fresh module loads", async () => {
    const a = await freshModule();
    a.registerAuthProvider(makeProvider());
    expect(() => a.getAuthProvider()).not.toThrow();

    const b = await freshModule();
    expect(() => b.getAuthProvider()).toThrow();
  });
});
