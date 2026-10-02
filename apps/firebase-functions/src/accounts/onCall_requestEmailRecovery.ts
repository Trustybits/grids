import { HttpsError } from "firebase-functions/v1/https";
import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { getCallableData } from "../shared/utils_callable.js";
import {
  EMAIL_RECOVERY_REQUESTS_COLLECTION,
  MAX_CONTACT_LENGTH,
  MAX_DETAILS_LENGTH,
  hasRecentPendingRequest,
  normalizeEmail,
  normalizeText,
  recoveryDedupeKey,
  type EmailRecoveryRequestDoc,
} from "./utils_emailRecovery.js";

async function resolveUidByEmail(email: string): Promise<string | null> {
  try {
    return (await admin.auth().getUserByEmail(email)).uid;
  } catch {
    return null;
  }
}

/**
 * File a "lost access to my email" request for staff review. Works signed in
 * or signed out. The response is the same whether or not an account exists,
 * so this can't be used to probe for registered emails.
 */
export const requestEmailRecovery = functions.https.onCall(
  async (data, context) => {
    if (noopIfMaintenance("requestEmailRecovery")) return null;

    const payload = getCallableData<{
      lostEmail?: unknown;
      requestedEmail?: unknown;
      contact?: unknown;
      details?: unknown;
    }>(data);

    const requestedEmail = normalizeEmail(payload.requestedEmail);
    if (!requestedEmail) {
      throw new HttpsError("invalid-argument", "Enter a valid new email address.");
    }
    const contact = normalizeText(payload.contact, MAX_CONTACT_LENGTH);
    if (!contact) {
      throw new HttpsError(
        "invalid-argument",
        "Tell us how to reach you (for example your Discord username).",
      );
    }
    const details = normalizeText(payload.details, MAX_DETAILS_LENGTH);

    const callerUid = context.auth?.uid ?? null;
    let uid: string | null;
    let lostEmail: string | null;
    if (callerUid) {
      // Signed in: the account is known; trust the auth record over input.
      uid = callerUid;
      const authUser = await admin.auth().getUser(callerUid);
      lostEmail = normalizeEmail(authUser.email) ?? normalizeEmail(payload.lostEmail) ?? "";
    } else {
      lostEmail = normalizeEmail(payload.lostEmail);
      if (!lostEmail) {
        throw new HttpsError(
          "invalid-argument",
          "Enter the email address on your Grids account.",
        );
      }
      uid = await resolveUidByEmail(lostEmail);
    }

    const db = admin.firestore();
    const dedupeKey = recoveryDedupeKey(uid, lostEmail);
    if (await hasRecentPendingRequest(db, dedupeKey)) {
      logger.info("Skipping duplicate email recovery request", {
        uid,
        signedIn: Boolean(callerUid),
      });
      return { ok: true };
    }

    const request: EmailRecoveryRequestDoc = {
      uid,
      lostEmail,
      requestedEmail,
      contact,
      details,
      signedIn: Boolean(callerUid),
      status: "pending",
      dedupeKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await db.collection(EMAIL_RECOVERY_REQUESTS_COLLECTION).add(request);

    logger.info("Email recovery request filed", {
      requestId: ref.id,
      uid,
      accountFound: Boolean(uid),
      signedIn: Boolean(callerUid),
    });
    return { ok: true };
  },
);
