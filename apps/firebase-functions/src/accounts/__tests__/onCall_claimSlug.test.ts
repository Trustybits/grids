import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { isValidSlugFormat } from "../utils_slugValidation.js";

const { firestoreState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
    arrayUnion: vi.fn((value: unknown) => ({ __op: "arrayUnion", value })),
  };
  const firestoreState = {
    docs: new Map<string, Record<string, unknown>>(),
    transactionShouldReject: false,
    collectionCalls: [] as string[],
    docCalls: [] as string[],
    getCalls: [] as string[],
    setCalls: [] as Array<{
      path: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    }>,
    updateCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  };

  return { firestoreState, FieldValue };
});

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    https: {
      onCall: (handler: unknown) => handler,
    },
  })),
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock();
});

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../utils_slugValidation.js", () => ({
  isValidSlugFormat: vi.fn(),
}));

vi.mock("../utils_reservedSlugs.js", () => ({
  RESERVED_SLUGS: ["admin", "grid", "www"],
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: (collectionName: string) => {
          firestoreState.collectionCalls.push(collectionName);
          return {
            doc: (docId: string) => {
              firestoreState.docCalls.push(docId);
              return { path: `${collectionName}/${docId}` };
            },
          };
        },
        runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
          if (firestoreState.transactionShouldReject) {
            throw new Error("transaction unavailable");
          }

          const transaction = {
            get: async (ref: { path: string }) => {
              firestoreState.getCalls.push(ref.path);
              const data = firestoreState.docs.get(ref.path);
              return {
                exists: data !== undefined,
                data: () => data,
              };
            },
            set: (
              ref: { path: string },
              data: Record<string, unknown>,
              options?: Record<string, unknown>,
            ) => {
              firestoreState.setCalls.push({ path: ref.path, data, options });
            },
            update: (ref: { path: string }, data: Record<string, unknown>) => {
              firestoreState.updateCalls.push({ path: ref.path, data });
            },
          };

          return callback(transaction);
        },
      }),
      { FieldValue },
    ),
  },
}));

import { claimSlug as callable } from "../onCall_claimSlug.js";

const claimSlug = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

const FIXED_NOW = new Date("2026-05-22T12:00:00.000Z");

function setDoc(path: string, data: Record<string, unknown>): void {
  firestoreState.docs.set(path, data);
}

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as HttpsError).message).toBe(message);
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.transactionShouldReject = false;
  firestoreState.collectionCalls = [];
  firestoreState.docCalls = [];
  firestoreState.getCalls = [];
  firestoreState.setCalls = [];
  firestoreState.updateCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(isValidSlugFormat).mockReset().mockReturnValue(true);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  FieldValue.serverTimestamp.mockClear();
  FieldValue.arrayUnion.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("claimSlug", () => {
  it("returns null without touching auth or Firestore when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(claimSlug({ slug: "matt" }, {})).resolves.toBeNull();
    expect(noopIfMaintenance).toHaveBeenCalledWith("claimSlug");
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("requires an authenticated caller", async () => {
    await expect(claimSlug({ slug: "matt" }, {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(
          error,
          "unauthenticated",
          "You must be signed in to claim a slug.",
        );
        return true;
      },
    );
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it.each([
    ["missing data", undefined],
    ["missing slug", {}],
    ["empty slug", { slug: "" }],
    ["non-string slug", { slug: 123 }],
  ])("throws invalid-argument for %s", async (_label, data) => {
    await expect(claimSlug(data, { auth: { uid: "user-1" } })).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "invalid-argument", "Slug is required.");
        return true;
      },
    );
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("normalizes the requested slug before validating and writing", async () => {
    setDoc("users/user-1", { defaultGridId: "grid-1" });

    const result = await claimSlug(
      { slug: "  MaTT-Galley  " },
      { auth: { uid: "user-1" } },
    );

    // The canonical normalized slug is returned so callers can update UI
    // without re-reading the profile.
    expect(result).toMatchObject({ success: true, slug: "matt-galley" });
    expect(isValidSlugFormat).toHaveBeenCalledWith("matt-galley");
    expect(firestoreState.setCalls[0]).toMatchObject({
      path: "slugs/matt-galley",
      options: { merge: true },
    });
    expect(firestoreState.updateCalls).toContainEqual({
      path: "users/user-1",
      data: { slug: "matt-galley" },
    });
  });

  it("throws invalid-argument without opening a transaction when the slug format is invalid", async () => {
    vi.mocked(isValidSlugFormat).mockReturnValue(false);

    await expect(
      claimSlug({ slug: "bad_slug" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "invalid-argument",
        "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only. Cannot start or end with a hyphen.",
      );
      return true;
    });
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("throws invalid-argument without opening a transaction when the slug is reserved", async () => {
    await expect(
      claimSlug({ slug: "Admin" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "invalid-argument",
        "This slug is reserved and cannot be used.",
      );
      return true;
    });
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("throws already-exists when another user owns the slug", async () => {
    setDoc("users/user-1", { slug: "old", defaultGridId: "grid-1" });
    setDoc("slugs/matt", { userId: "user-2" });

    await expect(
      claimSlug({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "already-exists", "This slug is already taken.");
      return true;
    });
    expect(firestoreState.setCalls).toEqual([]);
    expect(firestoreState.updateCalls).toEqual([]);
  });

  it("returns a no-op success when the caller already owns the slug", async () => {
    setDoc("users/user-1", { slug: "matt", defaultGridId: "grid-1" });
    setDoc("slugs/matt", { userId: "user-1" });

    await expect(
      claimSlug({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      success: true,
      message: "Slug is already yours.",
      slug: "matt",
    });
    expect(firestoreState.setCalls).toEqual([]);
    expect(firestoreState.updateCalls).toEqual([]);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("claims a released slug whose userId is %s", async (_label, userId) => {
    setDoc("users/user-1", { defaultGridId: "grid-1" });
    setDoc("slugs/matt", { userId });

    await expect(
      claimSlug({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      success: true,
      message: "Slug claimed successfully.",
      slug: "matt",
    });
    expect(firestoreState.setCalls[0]).toMatchObject({
      path: "slugs/matt",
      data: expect.objectContaining({
        userId: "user-1",
        defaultGridId: "grid-1",
      }),
      options: { merge: true },
    });
  });

  it("releases the previous slug with history before claiming the new slug", async () => {
    const oldClaimedAt = new Date("2026-01-01T00:00:00.000Z");
    setDoc("users/user-1", { slug: "old-slug", defaultGridId: "grid-1" });
    setDoc("slugs/old-slug", {
      userId: "user-1",
      createdAt: oldClaimedAt,
    });

    await claimSlug({ slug: "matt" }, { auth: { uid: "user-1" } });

    expect(firestoreState.updateCalls[0]).toEqual({
      path: "slugs/old-slug",
      data: {
        userId: null,
        history: {
          __op: "arrayUnion",
          value: {
            userId: "user-1",
            claimedAt: oldClaimedAt,
            releasedAt: FIXED_NOW,
          },
        },
      },
    });
    expect(firestoreState.setCalls[0]).toEqual({
      path: "slugs/matt",
      data: {
        userId: "user-1",
        defaultGridId: "grid-1",
        createdAt: { __op: "serverTimestamp" },
        history: {
          __op: "arrayUnion",
          value: {
            userId: "user-1",
            claimedAt: FIXED_NOW,
          },
        },
      },
      options: { merge: true },
    });
    expect(firestoreState.updateCalls[1]).toEqual({
      path: "users/user-1",
      data: { slug: "matt" },
    });
  });

  it("falls back to the current time when the old slug has no createdAt", async () => {
    setDoc("users/user-1", { slug: "old-slug" });
    setDoc("slugs/old-slug", { userId: "user-1" });

    await claimSlug({ slug: "matt" }, { auth: { uid: "user-1" } });

    expect(firestoreState.updateCalls[0].data.history).toEqual({
      __op: "arrayUnion",
      value: {
        userId: "user-1",
        claimedAt: FIXED_NOW,
        releasedAt: FIXED_NOW,
      },
    });
  });

  it("creates the user document when the caller has no existing profile", async () => {
    await claimSlug({ slug: "matt" }, { auth: { uid: "user-1" } });

    expect(firestoreState.setCalls).toContainEqual({
      path: "users/user-1",
      data: { slug: "matt" },
      options: { merge: true },
    });
    expect(firestoreState.setCalls[0].data.defaultGridId).toBeNull();
  });

  it("logs success after a successful claim", async () => {
    await claimSlug({ slug: "matt" }, { auth: { uid: "user-1" } });

    expect(logger.info).toHaveBeenCalledWith("Slug claimed successfully", {
      userId: "user-1",
      slug: "matt",
    });
  });

  it("logs and throws internal when the transaction fails unexpectedly", async () => {
    firestoreState.transactionShouldReject = true;

    await expect(
      claimSlug({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "internal",
        "Failed to claim slug. Please try again.",
      );
      return true;
    });

    expect(logger.error).toHaveBeenCalledWith("Failed to claim slug", {
      error: "Error: transaction unavailable",
      userId: "user-1",
      slug: "matt",
    });
  });
});
