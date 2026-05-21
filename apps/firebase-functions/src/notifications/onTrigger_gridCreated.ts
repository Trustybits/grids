import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { isDevTeamMember } from "./utils_devTeam.js";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";

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
          title: "📊 New Grid Created",
          color: 3066993, // Green color
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
        logger.info("Discord grid creation notification sent successfully", {
          gridId,
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        gridId,
      });
    }

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
