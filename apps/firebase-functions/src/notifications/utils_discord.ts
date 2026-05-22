import * as logger from "firebase-functions/logger";

type DiscordLogContext = Record<string, unknown>;

export type DiscordEmbedField = {
  name: string;
  value: string;
  inline: boolean;
};

type DiscordEmbedPayloadOptions = {
  title: string;
  color: number;
  fields: DiscordEmbedField[];
  footerText: string;
};

export type DiscordWebhookPayload = {
  embeds: Array<{
    title: string;
    color: number;
    fields: DiscordEmbedField[];
    timestamp: string;
    footer: {
      text: string;
    };
  }>;
};

type DiscordResponseInfo = {
  status: number;
  statusText: string;
  responseText: string;
};

type DiscordWebhookOptions = {
  webhookUrl: string;
  payload: DiscordWebhookPayload;
  successMessage: string;
  successContext: DiscordLogContext | ((info: DiscordResponseInfo) => DiscordLogContext);
  responseErrorContext?: DiscordLogContext | ((info: DiscordResponseInfo) => DiscordLogContext);
  sendErrorContext: DiscordLogContext | ((error: unknown) => DiscordLogContext);
};

function resolveResponseContext(
  context: DiscordLogContext | ((info: DiscordResponseInfo) => DiscordLogContext),
  info: DiscordResponseInfo,
): DiscordLogContext {
  return typeof context === "function" ? context(info) : context;
}

function resolveSendErrorContext(
  context: DiscordLogContext | ((error: unknown) => DiscordLogContext),
  error: unknown,
): DiscordLogContext {
  return typeof context === "function" ? context(error) : context;
}

export function getDiscordWebhookUrl(
  webhookUrl: string,
  secretName: string,
): string | null {
  if (!webhookUrl) {
    logger.error(`${secretName} secret is not configured`);
    return null;
  }

  return webhookUrl;
}

export function buildDiscordEmbedPayload({
  title,
  color,
  fields,
  footerText,
}: DiscordEmbedPayloadOptions): DiscordWebhookPayload {
  return {
    embeds: [
      {
        title,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: {
          text: footerText,
        },
      },
    ],
  };
}

export async function sendDiscordWebhook({
  webhookUrl,
  payload,
  successMessage,
  successContext,
  responseErrorContext,
  sendErrorContext,
}: DiscordWebhookOptions): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    const responseInfo = {
      status: response.status,
      statusText: response.statusText,
      responseText,
    };

    if (!response.ok) {
      logger.error("Discord webhook returned error status", {
        ...resolveResponseContext(responseErrorContext ?? {}, responseInfo),
        status: response.status,
        statusText: response.statusText,
        responseBody: responseText,
      });
      return false;
    }

    logger.info(successMessage, resolveResponseContext(successContext, responseInfo));
    return true;
  } catch (error) {
    logger.error("Failed to send Discord webhook", {
      error: String(error),
      ...resolveSendErrorContext(sendErrorContext, error),
    });
    return false;
  }
}
