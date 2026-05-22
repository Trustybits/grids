import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { isDevTeamMember } from "./utils_devTeam.js";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";
import {
  buildDiscordEmbedPayload,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
} from "./utils_discord.js";

/**
 * Firebase function that triggers when a grid is deleted.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridDeleted = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("grids/{gridId}")
  .onDelete(async (snapshot, context) => {
    if (noopIfMaintenance("onGridDeleted")) return null;

    const gridData = snapshot.data();
    const gridId = context.params.gridId;

    logger.info("Grid deleted", {
      gridId,
      userId: gridData.userId,
      name: gridData.name,
    });

    await writeServerAnalyticsEvent({
      eventType: "grid_deleted",
      userId: gridData.userId ?? null,
      gridId,
      metadata: { gridName: gridData.name || "Untitled" },
    });

    // Skip dev team members — look up email from users collection
    let ownerEmail: string | undefined;
    try {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(gridData.userId)
        .get();
      ownerEmail = userDoc.data()?.email;
    } catch {
      // Non-fatal — proceed without email check
    }
    if (isDevTeamMember(gridData.userId, ownerEmail)) {
      logger.info("Skipping Discord notification for dev team member", {
        userId: gridData.userId,
      });
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
      title: "🗑️ Grid Deleted",
      color: 15158332,
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
      successMessage: "Discord grid deletion notification sent successfully",
      successContext: ({ status }) => ({ gridId, status }),
      responseErrorContext: { gridId },
      sendErrorContext: { gridId },
    });

    return null;
  });
