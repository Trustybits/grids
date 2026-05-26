import { describe, expect, it } from "vitest";
import { HttpsError } from "firebase-functions/v1/https";
import {
  getNotionAccessToken,
  notionBasicJsonHeaders,
  notionBearerHeaders,
} from "../utils_notion.js";

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as HttpsError).message).toBe(message);
}

function firestoreWithTokenDoc(
  tokenDoc: { exists: boolean; data?: () => Record<string, unknown> },
  calls: string[] = [],
): FirebaseFirestore.Firestore {
  return {
    collection: (collectionName: string) => {
      calls.push(`collection:${collectionName}`);
      return {
        doc: (gridId: string) => {
          calls.push(`grid:${gridId}`);
          return {
            collection: (subcollectionName: string) => {
              calls.push(`subcollection:${subcollectionName}`);
              return {
                doc: (tileId: string) => {
                  calls.push(`tile:${tileId}`);
                  return {
                    get: async () => tokenDoc,
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as FirebaseFirestore.Firestore;
}

describe("getNotionAccessToken", () => {
  it("reads the tile token document and returns the stored access token", async () => {
    const calls: string[] = [];
    const db = firestoreWithTokenDoc(
      {
        exists: true,
        data: () => ({ accessToken: "secret-token" }),
      },
      calls,
    );

    await expect(getNotionAccessToken(db, "grid-1", "tile-1")).resolves.toBe(
      "secret-token",
    );
    expect(calls).toEqual([
      "collection:grids",
      "grid:grid-1",
      "subcollection:notionTokens",
      "tile:tile-1",
    ]);
  });

  it("throws not-found when the tile has no connected Notion token", async () => {
    const db = firestoreWithTokenDoc({ exists: false });

    try {
      await getNotionAccessToken(db, "grid-1", "tile-1");
      throw new Error("Expected getNotionAccessToken to throw");
    } catch (error) {
      expectHttpsError(
        error,
        "not-found",
        "Notion integration not connected for this tile.",
      );
    }
  });
});

describe("notionBearerHeaders", () => {
  it("builds bearer headers without content-type for GET-style requests", () => {
    expect(notionBearerHeaders("secret-token")).toEqual({
      Authorization: "Bearer secret-token",
      "Notion-Version": "2022-06-28",
    });
  });

  it("adds JSON content-type when requested", () => {
    expect(
      notionBearerHeaders("secret-token", { contentType: "application/json" }),
    ).toEqual({
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    });
  });
});

describe("notionBasicJsonHeaders", () => {
  it("builds basic-auth JSON headers for OAuth token exchange", () => {
    expect(notionBasicJsonHeaders("encoded-creds")).toEqual({
      Authorization: "Basic encoded-creds",
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    });
  });
});
