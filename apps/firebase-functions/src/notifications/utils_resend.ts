import * as logger from "firebase-functions/logger";

type ResendLogContext = Record<string, unknown>;

type ResendResponseInfo = {
  status: number;
  statusText: string;
  responseText: string;
};

export type ResendEmailPayload = {
  from: string;
  to: string;
  subject: string;
  html: string;
};

type ResendEmailOptions = {
  apiKey: string;
  payload: ResendEmailPayload;
  successMessage: string;
  successContext: ResendLogContext | ((info: ResendResponseInfo) => ResendLogContext);
  responseErrorContext?: ResendLogContext | ((info: ResendResponseInfo) => ResendLogContext);
  sendErrorContext: ResendLogContext | ((error: unknown) => ResendLogContext);
};

function resolveResponseContext(
  context: ResendLogContext | ((info: ResendResponseInfo) => ResendLogContext),
  info: ResendResponseInfo,
): ResendLogContext {
  return typeof context === "function" ? context(info) : context;
}

function resolveSendErrorContext(
  context: ResendLogContext | ((error: unknown) => ResendLogContext),
  error: unknown,
): ResendLogContext {
  return typeof context === "function" ? context(error) : context;
}

export function getResendApiKey(apiKey: string, secretName: string): string | null {
  if (!apiKey) {
    logger.error(`${secretName} secret is not configured`);
    return null;
  }

  return apiKey;
}

export function getResendFromEmail(fromEmail: string, secretName: string): string | null {
  if (!fromEmail) {
    logger.error(`${secretName} secret is not configured`);
    return null;
  }

  return fromEmail;
}

export async function sendResendEmail({
  apiKey,
  payload,
  successMessage,
  successContext,
  responseErrorContext,
  sendErrorContext,
}: ResendEmailOptions): Promise<boolean> {
  const allowEmulatorSend = process.env.RESEND_ALLOW_EMULATOR_SEND === "true";

  if (process.env.FUNCTIONS_EMULATOR === "true" && !allowEmulatorSend) {
    logger.info("Skipping Resend email send in emulator environment", {
      successMessage,
      to: payload.to,
      subject: payload.subject,
      hint:
        "Run npm run email:preview for HTML previews, npm run email:send-test to send one message, or set RESEND_ALLOW_EMULATOR_SEND=true to send from the emulator",
    });
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      logger.error("Resend API returned error status", {
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
    logger.error("Failed to send Resend email", {
      error: String(error),
      ...resolveSendErrorContext(sendErrorContext, error),
    });
    return false;
  }
}
