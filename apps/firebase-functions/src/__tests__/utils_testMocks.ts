/**
 * Shared test-only helpers for Cloud Functions tests.
 *
 * - `createHttpsModuleMock` returns a factory body for the
 *   `firebase-functions/v1/https` module mock. Pass it through a `vi.mock`
 *   async factory so the test file does not need to re-declare the
 *   `HttpsError` class on its own.
 * - `resetMaintenanceMock` resets the `noopIfMaintenance` /
 *   `respondWithMaintenanceIfEnabled` mock in `beforeEach` so the default
 *   behavior is "maintenance disabled".
 */

import { vi, type Mock } from "vitest";

class TestHttpsError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export interface HttpsModuleMockOptions {
  /**
   * When true, also exports a passthrough `onCall` that returns the handler
   * unchanged. Match this to whether the source file under test imports
   * `{ onCall }` directly from `firebase-functions/v1/https`.
   */
  includeOnCall?: boolean;
}

export function createHttpsModuleMock(
  options: HttpsModuleMockOptions = {},
): Record<string, unknown> {
  const mod: Record<string, unknown> = { HttpsError: TestHttpsError };
  if (options.includeOnCall) {
    mod.onCall = (handler: unknown) => handler;
  }
  return mod;
}

/**
 * Resets a mocked maintenance gate (`noopIfMaintenance` or
 * `respondWithMaintenanceIfEnabled`) and sets its default return value to
 * `false` so tests opt-in to maintenance mode instead of opting out.
 */
export function resetMaintenanceMock(
  mockFn: (...args: never[]) => unknown,
): void {
  vi.mocked(mockFn as unknown as Mock).mockReset().mockReturnValue(false);
}
