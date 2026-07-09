import { beforeEach, describe, expect, it, vi } from "vitest";

const { adminState, FieldValue, Timestamp, isValidSlugFormat } = vi.hoisted(
  () => {
    const FieldValue = {
      serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
    };
    const Timestamp = {
      fromMillis: vi.fn((millis: number) => ({
        millis,
        toMillis: () => millis,
      })),
    };
    return {
      FieldValue,
      Timestamp,
      isValidSlugFormat: vi.fn((slug: string) => slug !== "bad slug"),
      adminState: {
        docs: new Map<string, Record<string, unknown>>(),
        updates: [] as Array<{ path: string; data: Record<string, unknown> }>,
        authUsers: new Map<string, { uid: string }>(),
      },
    };
  },
);

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import(
    "../../__tests__/utils_testMocks.js"
  );
  return createHttpsModuleMock();
});

vi.mock("../../accounts/utils_slugValidation.js", () => ({
  isValidSlugFormat,
}));

vi.mock("../../storage/utils_uploadPaths.js", () => ({
  STORAGE_QUOTA_BYTES: 100,
}));

vi.mock("../../admin.js", () => {
  function docRef(path: string) {
    return {
      path,
      get: async () => {
        const data = adminState.docs.get(path);
        return {
          exists: data !== undefined,
          data: () => data,
        };
      },
      update: async (data: Record<string, unknown>) => {
        adminState.updates.push({ path, data });
      },
      collection: (subcollection: string) => ({
        doc: (id: string) => docRef(`${path}/${subcollection}/${id}`),
      }),
    };
  }

  const firestore = () => ({
    collection: (collection: string) => ({
      doc: (id: string) => docRef(`${collection}/${id}`),
    }),
  });
  firestore.FieldValue = FieldValue;
  firestore.Timestamp = Timestamp;

  return {
    default: {
      firestore,
      auth: () => ({
        getUserByEmail: async (email: string) => {
          const user = adminState.authUsers.get(email);
          if (!user) throw new Error("not-found");
          return user;
        },
      }),
    },
  };
});

import {
  GRID_TRANSFER_EXPIRY_MS,
  getRecipientQuotaRemaining,
  isExpired,
  markTransferResolved,
  normalizeGridId,
  normalizeRecipientRef,
  normalizeRemoveOrphanedFiles,
  normalizeTransferId,
  readTransfer,
  resolveRecipientUid,
  timestampFromMillis,
  timestampToMillis,
  transferExpiresAt,
} from "../utils_gridTransfer.js";

beforeEach(() => {
  adminState.docs = new Map();
  adminState.updates = [];
  adminState.authUsers = new Map();
  FieldValue.serverTimestamp.mockClear();
  Timestamp.fromMillis.mockClear();
  isValidSlugFormat.mockClear();
});

describe("transfer timestamp helpers", () => {
  it("creates Firestore timestamps and applies the 14 day expiry window", () => {
    expect(timestampFromMillis(123)).toMatchObject({ millis: 123 });
    expect(transferExpiresAt(1_000)).toMatchObject({
      millis: 1_000 + GRID_TRANSFER_EXPIRY_MS,
    });
  });

  it("normalizes supported timestamp-like values and rejects unknown shapes", () => {
    expect(timestampToMillis(5)).toBe(5);
    expect(timestampToMillis(new Date(10))).toBe(10);
    expect(timestampToMillis({ toMillis: () => 20 })).toBe(20);
    expect(timestampToMillis({ toDate: () => new Date(30) })).toBe(30);
    expect(timestampToMillis({})).toBeNull();
  });

  it("treats missing expiry values as not expired", () => {
    expect(isExpired({ toMillis: () => 99 }, 100)).toBe(true);
    expect(isExpired({ toMillis: () => 101 }, 100)).toBe(false);
    expect(isExpired(null, 100)).toBe(false);
  });
});

describe("transfer input normalization", () => {
  it("trims required ids and rejects empty values", () => {
    expect(normalizeTransferId(" transfer-1 ")).toBe("transfer-1");
    expect(normalizeGridId(" grid-1 ")).toBe("grid-1");
    expect(() => normalizeTransferId("")).toThrow("transferId is required.");
    expect(() => normalizeGridId(null)).toThrow("gridId is required.");
  });

  it("requires an explicit boolean for removeOrphanedFiles", () => {
    expect(normalizeRemoveOrphanedFiles(true)).toBe(true);
    expect(normalizeRemoveOrphanedFiles(false)).toBe(false);
    expect(() => normalizeRemoveOrphanedFiles(undefined)).toThrow(
      "removeOrphanedFiles is required.",
    );
  });

  it("accepts exactly one recipient email or valid slug", () => {
    expect(normalizeRecipientRef({ email: " USER@EXAMPLE.COM " })).toEqual({
      email: "user@example.com",
    });
    expect(normalizeRecipientRef({ slug: " Target-Slug " })).toEqual({
      slug: "target-slug",
    });
    expect(() =>
      normalizeRecipientRef({ email: "a@example.com", slug: "target" }),
    ).toThrow("Provide either an email or a slug");
    expect(() => normalizeRecipientRef({ slug: "bad slug" })).toThrow(
      "Invalid recipient slug.",
    );
    expect(() => normalizeRecipientRef({})).toThrow(
      "Recipient email or slug is required.",
    );
  });
});

describe("transfer document helpers", () => {
  it("resolves recipient uid by slug or email", async () => {
    adminState.docs.set("slugs/target", { userId: "target-uid" });
    adminState.authUsers.set("target@example.com", { uid: "email-uid" });

    await expect(resolveRecipientUid({ slug: "target" })).resolves.toBe(
      "target-uid",
    );
    await expect(resolveRecipientUid({ email: "target@example.com" })).resolves.toBe(
      "email-uid",
    );
  });

  it("uses a generic not-found error for unknown recipients", async () => {
    await expect(resolveRecipientUid({ slug: "missing" })).rejects.toMatchObject({
      code: "not-found",
    });
    await expect(
      resolveRecipientUid({ email: "missing@example.com" }),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("reads transfer documents with the document id as the authoritative id", async () => {
    adminState.docs.set("gridTransfers/transfer-1", {
      id: "stale",
      gridId: "grid-1",
      status: "pending",
    });

    await expect(readTransfer("transfer-1")).resolves.toMatchObject({
      ref: { path: "gridTransfers/transfer-1" },
      transfer: { id: "transfer-1", gridId: "grid-1", status: "pending" },
    });
    await expect(readTransfer("missing")).rejects.toMatchObject({
      code: "not-found",
    });
  });

  it("marks transfers resolved with lifecycle timestamps and extra fields", async () => {
    await markTransferResolved(
      { path: "gridTransfers/transfer-1", update: vi.fn() } as never,
      "expired",
      { failureReason: "expired" },
    );

    const ref = {
      path: "gridTransfers/transfer-2",
      update: vi.fn(),
    } as never;
    await markTransferResolved(ref, "declined");
    expect((ref as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "declined",
        updatedAt: { __op: "serverTimestamp" },
        resolvedAt: { __op: "serverTimestamp" },
      }),
    );
  });

  it("computes recipient quota for normal, dev, and missing user documents", async () => {
    adminState.docs.set("users/normal", { storageUsed: 40 });
    adminState.docs.set("users/dev", {
      storageUsed: 100,
      isDevAccount: true,
    });

    await expect(getRecipientQuotaRemaining("normal")).resolves.toEqual({
      remaining: 60,
      isDevAccount: false,
    });
    await expect(getRecipientQuotaRemaining("missing")).resolves.toEqual({
      remaining: 100,
      isDevAccount: false,
    });
    await expect(getRecipientQuotaRemaining("dev")).resolves.toEqual({
      remaining: Number.MAX_SAFE_INTEGER,
      isDevAccount: true,
    });
  });
});
