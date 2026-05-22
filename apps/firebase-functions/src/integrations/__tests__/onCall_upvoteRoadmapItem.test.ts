import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { firestoreState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  };
  const firestoreState = {
    docs: new Map<string, Record<string, unknown>>(),
    getCalls: [] as string[],
    txGetCalls: [] as string[],
    txSetCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
    txDeleteCalls: [] as string[],
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

vi.mock("../secrets.js", () => ({
  notionClientId: { value: vi.fn(() => "client-id") },
  notionClientSecret: { value: vi.fn(() => "client-secret") },
}));

function makeDocRef(path: string) {
  return {
    path,
    collection: (collectionName: string) => ({
      doc: (docId: string) => makeDocRef(`${path}/${collectionName}/${docId}`),
    }),
    get: async () => {
      firestoreState.getCalls.push(path);
      const data = firestoreState.docs.get(path);
      return {
        exists: data !== undefined,
        data: () => data,
      };
    },
  };
}

vi.mock("../../admin.js", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: (collectionName: string) => ({
          doc: (docId: string) => makeDocRef(`${collectionName}/${docId}`),
        }),
        runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => {
          const transaction = {
            get: async (ref: { path: string }) => {
              firestoreState.txGetCalls.push(ref.path);
              const data = firestoreState.docs.get(ref.path);
              return {
                exists: data !== undefined,
                data: () => data,
              };
            },
            set: (ref: { path: string }, data: Record<string, unknown>) => {
              firestoreState.txSetCalls.push({ path: ref.path, data });
            },
            delete: (ref: { path: string }) => {
              firestoreState.txDeleteCalls.push(ref.path);
            },
          };

          return callback(transaction);
        },
      }),
      { FieldValue },
    ),
  },
}));

import { upvoteRoadmapItem as callable } from "../onCall_upvoteRoadmapItem.js";

const upvoteRoadmapItem = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function validData(overrides: Record<string, unknown> = {}) {
  return {
    gridId: "grid-1",
    tileId: "tile-1",
    notionPageId: "page-1",
    ...overrides,
  };
}

function setDoc(path: string, data: Record<string, unknown>): void {
  firestoreState.docs.set(path, data);
}

function setConnectedTile(upvotePropertyName = "Votes"): void {
  setDoc("grids/grid-1/notionTokens/tile-1", { accessToken: "secret-token" });
  setDoc("grids/grid-1", {
    tiles: [
      {
        i: "tile-1",
        content: { upvotePropertyName },
      },
    ],
  });
}

function installPageFetch(currentCount: number, options: { getOk?: boolean; reject?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (options.reject) {
      throw new Error("notion unavailable");
    }

    if (url === "https://api.notion.com/v1/pages/page-1" && !init?.method) {
      return {
        ok: options.getOk ?? true,
        json: async () => ({
          properties: {
            Votes: { number: currentCount },
          },
        }),
      };
    }

    if (
      url === "https://api.notion.com/v1/pages/page-1" &&
      init?.method === "PATCH"
    ) {
      return {
        ok: true,
        json: async () => ({}),
      };
    }

    throw new Error(`unexpected fetch url: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as HttpsError).message).toBe(message);
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.getCalls = [];
  firestoreState.txGetCalls = [];
  firestoreState.txSetCalls = [];
  firestoreState.txDeleteCalls = [];
  FieldValue.serverTimestamp.mockClear();
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("upvoteRoadmapItem", () => {
  it("returns null without validating auth or reading Firestore when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(upvoteRoadmapItem({}, {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("upvoteRoadmapItem");
    expect(firestoreState.getCalls).toEqual([]);
  });

  it("requires an authenticated caller", async () => {
    await expect(upvoteRoadmapItem(validData(), {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "unauthenticated", "You must be signed in to upvote.");
        return true;
      },
    );
  });

  it.each([
    ["missing data", undefined],
    ["missing gridId", { tileId: "tile-1", notionPageId: "page-1" }],
    ["missing tileId", { gridId: "grid-1", notionPageId: "page-1" }],
    ["missing notionPageId", { gridId: "grid-1", tileId: "tile-1" }],
  ])("throws invalid-argument for %s", async (_label, data) => {
    await expect(upvoteRoadmapItem(data, { auth: { uid: "user-1" } })).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(
          error,
          "invalid-argument",
          "Missing gridId, tileId, or notionPageId.",
        );
        return true;
      },
    );
  });

  it("throws not-found when the tile has no stored token", async () => {
    await expect(
      upvoteRoadmapItem(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "not-found",
        "Notion integration not connected for this tile.",
      );
      return true;
    });
  });

  it("records a new upvote and patches Notion with an incremented count", async () => {
    setConnectedTile();
    const fetchMock = installPageFetch(4);

    await expect(
      upvoteRoadmapItem(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ isNowUpvoted: true });

    expect(firestoreState.txGetCalls).toEqual([
      "grids/grid-1/tiles/tile-1/upvotes/user-1_page-1",
    ]);
    expect(firestoreState.txSetCalls).toEqual([
      {
        path: "grids/grid-1/tiles/tile-1/upvotes/user-1_page-1",
        data: {
          userId: "user-1",
          notionPageId: "page-1",
          votedAt: { __op: "serverTimestamp" },
        },
      },
    ]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://api.notion.com/v1/pages/page-1",
      {
        method: "PATCH",
        headers: {
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          properties: {
            Votes: { number: 5 },
          },
        }),
      },
    );
  });

  it("removes an existing upvote and never patches Notion below zero", async () => {
    setConnectedTile();
    setDoc("grids/grid-1/tiles/tile-1/upvotes/user-1_page-1", {
      userId: "user-1",
      notionPageId: "page-1",
    });
    const fetchMock = installPageFetch(0);

    await expect(
      upvoteRoadmapItem(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ isNowUpvoted: false });

    expect(firestoreState.txDeleteCalls).toEqual([
      "grids/grid-1/tiles/tile-1/upvotes/user-1_page-1",
    ]);
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({
      properties: {
        Votes: { number: 0 },
      },
    });
  });

  it("skips Notion patching when no upvote property name is configured", async () => {
    setConnectedTile("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      upvoteRoadmapItem(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ isNowUpvoted: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the patch when the Notion page fetch is not ok", async () => {
    setConnectedTile();
    const fetchMock = installPageFetch(4, { getOk: false });

    await expect(
      upvoteRoadmapItem(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ isNowUpvoted: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firestoreState.txSetCalls).toHaveLength(1);
  });

  it("logs but still returns the Firestore vote result when Notion patching throws", async () => {
    setConnectedTile();
    installPageFetch(4, { reject: true });

    await expect(
      upvoteRoadmapItem(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({ isNowUpvoted: true });

    expect(logger.error).toHaveBeenCalledWith("Failed to patch Notion upvote count", {
      error: "Error: notion unavailable",
      notionPageId: "page-1",
    });
  });
});
