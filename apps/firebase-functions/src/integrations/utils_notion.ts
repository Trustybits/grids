import { HttpsError } from "firebase-functions/v1/https";

const NOTION_VERSION = "2022-06-28";
const NOTION_TOKEN_MISSING_MESSAGE =
  "Notion integration not connected for this tile.";

type NotionHeadersOptions = {
  contentType?: "application/json";
};

export type NotionRichText = { plain_text?: string };
export type NotionOption = { name?: string };
export type NotionProperty = {
  type: string;
  title?: NotionRichText[];
  select?: { name?: string; options?: NotionOption[] };
  status?: { name?: string; options?: NotionOption[] };
  multi_select?: { options?: NotionOption[] };
  number?: number;
};

export async function getNotionAccessToken(
  db: FirebaseFirestore.Firestore,
  gridId: string,
  tileId: string,
): Promise<string> {
  const tokenDoc = await db
    .collection("grids")
    .doc(gridId)
    .collection("notionTokens")
    .doc(tileId)
    .get();

  if (!tokenDoc.exists) {
    throw new HttpsError("not-found", NOTION_TOKEN_MISSING_MESSAGE);
  }

  return tokenDoc.data()?.accessToken as string;
}

export function notionBearerHeaders(
  accessToken: string,
  options: NotionHeadersOptions = {},
): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(options.contentType ? { "Content-Type": options.contentType } : {}),
    "Notion-Version": NOTION_VERSION,
  };
}

export function notionBasicJsonHeaders(credentials: string): Record<string, string> {
  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}
