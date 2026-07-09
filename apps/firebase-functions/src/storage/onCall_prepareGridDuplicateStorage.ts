import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData, requireAuth } from "../shared/utils_callable.js";
import {
  copyArchiveObjects,
  prepareArchiveObjectCopyPlan,
} from "./utils_copyArchiveObjects.js";
import { extractGridStorageReferencesFromRecord } from "@grids/contracts/storage";

type GridDuplicateStorageRequest = {
  sourceGridId?: unknown;
  copyDepth?: unknown;
  confirmed?: unknown;
};

export const prepareGridDuplicateStorage = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("prepareGridDuplicateStorage")) return null;

    const targetUid = requireAuth(context, "Sign in required.");
    const payload = getCallableData<GridDuplicateStorageRequest>(data);
    if (typeof payload.sourceGridId !== "string" || !payload.sourceGridId) {
      throw new HttpsError("invalid-argument", "sourceGridId is required.");
    }
    if (payload.copyDepth !== "full" && payload.copyDepth !== "structure") {
      throw new HttpsError("invalid-argument", "copyDepth is required.");
    }

    if (payload.copyDepth === "structure") {
      return {
        additionalBytesRequired: 0,
        copiableCount: 0,
        nonCopiableCount: 0,
        replacementTileIds: [],
        removeBackgroundImage: false,
      };
    }

    const db = admin.firestore();
    const sourceSnap = await db.collection("grids").doc(payload.sourceGridId).get();
    if (!sourceSnap.exists) {
      throw new HttpsError("not-found", "Source grid not found.");
    }
    const sourceGrid = sourceSnap.data();
    const sourceUid = typeof sourceGrid?.userId === "string"
      ? sourceGrid.userId
      : null;
    if (!sourceUid) {
      throw new HttpsError("failed-precondition", "Source grid has no owner.");
    }

    const references = extractGridStorageReferencesFromRecord(sourceGrid);
    const copyPlan = await prepareArchiveObjectCopyPlan({
      sourceUid,
      targetUid,
      references,
      requireShareable: true,
    });

    const replacementTileIds = [
      ...new Set(
        references
          .filter((ref) => copyPlan.nonCopiableHashes.has(ref.hash) && ref.tileId)
          .map((ref) => ref.tileId as string),
      ),
    ];
    const removeBackgroundImage = references.some(
      (ref) =>
        ref.location === "grid.backgroundImage" &&
        copyPlan.nonCopiableHashes.has(ref.hash),
    );

    if (payload.confirmed !== true) {
      return {
        additionalBytesRequired: copyPlan.additionalBytesRequired,
        copiableCount: copyPlan.copiable.size,
        nonCopiableCount: replacementTileIds.length,
        replacementTileIds,
        removeBackgroundImage,
      };
    }

    const rewriteMap = await copyArchiveObjects({
      targetUid,
      plan: copyPlan,
    });

    return {
      additionalBytesRequired: copyPlan.additionalBytesRequired,
      copiableCount: copyPlan.copiable.size,
      nonCopiableCount: replacementTileIds.length,
      rewriteMap,
      replacementTileIds,
      removeBackgroundImage,
    };
  },
);
