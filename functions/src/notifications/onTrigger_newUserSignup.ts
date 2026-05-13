import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions/v1";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent";
import { isDevTeamMember } from "./utils_devTeam";
import { discordNewUsersWebhookUrl } from "./secrets";

/**
 * Firebase function that triggers when a new user signs up.
 * Sends a formatted notification to Discord via webhook.
 */
export const onNewUserSignup = functions
  .runWith({
    secrets: [discordNewUsersWebhookUrl],
  })
  .auth.user()
  .onCreate(async (user) => {
    logger.info("New user signup detected", {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
    });

    const providerInfo = user.providerData[0];
    const signInMethod =
      providerInfo?.providerId === "google.com"
        ? "Google"
        : providerInfo?.providerId === "password"
          ? "Email/Password"
          : "Email Link";

    await writeServerAnalyticsEvent({
      eventType: "user_signup",
      userId: user.uid,
      layoutId: null,
      metadata: { signInMethod },
    });

    // Skip dev team members
    if (isDevTeamMember(user.uid, user.email ?? undefined)) {
      logger.info("Skipping Discord notification for dev team member", {
        uid: user.uid,
      });
      return null;
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordNewUsersWebhookUrl.value();

    if (!webhookUrl) {
      logger.error("DISCORD_NEW_USERS_WEBHOOK_URL secret is not configured");
      return null;
    }

    // Build Discord embed payload
    const discordPayload = {
      embeds: [
        {
          title: "🎉 New User Joined Grids",
          color: 5814783, // Purple/blue color
          fields: [
            {
              name: "Display Name",
              value: user.displayName || "Not set",
              inline: true,
            },
            {
              name: "Email",
              value: user.email || "Not available",
              inline: true,
            },
            {
              name: "Sign-in Method",
              value: signInMethod,
              inline: true,
            },
            {
              name: "User ID",
              value: user.uid,
              inline: false,
            },
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: "Grids User Signup",
          },
        },
      ],
    };

    try {
      // Send webhook to Discord
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(discordPayload),
      });

      // Read response body for debugging
      const responseText = await response.text();

      if (!response.ok) {
        logger.error("Discord webhook returned error status", {
          uid: user.uid,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText,
          webhookUrlLength: webhookUrl.length, // Verify URL was loaded
        });
      } else {
        logger.info("Discord notification sent successfully", {
          uid: user.uid,
          email: user.email,
          status: response.status,
          responseBody: responseText,
        });
      }

      return null;
    } catch (error) {
      logger.error("Failed to send Discord webhook", {
        error: String(error),
        uid: user.uid,
        errorStack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  });
