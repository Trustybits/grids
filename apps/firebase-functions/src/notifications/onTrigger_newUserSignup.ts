import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions/v1";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { noopIfMaintenance } from "../maintenance.js";
import { isDevTeamMember } from "./utils_devTeam.js";
import { discordNewUsersWebhookUrl } from "./secrets.js";
import {
  buildDiscordEmbedPayload,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
} from "./utils_discord.js";

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
    if (noopIfMaintenance("onNewUserSignup")) return null;

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
      gridId: null,
      metadata: { signInMethod },
    });

    // Skip dev team members
    if (isDevTeamMember(user.uid, user.email ?? undefined)) {
      logger.info("Skipping Discord notification for dev team member", {
        uid: user.uid,
      });
      return null;
    }

    const webhookUrl = getDiscordWebhookUrl(
      discordNewUsersWebhookUrl.value(),
      "DISCORD_NEW_USERS_WEBHOOK_URL",
    );
    if (!webhookUrl) {
      return null;
    }

    const discordPayload = buildDiscordEmbedPayload({
      title: "🎉 New User Joined Grids",
      color: 5814783,
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
      footerText: "Grids User Signup",
    });

    await sendDiscordWebhook({
      webhookUrl,
      payload: discordPayload,
      successMessage: "Discord notification sent successfully",
      successContext: ({ status, responseText }) => ({
        uid: user.uid,
        email: user.email,
        status,
        responseBody: responseText,
      }),
      responseErrorContext: {
        uid: user.uid,
        webhookUrlLength: webhookUrl.length,
      },
      sendErrorContext: (error) => ({
        uid: user.uid,
        errorStack: error instanceof Error ? error.stack : undefined,
      }),
    });

    return null;
  });
