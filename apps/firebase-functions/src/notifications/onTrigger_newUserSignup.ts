import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions/v1";
import { writeServerAnalyticsEvent } from "../analytics/utils_writeServerEvent.js";
import { noopIfMaintenance } from "../maintenance.js";
import { discordNewUsersWebhookUrl, resendApiKey, resendFromEmail } from "./secrets.js";
import { shouldSkipDevTeamNotification } from "./utils_devTeamNotification.js";
import { buildWelcomeEmail } from "./utils_emailTemplates.js";
import {
  buildDiscordEmbedPayload,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
} from "./utils_discord.js";
import {
  getResendApiKey,
  getResendFromEmail,
  sendResendEmail,
} from "./utils_resend.js";

/**
 * Firebase function that triggers when a new user signs up.
 * Sends a formatted notification to Discord via webhook.
 */
export const onNewUserSignup = functions
  .runWith({
    secrets: [discordNewUsersWebhookUrl, resendApiKey, resendFromEmail],
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

    if (user.email) {
      const welcomeApiKey = getResendApiKey(resendApiKey.value(), "RESEND_API_KEY");
      const welcomeFrom = getResendFromEmail(
        resendFromEmail.value(),
        "RESEND_FROM_EMAIL",
      );

      if (welcomeApiKey && welcomeFrom) {
        const { subject, html } = buildWelcomeEmail({
          displayName: user.displayName ?? null,
        });

        await sendResendEmail({
          apiKey: welcomeApiKey,
          payload: {
            from: welcomeFrom,
            to: user.email,
            subject,
            html,
          },
          successMessage: "Welcome email sent successfully",
          successContext: ({ status }) => ({
            uid: user.uid,
            email: user.email,
            status,
          }),
          responseErrorContext: { uid: user.uid },
          sendErrorContext: { uid: user.uid },
        });
      }
    }

    if (
      await shouldSkipDevTeamNotification({
        userId: user.uid,
        email: user.email ?? undefined,
        logContext: { uid: user.uid },
      })
    ) {
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
