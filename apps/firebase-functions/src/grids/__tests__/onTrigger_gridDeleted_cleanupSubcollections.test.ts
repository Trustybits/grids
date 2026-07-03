/**
 * Unit tests for the cleanupGridSubcollectionsOnDelete onDelete trigger.
 *
 * Covers:
 *  - maintenance gate: returns null and never calls recursiveDelete when
 *    MAINTENANCE_MODE is on
 *  - happy path: recursiveDelete is invoked once with the deleted grid's
 *    snapshot.ref, an info log is written, and the handler resolves to null
 *  - error path: a rejected recursiveDelete is caught and logged (not rethrown),
 *    and the handler still resolves to null
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { recursiveDelete } = vi.hoisted(() => ({
  recursiveDelete: vi.fn(),
}));

vi.mock("firebase-functions/v1", () => ({
  firestore: {
    document: vi.fn(() => ({
      onDelete: (handler: unknown) => handler,
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
      recursiveDelete,
    }),
  },
}));

vi.mock("../../maintenance.js", () => ({ noopIfMaintenance: vi.fn() }));

import { cleanupGridSubcollectionsOnDelete as handlerExport } from "../onTrigger_gridDeleted_cleanupSubcollections.js";

const cleanupGridSubcollectionsOnDelete = handlerExport as unknown as (
  snapshot: { ref: unknown },
  context: { params: { gridId: string } },
) => Promise<unknown>;

// A sentinel DocumentReference — the handler must forward exactly this to
// recursiveDelete without inspecting it.
const gridRef = { __ref: "grids/grid-1" };

function snapshot(ref: unknown = gridRef) {
  return { ref };
}

function context(gridId = "grid-1") {
  return { params: { gridId } };
}

beforeEach(() => {
  recursiveDelete.mockReset().mockResolvedValue(undefined);
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cleanupGridSubcollectionsOnDelete", () => {
  it("returns null without deleting anything when maintenance is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(
      cleanupGridSubcollectionsOnDelete(snapshot(), context()),
    ).resolves.toBeNull();

    expect(recursiveDelete).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it("recursively deletes the deleted grid's subtree via its snapshot ref", async () => {
    await expect(
      cleanupGridSubcollectionsOnDelete(snapshot(), context("grid-1")),
    ).resolves.toBeNull();

    expect(recursiveDelete).toHaveBeenCalledTimes(1);
    expect(recursiveDelete).toHaveBeenCalledWith(gridRef);
    expect(logger.info).toHaveBeenCalledWith(
      "Recursively deleted grid subcollections",
      { gridId: "grid-1" },
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("catches and logs a recursiveDelete failure without throwing", async () => {
    recursiveDelete.mockRejectedValueOnce(new Error("boom"));

    await expect(
      cleanupGridSubcollectionsOnDelete(snapshot(), context("grid-1")),
    ).resolves.toBeNull();

    expect(recursiveDelete).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "Failed to delete grid subcollections",
      { error: "Error: boom", gridId: "grid-1" },
    );
    expect(logger.info).not.toHaveBeenCalled();
  });
});
