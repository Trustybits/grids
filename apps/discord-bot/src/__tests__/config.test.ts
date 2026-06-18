import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";

const fullEnv = {
  DISCORD_BOT_TOKEN: "discord-token",
  GITHUB_TOKEN: "gh-token",
  DISCORD_FORUM_CHANNEL_ID: "forum-123",
} as NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("loads config and applies the default repo + port", () => {
    const config = loadConfig({ ...fullEnv });
    expect(config.githubRepo).toBe("Trustybits/grids");
    expect(config.port).toBe(8080);
    expect(config.forumChannelId).toBe("forum-123");
  });

  it("honors GITHUB_REPO and PORT overrides", () => {
    const config = loadConfig({
      ...fullEnv,
      GITHUB_REPO: "acme/widgets",
      PORT: "3000",
    });
    expect(config.githubRepo).toBe("acme/widgets");
    expect(config.port).toBe(3000);
  });

  it("throws listing every missing required variable", () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrowError(
      /DISCORD_BOT_TOKEN, GITHUB_TOKEN, DISCORD_FORUM_CHANNEL_ID/,
    );
  });
});
