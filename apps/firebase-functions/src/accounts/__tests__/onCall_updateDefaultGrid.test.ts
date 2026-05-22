import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { firestoreState } = vi.hoisted(() => {
  const firestoreState = {
    docs: new Map<string, Record<string, unknown>>(),
    transactionShouldReject: false,
    collectionCalls: [] as string[],
    docCalls: [] as string[],
    getCalls: [] as string[],
    updateCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  };

  return { firestoreState };
});

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock({ includeOnCall: true });
});

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
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
          update: (ref: { path: string }, data: Record<string, unknown>) => {
            firestoreState.updateCalls.push({ path: ref.path, data });
          },
        };

        return callback(transaction);
      },
    }),
  },
}));

import { updateDefaultGrid as callable } from "../onCall_updateDefaultGrid.js";

const updateDefaultGrid = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function setUserDoc(uid: string, data: Record<string, unknown>): void {
  firestoreState.docs.set(`users/${uid}`, data);
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
  firestoreState.updateCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

describe("updateDefaultGrid", () => {
  it("returns null without touching auth or Firestore when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(updateDefaultGrid({ gridId: "grid-1" }, {})).resolves.toBeNull();
    expect(noopIfMaintenance).toHaveBeenCalledWith("updateDefaultGrid");
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("requires an authenticated caller", async () => {
    await expect(updateDefaultGrid({ gridId: "grid-1" }, {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(
          error,
          "unauthenticated",
          "You must be signed in to update your default grid.",
        );
        return true;
      },
    );
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("throws not-found when the user profile does not exist", async () => {
    await expect(
      updateDefaultGrid({ gridId: "grid-1" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "User profile not found.");
      return true;
    });
    expect(firestoreState.updateCalls).toEqual([]);
  });

  it("updates the user default grid and matching slug document when the user has a slug", async () => {
    setUserDoc("user-1", { slug: "matt", defaultGridId: "old-grid" });

    await expect(
      updateDefaultGrid({ gridId: "new-grid" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ success: true });

    expect(firestoreState.updateCalls).toEqual([
      {
        path: "users/user-1",
        data: { defaultGridId: "new-grid" },
      },
      {
        path: "slugs/matt",
        data: { defaultGridId: "new-grid" },
      },
    ]);
  });

  it("updates only the user document when the user has no slug", async () => {
    setUserDoc("user-1", { defaultGridId: "old-grid" });

    await updateDefaultGrid({ gridId: "new-grid" }, { auth: { uid: "user-1" } });

    expect(firestoreState.updateCalls).toEqual([
      {
        path: "users/user-1",
        data: { defaultGridId: "new-grid" },
      },
    ]);
  });

  it.each([
    ["missing data", undefined],
    ["missing gridId", {}],
    ["null gridId", { gridId: null }],
    ["empty string gridId", { gridId: "" }],
  ])("stores null for %s", async (_label, data) => {
    setUserDoc("user-1", { slug: "matt", defaultGridId: "old-grid" });

    await updateDefaultGrid(data, { auth: { uid: "user-1" } });

    expect(firestoreState.updateCalls).toEqual([
      {
        path: "users/user-1",
        data: { defaultGridId: null },
      },
      {
        path: "slugs/matt",
        data: { defaultGridId: null },
      },
    ]);
  });

  it("logs success with the caller uid and normalized gridId", async () => {
    setUserDoc("user-1", { slug: "matt" });

    await updateDefaultGrid({ gridId: "grid-1" }, { auth: { uid: "user-1" } });

    expect(logger.info).toHaveBeenCalledWith(
      "Default grid updated successfully",
      {
        userId: "user-1",
        gridId: "grid-1",
      },
    );
  });

  it("logs and throws internal when the transaction fails unexpectedly", async () => {
    firestoreState.transactionShouldReject = true;

    await expect(
      updateDefaultGrid({ gridId: "grid-1" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "internal",
        "Failed to update default grid. Please try again.",
      );
      return true;
    });

    expect(logger.error).toHaveBeenCalledWith("Failed to update default grid", {
      error: "Error: transaction unavailable",
      userId: "user-1",
      gridId: "grid-1",
    });
  });
});
