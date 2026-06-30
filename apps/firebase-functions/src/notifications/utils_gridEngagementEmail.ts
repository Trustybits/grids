import * as logger from "firebase-functions/logger";
import type { Firestore } from "firebase-admin/firestore";
import admin from "../admin.js";
import { buildFirstGridEmail } from "./utils_emailTemplates.js";
import { getUserEmailInfo } from "./utils_userEmail.js";
import { sendResendEmail } from "./utils_resend.js";

export const GRID_ENGAGEMENT_EMAILS_COLLECTION = "grid_engagement_emails";

const DEFAULT_GRID_ENGAGEMENT_EMAIL_DELAY_MS = 2 * 24 * 60 * 60 * 1000;

export function getGridEngagementEmailDelayMs(): number {
  const fromEnv = process.env.GRID_ENGAGEMENT_EMAIL_DELAY_MS;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return DEFAULT_GRID_ENGAGEMENT_EMAIL_DELAY_MS;
}

type ProcessGridEngagementEmailsOptions = {
  db?: Firestore;
  apiKey: string;
  from: string;
};

export async function processPendingGridEngagementEmails({
  db = admin.firestore(),
  apiKey,
  from,
}: ProcessGridEngagementEmailsOptions): Promise<{
  processed: number;
  sent: number;
}> {
  const delayMs = getGridEngagementEmailDelayMs();
  const cutoffMs = Date.now() - delayMs;

  const pendingSnap = await db
    .collection(GRID_ENGAGEMENT_EMAILS_COLLECTION)
    .where("status", "==", "pending")
    .get();

  let sent = 0;

  for (const doc of pendingSnap.docs) {
    const data = doc.data();
    const userId = doc.id;
    const firstEditAtMs = data.firstEditAt?.toMillis?.();

    if (!firstEditAtMs || firstEditAtMs > cutoffMs) {
      continue;
    }

    const gridId = typeof data.gridId === "string" ? data.gridId : null;
    if (!gridId) {
      logger.warn("Skipping grid engagement email with missing gridId", {
        userId,
      });
      continue;
    }

    const userInfo = await getUserEmailInfo(userId);
    if (!userInfo) {
      continue;
    }

    let slug: string | null = null;
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      slug = userDoc.exists
        ? (userDoc.data()?.slug as string | undefined) ?? null
        : null;
    } catch (error) {
      logger.warn("Failed to load user slug for grid engagement email", {
        userId,
        error: String(error),
      });
    }

    const gridName =
      typeof data.gridName === "string" && data.gridName.length > 0
        ? data.gridName
        : "Untitled";

    const { subject, html } = buildFirstGridEmail({
      displayName: userInfo.displayName,
      gridName,
      gridId,
      slug,
    });

    const emailSent = await sendResendEmail({
      apiKey,
      payload: {
        from,
        to: userInfo.email,
        subject,
        html,
      },
      successMessage: "Grid engagement email sent successfully",
      successContext: ({ status }) => ({ userId, gridId, status }),
      responseErrorContext: { userId, gridId },
      sendErrorContext: { userId, gridId },
    });

    if (!emailSent) {
      continue;
    }

    sent += 1;

    try {
      await doc.ref.set(
        {
          status: "sent",
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      logger.warn("Failed to mark grid engagement email as sent", {
        userId,
        gridId,
        error: String(error),
      });
    }
  }

  return { processed: pendingSnap.size, sent };
}
