import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import { noopIfMaintenance } from "../maintenance.js";
import {
  resendApiKey,
  resendFromEmail,
} from "./secrets.js";
import {
  getGridEngagementEmailDelayMs,
  processPendingGridEngagementEmails,
} from "./utils_gridEngagementEmail.js";
import {
  getResendApiKey,
  getResendFromEmail,
} from "./utils_resend.js";

/**
 * Sends delayed grid engagement emails for users whose first edit is older than
 * the configured delay (default 2 days). Runs hourly.
 */
export const onSendGridEngagementEmails = functions
  .runWith({
    secrets: [resendApiKey, resendFromEmail],
  })
  .pubsub.schedule("every 1 hours")
  .onRun(async () => {
    if (noopIfMaintenance("onSendGridEngagementEmails")) return null;

    const apiKey = getResendApiKey(resendApiKey.value(), "RESEND_API_KEY");
    const from = getResendFromEmail(resendFromEmail.value(), "RESEND_FROM_EMAIL");
    if (!apiKey || !from) {
      return null;
    }

    const { processed, sent } = await processPendingGridEngagementEmails({
      apiKey,
      from,
    });

    logger.info("Grid engagement email sweep complete", {
      processed,
      sent,
      delayMs: getGridEngagementEmailDelayMs(),
    });

    return null;
  });
