import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

const { firestoreState, secretState, FieldValue } = vi.hoisted(() => {
  const FieldValue = {
    serverTimestamp: vi.fn(() => ({ __op: "serverTimestamp" })),
  };
  const firestoreState = {
    docs: new Map<string, Record<string, unknown>>(),
    getCalls: [] as string[],
    setCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  };
  const secretState = {
    clientId: "client-id",
    clientSecret: "client-secret",
  };

  return { firestoreState, secretState, FieldValue };
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
  notionClientId: { value: vi.fn(() => secretState.clientId) },
  notionClientSecret: { value: vi.fn(() => secretState.clientSecret) },
}));

vi.mock("../../admin.js", () => ({
  default: {
    firestore: Object.assign(
      () => ({
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
                set: async (data: Record<string, unknown>) => {
                  firestoreState.setCalls.push({
                    path: `${collectionName}/${docId}/${subcollectionName}/${subdocId}`,
                    data,
                  });
                },
              }),
            }),
          }),
        }),
      }),
      { FieldValue },
    ),
  },
}));

import { notionOAuthExchange as callable } from "../onCall_notionOAuthExchange.js";

const notionOAuthExchange = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

function setGridDoc(gridId: string, data: Record<string, unknown>): void {
  firestoreState.docs.set(`grids/${gridId}`, data);
}

function validData() {
  return {
    code: "auth-code",
    gridId: "grid-1",
    tileId: "tile-1",
    redirectUri: "https://grids.so/notion/callback",
  };
}

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as Error).message).toBe(message);
}

beforeEach(() => {
  firestoreState.docs = new Map();
  firestoreState.getCalls = [];
  firestoreState.setCalls = [];
  secretState.clientId = "client-id";
  secretState.clientSecret = "client-secret";
  FieldValue.serverTimestamp.mockClear();
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notionOAuthExchange", () => {
  it("returns null without validating auth or reading Firestore when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);

    await expect(notionOAuthExchange({}, {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("notionOAuthExchange");
    expect(firestoreState.getCalls).toEqual([]);
  });

  it("requires an authenticated caller", async () => {
    await expect(notionOAuthExchange(validData(), {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "unauthenticated", "You must be signed in.");
        return true;
      },
    );
  });

  it.each([
    ["missing data", undefined],
    ["missing code", { ...validData(), code: undefined }],
    ["missing gridId", { ...validData(), gridId: undefined }],
    ["missing tileId", { ...validData(), tileId: undefined }],
    ["missing redirectUri", { ...validData(), redirectUri: undefined }],
  ])("throws invalid-argument for %s", async (_label, data) => {
    await expect(
      notionOAuthExchange(data, { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "invalid-argument",
        "Missing code, gridId, tileId, or redirectUri.",
      );
      return true;
    });
  });

  it("throws permission-denied when the grid is missing", async () => {
    await expect(
      notionOAuthExchange(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "permission-denied", "You do not own this grid.");
      return true;
    });
  });

  it("throws permission-denied when the caller does not own the grid", async () => {
    setGridDoc("grid-1", { userId: "other-user" });

    await expect(
      notionOAuthExchange(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "permission-denied", "You do not own this grid.");
      return true;
    });
  });

  it.each([
    ["missing client id", "", "client-secret"],
    ["missing client secret", "client-id", ""],
  ])("throws failed-precondition for %s", async (_label, clientId, clientSecret) => {
    setGridDoc("grid-1", { userId: "user-1" });
    secretState.clientId = clientId;
    secretState.clientSecret = clientSecret;

    await expect(
      notionOAuthExchange(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "failed-precondition",
        "Notion OAuth not configured.",
      );
      return true;
    });
  });

  it("posts the authorization code exchange request with Basic credentials", async () => {
    setGridDoc("grid-1", { userId: "user-1" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "access-token",
        workspace_id: "workspace-1",
        workspace_name: "Workspace",
        bot_id: "bot-1",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await notionOAuthExchange(validData(), { auth: { uid: "user-1" } });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.notion.com/v1/oauth/token",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code: "auth-code",
          redirect_uri: "https://grids.so/notion/callback",
        }),
      },
    );
  });

  it("logs and throws internal when Notion token exchange fails", async () => {
    setGridDoc("grid-1", { userId: "user-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "bad request",
      }),
    );

    await expect(
      notionOAuthExchange(validData(), { auth: { uid: "user-1" } }),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(
        error,
        "internal",
        "Failed to exchange Notion authorization code.",
      );
      return true;
    });

    expect(logger.error).toHaveBeenCalledWith("Notion token exchange failed", {
      status: 400,
      body: "bad request",
    });
    expect(firestoreState.setCalls).toEqual([]);
  });

  it("stores the token server-side and returns the workspace name", async () => {
    setGridDoc("grid-1", { userId: "user-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          workspace_id: "workspace-1",
          workspace_name: "Workspace",
          bot_id: "bot-1",
        }),
      }),
    );

    await expect(
      notionOAuthExchange(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      success: true,
      workspaceName: "Workspace",
    });

    expect(firestoreState.setCalls).toEqual([
      {
        path: "grids/grid-1/notionTokens/tile-1",
        data: {
          accessToken: "access-token",
          workspaceId: "workspace-1",
          workspaceName: "Workspace",
          botId: "bot-1",
          ownerId: "user-1",
          createdAt: { __op: "serverTimestamp" },
        },
      },
    ]);
    expect(logger.info).toHaveBeenCalledWith("Notion OAuth token stored", {
      gridId: "grid-1",
      tileId: "tile-1",
      workspaceId: "workspace-1",
    });
  });

  it("stores and returns an empty workspace name when Notion omits it", async () => {
    setGridDoc("grid-1", { userId: "user-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: "access-token",
          workspace_id: "workspace-1",
          bot_id: "bot-1",
        }),
      }),
    );

    await expect(
      notionOAuthExchange(validData(), { auth: { uid: "user-1" } }),
    ).resolves.toEqual({
      success: true,
      workspaceName: "",
    });
    expect(firestoreState.setCalls[0].data.workspaceName).toBe("");
  });
});
