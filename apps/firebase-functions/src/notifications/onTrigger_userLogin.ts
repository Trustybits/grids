import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { isDevTeamMember } from "./utils_devTeam.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";

/**
 * Firebase function that triggers when a user logs in.
 * Detects login by monitoring updates to the lastLogin field in Firestore users collection.
 */
export const onUserLogin = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document("users/{userId}")
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const userId = context.params.userId;

    // Only trigger if lastLogin field was updated. Compare by millis — the raw
    // Timestamp objects are deserialized fresh on each snapshot, so `===` is
    // always false and would fire this trigger on every users/{userId} write.
    const beforeLoginMs = beforeData.lastLogin?.toMillis?.() ?? null;
    const afterLoginMs = afterData.lastLogin?.toMillis?.() ?? null;
    if (!afterLoginMs || beforeLoginMs === afterLoginMs) {
      return null;
    }

    logger.info("User login event detected", {
      userId,
      email: afterData.email,
    });

    let signInMethod = "unknown";
    try {
      const authUser = await admin.auth().getUser(userId);
      const providerId = authUser.providerData[0]?.providerId;
      if (providerId === "google.com") signInMethod = "Google";
      else if (providerId === "password") signInMethod = "Email/Password";
      else if (providerId) signInMethod = "Email Link";
    } catch (error) {
      logger.warn("Failed to look up auth provider for login event", {
        userId,
        error: String(error),
      });
    }

    await writeServerAnalyticsEvent({
      eventType: "user_login",
      userId,
      layoutId: null,
      metadata: { signInMethod },
    });

    // Skip dev team members
    if (isDevTeamMember(userId, afterData.email)) {
      logger.info("Skipping Discord notification for dev team member", {
        userId,
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
          title: "🔐 User Logged In",
          color: 3447003, // Blue color
          fields: [
            {
              name: "Email",
              value: afterData.email || "Not available",
              inline: true,
            },
            {
              name: "User ID",
              value: userId,
              inline: true,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Grids User Activity",
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
          userId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
        });
      } else {
        logger.info("Discord login notification sent successfully", {
          userId,
          status: response.status,
        });
      }

      return null;
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        userId,
      });
      return null;
    }
  });
