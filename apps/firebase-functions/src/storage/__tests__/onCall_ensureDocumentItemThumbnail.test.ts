import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";
import sharp from "sharp";

const { firestoreState, storageState, randomState, browserState } = vi.hoisted(() => ({
  firestoreState: {
    docs: new Map<string, Record<string, unknown>>(),
    getCalls: [] as string[],
    txUpdateCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  },
  storageState: {
    signedUrlCalls: [] as Array<{ path: string; options: Record<string, unknown> }>,
    saveCalls: [] as Array<{ path: string; data: Buffer; options: Record<string, unknown> }>,
  },
  randomState: {
    value: "token-1",
  },
  browserState: {
    renderShouldReject: false,
    gotoCalls: [] as Array<{ url: string; options: Record<string, unknown> }>,
  },
}));

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    https: {
      onCall: (handler: unknown) => handler,
    },
  })),
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock();
});

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => randomState.value),
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(async () => Buffer.from("resized-png")),
  })),
}));

vi.mock("@sparticuz/chromium-min", () => ({
  default: {
    args: ["--no-sandbox"],
    executablePath: vi.fn(async () => "/chromium"),
  },
}));

vi.mock("puppeteer-core", () => ({
  default: {
    launch: vi.fn(async () => ({
      newPage: async () => ({
        goto: async (url: string, options: Record<string, unknown>) => {
          if (browserState.renderShouldReject) {
            throw new Error("render failed");
          }
          browserState.gotoCalls.push({ url, options });
        },
        screenshot: async () => Buffer.from("raw-png"),
      }),
      close: vi.fn(async () => undefined),
    })),
  },
}));

vi.mock("firebase-admin", () => ({
  default: {
    firestore: () => ({
      collection: (collectionName: string) => ({
        doc: (docId: string) => ({
          path: `${collectionName}/${docId}`,
          get: async () => {
            const path = `${collectionName}/${docId}`;
            firestoreState.getCalls.push(path);
            const data = firestoreState.docs.get(path);
            return {
              exists: data !== undefined,
              data: () => data,
            };
          },
        }),
      }),
      runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          get: async (ref: { path: string }) => {
            const data = firestoreState.docs.get(ref.path);
            return {
              exists: data !== undefined,
              data: () => data,
            };
          },
          update: (ref: { path: string }, data: Record<string, unknown>) => {
            firestoreState.txUpdateCalls.push({ path: ref.path, data });
          },
        };
        return callback(tx);
      },
    }),
    storage: () => ({
      bucket: () => ({
        name: "bucket.test",
        file: (path: string) => ({
          getSignedUrl: async (options: Record<string, unknown>) => {
            storageState.signedUrlCalls.push({ path, options });
            return [`https://signed.test/${encodeURIComponent(path)}`];
          },
          save: async (data: Buffer, options: Record<string, unknown>) => {
            storageState.saveCalls.push({ path, data, options });
          },
        }),
      }),
    }),
  },
}));

import { ensureDocumentItemThumbnail as callable } from "../onCall_ensureDocumentItemThumbnail.js";

const ensureDocumentItemThumbnail = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function gridDoc(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    tiles: [
      {
        i: "tile-1",
        content: {
          type: "document",
          items: [
            {
              id: "item-1",
              fileName: "file.pdf",
              mimeType: "application/pdf",
              url: "https://firebasestorage.googleapis.com/v0/b/bucket/o/users%2Fuser-1%2Ffile.pdf?alt=media",
            },
          ],
        },
      },
    ],
    ...overrides,
  };
}

function validData() {
  return { gridId: "grid-1", tileId: "tile-1", itemId: "item-1" };
}

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as Error).message).toBe(message);
}

beforeEach(() => {
  firestoreState.docs = new Map([["grids/grid-1", gridDoc()]]);
  firestoreState.getCalls = [];
  firestoreState.txUpdateCalls = [];
  storageState.signedUrlCalls = [];
  storageState.saveCalls = [];
  browserState.renderShouldReject = false;
  browserState.gotoCalls = [];
  randomState.value = "token-1";
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(sharp).mockClear();
});

describe("ensureDocumentItemThumbnail", () => {
  it("returns null without auth or Firestore checks when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(ensureDocumentItemThumbnail(validData(), {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("ensureDocumentItemThumbnail");
    expect(firestoreState.getCalls).toEqual([]);
  });

  it("requires an authenticated caller and required ids", async () => {
    await expect(ensureDocumentItemThumbnail(validData(), {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "unauthenticated", "Sign in required.");
        return true;
      },
    );

    await expect(
      ensureDocumentItemThumbnail({}, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "invalid-argument",
        "gridId, tileId, and itemId are required.",
      );
      return true;
    });
  });

  it("rejects missing grids, empty grid data, and non-owner callers", async () => {
    firestoreState.docs.delete("grids/grid-1");
    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "Grid not found.");
      return true;
    });

    firestoreState.docs.set("grids/grid-1", {});
    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "permission-denied", "You do not own this grid.");
      return true;
    });

    firestoreState.docs.set("grids/grid-1", gridDoc({ userId: "other-user" }));
    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "permission-denied", "You do not own this grid.");
      return true;
    });
  });

  it("rejects grids without a document tile or item", async () => {
    firestoreState.docs.set("grids/grid-1", gridDoc({ tiles: undefined }));
    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "failed-precondition", "Grid has no tiles.");
      return true;
    });

    firestoreState.docs.set("grids/grid-1", gridDoc({ tiles: [] }));
    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "Document tile not found.");
      return true;
    });

    firestoreState.docs.set("grids/grid-1", gridDoc({
      tiles: [{ i: "tile-1", content: { type: "document", items: [] } }],
    }));
    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "not-found", "Document item not found.");
      return true;
    });
  });

  it("returns cached thumbnail URLs without rendering", async () => {
    firestoreState.docs.set("grids/grid-1", gridDoc({
      tiles: [{
        i: "tile-1",
        content: {
          type: "document",
          items: [{ id: "item-1", fileName: "file.pdf", url: "x", thumbnailUrl: "https://thumb.test/a.png" }],
        },
      }],
    }));

    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ thumbnailUrl: "https://thumb.test/a.png", cached: true });
    expect(storageState.saveCalls).toEqual([]);
  });

  it("skips non-PDF document items", async () => {
    firestoreState.docs.set("grids/grid-1", gridDoc({
      tiles: [{
        i: "tile-1",
        content: {
          type: "document",
          items: [{ id: "item-1", fileName: "file.txt", mimeType: "text/plain", url: "x" }],
        },
      }],
    }));

    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ skipped: true });
  });

  it("throws failed-precondition when the storage path cannot be parsed", async () => {
    firestoreState.docs.set("grids/grid-1", gridDoc({
      tiles: [{
        i: "tile-1",
        content: {
          type: "document",
          items: [{ id: "item-1", fileName: "file.pdf", url: "https://example.com/file.pdf" }],
        },
      }],
    }));

    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "failed-precondition",
        "Could not parse storage path from file URL.",
      );
      return true;
    });
  });

  it("renders, uploads, and writes the generated thumbnail URL back to the grid", async () => {
    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      thumbnailUrl:
        "https://firebasestorage.googleapis.com/v0/b/bucket.test/o/thumbnails%2Fdocuments%2Fuser-1%2Fitem-1.png?alt=media&token=token-1",
    });

    expect(storageState.signedUrlCalls[0].path).toBe("users/user-1/file.pdf");
    expect(browserState.gotoCalls[0].url).toBe("https://signed.test/users%2Fuser-1%2Ffile.pdf");
    expect(sharp).toHaveBeenCalledWith(Buffer.from("raw-png"));
    expect(storageState.saveCalls).toEqual([
      {
        path: "thumbnails/documents/user-1/item-1.png",
        data: Buffer.from("resized-png"),
        options: {
          contentType: "image/png",
          metadata: {
            cacheControl: "public, max-age=604800",
            metadata: {
              published: "true",
              firebaseStorageDownloadTokens: "token-1",
            },
          },
        },
      },
    ]);
    expect(firestoreState.txUpdateCalls[0].path).toBe("grids/grid-1");
    expect(JSON.stringify(firestoreState.txUpdateCalls[0].data)).toContain(
      "thumbnails%2Fdocuments%2Fuser-1%2Fitem-1.png",
    );
  });

  it("throws internal when PDF rendering fails", async () => {
    browserState.renderShouldReject = true;

    await expect(
      ensureDocumentItemThumbnail(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "internal", "Failed to render PDF thumbnail.");
      return true;
    });
    expect(storageState.saveCalls).toEqual([]);
  });
});
