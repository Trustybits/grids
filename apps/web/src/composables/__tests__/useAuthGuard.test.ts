/**
 * Tests for useAuthGuard — subscribes to auth state and redirects
 * unauthenticated users to /login, flipping isAuthChecked once resolved.
 *
 * vue-router is mocked with a stable push spy (overriding the global setup
 * mock's per-call spy) and the auth provider is mocked so the auth-state
 * callback can be driven manually.
 *
 * isAuthChecked is a module-level ref that is only ever flipped to true and
 * never reset, so each test calls vi.resetModules() and re-imports the
 * composable to start from a fresh `false` — otherwise the "marks true"
 * assertions would pass off state left behind by an earlier test.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPush, mockOnAuthStateChanged } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockOnAuthStateChanged: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/auth/AuthProviderSingleton", () => ({
  getAuthProvider: () => ({ onAuthStateChanged: mockOnAuthStateChanged }),
}));

let authCb: ((user: unknown) => void) | null = null;

/** Re-import the composable with fresh module state (resets isAuthChecked). */
async function loadUseAuthGuard() {
  vi.resetModules();
  return (await import("@/composables/useAuthGuard")).useAuthGuard;
}

beforeEach(() => {
  authCb = null;
  mockPush.mockReset();
  mockOnAuthStateChanged.mockReset();
  mockOnAuthStateChanged.mockImplementation((cb) => {
    authCb = cb;
    return () => {};
  });
});

describe("useAuthGuard", () => {
  it("subscribes to auth state changes", async () => {
    const useAuthGuard = await loadUseAuthGuard();
    useAuthGuard();
    expect(mockOnAuthStateChanged).toHaveBeenCalledTimes(1);
  });

  it("does not redirect when a user is authenticated", async () => {
    const useAuthGuard = await loadUseAuthGuard();
    useAuthGuard();
    authCb?.({ uid: "user-1" });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("redirects to /login when no user is authenticated", async () => {
    const useAuthGuard = await loadUseAuthGuard();
    useAuthGuard();
    authCb?.(null);
    expect(mockPush).toHaveBeenCalledWith("/login");
  });

  it("starts with isAuthChecked false and flips it true once resolved (authenticated)", async () => {
    const useAuthGuard = await loadUseAuthGuard();
    const { isAuthChecked } = useAuthGuard();
    expect(isAuthChecked.value).toBe(false);
    authCb?.({ uid: "user-1" });
    expect(isAuthChecked.value).toBe(true);
  });

  it("starts with isAuthChecked false and flips it true once resolved (unauthenticated)", async () => {
    const useAuthGuard = await loadUseAuthGuard();
    const { isAuthChecked } = useAuthGuard();
    expect(isAuthChecked.value).toBe(false);
    authCb?.(null);
    expect(isAuthChecked.value).toBe(true);
  });

  it("shares isAuthChecked across invocations (module-level ref)", async () => {
    const useAuthGuard = await loadUseAuthGuard();
    // First invocation resolves auth state, flipping the shared ref to true.
    const first = useAuthGuard();
    authCb?.({ uid: "user-1" });
    expect(first.isAuthChecked.value).toBe(true);

    // A subsequent invocation observes the same already-true ref, even before
    // its own callback fires.
    const second = useAuthGuard();
    expect(second.isAuthChecked.value).toBe(true);
    expect(second.isAuthChecked).toBe(first.isAuthChecked);
  });
});
