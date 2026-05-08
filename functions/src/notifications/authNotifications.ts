import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import { isDevTeamMember } from "../shared/devTeam";
import { discordNewUsersWebhookUrl, discordUserActivityWebhookUrl } from "./secrets";

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

    // Skip dev team members
    if (isDevTeamMember(user.uid, user.email ?? undefined)) {
      logger.info("Skipping Discord notification for dev team member", { uid: user.uid });
      return null;
    }

    // Get the Discord webhook URL from secrets
    const webhookUrl = discordNewUsersWebhookUrl.value();
    
    if (!webhookUrl) {
      logger.error("DISCORD_NEW_USERS_WEBHOOK_URL secret is not configured");
      return null;
    }

    // Determine sign-in method
    const providerInfo = user.providerData[0];
    const signInMethod = providerInfo?.providerId === "google.com" 
      ? "Google" 
      : providerInfo?.providerId === "password"
      ? "Email/Password"
      : "Email Link";

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

    // Only trigger if lastLogin field was updated
    if (!afterData.lastLogin || beforeData.lastLogin === afterData.lastLogin) {
      return null;
    }

    logger.info("User login event detected", {
      userId,
      email: afterData.email,
    });

    // Skip dev team members
    if (isDevTeamMember(userId, afterData.email)) {
      logger.info("Skipping Discord notification for dev team member", { userId });
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
