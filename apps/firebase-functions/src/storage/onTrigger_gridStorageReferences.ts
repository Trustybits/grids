import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../maintenance.js";
import { adjustUploadRefCounts } from "./utils_uploadArchive.js";
import {
  countReferencesByHash,
  extractGridStorageReferencesFromRecord,
} from "@grids/contracts/storage";

type GridSnapshotLike = {
  data: () => Record<string, unknown> | undefined;
};

export const onGridStorageReferencesCreated = functions.firestore
  .document("grids/{gridId}")
  .onCreate(async (snapshot, context) => {
    if (noopIfMaintenance("onGridStorageReferencesCreated")) return null;

    await reconcileGridReferenceDeltas(undefined, snapshot, context.params.gridId);
    return null;
  });

export const onGridStorageReferencesUpdated = functions.firestore
  .document("grids/{gridId}")
  .onUpdate(async (change, context) => {
    if (noopIfMaintenance("onGridStorageReferencesUpdated")) return null;

    await reconcileGridReferenceDeltas(
      change.before,
      change.after,
      context.params.gridId,
    );
    return null;
  });

export const onGridStorageReferencesDeleted = functions.firestore
  .document("grids/{gridId}")
  .onDelete(async (snapshot, context) => {
    if (noopIfMaintenance("onGridStorageReferencesDeleted")) return null;

    await reconcileGridReferenceDeltas(snapshot, undefined, context.params.gridId);
    return null;
  });

async function reconcileGridReferenceDeltas(
  beforeSnapshot: GridSnapshotLike | undefined,
  afterSnapshot: GridSnapshotLike | undefined,
  gridId: string,
): Promise<void> {
  const before = beforeSnapshot?.data();
  const after = afterSnapshot?.data();
  const beforeUid = getOwner(before);
  const afterUid = getOwner(after);
  const stableUid = afterUid ?? beforeUid;
  if (!stableUid) {
    logger.warn("Skipping grid storage reference reconciliation without owner", {
      gridId,
    });
    return;
  }

  const beforeCounts = countReferencesByHash(
    extractGridStorageReferencesFromRecord(before),
  );
  const afterCounts = countReferencesByHash(
    extractGridStorageReferencesFromRecord(after),
  );

  if (beforeUid && afterUid && beforeUid !== afterUid) {
    await adjustUploadRefCounts(beforeUid, negativeDeltas(beforeCounts));
    await adjustUploadRefCounts(afterUid, afterCounts);
    return;
  }

  const deltas = new Map<string, number>();

  for (const [hash, count] of afterCounts) {
    deltas.set(hash, count - (beforeCounts.get(hash) ?? 0));
  }
  for (const [hash, count] of beforeCounts) {
    if (!afterCounts.has(hash)) {
      deltas.set(hash, -count);
    }
  }

  await adjustUploadRefCounts(stableUid, deltas);
}

function getOwner(record: Record<string, unknown> | undefined): string | null {
  return typeof record?.userId === "string" ? record.userId : null;
}

function negativeDeltas(counts: Map<string, number>): Map<string, number> {
  return new Map([...counts].map(([hash, count]) => [hash, -count]));
}
