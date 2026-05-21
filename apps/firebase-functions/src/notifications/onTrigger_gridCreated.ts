import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "../admin.js";
import { noopIfMaintenance } from "../maintenance.js";
import { isDevTeamMember } from "./utils_devTeam.js";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";

/**
 * Firebase function that triggers when a new grid/layout is created.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridCreated = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("layouts/{layoutId}")
  .onCreate(async (snapshot, context) => {
    if (noopIfMaintenance("onGridCreated")) return null;

    const layoutData = snapshot.data();
    const layoutId = context.params.layoutId;

    logger.info("New grid created", {
      layoutId,
      userId: layoutData.userId,
      name: layoutData.name,
    });

    await writeServerAnalyticsEvent({
      eventType: "grid_created",
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
          title: "📊 New Grid Created",
          color: 3066993, // Green color
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
              name: "Grid Link",
              value: `https://grids.so/grid/${layoutId}`,
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
        logger.info("Discord grid creation notification sent successfully", {
          layoutId,
          status: response.status,
        });
      }
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        layoutId,
      });
    }

    // Auto-assign this grid as the user's default if they don't have one set yet
    const userId = layoutData.userId;
    if (userId) {
      try {
        const db = admin.firestore();
        await db.runTransaction(async (transaction) => {
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists || !userDoc.data()?.defaultGridId) {
            transaction.set(
              userRef,
              { defaultGridId: layoutId },
              { merge: true },
            );

            const userSlug = userDoc.exists ? userDoc.data()?.slug : null;
            if (userSlug) {
              const slugRef = db.collection("slugs").doc(userSlug);
              transaction.update(slugRef, { defaultGridId: layoutId });
            }

            logger.info("Auto-assigned default grid for user", {
              userId,
              layoutId,
            });
          }
        });
      } catch (error) {
        logger.error("Failed to auto-assign default grid", {
          error: String(error),
          userId,
          layoutId,
        });
      }
    }

    return null;
  });
