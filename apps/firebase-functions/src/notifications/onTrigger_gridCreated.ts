import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";
import { shouldSkipDevTeamNotification } from "./utils_devTeamNotification.js";
import {
  buildDiscordEmbedPayload,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
} from "./utils_discord.js";

/**
 * Firebase function that triggers when a new grid is created.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridCreated = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("grids/{gridId}")
  .onCreate(async (snapshot, context) => {
    if (noopIfMaintenance("onGridCreated")) return null;

    const gridData = snapshot.data();
    const gridId = context.params.gridId;

    logger.info("New grid created", {
      gridId,
      userId: gridData.userId,
      name: gridData.name,
    });

    await writeServerAnalyticsEvent({
      eventType: "grid_created",
      userId: gridData.userId ?? null,
      gridId,
      metadata: { gridName: gridData.name || "Untitled" },
    });

    if (
      await shouldSkipDevTeamNotification({
        userId: gridData.userId,
        lookupUserEmail: true,
        logContext: { userId: gridData.userId },
      })
    ) {
      return null;
    }

    const webhookUrl = getDiscordWebhookUrl(
      discordUserActivityWebhookUrl.value(),
      "DISCORD_USER_ACTIVITY_WEBHOOK_URL",
    );
    if (!webhookUrl) {
      return null;
    }

    const discordPayload = buildDiscordEmbedPayload({
      title: "📊 New Grid Created",
      color: 3066993,
      fields: [
        {
          name: "Grid Name",
          value: gridData.name || "Untitled",
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
          value: gridData.userId || "Unknown",
          inline: false,
        },
      ],
      footerText: "Grids Activity",
    });

    await sendDiscordWebhook({
      webhookUrl,
      payload: discordPayload,
      successMessage: "Discord grid creation notification sent successfully",
      successContext: ({ status }) => ({ gridId, status }),
      responseErrorContext: { gridId },
      sendErrorContext: { gridId },
    });

    // Auto-assign this grid as the user's default if they don't have one set yet
    const userId = gridData.userId;
    if (userId) {
      try {
        const db = admin.firestore();
        await db.runTransaction(async (transaction) => {
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists || !userDoc.data()?.defaultGridId) {
            transaction.set(
              userRef,
              { defaultGridId: gridId },
              { merge: true },
            );

            const userSlug = userDoc.exists ? userDoc.data()?.slug : null;
            if (userSlug) {
              const slugRef = db.collection("slugs").doc(userSlug);
              transaction.update(slugRef, { defaultGridId: gridId });
            }

            logger.info("Auto-assigned default grid for user", {
              userId,
              gridId,
            });
          }
        });
      } catch (error) {
        logger.error("Failed to auto-assign default grid", {
          error: String(error),
          userId,
          gridId,
        });
      }
    }

    return null;
  });
