import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { adjustUploadRefCounts } from "../utils_uploadArchive.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    firestore: {
      document: () => ({
        onCreate: (handler: unknown) => handler,
        onUpdate: (handler: unknown) => handler,
        onDelete: (handler: unknown) => handler,
      }),
    },
  })),
}));

vi.mock("firebase-functions/logger", () => ({
  warn: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../utils_uploadArchive.js", () => ({
  adjustUploadRefCounts: vi.fn(),
}));

import {
  onGridStorageReferencesCreated,
  onGridStorageReferencesDeleted,
  onGridStorageReferencesUpdated,
} from "../onTrigger_gridStorageReferences.js";

const onCreate = onGridStorageReferencesCreated as unknown as (
  snapshot: { data: () => Record<string, unknown> },
  context: { params: { gridId: string } },
) => Promise<unknown>;
const onUpdate = onGridStorageReferencesUpdated as unknown as (
  change: {
    before: { data: () => Record<string, unknown> };
    after: { data: () => Record<string, unknown> };
  },
  context: { params: { gridId: string } },
) => Promise<unknown>;
const onDelete = onGridStorageReferencesDeleted as unknown as (
  snapshot: { data: () => Record<string, unknown> },
  context: { params: { gridId: string } },
) => Promise<unknown>;

function grid(hashes: string[]) {
  return {
    userId: "user-1",
    tiles: hashes.map((hash, index) => ({
      i: `tile-${index}`,
      content: {
        type: "image",
        src: `users/user-1/images/${hash}.png`,
        srcHash: hash,
      },
    })),
  };
}

function ctx(gridId = "grid-1") {
  return { params: { gridId } };
}

beforeEach(() => {
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(adjustUploadRefCounts).mockReset().mockResolvedValue(undefined);
  vi.mocked(logger.warn).mockClear();
});

describe("grid storage reference reconciliation", () => {
  it("increments all references on grid create, including duplicates", async () => {
    await onCreate({ data: () => grid([HASH_A, HASH_A, HASH_B]) }, ctx());

    const deltas = vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[1];
    expect(vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[0]).toBe("user-1");
    expect(deltas?.get(HASH_A)).toBe(2);
    expect(deltas?.get(HASH_B)).toBe(1);
  });

  it("diffs before and after references on update", async () => {
    await onUpdate(
      {
        before: { data: () => grid([HASH_A, HASH_A]) },
        after: { data: () => grid([HASH_A, HASH_B]) },
      },
      ctx(),
    );

    const deltas = vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[1];
    expect(deltas?.get(HASH_A)).toBe(-1);
    expect(deltas?.get(HASH_B)).toBe(1);
  });

  it("decrements removed tile references without deleting objects", async () => {
    await onUpdate(
      {
        before: { data: () => grid([HASH_A]) },
        after: { data: () => grid([]) },
      },
      ctx(),
    );

    const deltas = vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[1];
    expect(deltas?.get(HASH_A)).toBe(-1);
    expect(deltas?.size).toBe(1);
  });

  it("adjusts refs for undo and redo-style grid snapshots", async () => {
    await onUpdate(
      {
        before: { data: () => grid([]) },
        after: { data: () => grid([HASH_A]) },
      },
      ctx("grid-redo"),
    );
    await onUpdate(
      {
        before: { data: () => grid([HASH_A]) },
        after: { data: () => grid([]) },
      },
      ctx("grid-undo"),
    );

    expect(vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[1].get(HASH_A)).toBe(1);
    expect(vi.mocked(adjustUploadRefCounts).mock.calls[1]?.[1].get(HASH_A)).toBe(-1);
  });

  it("ignores non-archive and external references", async () => {
    await onCreate(
      {
        data: () => ({
          userId: "user-1",
          tiles: [
            {
              i: "external",
              content: {
                type: "image",
                src: "https://cdn.example.com/photo.png",
              },
            },
            {
              i: "other-owner",
              content: {
                type: "image",
                src: `users/user-2/images/${HASH_A}.png`,
              },
            },
            {
              i: "legacy-filename",
              content: {
                type: "image",
                src: "users/user-1/images/original-name.png",
              },
            },
          ],
        }),
      },
      ctx("grid-external"),
    );

    const deltas = vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[1];
    expect(vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[0]).toBe("user-1");
    expect(deltas?.size).toBe(0);
  });

  it("moves reference counts between owners when grid ownership changes", async () => {
    await onUpdate(
      {
        before: { data: () => grid([HASH_A, HASH_A]) },
        after: {
          data: () => ({
            ...grid([HASH_A, HASH_B]),
            userId: "user-2",
          }),
        },
      },
      ctx(),
    );

    expect(adjustUploadRefCounts).toHaveBeenCalledTimes(2);
    expect(vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[0]).toBe("user-1");
    expect(vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[1].get(HASH_A)).toBe(-2);
    expect(vi.mocked(adjustUploadRefCounts).mock.calls[1]?.[0]).toBe("user-2");
    expect(vi.mocked(adjustUploadRefCounts).mock.calls[1]?.[1].get(HASH_A)).toBe(1);
    expect(vi.mocked(adjustUploadRefCounts).mock.calls[1]?.[1].get(HASH_B)).toBe(1);
  });

  it("decrements all references on delete", async () => {
    await onDelete({ data: () => grid([HASH_A, HASH_B]) }, ctx());

    const deltas = vi.mocked(adjustUploadRefCounts).mock.calls[0]?.[1];
    expect(deltas?.get(HASH_A)).toBe(-1);
    expect(deltas?.get(HASH_B)).toBe(-1);
  });

  it("skips reconciliation when no owner is available", async () => {
    await onCreate({ data: () => ({ tiles: [] }) }, ctx("grid-missing-owner"));

    expect(adjustUploadRefCounts).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "Skipping grid storage reference reconciliation without owner",
      { gridId: "grid-missing-owner" },
    );
  });
});
