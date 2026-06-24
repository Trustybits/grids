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
const localWordmarkPath = "../../web/public/grids_wordmark.png";

function localizeAssetsForPreview(html: string): string {
  return html.replace(
    "https://grids.so/grids_wordmark.png",
    localWordmarkPath,
  );
}

type PreviewEmail = {
  fileName: string;
  subject: string;
  html: string;
};

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
  writeFileSync(path, localizeAssetsForPreview(preview.html), "utf8");
  console.log(`Wrote ${path}`);
}

console.log(`\nOpen files in ${outputDir} to preview emails.`);
