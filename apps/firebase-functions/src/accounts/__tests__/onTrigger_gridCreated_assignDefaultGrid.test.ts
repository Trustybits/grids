import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { firestoreState } = vi.hoisted(() => ({
  firestoreState: {
    docs: new Map<string, Record<string, unknown>>(),
    transactionShouldThrow: false,
    txSetCalls: [] as Array<{
      path: string;
      data: Record<string, unknown>;
      options?: Record<string, unknown>;
    }>,
    txUpdateCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  },
}));

vi.mock("firebase-functions/v1", () => ({
  firestore: {
    document: vi.fn(() => ({
      onCreate: (handler: unknown) => handler,
    })),
  },
}));

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({ path: `${name}/${id}` }),
      }),
      runTransaction: async (
        callback: (transaction: unknown) => Promise<unknown>,
      ) => {
        if (firestoreState.transactionShouldThrow) {
          throw new Error("transaction failed");
        }
        const transaction = {
          get: async (ref: { path: string }) => {
            const data = firestoreState.docs.get(ref.path);
            return { exists: data !== undefined, data: () => data };
          },
          set: (
            ref: { path: string },
            data: Record<string, unknown>,
            options?: Record<string, unknown>,
          ) => {
            firestoreState.txSetCalls.push({ path: ref.path, data, options });
          },
          update: (ref: { path: string }, data: Record<string, unknown>) => {
            firestoreState.txUpdateCalls.push({ path: ref.path, data });
          },
        };
        return callback(transaction);
      },
    }),
  },
}));

vi.mock("../../maintenance.js", () => ({ noopIfMaintenance: vi.fn() }));

import { assignDefaultGridOnCreate as handlerExport } from "../onTrigger_gridCreated_assignDefaultGrid.js";

const assignDefaultGridOnCreate = handlerExport as unknown as (
  snapshot: { data: () => Record<string, unknown> },
  context: { params: { gridId: string } },
) => Promise<unknown>;

function snapshot(data: Record<string, unknown>) {
  return { data: () => data };
}

function context(gridId = "grid-1") {
  return { params: { gridId } };
}

beforeEach(() => {
  firestoreState.docs = new Map([
    ["users/user-1", { email: "person@example.com" }],
  ]);
  firestoreState.transactionShouldThrow = false;
  firestoreState.txSetCalls = [];
  firestoreState.txUpdateCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assignDefaultGridOnCreate", () => {
  it("returns null without touching Firestore when maintenance is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(
      assignDefaultGridOnCreate(snapshot({ userId: "user-1" }), context()),
    ).resolves.toBeNull();

    expect(firestoreState.txSetCalls).toEqual([]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("assigns the grid as the default and syncs the slug when none is set", async () => {
    firestoreState.docs.set("users/user-1", {
      email: "person@example.com",
      slug: "matt",
    });

    await assignDefaultGridOnCreate(
      snapshot({ userId: "user-1", name: "New Grid" }),
      context("grid-1"),
    );

    expect(firestoreState.txSetCalls).toEqual([
      {
        path: "users/user-1",
        data: { defaultGridId: "grid-1" },
        options: { merge: true },
      },
    ]);
    expect(firestoreState.txUpdateCalls).toEqual([
      { path: "slugs/matt", data: { defaultGridId: "grid-1" } },
    ]);
  });

  it("assigns the default without a slug update when the user has no slug", async () => {
    await assignDefaultGridOnCreate(
      snapshot({ userId: "user-1", name: "New Grid" }),
      context("grid-1"),
    );

    expect(firestoreState.txSetCalls).toEqual([
      {
        path: "users/user-1",
        data: { defaultGridId: "grid-1" },
        options: { merge: true },
      },
    ]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("assigns the default even for accounts notifications would skip (e.g. dev team)", async () => {
    // The auto-assign is intentionally decoupled from notification gating, so a
    // dev-team account still receives an automatic default grid.
    firestoreState.docs.set("users/user-1", {
      email: "developer@trustybits.com",
      slug: "dev",
    });

    await assignDefaultGridOnCreate(
      snapshot({ userId: "user-1", name: "Grid" }),
      context("grid-1"),
    );

    expect(firestoreState.txSetCalls).toEqual([
      {
        path: "users/user-1",
        data: { defaultGridId: "grid-1" },
        options: { merge: true },
      },
    ]);
  });

  it("does not assign a default for a duplicated grid", async () => {
    // A clone carries a clonedFrom marker and must never auto-become the
    // default, even when the user currently has none.
    await assignDefaultGridOnCreate(
      snapshot({ userId: "user-1", name: "Copy of Grid", clonedFrom: "grid-source" }),
      context("grid-1"),
    );

    expect(firestoreState.txSetCalls).toEqual([]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("does not overwrite an existing default grid", async () => {
    firestoreState.docs.set("users/user-1", {
      email: "person@example.com",
      defaultGridId: "existing-grid",
      slug: "matt",
    });

    await assignDefaultGridOnCreate(
      snapshot({ userId: "user-1", name: "Grid" }),
      context("grid-1"),
    );

    expect(firestoreState.txSetCalls).toEqual([]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("returns null without writing when the grid has no userId", async () => {
    await expect(
      assignDefaultGridOnCreate(snapshot({ name: "Grid" }), context("grid-1")),
    ).resolves.toBeNull();

    expect(firestoreState.txSetCalls).toEqual([]);
    expect(firestoreState.txUpdateCalls).toEqual([]);
  });

  it("logs the failure without throwing when the transaction fails", async () => {
    firestoreState.transactionShouldThrow = true;

    await expect(
      assignDefaultGridOnCreate(
        snapshot({ userId: "user-1", name: "Grid" }),
        context("grid-1"),
      ),
    ).resolves.toBeNull();

    expect(logger.error).toHaveBeenCalledWith("Failed to auto-assign default grid", {
      error: "Error: transaction failed",
      userId: "user-1",
      gridId: "grid-1",
    });
  });
});
