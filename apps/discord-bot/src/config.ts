export interface BotConfig {
  /** Discord bot token (Developer Portal → Bot → Reset Token). */
  discordToken: string;
  /** GitHub App id (Developer settings → GitHub Apps). */
  githubAppId: string;
  /** Installation id after installing the app on the target repo/org. */
  githubAppInstallationId: string;
  /** PEM private key for the GitHub App (full key including BEGIN/END lines). */
  githubAppPrivateKey: string;
  /** Target repository as `owner/repo`. */
  githubRepo: string;
  /** Id of the Discord forum channel to mirror into GitHub. */
  forumChannelId: string;
  /** Port for the Cloud Run health/keepalive server. */
  port: number;
}

const DEFAULT_REPO = "Trustybits/grids";

/**
 * Read and validate bot configuration from the environment. Throws with a
 * single combined message listing everything that is missing so a
 * misconfigured deploy fails fast and legibly at startup.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const discordToken = env.DISCORD_BOT_TOKEN;
  const githubAppId = env.GITHUB_APP_ID;
  const githubAppInstallationId = env.GITHUB_APP_INSTALLATION_ID;
  const githubAppPrivateKey = env.GITHUB_APP_PRIVATE_KEY;
  const forumChannelId = env.DISCORD_FORUM_CHANNEL_ID;

  const missing: string[] = [];
  if (!discordToken) missing.push("DISCORD_BOT_TOKEN");
  if (!githubAppId) missing.push("GITHUB_APP_ID");
  if (!githubAppInstallationId) missing.push("GITHUB_APP_INSTALLATION_ID");
  if (!githubAppPrivateKey) missing.push("GITHUB_APP_PRIVATE_KEY");
  if (!forumChannelId) missing.push("DISCORD_FORUM_CHANNEL_ID");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    discordToken: discordToken as string,
    githubAppId: githubAppId as string,
    githubAppInstallationId: githubAppInstallationId as string,
    githubAppPrivateKey: githubAppPrivateKey as string,
    githubRepo: env.GITHUB_REPO ?? DEFAULT_REPO,
    forumChannelId: forumChannelId as string,
    port: Number(env.PORT ?? "8080"),
  };
}
