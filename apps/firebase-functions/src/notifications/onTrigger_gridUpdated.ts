import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";
import { shouldSkipDevTeamNotification } from "./utils_devTeamNotification.js";
import {
  buildDiscordEmbedPayload,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
} from "./utils_discord.js";

/**
 * Firebase function that triggers when a grid is updated.
 * Only fires when the updatedAt field changes to avoid spurious triggers.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridUpdated = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("grids/{gridId}")
  .onUpdate(async (change, context) => {
    if (noopIfMaintenance("onGridUpdated")) return null;

    const beforeData = change.before.data();
    const afterData = change.after.data();
    const gridId = context.params.gridId;

    // Only trigger when updatedAt actually changed
    const beforeUpdatedAt =
      beforeData.updatedAt?.toMillis?.() ?? beforeData.updatedAt;
    const afterUpdatedAt =
      afterData.updatedAt?.toMillis?.() ?? afterData.updatedAt;
    if (!afterUpdatedAt || beforeUpdatedAt === afterUpdatedAt) {
      return null;
    }

    // Check for meaningful changes (name, tiles, or privacy settings)
    const nameChanged = beforeData.name !== afterData.name;
    const tilesChanged =
      JSON.stringify(beforeData.tiles || []) !==
      JSON.stringify(afterData.tiles || []);
    const privacyChanged = beforeData.isPublic !== afterData.isPublic;

    const hasMeaningfulChanges = nameChanged || tilesChanged || privacyChanged;

    if (!hasMeaningfulChanges) {
      logger.info(
        "Grid updated but no meaningful changes detected, skipping notification",
        {
          gridId,
          userId: afterData.userId,
        },
      );
      return null;
    }

    logger.info("Grid updated with meaningful changes", {
      gridId,
      userId: afterData.userId,
      name: afterData.name,
      nameChanged,
      tilesChanged,
      privacyChanged,
    });

    if (
      await shouldSkipDevTeamNotification({
        userId: afterData.userId,
        lookupUserEmail: true,
        logContext: { userId: afterData.userId },
      })
    ) {
      return null;
    }

    // 10-minute debounce: Check if we've notified this user recently
    const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes
    const db = admin.firestore();
    const notificationTrackingRef = db
      .collection("notification_tracking")
      .doc(`grid_update_${afterData.userId}`);

    try {
      const trackingDoc = await notificationTrackingRef.get();
      const lastNotifiedAt = trackingDoc.data()?.lastNotifiedAt?.toMillis?.();

      if (lastNotifiedAt && Date.now() - lastNotifiedAt < DEBOUNCE_MS) {
        logger.info("Skipping notification due to 10-minute debounce", {
          userId: afterData.userId,
          gridId,
          lastNotifiedAt: new Date(lastNotifiedAt).toISOString(),
        });
        return null;
      }
    } catch (error) {
      logger.warn(
        "Failed to check notification tracking, proceeding with notification",
        {
          error: String(error),
        },
      );
    }

    const webhookUrl = getDiscordWebhookUrl(
      discordUserActivityWebhookUrl.value(),
      "DISCORD_USER_ACTIVITY_WEBHOOK_URL",
    );
    if (!webhookUrl) {
      return null;
    }

    const discordPayload = buildDiscordEmbedPayload({
      title: "✏️ Grid Updated",
      color: 16776960,
      fields: [
        {
          name: "Grid Name",
          value: afterData.name || "Untitled",
          inline: true,
        },
        {
          name: "Grid ID",
          value: gridId,
          inline: true,
        },
        {
          name: "Grid Link",
          value: `https://grids.so/grid/${gridId}`,
          inline: true,
        },
        {
          name: "User ID",
          value: afterData.userId || "Unknown",
          inline: false,
        },
      ],
      footerText: "Grids Activity",
    });

    const sent = await sendDiscordWebhook({
      webhookUrl,
      payload: discordPayload,
      successMessage: "Discord grid update notification sent successfully",
      successContext: ({ status }) => ({ gridId, status }),
      responseErrorContext: { gridId },
      sendErrorContext: { gridId },
    });

    if (sent) {
      // Update notification tracking timestamp for debounce
      try {
        await notificationTrackingRef.set({
          lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          userId: afterData.userId,
          gridId,
        });
      } catch (error) {
        logger.warn("Failed to update notification tracking", {
          error: String(error),
        });
      }
    }

    return null;
  });
