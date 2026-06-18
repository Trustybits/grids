export interface BotConfig {
  /** Discord bot token (Developer Portal → Bot → Reset Token). */
  discordToken: string;
  /** GitHub PAT with `repo` scope used to create issues/comments. */
  githubToken: string;
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
  const githubToken = env.GITHUB_TOKEN;
  const forumChannelId = env.DISCORD_FORUM_CHANNEL_ID;

  const missing: string[] = [];
  if (!discordToken) missing.push("DISCORD_BOT_TOKEN");
  if (!githubToken) missing.push("GITHUB_TOKEN");
  if (!forumChannelId) missing.push("DISCORD_FORUM_CHANNEL_ID");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    discordToken: discordToken as string,
    githubToken: githubToken as string,
    githubRepo: env.GITHUB_REPO ?? DEFAULT_REPO,
    forumChannelId: forumChannelId as string,
    port: Number(env.PORT ?? "8080"),
  };
}
