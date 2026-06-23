import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { firestoreState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  };
  const firestoreState = {
    docs: new Map<string, Record<string, unknown>>(),
    setCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
    getShouldThrowPaths: new Set<string>(),
  };

  return { firestoreState, FieldValue };
});

vi.mock("firebase-functions/v1", () => ({
  firestore: {
    document: vi.fn(() => ({
      onUpdate: (handler: unknown) => handler,
    })),
  },
}));

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: (name: string) => ({
          doc: (id: string) => ({
            path: `${name}/${id}`,
            get: async () => {
              const path = `${name}/${id}`;
              if (firestoreState.getShouldThrowPaths.has(path)) {
                throw new Error(`get failed: ${path}`);
              }
              const data = firestoreState.docs.get(path);
              return { exists: data !== undefined, data: () => data };
            },
            set: async (data: Record<string, unknown>) => {
              firestoreState.setCalls.push({ path: `${name}/${id}`, data });
              firestoreState.docs.set(`${name}/${id}`, data);
            },
          }),
        }),
      }),
      { FieldValue },
    ),
  },
}));

vi.mock("../../maintenance.js", () => ({ noopIfMaintenance: vi.fn() }));

import { onRecordFirstGridEdit as handlerExport } from "../onTrigger_recordFirstGridEdit.js";

const onRecordFirstGridEdit = handlerExport as unknown as (
  change: {
    before: { data: () => Record<string, unknown> };
    after: { data: () => Record<string, unknown> };
  },
  context: { params: { gridId: string } },
) => Promise<unknown>;

function change(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return {
    before: { data: () => before },
    after: { data: () => after },
  };
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.setCalls = [];
  firestoreState.getShouldThrowPaths = new Set();
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onRecordFirstGridEdit", () => {
  it("records first tile edit for a user", async () => {
    await onRecordFirstGridEdit(
      change(
        {
          userId: "user-1",
          name: "Grid",
          tiles: [],
          updatedAt: { toMillis: () => 1 },
        },
        {
          userId: "user-1",
          name: "Grid",
          tiles: [{ i: "tile-1" }],
          updatedAt: { toMillis: () => 2 },
        },
      ),
      { params: { gridId: "grid-1" } },
    );

    expect(firestoreState.setCalls).toEqual([
      {
        path: "grid_engagement_emails/user-1",
        data: {
          userId: "user-1",
          gridId: "grid-1",
          gridName: "Grid",
          firstEditAt: { __op: "serverTimestamp" },
          status: "pending",
        },
      },
    ]);
  });

  it("does not record privacy-only changes", async () => {
    await onRecordFirstGridEdit(
      change(
        {
          userId: "user-1",
          name: "Grid",
          tiles: [],
          isPublic: false,
          updatedAt: { toMillis: () => 1 },
        },
        {
          userId: "user-1",
          name: "Grid",
          tiles: [],
          isPublic: true,
          updatedAt: { toMillis: () => 2 },
        },
      ),
      { params: { gridId: "grid-1" } },
    );

    expect(firestoreState.setCalls).toEqual([]);
  });

  it("is idempotent after the first recorded edit", async () => {
    firestoreState.docs.set("grid_engagement_emails/user-1", {
      status: "pending",
    });

    await onRecordFirstGridEdit(
      change(
        {
          userId: "user-1",
          name: "Grid",
          tiles: [],
          updatedAt: { toMillis: () => 1 },
        },
        {
          userId: "user-1",
          name: "New Name",
          tiles: [{ i: "tile-1" }],
          updatedAt: { toMillis: () => 2 },
        },
      ),
      { params: { gridId: "grid-2" } },
    );

    expect(firestoreState.setCalls).toEqual([]);
  });
});
