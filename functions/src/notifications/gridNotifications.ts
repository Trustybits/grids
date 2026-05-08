/* eslint-disable */

import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import * as admin from "../firebase/admin";
import { isDevTeamMember } from "../shared/devTeam";
import { discordUserActivityWebhookUrl } from "./secrets";

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
    const layoutData = snapshot.data();
    const layoutId = context.params.layoutId;

    logger.info("New grid created", {
      layoutId,
      userId: layoutData.userId,
      name: layoutData.name,
    });

    // Skip dev team members — look up email from users collection
    let ownerEmail: string | undefined;
    try {
      const userDoc = await admin.firestore().collection("users").doc(layoutData.userId).get();
      ownerEmail = userDoc.data()?.email;
    } catch {
      // Non-fatal — proceed without email check
    }
    if (isDevTeamMember(layoutData.userId, ownerEmail)) {
      logger.info("Skipping Discord notification for dev team member", { userId: layoutData.userId });
      return null;
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordUserActivityWebhookUrl.value();
    
    if (!webhookUrl) {
      logger.error("DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured");
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
            transaction.set(userRef, { defaultGridId: layoutId }, { merge: true });

            const userSlug = userDoc.exists ? userDoc.data()?.slug : null;
            if (userSlug) {
              const slugRef = db.collection("slugs").doc(userSlug);
              transaction.update(slugRef, { defaultGridId: layoutId });
            }

            logger.info("Auto-assigned default grid for user", { userId, layoutId });
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

/**
 * Firebase function that triggers when a grid/layout is updated.
 * Only fires when the updatedAt field changes to avoid spurious triggers.
 * Sends a notification to the user-activity Discord channel.
 */
export const onGridUpdated = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("layouts/{layoutId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const layoutId = context.params.layoutId;

    // Only trigger when updatedAt actually changed
    const beforeUpdatedAt = beforeData.updatedAt?.toMillis?.() ?? beforeData.updatedAt;
    const afterUpdatedAt = afterData.updatedAt?.toMillis?.() ?? afterData.updatedAt;
    if (!afterUpdatedAt || beforeUpdatedAt === afterUpdatedAt) {
      return null;
    }

    // Check for meaningful changes (name, tiles, or privacy settings)
    const nameChanged = beforeData.name !== afterData.name;
    const tilesChanged = JSON.stringify(beforeData.tiles || []) !== JSON.stringify(afterData.tiles || []);
    const privacyChanged = beforeData.isPublic !== afterData.isPublic;
    
    const hasMeaningfulChanges = nameChanged || tilesChanged || privacyChanged;
    
    if (!hasMeaningfulChanges) {
      logger.info("Grid updated but no meaningful changes detected, skipping notification", {
        layoutId,
        userId: afterData.userId,
      });
      return null;
    }

    logger.info("Grid updated with meaningful changes", {
      layoutId,
      userId: afterData.userId,
      name: afterData.name,
      nameChanged,
      tilesChanged,
      privacyChanged,
    });

    // Skip dev team members — look up email from users collection
    let ownerEmail: string | undefined;
    try {
      const userDoc = await admin.firestore().collection("users").doc(afterData.userId).get();
      ownerEmail = userDoc.data()?.email;
    } catch {
      // Non-fatal — proceed without email check
    }
    if (isDevTeamMember(afterData.userId, ownerEmail)) {
      logger.info("Skipping Discord notification for dev team member", { userId: afterData.userId });
      return null;
    }

    // 10-minute debounce: Check if we've notified this user recently
    const DEBOUNCE_MS = 10 * 60 * 1000; // 10 minutes
    const db = admin.firestore();
    const notificationTrackingRef = db.collection("notification_tracking").doc(`grid_update_${afterData.userId}`);
    
    try {
      const trackingDoc = await notificationTrackingRef.get();
      const lastNotifiedAt = trackingDoc.data()?.lastNotifiedAt?.toMillis?.();
      
      if (lastNotifiedAt && (Date.now() - lastNotifiedAt < DEBOUNCE_MS)) {
        logger.info("Skipping notification due to 10-minute debounce", {
          userId: afterData.userId,
          layoutId,
          lastNotifiedAt: new Date(lastNotifiedAt).toISOString(),
        });
        return null;
      }
    } catch (error) {
      logger.warn("Failed to check notification tracking, proceeding with notification", {
        error: String(error),
      });
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordUserActivityWebhookUrl.value();

    if (!webhookUrl) {
      logger.error("DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured");
      return null;
    }

    // Build Discord embed payload
    const discordPayload = {
      embeds: [
        {
          title: "✏️ Grid Updated",
          color: 16776960, // Yellow color
          fields: [
            {
              name: "Grid Name",
              value: afterData.name || "Untitled",
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
              value: afterData.userId || "Unknown",
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
        logger.info("Discord grid update notification sent successfully", {
          layoutId,
          status: response.status,
        });
        
        // Update notification tracking timestamp for debounce
        try {
          await notificationTrackingRef.set({
            lastNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
            userId: afterData.userId,
            layoutId,
          });
        } catch (error) {
          logger.warn("Failed to update notification tracking", {
            error: String(error),
          });
        }
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

    // Skip dev team members — look up email from users collection
    let ownerEmail: string | undefined;
    try {
      const userDoc = await admin.firestore().collection("users").doc(layoutData.userId).get();
      ownerEmail = userDoc.data()?.email;
    } catch {
      // Non-fatal — proceed without email check
    }
    if (isDevTeamMember(layoutData.userId, ownerEmail)) {
      logger.info("Skipping Discord notification for dev team member", { userId: layoutData.userId });
      return null;
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordUserActivityWebhookUrl.value();

    if (!webhookUrl) {
      logger.error("DISCORD_USER_ACTIVITY_WEBHOOK_URL secret is not configured");
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
