/**
 * Cloud Function: grant the Supporter badge based on Stripe payments.
 *
 * Triggered when the firestore-stripe-payments Extension writes a payment
 * document to `customers/{uid}/payments/{paymentId}` (extension-managed,
 * unauthenticated by clients).
 *
 * Behavior:
 *   1. Sum all succeeded payments for the user
 *   2. If total >= SUPPORTER_BADGE_MIN_CENTS and they don't already have
 *      the badge, write `userBadges/{uid}.supporter = { earnedAt }`
 *   3. Otherwise no-op (idempotent — re-running won't re-bump earnedAt)
 *
 * Refunds: not handled in v1. If a refund pulls the user below the
 * threshold, the badge stays. Add a separate revocation pass when needed.
 */

import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";
import { SUPPORTER_BADGE_MIN_CENTS } from "./constants.js";

const SUCCEEDED_STATUS = "succeeded";

export const grantSupporterBadgeOnPayment = functions
  .firestore
  .document("customers/{uid}/payments/{paymentId}")
  .onWrite(async (change, context) => {
    const uid = context.params.uid as string;
    const after = change.after.exists ? change.after.data() : null;

    // Ignore deletes and writes that aren't succeeded payments.
    if (!after || after.status !== SUCCEEDED_STATUS) {
      return null;
    }

    const db = admin.firestore();
    const badgeRef = db.collection("userBadges").doc(uid);
    const badgeSnap = await badgeRef.get();
    const existing = badgeSnap.exists ? badgeSnap.data() : null;

    // Idempotent: already granted, nothing to do. earnedAt stays the
    // first-qualifying timestamp regardless of subsequent payments.
    if (existing && existing.supporter) {
      return null;
    }

    // Re-aggregate succeeded payments to decide eligibility. We can't trust
    // the single triggering payment alone because totals may include older
    // contributions and partial captures.
    const paymentsSnap = await db
      .collection(`customers/${uid}/payments`)
      .where("status", "==", SUCCEEDED_STATUS)
      .get();

    const totalCents = paymentsSnap.docs.reduce((sum, doc) => {
      const amount = doc.data().amount;
      return sum + (typeof amount === "number" ? amount : 0);
    }, 0);

    if (totalCents < SUPPORTER_BADGE_MIN_CENTS) {
      logger.info("Payment processed but threshold not met", {
        uid,
        totalCents,
        threshold: SUPPORTER_BADGE_MIN_CENTS,
      });
      return null;
    }

    await badgeRef.set(
      {
        supporter: {
          earnedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    logger.info("Granted supporter badge", { uid, totalCents });
    return null;
  });
