/* eslint-disable */

import { defineSecret } from "firebase-functions/params";

// Notion OAuth secrets — set via: firebase functions:secrets:set NOTION_CLIENT_ID etc.
export const notionClientId = defineSecret("NOTION_CLIENT_ID");
export const notionClientSecret = defineSecret("NOTION_CLIENT_SECRET");
