/**
 * Write HTML previews for all transactional email templates.
 *
 * Usage (from apps/firebase-functions):
 *   npm run email:preview
 *
 * Opens email-previews/*.html in a browser to review layout and copy.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildFirstGridEmail,
  buildSupporterBadgeEmail,
  buildWelcomeEmail,
} from "../notifications/utils_emailTemplates.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = join(scriptDir, "../../email-previews");

type PreviewEmail = {
  fileName: string;
  subject: string;
  html: string;
};

function wrapPreviewHtml(subject: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; padding: 24px; color: #111; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    ${bodyHtml}
  </body>
</html>`;
}

const previews: PreviewEmail[] = [
  {
    fileName: "welcome.html",
    ...buildWelcomeEmail({ displayName: "Matt" }),
  },
  {
    fileName: "grid-engagement-with-slug.html",
    ...buildFirstGridEmail({
      displayName: "Matt",
      gridName: "My Grid",
      gridId: "grid-demo-1",
      slug: "matt",
    }),
  },
  {
    fileName: "grid-engagement-no-slug.html",
    ...buildFirstGridEmail({
      displayName: null,
      gridName: "Untitled",
      gridId: "grid-demo-2",
      slug: null,
    }),
  },
  {
    fileName: "supporter-badge.html",
    ...buildSupporterBadgeEmail({ displayName: "Matt" }),
  },
];

mkdirSync(outputDir, { recursive: true });

for (const preview of previews) {
  const path = join(outputDir, preview.fileName);
  writeFileSync(path, wrapPreviewHtml(preview.subject, preview.html), "utf8");
  console.log(`Wrote ${path}`);
}

console.log(`\nOpen files in ${outputDir} to preview emails.`);
