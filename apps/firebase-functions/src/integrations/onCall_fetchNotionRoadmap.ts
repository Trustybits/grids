import * as functions from "firebase-functions/v1";
import { HttpsError } from "firebase-functions/v1/https";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { notionClientId, notionClientSecret } from "./secrets.js";

type NotionRichText = { plain_text?: string };
type NotionOption = { name?: string };
type NotionProperty = {
  type: string;
  title?: NotionRichText[];
  select?: { name?: string; options?: NotionOption[] };
  status?: { name?: string; options?: NotionOption[] };
  multi_select?: { options?: NotionOption[] };
  number?: number;
};

/**
 * Fetches pages from the connected Notion database and maps them to
 * RoadmapItem objects using the owner-configured status mapping.
 *
 * Returns up to 100 items sorted by upvote count descending.
 * Also returns the list of available select options for the status property
 * so the owner can configure the mapping in the tile settings UI.
 */
export const fetchNotionRoadmap = functions
  .runWith({ secrets: [notionClientId, notionClientSecret] })
  .https.onCall(async (data, _context) => {
    if (noopIfMaintenance("fetchNotionRoadmap")) return null;

    // No auth required — roadmap data is public (visible to anyone who can view the grid).
    // The Notion access token is read server-side from Firestore and never returned to the client.

    const {
      gridId,
      tileId,
      statusPropertyName,
      upvotePropertyName,
      statusMapping,
      databaseIdOverride,
      queryFilters,
    } = data as {
      gridId?: string;
      tileId?: string;
      statusPropertyName?: string;
      upvotePropertyName?: string;
      // Maps Notion select option names → "backlog" | "in_progress" | "done"
      statusMapping?: Record<string, string>;
      // Optional: pass the database ID directly so the client doesn't need to
      // wait for patchTileContent to persist to Firestore before calling this function.
      databaseIdOverride?: string;
      // Owner-configured filters applied when querying Notion.
      // Each filter maps to a Notion API filter condition.
      queryFilters?: Array<{
        propertyName: string;
        type: string;
        value: boolean | string | string[];
      }>;
    };

    if (!gridId || !tileId) {
      throw new HttpsError("invalid-argument", "Missing gridId or tileId.");
    }

    // Retrieve the stored Notion access token for this tile
    const db = admin.firestore();
    const tokenDoc = await db
      .collection("grids")
      .doc(gridId)
      .collection("notionTokens")
      .doc(tileId)
      .get();

    if (!tokenDoc.exists) {
      throw new HttpsError(
        "not-found",
        "Notion integration not connected for this tile.",
      );
    }

    // Any authenticated user can fetch items; the token itself is only accessible server-side.
    // but the token itself is only accessible server-side
    const accessToken = tokenDoc.data()?.accessToken as string;

    // Fetch the tile content to get the configured databaseId
    const gridDoc = await db.collection("grids").doc(gridId).get();
    if (!gridDoc.exists) {
      throw new HttpsError("not-found", "Grid not found.");
    }

    type RoadmapTileContent = {
      notionDatabaseId?: string;
      statusPropertyName?: string;
      upvotePropertyName?: string;
      statusMapping?: Record<string, string>;
      queryFilters?: Array<{
        propertyName: string;
        type: string;
        value: boolean | string | string[];
      }>;
    };
    type TileShape = { i: string; content?: RoadmapTileContent };
    const tiles: TileShape[] = gridDoc.data()?.tiles || [];
    const tile = tiles.find((t: TileShape) => t.i === tileId);

    // Prefer the client-supplied override (used when selectDatabase hasn't persisted yet)
    const databaseId = databaseIdOverride || tile?.content?.notionDatabaseId;
    if (!databaseId || databaseId === "pending") {
      throw new HttpsError(
        "not-found",
        "Roadmap tile or database ID not configured.",
      );
    }
    const effectiveStatusProp =
      statusPropertyName || tile?.content?.statusPropertyName || "";
    const effectiveUpvoteProp =
      upvotePropertyName || tile?.content?.upvotePropertyName || "";
    const effectiveMapping: Record<string, string> =
      statusMapping || tile?.content?.statusMapping || {};
    // Owner-configured query filters — applied as Notion API filter conditions
    const effectiveQueryFilters: Array<{
      propertyName: string;
      type: string;
      value: boolean | string | string[];
    }> = queryFilters || tile?.content?.queryFilters || [];

    logger.info("[fetchNotionRoadmap] Received queryFilters from client:", {
      queryFilters,
    });
    logger.info("[fetchNotionRoadmap] Effective queryFilters after fallback:", {
      effectiveQueryFilters,
    });

    // Build the Notion API `filter` object from effectiveQueryFilters.
    // All conditions are ANDed together using a compound `and` filter.
    // multi_select uses OR logic: item must have at least one of the selected tags.
    const buildNotionFilter = (): Record<string, unknown> | undefined => {
      if (effectiveQueryFilters.length === 0) return undefined;
      const conditions: Record<string, unknown>[] = [];
      for (const qf of effectiveQueryFilters) {
        if (qf.type === "checkbox") {
          conditions.push({
            property: qf.propertyName,
            checkbox: { equals: qf.value as boolean },
          });
        } else if (qf.type === "select") {
          conditions.push({
            property: qf.propertyName,
            select: { equals: qf.value as string },
          });
        } else if (qf.type === "status") {
          conditions.push({
            property: qf.propertyName,
            status: { equals: qf.value as string },
          });
        } else if (qf.type === "multi_select") {
          const values = Array.isArray(qf.value)
            ? (qf.value as string[])
            : [qf.value as string];
          if (values.length === 0) continue;
          if (values.length === 1) {
            conditions.push({
              property: qf.propertyName,
              multi_select: { contains: values[0] },
            });
          } else {
            // OR: at least one tag must match — expressed as a nested `or` compound
            conditions.push({
              or: values.map((v) => ({
                property: qf.propertyName,
                multi_select: { contains: v },
              })),
            });
          }
        }
      }
      if (conditions.length === 0) return undefined;
      if (conditions.length === 1) return conditions[0];
      return { and: conditions };
    };
    const notionFilter = buildNotionFilter();
    logger.info("[fetchNotionRoadmap] Built Notion filter:", {
      notionFilter: JSON.stringify(notionFilter),
    });

    // Fetch the database schema and all pages in parallel (schema fetch is independent)
    const schemaFetchPromise = fetch(
      `https://api.notion.com/v1/databases/${databaseId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Notion-Version": "2022-06-28",
        },
      },
    );

    // Paginate through all Notion results — the API caps each response at 100 rows.
    // We keep fetching until has_more is false.
    const sorts = effectiveUpvoteProp
      ? [{ property: effectiveUpvoteProp, direction: "descending" }]
      : [];

    type NotionPage = {
      id: string;
      properties?: Record<string, NotionProperty>;
    };
    const allPages: NotionPage[] = [];
    let startCursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: Record<string, unknown> = { page_size: 100, sorts };
      if (startCursor) body.start_cursor = startCursor;
      if (notionFilter) body.filter = notionFilter;

      const queryRes = await fetch(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
          },
          body: JSON.stringify(body),
        },
      );

      if (!queryRes.ok) {
        const errBody = await queryRes.text();
        logger.error("Notion database query failed", {
          status: queryRes.status,
          body: errBody,
          databaseId,
        });
        throw new HttpsError("internal", "Failed to query Notion database.");
      }

      const queryData = (await queryRes.json()) as {
        results: NotionPage[];
        has_more: boolean;
        next_cursor: string | null;
      };
      allPages.push(...queryData.results);
      hasMore = queryData.has_more;
      startCursor = queryData.next_cursor ?? undefined;
    }

    // Map Notion pages to RoadmapItem shape
    const items = allPages.map((page: NotionPage) => {
      const props: Record<string, NotionProperty> = page.properties || {};

      // Extract title from the first title-type property
      let title = "";
      for (const key of Object.keys(props)) {
        const prop = props[key];
        if (prop.type === "title" && Array.isArray(prop.title)) {
          title = prop.title
            .map((t: NotionRichText) => t.plain_text || "")
            .join("");
          break;
        }
      }

      // Extract status from the configured select/status property
      let rawStatus = "";
      if (effectiveStatusProp && props[effectiveStatusProp]) {
        const statusProp = props[effectiveStatusProp];
        if (statusProp.type === "select" && statusProp.select?.name) {
          rawStatus = statusProp.select.name;
        } else if (statusProp.type === "status" && statusProp.status?.name) {
          rawStatus = statusProp.status.name;
        }
      }

      // Map the raw Notion status value to one of our three canonical buckets
      const mappedStatus = effectiveMapping[rawStatus] || "backlog";

      // Extract upvote count from the configured number property
      let upvoteCount = 0;
      if (effectiveUpvoteProp && props[effectiveUpvoteProp]) {
        const upvoteProp = props[effectiveUpvoteProp];
        if (
          upvoteProp.type === "number" &&
          typeof upvoteProp.number === "number"
        ) {
          upvoteCount = upvoteProp.number;
        }
      }

      return {
        notionPageId: page.id,
        title: title || "Untitled",
        status: mappedStatus,
        upvoteCount,
      };
    });

    // Resolve the schema fetch that was started in parallel with the page queries
    let propertyOptions: {
      name: string;
      type: string;
      selectOptions?: string[];
    }[] = [];
    try {
      const dbRes = await schemaFetchPromise;
      if (dbRes.ok) {
        const dbData = (await dbRes.json()) as {
          properties: Record<string, NotionProperty>;
        };
        propertyOptions = Object.entries(dbData.properties).map(
          ([name, prop]) => ({
            name,
            type: prop.type,
            selectOptions:
              prop.type === "select"
                ? (prop.select?.options || []).map(
                    (o: NotionOption) => o.name as string,
                  )
                : prop.type === "status"
                  ? (prop.status?.options || []).map(
                      (o: NotionOption) => o.name as string,
                    )
                  : prop.type === "multi_select"
                    ? (prop.multi_select?.options || []).map(
                        (o: NotionOption) => o.name as string,
                      )
                    : undefined,
          }),
        );
      }
    } catch (err) {
      // Non-fatal — owner can still use the feed even without property options
      logger.warn("Failed to fetch Notion database schema", {
        error: String(err),
      });
    }

    logger.info("Notion roadmap fetched", {
      gridId,
      tileId,
      itemCount: items.length,
    });

    return { items, propertyOptions };
  });
