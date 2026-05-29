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
  info: vi.fn(),
  warn: vi.fn(),
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
          get: async () => {
            const path = `${collectionName}/${docId}`;
            firestoreState.getCalls.push(path);
            const data = firestoreState.docs.get(path);
            return {
              exists: data !== undefined,
              data: () => data,
            };
          },
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

import { fetchNotionRoadmap as callable } from "../onCall_fetchNotionRoadmap.js";

const fetchNotionRoadmap = callable as unknown as (
  data: unknown,
  context: Record<string, unknown>,
) => Promise<unknown>;

type FetchCall = {
  url: string;
  options?: RequestInit;
};

function setTokenDoc(
  gridId: string,
  tileId: string,
  data: Record<string, unknown>,
): void {
  firestoreState.docs.set(`grids/${gridId}/notionTokens/${tileId}`, data);
}

function setGridDoc(gridId: string, data: Record<string, unknown>): void {
  firestoreState.docs.set(`grids/${gridId}`, data);
}

function validData(overrides: Record<string, unknown> = {}) {
  return {
    gridId: "grid-1",
    tileId: "tile-1",
    ...overrides,
  };
}

function setConnectedRoadmapTile(
  content: Record<string, unknown> = {},
): void {
  setTokenDoc("grid-1", "tile-1", { accessToken: "secret-token" });
  setGridDoc("grid-1", {
    tiles: [
      {
        i: "tile-1",
        content: {
          notionDatabaseId: "db-1",
          statusPropertyName: "Status",
          upvotePropertyName: "Votes",
          statusMapping: {
            Planned: "backlog",
            Doing: "in_progress",
            Done: "done",
          },
          ...content,
        },
      },
    ],
  });
}

function installNotionFetch(options: {
  schemaOk?: boolean;
  schemaReject?: boolean;
  schemaProperties?: Record<string, unknown>;
  queryOk?: boolean;
  queryText?: string;
  queryPages?: Array<{
    results: unknown[];
    has_more: boolean;
    next_cursor: string | null;
  }>;
}) {
  const calls: FetchCall[] = [];
  const queryPages =
    options.queryPages ??
    [
      {
        results: [],
        has_more: false,
        next_cursor: null,
      },
    ];
  let queryIndex = 0;

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, options: init });

    if (url === "https://api.notion.com/v1/databases/db-1") {
      if (options.schemaReject) {
        throw new Error("schema unavailable");
      }

      return {
        ok: options.schemaOk ?? true,
        json: async () => ({
          properties:
            options.schemaProperties ??
            {
              Status: {
                type: "status",
                status: { options: [{ name: "Planned" }, { name: "Done" }] },
              },
              Votes: { type: "number" },
              Tags: {
                type: "multi_select",
                multi_select: { options: [{ name: "Public" }] },
              },
            },
        }),
      };
    }

    if (url === "https://api.notion.com/v1/databases/db-1/query") {
      if (options.queryOk === false) {
        return {
          ok: false,
          status: 500,
          text: async () => options.queryText ?? "query failed",
        };
      }

      const page = queryPages[Math.min(queryIndex, queryPages.length - 1)];
      queryIndex += 1;
      return {
        ok: true,
        json: async () => page,
      };
    }

    throw new Error(`unexpected fetch url: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as HttpsError).message).toBe(message);
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.getCalls = [];
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
  vi.mocked(logger.warn).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchNotionRoadmap", () => {
  it("returns null without validating input or reading Firestore when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(fetchNotionRoadmap({}, {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("fetchNotionRoadmap");
    expect(firestoreState.getCalls).toEqual([]);
  });

  it.each([
    ["missing data", undefined],
    ["missing gridId", { tileId: "tile-1" }],
    ["missing tileId", { gridId: "grid-1" }],
  ])("throws invalid-argument for %s", async (_label, data) => {
    await expect(fetchNotionRoadmap(data, {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "invalid-argument", "Missing gridId or tileId.");
        return true;
      },
    );
    expect(firestoreState.getCalls).toEqual([]);
  });

  it("throws not-found when the tile has no stored token", async () => {
    await expect(fetchNotionRoadmap(validData(), {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(
          error,
          "not-found",
          "Notion integration not connected for this tile.",
        );
        return true;
      },
    );
  });

  it("throws not-found when the grid document is missing", async () => {
    setTokenDoc("grid-1", "tile-1", { accessToken: "secret-token" });

    await expect(fetchNotionRoadmap(validData(), {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "not-found", "Grid not found.");
        return true;
      },
    );
  });

  it.each([
    ["missing database id", undefined],
    ["pending database id", "pending"],
  ])("throws not-found for %s", async (_label, notionDatabaseId) => {
    setConnectedRoadmapTile({ notionDatabaseId });

    await expect(fetchNotionRoadmap(validData(), {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(
          error,
          "not-found",
          "Roadmap tile or database ID not configured.",
        );
        return true;
      },
    );
  });

  it("uses client overrides and query filters when building the Notion query body", async () => {
    setConnectedRoadmapTile({
      notionDatabaseId: "pending",
      upvotePropertyName: "StoredVotes",
    });
    const { calls } = installNotionFetch({});

    await fetchNotionRoadmap(
      validData({
        databaseIdOverride: "db-1",
        upvotePropertyName: "Votes",
        queryFilters: [
          { propertyName: "Public", type: "checkbox", value: true },
          { propertyName: "Stage", type: "select", value: "Beta" },
          { propertyName: "Status", type: "status", value: "Doing" },
          {
            propertyName: "Tags",
            type: "multi_select",
            value: ["Public", "Launch"],
          },
        ],
      }),
      {},
    );

    const queryCall = calls.find((call) => call.url.endsWith("/query"));
    expect(JSON.parse(queryCall?.options?.body as string)).toEqual({
      page_size: 100,
      sorts: [{ property: "Votes", direction: "descending" }],
      filter: {
        and: [
          { property: "Public", checkbox: { equals: true } },
          { property: "Stage", select: { equals: "Beta" } },
          { property: "Status", status: { equals: "Doing" } },
          {
            or: [
              { property: "Tags", multi_select: { contains: "Public" } },
              { property: "Tags", multi_select: { contains: "Launch" } },
            ],
          },
        ],
      },
    });
  });

  it("paginates Notion query results and maps pages to roadmap items", async () => {
    setConnectedRoadmapTile();
    installNotionFetch({
      queryPages: [
        {
          results: [
            {
              id: "page-1",
              properties: {
                Name: {
                  type: "title",
                  title: [{ plain_text: "Better " }, { plain_text: "tiles" }],
                },
                Status: { type: "status", status: { name: "Doing" } },
                Votes: { type: "number", number: 12 },
              },
            },
          ],
          has_more: true,
          next_cursor: "cursor-2",
        },
        {
          results: [
            {
              id: "page-2",
              properties: {
                Name: { type: "title", title: [] },
                Status: { type: "status", status: { name: "Unknown" } },
                Votes: { type: "number", number: 2 },
              },
            },
          ],
          has_more: false,
          next_cursor: null,
        },
      ],
    });

    await expect(fetchNotionRoadmap(validData(), {})).resolves.toEqual({
      items: [
        {
          notionPageId: "page-1",
          title: "Better tiles",
          status: "in_progress",
          upvoteCount: 12,
        },
        {
          notionPageId: "page-2",
          title: "Untitled",
          status: "backlog",
          upvoteCount: 2,
        },
      ],
      propertyOptions: [
        {
          name: "Status",
          type: "status",
          selectOptions: ["Planned", "Done"],
        },
        { name: "Votes", type: "number", selectOptions: undefined },
        { name: "Tags", type: "multi_select", selectOptions: ["Public"] },
      ],
    });
  });

  it("logs and throws internal when Notion database query fails", async () => {
    setConnectedRoadmapTile();
    installNotionFetch({ queryOk: false, queryText: "notion outage" });

    await expect(fetchNotionRoadmap(validData(), {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "internal", "Failed to query Notion database.");
        return true;
      },
    );

    expect(logger.error).toHaveBeenCalledWith("Notion database query failed", {
      status: 500,
      body: "notion outage",
      databaseId: "db-1",
    });
  });

  it("still returns items when schema fetch fails", async () => {
    setConnectedRoadmapTile();
    installNotionFetch({
      schemaReject: true,
      queryPages: [
        {
          results: [{ id: "page-1", properties: {} }],
          has_more: false,
          next_cursor: null,
        },
      ],
    });

    await expect(fetchNotionRoadmap(validData(), {})).resolves.toEqual({
      items: [
        {
          notionPageId: "page-1",
          title: "Untitled",
          status: "backlog",
          upvoteCount: 0,
        },
      ],
      propertyOptions: [],
    });
    expect(logger.warn).toHaveBeenCalledWith("Failed to fetch Notion database schema", {
      error: "Error: schema unavailable",
    });
  });
});
