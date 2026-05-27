import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { firestoreState } = vi.hoisted(() => {
  const firestoreState = {
    docs: new Map<string, Record<string, unknown>>(),
    getCalls: [] as string[],
  };

  return { firestoreState };
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
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../secrets.js", () => ({
  notionClientId: { value: vi.fn(() => "client-id") },
  notionClientSecret: { value: vi.fn(() => "client-secret") },
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: () => ({
      collection: (collectionName: string) => ({
        doc: (docId: string) => ({
          collection: (subcollectionName: string) => ({
            doc: (subdocId: string) => ({
              get: async () => {
                const path = `${collectionName}/${docId}/${subcollectionName}/${subdocId}`;
                firestoreState.getCalls.push(path);
                const data = firestoreState.docs.get(path);
                return {
                  exists: data !== undefined,
                  data: () => data,
                };
              },
            }),
          }),
        }),
      }),
    }),
  },
}));

import { listNotionDatabases as callable } from "../onCall_listNotionDatabases.js";

const listNotionDatabases = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function setTokenDoc(
  gridId: string,
  tileId: string,
  data: Record<string, unknown>,
): void {
  firestoreState.docs.set(`grids/${gridId}/notionTokens/${tileId}`, data);
}

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as Error).message).toBe(message);
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.getCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listNotionDatabases", () => {
  it("returns null without validating auth or reading Firestore when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(listNotionDatabases({}, {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("listNotionDatabases");
    expect(firestoreState.getCalls).toEqual([]);
  });

  it("requires an authenticated caller", async () => {
    await expect(
      listNotionDatabases({ gridId: "grid-1", tileId: "tile-1" }, {}),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "unauthenticated", "You must be signed in.");
      return true;
    });
    expect(firestoreState.getCalls).toEqual([]);
  });

  it.each([
    ["missing data", undefined],
    ["missing gridId", { tileId: "tile-1" }],
    ["missing tileId", { gridId: "grid-1" }],
  ])("throws invalid-argument for %s", async (_label, data) => {
    await expect(
      listNotionDatabases(data, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Missing gridId or tileId.");
      return true;
    });
    expect(firestoreState.getCalls).toEqual([]);
  });

  it("throws not-found when no token is stored for the tile", async () => {
    await expect(
      listNotionDatabases(
        { gridId: "grid-1", tileId: "tile-1" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "not-found",
        "Notion integration not connected for this tile.",
      );
      return true;
    });
  });

  it("posts a database search request to Notion using the stored access token", async () => {
    setTokenDoc("grid-1", "tile-1", { accessToken: "secret-token" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await listNotionDatabases(
      { gridId: "grid-1", tileId: "tile-1" },
      { auth: { uid: "user-1" } },
    );

    expect(fetchMock).toHaveBeenCalledWith("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: "Bearer secret-token",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        filter: { value: "database", property: "object" },
        page_size: 50,
      }),
    });
  });

  it("maps Notion database results to id and plain-text title", async () => {
    setTokenDoc("grid-1", "tile-1", { accessToken: "secret-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              id: "db-1",
              title: [{ plain_text: "Product " }, { plain_text: "Roadmap" }],
            },
            { id: "db-2", title: [] },
            { id: "db-3" },
          ],
        }),
      }),
    );

    await expect(
      listNotionDatabases(
        { gridId: "grid-1", tileId: "tile-1" },
        { auth: { uid: "user-1" } },
      ),
    ).resolves.toEqual({
      databases: [
        { id: "db-1", title: "Product Roadmap" },
        { id: "db-2", title: "Untitled" },
        { id: "db-3", title: "Untitled" },
      ],
    });
  });

  it("logs and throws internal when Notion search fails", async () => {
    setTokenDoc("grid-1", "tile-1", { accessToken: "secret-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      }),
    );

    await expect(
      listNotionDatabases(
        { gridId: "grid-1", tileId: "tile-1" },
        { auth: { uid: "user-1" } },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "internal", "Failed to list Notion databases.");
      return true;
    });

    expect(logger.error).toHaveBeenCalledWith("Notion database list failed", {
      status: 401,
      body: "unauthorized",
    });
  });
});
