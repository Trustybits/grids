/**
 * Send a single test email through Resend.
 *
 * Usage (from apps/firebase-functions):
 *   RESEND_API_KEY=re_... RESEND_FROM_EMAIL='Grids <hello@grids.so>' \
 *     npm run email:send-test -- welcome you@example.com
 *
 * Templates: welcome | grid-engagement | supporter
 */

import {
  buildFirstGridEmail,
  buildSupporterBadgeEmail,
  buildWelcomeEmail,
} from "../notifications/utils_emailTemplates.js";
import { sendResendEmail } from "../notifications/utils_resend.js";

type TemplateName = "welcome" | "grid-engagement" | "supporter";

function usage(): void {
  console.error(
    "Usage: npm run email:send-test -- <welcome|grid-engagement|supporter> <to@email.com>",
  );
}

function buildTemplate(template: TemplateName): { subject: string; html: string } {
  switch (template) {
    case "welcome":
      return buildWelcomeEmail({ displayName: "Preview User" });
    case "grid-engagement":
      return buildFirstGridEmail({
        displayName: "Preview User",
        gridName: "Preview Grid",
        gridId: "grid-preview",
        slug: "preview",
      });
    case "supporter":
      return buildSupporterBadgeEmail({ displayName: "Preview User" });
    default:
      throw new Error(`Unknown template: ${template}`);
  }
}

const [, , templateArg, toArg] = process.argv;

if (!templateArg || !toArg) {
  usage();
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL;

if (!apiKey || !from) {
  console.error(
    "RESEND_API_KEY and RESEND_FROM_EMAIL environment variables are required.",
  );
  process.exit(1);
}

const template = templateArg as TemplateName;
if (!["welcome", "grid-engagement", "supporter"].includes(template)) {
  usage();
  process.exit(1);
}

const { subject, html } = buildTemplate(template);

// Scripts run outside the Functions emulator — allow real sends.
delete process.env.FUNCTIONS_EMULATOR;

const sent = await sendResendEmail({
  apiKey,
  payload: { from, to: toArg, subject, html },
  successMessage: "Test email sent",
  successContext: () => ({ template, to: toArg }),
  responseErrorContext: { template, to: toArg },
  sendErrorContext: { template, to: toArg },
});

if (!sent) {
  process.exit(1);
}

console.log(`Sent ${template} email to ${toArg}`);
