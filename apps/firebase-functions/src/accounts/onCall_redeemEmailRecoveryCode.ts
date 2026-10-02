import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData } from "../shared/utils_callable.js";
import {
  RecoveryCodeRejectedError,
  consumeRecoveryCode,
  normalizeRecoveryCode,
  releaseRecoveryCode,
} from "./utils_emailRecovery.js";

const REJECTED_MESSAGE = "That code is invalid or has expired.";

/**
 * Redeem a staff-issued recovery code for a one-time custom sign-in token.
 * Works signed in (the code must belong to the caller) or signed out. Every
 * rejection returns the same generic error.
 */
export const redeemEmailRecoveryCode = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("redeemEmailRecoveryCode")) return null;

    const payload = getCallableData<{ code?: unknown }>(data);
    const code = normalizeRecoveryCode(payload.code);
    if (!code) {
      throw new HttpsError("permission-denied", REJECTED_MESSAGE);
    }

    const callerUid = context.auth?.uid ?? null;
    const db = admin.firestore();

    let uid: string;
    try {
      uid = await consumeRecoveryCode(
        db,
        () => admin.firestore.FieldValue.serverTimestamp(),
        code,
        callerUid,
      );
    } catch (error) {
      if (error instanceof RecoveryCodeRejectedError) {
        logger.warn("Email recovery code rejected", {
          reason: error.reason,
          callerUid,
        });
        throw new HttpsError("permission-denied", REJECTED_MESSAGE);
      }
      throw error;
    }

    try {
      const token = await admin.auth().createCustomToken(uid);
      logger.info("Email recovery code redeemed", {
        uid,
        signedIn: Boolean(callerUid),
      });
      return { token };
    } catch (error) {
      // Don't burn the code if we couldn't hand back a token.
      await releaseRecoveryCode(db, code).catch(() => undefined);
      logger.error("Failed to mint recovery sign-in token", {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new HttpsError(
        "internal",
        "Something went wrong. Please try again in a moment.",
      );
    }
  },
);
