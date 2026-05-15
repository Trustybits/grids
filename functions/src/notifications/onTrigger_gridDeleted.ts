import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import * as admin from "../admin";
import { isDevTeamMember } from "./utils_devTeam";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent";
import { discordUserActivityWebhookUrl } from "./secrets";

/**
 * Firebase function that triggers when a grid/layout is deleted.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridDeleted = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("layouts/{layoutId}")
  .onDelete(async (snapshot, context) => {
    const layoutData = snapshot.data();
    const layoutId = context.params.layoutId;

    logger.info("Grid deleted", {
      layoutId,
      userId: layoutData.userId,
      name: layoutData.name,
    });

    await writeServerAnalyticsEvent({
      eventType: "grid_deleted",
      userId: layoutData.userId ?? null,
      layoutId,
      metadata: { gridName: layoutData.name || "Untitled" },
    });

    // Skip dev team members — look up email from users collection
    let ownerEmail: string | undefined;
    try {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(layoutData.userId)
        .get();
      ownerEmail = userDoc.data()?.email;
    } catch {
      // Non-fatal — proceed without email check
    }
    if (isDevTeamMember(layoutData.userId, ownerEmail)) {
      logger.info("Skipping Discord notification for dev team member", {
        userId: layoutData.userId,
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
              value: layoutData.name || "Untitled",
              inline: true,
            },
            {
              name: "Grid ID",
              value: layoutId,
              inline: true,
            },
            {
              name: "User ID",
              value: layoutData.userId || "Unknown",
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
          layoutId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
        });
      } else {
        logger.info("Discord grid deletion notification sent successfully", {
          layoutId,
          status: response.status,
        });
      }

      return null;
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        layoutId,
      });
      return null;
    }
  });
