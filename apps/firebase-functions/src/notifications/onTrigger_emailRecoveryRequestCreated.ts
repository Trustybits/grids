import * as functions from "firebase-functions/v1";
import { noopIfMaintenance } from "../maintenance.js";
import {
  EMAIL_RECOVERY_REQUESTS_COLLECTION,
  type EmailRecoveryRequestDoc,
} from "../accounts/utils_emailRecovery.js";
import { discordUserActivityWebhookUrl } from "./secrets.js";
import {
  buildDiscordEmbedPayload,
  getDiscordWebhookUrl,
  sendDiscordWebhook,
  type DiscordEmbedField,
} from "./utils_discord.js";

// Discord rejects embed field values longer than 1024 characters.
const DISCORD_FIELD_LIMIT = 1024;

function fieldValue(value: string | null | undefined, fallback: string): string {
  const text = value?.trim() || fallback;
  return text.length > DISCORD_FIELD_LIMIT
    ? `${text.slice(0, DISCORD_FIELD_LIMIT - 1)}…`
    : text;
}

export function buildEmailRecoveryRequestFields(
  requestId: string,
  request: Partial<EmailRecoveryRequestDoc>,
): DiscordEmbedField[] {
  return [
    {
      name: "Account email (lost)",
      value: fieldValue(request.lostEmail, "Not provided"),
      inline: true,
    },
    {
      name: "Wants to switch to",
      value: fieldValue(request.requestedEmail, "Not provided"),
      inline: true,
    },
    {
      name: "Contact",
      value: fieldValue(request.contact, "Not provided"),
      inline: true,
    },
    {
      name: "User ID",
      value: fieldValue(request.uid, "⚠️ No account found for that email"),
      inline: true,
    },
    {
      name: "Filed while signed in",
      value: request.signedIn ? "Yes" : "No",
      inline: true,
    },
    {
      name: "Details",
      value: fieldValue(request.details, "None"),
      inline: false,
    },
    {
      name: "Next step",
      value: fieldValue(
        `Verify identity, then: npm run recovery:issue -- issue ${request.uid ?? "<uid>"} --request ${requestId}`,
        "",
      ),
      inline: false,
    },
  ];
}

/**
 * Ping the team on Discord when someone asks for lost-inbox recovery, so the
 * request can be reviewed. Not filtered for dev-team accounts: unlike activity
 * notifications, these are action items.
 */
export const onEmailRecoveryRequestCreated = functions
  .runWith({
    secrets: [discordUserActivityWebhookUrl],
  })
  .firestore.document(`${EMAIL_RECOVERY_REQUESTS_COLLECTION}/{requestId}`)
  .onCreate(async (snapshot, context) => {
    if (noopIfMaintenance("onEmailRecoveryRequestCreated")) return null;

    const requestId = context.params.requestId as string;
    const request = snapshot.data() as Partial<EmailRecoveryRequestDoc>;

    const webhookUrl = getDiscordWebhookUrl(
      discordUserActivityWebhookUrl.value(),
      "DISCORD_USER_ACTIVITY_WEBHOOK_URL",
    );
    if (!webhookUrl) {
      return null;
    }

    await sendDiscordWebhook({
      webhookUrl,
      payload: buildDiscordEmbedPayload({
        title: "🔑 Email Recovery Request",
        color: 16753920,
        fields: buildEmailRecoveryRequestFields(requestId, request),
        footerText: `Grids Account Recovery · ${requestId}`,
      }),
      successMessage: "Email recovery Discord notification sent",
      successContext: { requestId, uid: request.uid },
      responseErrorContext: { requestId },
      sendErrorContext: (error) => ({
        requestId,
        errorStack: error instanceof Error ? error.stack : undefined,
      }),
    });

    return null;
  });
