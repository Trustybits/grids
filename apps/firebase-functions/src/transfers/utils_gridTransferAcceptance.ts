import admin from "../admin.js";
import {
  ContentType,
  type Grid,
  type RoadmapFeedContent,
  type Tile,
} from "@grids/contracts/types";
import {
  extractGridStorageReferencesFromRecord,
  rewriteArchiveBackedContent,
  rewriteBackgroundImage,
  type GridStorageRewriteMap,
} from "@grids/contracts/storage";
import { readUploadArchiveDoc, uploadArchiveRef } from "../storage/utils_uploadArchive.js";
import {
  copyArchiveObjects,
  prepareArchiveObjectCopyPlan,
  type ArchiveObjectCopyPlan,
} from "../storage/utils_copyArchiveObjects.js";

type GridRecord = Record<string, unknown> & {
  id?: string;
  userId?: string;
  tiles?: unknown[];
  backgroundImageSrc?: string;
  backgroundImageHash?: string;
  rev?: number;
};

export type GridTransferInventoryFile = {
  hash: string;
  displayName: string;
  kind: "images" | "videos" | "documents";
  size: number;
  alreadyOwned: boolean;
};

export async function buildTransferInventory(params: {
  grid: unknown;
  fromUserId: string;
  toUserId: string;
  assertQuota: boolean;
}): Promise<{
  references: ReturnType<typeof extractGridStorageReferencesFromRecord>;
  copyPlan: ArchiveObjectCopyPlan;
  files: GridTransferInventoryFile[];
}> {
  const references = extractGridStorageReferencesFromRecord(params.grid);
  const copyPlan = await prepareArchiveObjectCopyPlan({
    sourceUid: params.fromUserId,
    targetUid: params.toUserId,
    references,
    requireShareable: false,
    requireActiveSource: true,
    assertQuota: params.assertQuota,
  });
  const files = [...copyPlan.copiable.entries()].map(([hash, archiveDoc]) => ({
    hash,
    displayName: archiveDoc.displayName ?? `${archiveDoc.hash}.${archiveDoc.ext}`,
    kind: archiveDoc.kind as GridTransferInventoryFile["kind"],
    size: archiveDoc.size,
    alreadyOwned: copyPlan.targetArchiveDocs.has(hash),
  }));
  return { references, copyPlan, files };
}

export async function copyTransferArchiveObjects(params: {
  toUserId: string;
  copyPlan: ArchiveObjectCopyPlan;
}): Promise<GridStorageRewriteMap> {
  return copyArchiveObjects({
    targetUid: params.toUserId,
    plan: params.copyPlan,
  });
}

export function rewriteGridForTransfer(params: {
  gridId: string;
  grid: GridRecord;
  toUserId: string;
  rewriteMap: GridStorageRewriteMap;
  nonCopiableHashes: Set<string>;
}): Partial<Grid> {
  const sourceGrid = {
    ...params.grid,
    id: params.gridId,
    tiles: JSON.parse(JSON.stringify(params.grid.tiles ?? [])) as Tile[],
  } as Grid;
  const replacementTileIds = collectReplacementTileIds(
    sourceGrid,
    params.nonCopiableHashes,
  );

  sourceGrid.tiles = sourceGrid.tiles.map((tile) => {
    if (replacementTileIds.has(tile.i)) {
      return {
        ...tile,
        content: {
          type: ContentType.SUGGESTION,
          action: contentTypeToSuggestionAction(tile.content.type),
        },
      };
    }
    const next = rewriteArchiveBackedContent(tile, {
      rewriteMap: params.rewriteMap,
    });
    if (next.content.type === ContentType.ROADMAP_FEED) {
      next.content = {
        type: ContentType.ROADMAP_FEED,
        notionDatabaseId: "",
        statusPropertyName: "",
        upvotePropertyName: "",
        statusMapping: {},
      } as RoadmapFeedContent;
    }
    return next;
  });

  const background = rewriteBackgroundImage(sourceGrid, {
    rewriteMap: params.rewriteMap,
    removeBackgroundImage: hasNonCopiableBackground(
      params.grid,
      params.nonCopiableHashes,
    ),
  });

  return {
    userId: params.toUserId,
    tiles: sourceGrid.tiles,
    backgroundImageSrc: background.backgroundImageSrc,
    backgroundImageHash: background.backgroundImageHash,
    rev: typeof params.grid.rev === "number" ? params.grid.rev + 1 : 1,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as never,
  };
}

export async function deleteNotionAndUpvoteSubcollections(
  gridId: string,
  tiles: unknown[],
): Promise<void> {
  const db = admin.firestore();
  const gridRef = db.collection("grids").doc(gridId);
  await deleteCollectionDocs(gridRef.collection("notionTokens"));

  await Promise.all(
    tiles
      .map((tile) => {
        if (!tile || typeof tile !== "object") return undefined;
        const record = tile as { i?: unknown; content?: { type?: unknown } };
        return record.content?.type === ContentType.ROADMAP_FEED
          ? record.i
          : undefined;
      })
      .filter((tileId): tileId is string => typeof tileId === "string")
      .map((tileId) =>
        db.recursiveDelete(gridRef.collection("tiles").doc(tileId).collection("upvotes")),
      ),
  );
}

export async function deleteSenderOrphanedFiles(params: {
  fromUserId: string;
  gridId: string;
  transferredHashes: Set<string>;
}): Promise<void> {
  if (params.transferredHashes.size === 0) return;

  const db = admin.firestore();
  const otherGridSnap = await db
    .collection("grids")
    .where("userId", "==", params.fromUserId)
    .get();
  const retainedHashes = new Set<string>();
  for (const doc of otherGridSnap.docs) {
    if (doc.id === params.gridId) continue;
    for (const ref of extractGridStorageReferencesFromRecord(doc.data())) {
      retainedHashes.add(ref.hash);
    }
  }

  await Promise.all(
    [...params.transferredHashes]
      .filter((hash) => !retainedHashes.has(hash))
      .map(async (hash) => {
        const archiveDoc = await readUploadArchiveDoc(params.fromUserId, hash);
        if (!archiveDoc) return;
        await uploadArchiveRef(params.fromUserId, hash).delete();
        await admin.storage().bucket().file(archiveDoc.path).delete({
          ignoreNotFound: true,
        });
      }),
  );
}

function collectReplacementTileIds(
  grid: Grid,
  nonCopiableHashes: Set<string>,
): Set<string> {
  const references = extractGridStorageReferencesFromRecord(grid);
  return new Set(
    references
      .filter((ref) => ref.tileId && nonCopiableHashes.has(ref.hash))
      .map((ref) => ref.tileId as string),
  );
}

function hasNonCopiableBackground(
  grid: unknown,
  nonCopiableHashes: Set<string>,
): boolean {
  return extractGridStorageReferencesFromRecord(grid).some(
    (ref) =>
      ref.location === "grid.backgroundImage" &&
      nonCopiableHashes.has(ref.hash),
  );
}

function contentTypeToSuggestionAction(
  type: ContentType,
): "text" | "media" | "link" | "embed" | "profile" {
  switch (type) {
    case ContentType.TEXT:
    case ContentType.CHAT:
    case ContentType.CAMPFIRE:
    case ContentType.SMART_TEXT:
      return "text";
    case ContentType.IMAGE:
    case ContentType.VIDEO:
    case ContentType.DOCUMENT:
      return "media";
    case ContentType.LINK:
      return "link";
    case ContentType.EMBED:
    case ContentType.MAP:
    case ContentType.YOUTUBE:
    case ContentType.ROADMAP_FEED:
    case ContentType.MUSIC:
      return "embed";
    case ContentType.PROFILE:
      return "profile";
    default:
      return "text";
  }
}

async function deleteCollectionDocs(
  collectionRef: FirebaseFirestore.CollectionReference,
): Promise<void> {
  const snapshot = await collectionRef.get();
  await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
}
