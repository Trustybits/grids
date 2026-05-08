import { defineSecret } from "firebase-functions/params";

// Define secrets for Discord webhook URLs
export const discordNewUsersWebhookUrl = defineSecret("DISCORD_NEW_USERS_WEBHOOK_URL");
export const discordUserActivityWebhookUrl = defineSecret("DISCORD_USER_ACTIVITY_WEBHOOK_URL");
