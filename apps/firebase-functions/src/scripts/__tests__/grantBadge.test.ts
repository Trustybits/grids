import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import admin from "firebase-admin";

const { adminState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
    delete: vi.fn(() => ({ __op: "delete" })),
  };
  const adminState = {
    apps: [] as unknown[],
    initializeApp: vi.fn(),
    badgeDocs: new Map<string, Record<string, unknown>>(),
    getCalls: [] as string[],
    setCalls: [] as Array<{
      path: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    }>,
    updateCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
    listUsersPages: [] as Array<{
      users: Array<{ uid: string; metadata: { creationTime: string } }>;
      pageToken?: string;
    }>,
    listUsersCalls: [] as Array<{ maxResults: number; pageToken?: string }>,
  };

  return { adminState, FieldValue };
});

vi.mock("firebase-admin", () => {
  const admin = {
    get apps() {
      return adminState.apps;
    },
    initializeApp: adminState.initializeApp,
    firestore: Object.assign(
      () => ({
        collection: (collectionName: string) => ({
          doc: (uid: string) => ({
            get: async () => {
              const path = `${collectionName}/${uid}`;
              adminState.getCalls.push(path);
              const data = adminState.badgeDocs.get(path);
              return {
                exists: data !== undefined,
                data: () => data,
              };
            },
            set: async (
              data: Record<string, unknown>,
              options?: Record<string, unknown>,
            ) => {
              adminState.setCalls.push({
                path: `${collectionName}/${uid}`,
                data,
                options,
              });
            },
            update: async (data: Record<string, unknown>) => {
              adminState.updateCalls.push({
                path: `${collectionName}/${uid}`,
                data,
              });
            },
          }),
        }),
      }),
      { FieldValue },
    ),
    auth: () => ({
      listUsers: async (maxResults: number, pageToken?: string) => {
        adminState.listUsersCalls.push({ maxResults, pageToken });
        return adminState.listUsersPages.shift() ?? { users: [] };
      },
    }),
  };

  return { default: admin };
});

const originalArgv = process.argv;
const originalExit = process.exit;

let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.fn>;

async function runScript(args: string[]): Promise<void> {
  vi.resetModules();
  process.argv = ["node", "lib/scripts/grantBadge.js", ...args];
  await import("../grantBadge.js");
}

async function waitForWarnContaining(text: string): Promise<void> {
  await vi.waitFor(() => {
    expect(
      warnSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes(text),
      ),
    ).toBe(true);
  });
}

beforeEach(() => {
  adminState.apps = [];
  adminState.initializeApp.mockClear();
  adminState.badgeDocs = new Map();
  adminState.getCalls = [];
  adminState.setCalls = [];
  adminState.updateCalls = [];
  adminState.listUsersPages = [];
  adminState.listUsersCalls = [];
  FieldValue.serverTimestamp.mockClear();
  FieldValue.delete.mockClear();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  exitSpy = vi.fn() as unknown as ReturnType<typeof vi.fn>;
  process.exit = exitSpy as unknown as typeof process.exit;
});

afterEach(() => {
  process.argv = originalArgv;
  process.exit = originalExit;
  vi.restoreAllMocks();
});

describe("grantBadge script", () => {
  it("initializes Firebase Admin when no app exists", async () => {
    await runScript(["grant", "earlyAdopter", "user-1", "--dry-run"]);
    await waitForWarnContaining("Done.");

    expect(admin.initializeApp).toHaveBeenCalledTimes(1);
  });

  it("does not initialize Firebase Admin when an app already exists", async () => {
    adminState.apps = [{}];

    await runScript(["grant", "earlyAdopter", "user-1", "--dry-run"]);
    await waitForWarnContaining("Done.");

    expect(admin.initializeApp).not.toHaveBeenCalled();
  });

  it("grants a badge to each requested uid with serverTimestamp and merge", async () => {
    await runScript(["grant", "earlyAdopter", "user-1", "user-2"]);
    await waitForWarnContaining("Granted: 2");

    expect(adminState.getCalls).toEqual(["userBadges/user-1", "userBadges/user-2"]);
    expect(adminState.setCalls).toEqual([
      {
        path: "userBadges/user-1",
        data: { earlyAdopter: { earnedAt: { __op: "serverTimestamp" } } },
        options: { merge: true },
      },
      {
        path: "userBadges/user-2",
        data: { earlyAdopter: { earnedAt: { __op: "serverTimestamp" } } },
        options: { merge: true },
      },
    ]);
    expect(adminState.updateCalls).toEqual([]);
  });

  it("skips users who already have the badge", async () => {
    adminState.badgeDocs.set("userBadges/user-1", {
      earlyAdopter: { earnedAt: "existing" },
    });

    await runScript(["grant", "earlyAdopter", "user-1"]);
    await waitForWarnContaining("Skipped: 1");

    expect(adminState.setCalls).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "  SKIP   user-1 — already has earlyAdopter",
    );
  });

  it("dry-runs grants without writing", async () => {
    await runScript(["grant", "earlyAdopter", "user-1", "--dry-run"]);
    await waitForWarnContaining("dry-run — no writes performed");

    expect(adminState.setCalls).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith("  WOULD  user-1 ← earlyAdopter");
  });

  it("revokes an existing badge with FieldValue.delete", async () => {
    adminState.badgeDocs.set("userBadges/user-1", {
      earlyAdopter: { earnedAt: "existing" },
    });

    await runScript(["revoke", "earlyAdopter", "user-1"]);
    await waitForWarnContaining("Revoked: 1");

    expect(adminState.updateCalls).toEqual([
      {
        path: "userBadges/user-1",
        data: { earlyAdopter: { __op: "delete" } },
      },
    ]);
    expect(adminState.setCalls).toEqual([]);
  });

  it("skips revoking a missing badge and dry-runs revoke without writing", async () => {
    await runScript(["revoke", "earlyAdopter", "user-1"]);
    await waitForWarnContaining("Skipped: 1");

    expect(adminState.updateCalls).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "  SKIP   user-1 — does not have earlyAdopter",
    );

    vi.restoreAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.exit = exitSpy as unknown as typeof process.exit;
    adminState.badgeDocs.set("userBadges/user-1", {
      earlyAdopter: { earnedAt: "existing" },
    });

    await runScript(["revoke", "earlyAdopter", "user-1", "--dry-run"]);
    await waitForWarnContaining("dry-run — no writes performed");

    expect(adminState.updateCalls).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith("  WOULD  user-1 ✗ earlyAdopter");
  });

  it("backfills users created before the cutoff across auth pages", async () => {
    adminState.listUsersPages = [
      {
        users: [
          {
            uid: "old-user",
            metadata: { creationTime: "2026-01-01T00:00:00.000Z" },
          },
          {
            uid: "new-user",
            metadata: { creationTime: "2026-07-01T00:00:00.000Z" },
          },
        ],
        pageToken: "page-2",
      },
      {
        users: [
          {
            uid: "older-user",
            metadata: { creationTime: "2025-12-31T00:00:00.000Z" },
          },
        ],
      },
    ];

    await runScript(["backfill", "earlyAdopter", "--before", "2026-06-01"]);
    await waitForWarnContaining("Granted: 2");

    expect(adminState.listUsersCalls).toEqual([
      { maxResults: 1000, pageToken: undefined },
      { maxResults: 1000, pageToken: "page-2" },
    ]);
    expect(adminState.setCalls.map((call) => call.path)).toEqual([
      "userBadges/old-user",
      "userBadges/older-user",
    ]);
  });

  it("prints no-op summary when there are no users to process", async () => {
    await runScript(["grant", "earlyAdopter"]);
    await waitForWarnContaining("No users to process.");

    expect(adminState.getCalls).toEqual([]);
    expect(adminState.setCalls).toEqual([]);
  });

  it.each([
    [["unknown", "earlyAdopter"], "Action must be one of: grant | revoke | backfill (got: unknown)"],
    [["grant"], "Badge ID is required (e.g. earlyAdopter, supporter)"],
    [["backfill", "earlyAdopter"], "backfill requires --before YYYY-MM-DD"],
    [["backfill", "earlyAdopter", "--before"], "--before requires a date (YYYY-MM-DD)"],
    [["backfill", "earlyAdopter", "--before", "not-a-date"], "Invalid --before date: not-a-date"],
  ])("logs and exits for invalid args: %s", async (args, message) => {
    await runScript(args);
    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith("Script failed:", expect.any(Error));
    });

    expect((errorSpy.mock.calls[0][1] as Error).message).toBe(message);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
