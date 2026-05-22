import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import admin from "firebase-admin";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { noopIfMaintenance } from "../maintenance.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";
import { shouldSkipDevTeamNotification } from "./utils_devTeamNotification.js";
import {
  buildDiscordEmbedPayload,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
} from "./utils_discord.js";

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
    if (noopIfMaintenance("onUserLogin")) return null;

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
      gridId: null,
      metadata: { signInMethod },
    });

    if (
      await shouldSkipDevTeamNotification({
        userId,
        email: afterData.email,
        logContext: { userId },
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
      title: "🔐 User Logged In",
      color: 3447003,
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
      footerText: "Grids User Activity",
    });

    await sendDiscordWebhook({
      webhookUrl,
      payload: discordPayload,
      successMessage: "Discord login notification sent successfully",
      successContext: ({ status }) => ({ userId, status }),
      responseErrorContext: { userId },
      sendErrorContext: { userId },
    });

    return null;
  });
