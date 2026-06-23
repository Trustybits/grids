/**
 * Process pending grid engagement emails (same logic as the scheduled function).
 *
 * Usage (from apps/firebase-functions):
 *   GOOGLE_APPLICATION_CREDENTIALS=... RESEND_API_KEY=... RESEND_FROM_EMAIL=... \
 *     GRID_ENGAGEMENT_EMAIL_DELAY_MS=0 npm run email:process-engagement
 *
 * GRID_ENGAGEMENT_EMAIL_DELAY_MS=0 sends immediately for any pending record.
 */

import admin from "firebase-admin";
import {
  getGridEngagementEmailDelayMs,
  processPendingGridEngagementEmails,
} from "../notifications/utils_gridEngagementEmail.js";

if (!admin.apps.length) {
  admin.initializeApp();
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL;

if (!apiKey || !from) {
  console.error(
    "RESEND_API_KEY and RESEND_FROM_EMAIL environment variables are required.",
  );
  process.exit(1);
}

delete process.env.FUNCTIONS_EMULATOR;

const { processed, sent } = await processPendingGridEngagementEmails({
  apiKey,
  from,
});

console.log(
  `Processed ${processed} pending record(s); sent ${sent}. Delay ms: ${getGridEngagementEmailDelayMs()}`,
);

if (processed > 0 && sent === 0) {
  console.log(
    "No emails sent — records may still be inside the delay window. Try GRID_ENGAGEMENT_EMAIL_DELAY_MS=0.",
  );
}
