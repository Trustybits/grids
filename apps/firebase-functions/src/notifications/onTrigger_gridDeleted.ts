import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { isDevTeamMember } from "./utils_devTeam.js";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";

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

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordUserActivityWebhookUrl.value();

    if (!webhookUrl) {
      logger.error(
        "DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured",
      );
      return null;
    }

    // Build Discord embed payload
    const discordPayload = {
      embeds: [
        {
          title: "🗑️ Grid Deleted",
          color: 15158332, // Red color
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
          timestamp: new Date().toISOString(),
          footer: {
            text: "Grids Activity",
          },
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        logger.error("Discord webhook returned error status", {
          gridId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
        });
      } else {
        logger.info("Discord grid deletion notification sent successfully", {
          gridId,
          status: response.status,
        });
      }

      return null;
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        gridId,
      });
      return null;
    }
  });
