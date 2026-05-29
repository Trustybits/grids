import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import { isValidSlugFormat } from "../utils_slugValidation.js";

const { firestoreState } = vi.hoisted(() => {
  const firestoreState = {
    docs: new Map<string, { exists: boolean; data?: Record<string, unknown> }>(),
    getShouldReject: false,
    collectionCalls: [] as string[],
    docCalls: [] as string[],
  };

  return { firestoreState };
});

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock({ includeOnCall: true });
});

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
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
    firestore: () => ({
      collection: (collectionName: string) => {
        firestoreState.collectionCalls.push(collectionName);
        return {
          doc: (docId: string) => {
            firestoreState.docCalls.push(docId);
            return {
              get: async () => {
                if (firestoreState.getShouldReject) {
                  throw new Error("firestore unavailable");
                }

                const doc = firestoreState.docs.get(`${collectionName}/${docId}`);
                return {
                  exists: doc?.exists ?? false,
                  data: () => doc?.data,
                };
              },
            };
          },
        };
      },
    }),
  },
}));

import { checkSlugAvailability as callable } from "../onCall_checkSlugAvailability.js";

const checkSlugAvailability = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function setSlugDoc(slug: string, data?: Record<string, unknown>): void {
  firestoreState.docs.set(`slugs/${slug}`, {
    exists: true,
    data,
  });
}

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as Error).message).toBe(message);
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.getShouldReject = false;
  firestoreState.collectionCalls = [];
  firestoreState.docCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(isValidSlugFormat).mockReset().mockReturnValue(true);
  vi.mocked(logger.error).mockClear();
});

describe("checkSlugAvailability", () => {
  it("returns null without touching auth or Firestore when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(checkSlugAvailability({ slug: "matt" }, {})).resolves.toBeNull();
    expect(noopIfMaintenance).toHaveBeenCalledWith("checkSlugAvailability");
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("requires an authenticated caller", async () => {
    await expect(checkSlugAvailability({ slug: "matt" }, {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(
          error,
          "unauthenticated",
          "You must be signed in to check slug availability.",
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
    await expect(
      checkSlugAvailability(data, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Slug is required.");
      return true;
    });
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("normalizes the requested slug before validating and reading Firestore", async () => {
    await checkSlugAvailability(
      { slug: "  MaTT-Galley  " },
      { auth: { uid: "user-1" } },
    );

    expect(isValidSlugFormat).toHaveBeenCalledWith("matt-galley");
    expect(firestoreState.collectionCalls).toEqual(["slugs"]);
    expect(firestoreState.docCalls).toEqual(["matt-galley"]);
  });

  it("returns invalid-format without reading Firestore when the normalized slug is invalid", async () => {
    vi.mocked(isValidSlugFormat).mockReturnValue(false);

    await expect(
      checkSlugAvailability({ slug: "bad_slug" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      available: false,
      reason: "invalid-format",
      message:
        "Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only.",
    });
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("returns reserved without reading Firestore when the slug is reserved", async () => {
    await expect(
      checkSlugAvailability({ slug: "Admin" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      available: false,
      reason: "reserved",
      message: "This slug is reserved.",
    });
    expect(firestoreState.collectionCalls).toEqual([]);
  });

  it("returns available when no slug document exists", async () => {
    await expect(
      checkSlugAvailability({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      available: true,
      reason: "available",
      message: "This slug is available!",
    });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("returns available when the slug document userId is %s", async (_label, userId) => {
    setSlugDoc("matt", { userId });

    await expect(
      checkSlugAvailability({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      available: true,
      reason: "available",
      message: "This slug is available!",
    });
  });

  it("returns own-slug when the existing slug belongs to the caller", async () => {
    setSlugDoc("matt", { userId: "user-1" });

    await expect(
      checkSlugAvailability({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      available: true,
      reason: "own-slug",
      message: "This is your current slug.",
    });
  });

  it("returns taken when the existing slug belongs to another user", async () => {
    setSlugDoc("matt", { userId: "user-2" });

    await expect(
      checkSlugAvailability({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      available: false,
      reason: "taken",
      message: "This slug is already taken.",
    });
  });

  it("logs and throws internal when Firestore lookup fails", async () => {
    firestoreState.getShouldReject = true;

    await expect(
      checkSlugAvailability({ slug: "matt" }, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "internal",
        "Failed to check slug availability.",
      );
      return true;
    });

    expect(logger.error).toHaveBeenCalledWith(
      "Failed to check slug availability",
      {
        error: "Error: firestore unavailable",
        slug: "matt",
      },
    );
  });
});
