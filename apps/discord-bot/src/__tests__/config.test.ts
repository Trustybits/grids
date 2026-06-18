import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";

const TEST_PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----";

const fullEnv = {
  DISCORD_BOT_TOKEN: "discord-token",
  GITHUB_APP_ID: "123456",
  GITHUB_APP_INSTALLATION_ID: "78901234",
  GITHUB_APP_PRIVATE_KEY: TEST_PRIVATE_KEY,
  DISCORD_FORUM_CHANNEL_ID: "forum-123",
} as NodeJS.ProcessEnv;

describe("loadConfig", () => {
  it("loads config and applies the default repo + port", () => {
    const config = loadConfig({ ...fullEnv });
    expect(config.githubRepo).toBe("Trustybits/grids");
    expect(config.port).toBe(8080);
    expect(config.forumChannelId).toBe("forum-123");
    expect(config.githubAppId).toBe("123456");
    expect(config.githubAppInstallationId).toBe("78901234");
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
      /DISCORD_BOT_TOKEN, GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY, DISCORD_FORUM_CHANNEL_ID/,
    );
  });
});
