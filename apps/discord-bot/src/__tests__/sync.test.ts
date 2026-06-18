import { describe, expect, it } from "vitest";
import {
  buildCommentBody,
  buildIssueBody,
  buildSearchQuery,
  decideAction,
  extractImageUrls,
  isGithubSyncDiscordNotification,
  shouldCloseGithubOnThreadArchive,
  THREAD_MARKER_PREFIX,
  VIA_DISCORD_MARKER,
  type ForumMessage,
} from "../sync.js";

const FORUM_CHANNEL_ID = "forum-123";

function message(overrides: Partial<ForumMessage> = {}): ForumMessage {
  return {
    authorIsBot: false,
    authorUsername: "alice",
    messageId: "thread-1",
    channelId: "thread-1",
    channelParentId: FORUM_CHANNEL_ID,
    channelIsThread: true,
    threadName: "Help with my grid",
    content: "Something is broken",
    imageUrls: [],
    ...overrides,
  };
}

describe("decideAction", () => {
  it("creates an issue for a forum starter message", () => {
    const action = decideAction(message(), FORUM_CHANNEL_ID);
    expect(action.kind).toBe("create_issue");
    if (action.kind !== "create_issue") return;
    expect(action.title).toBe("[Discord] Help with my grid");
    expect(action.threadId).toBe("thread-1");
    expect(action.body).toContain(`${THREAD_MARKER_PREFIX} thread-1`);
    expect(action.body).toContain("Something is broken");
  });

  it("embeds image markdown in the issue body when images are present", () => {
    const action = decideAction(
      message({
        content: "see screenshot",
        imageUrls: ["https://cdn.discordapp.com/attachments/1/2/screenshot.png"],
      }),
      FORUM_CHANNEL_ID,
    );
    expect(action.kind).toBe("create_issue");
    if (action.kind !== "create_issue") return;
    expect(action.body).toContain(
      "![discord-image-1](https://cdn.discordapp.com/attachments/1/2/screenshot.png)",
    );
  });

  it("comments for a reply in the thread", () => {
    const action = decideAction(
      message({ messageId: "msg-2", content: "Any update?" }),
      FORUM_CHANNEL_ID,
    );
    expect(action.kind).toBe("comment");
    if (action.kind !== "comment") return;
    expect(action.threadId).toBe("thread-1");
    expect(action.body).toContain("@alice via Discord");
    expect(action.body).toContain("Any update?");
    expect(action.body).toContain(VIA_DISCORD_MARKER);
  });

  it("ignores bot-authored messages (loop guard)", () => {
    const action = decideAction(
      message({ authorIsBot: true, messageId: "msg-2" }),
      FORUM_CHANNEL_ID,
    );
    expect(action).toEqual({ kind: "ignore", reason: "bot-authored" });
  });

  it("ignores messages outside a thread", () => {
    const action = decideAction(
      message({ channelIsThread: false, channelParentId: null }),
      FORUM_CHANNEL_ID,
    );
    expect(action).toEqual({ kind: "ignore", reason: "not-a-thread" });
  });

  it("ignores threads in a different parent channel", () => {
    const action = decideAction(
      message({ channelParentId: "some-other-channel" }),
      FORUM_CHANNEL_ID,
    );
    expect(action).toEqual({ kind: "ignore", reason: "different-channel" });
  });

  it("falls back to a default title when the thread has no name", () => {
    const action = decideAction(message({ threadName: "" }), FORUM_CHANNEL_ID);
    expect(action.kind).toBe("create_issue");
    if (action.kind !== "create_issue") return;
    expect(action.title).toBe("[Discord] New Support Request");
  });
});

describe("extractImageUrls", () => {
  it("collects image attachments by content type", () => {
    expect(
      extractImageUrls(
        [{ url: "https://cdn.discordapp.com/a.png", contentType: "image/png" }],
        [],
      ),
    ).toEqual(["https://cdn.discordapp.com/a.png"]);
  });

  it("collects embed image and thumbnail urls", () => {
    expect(
      extractImageUrls([], [
        "https://cdn.discordapp.com/embed.png",
        "https://cdn.discordapp.com/thumb.png",
      ]),
    ).toEqual([
      "https://cdn.discordapp.com/embed.png",
      "https://cdn.discordapp.com/thumb.png",
    ]);
  });

  it("skips non-image attachments", () => {
    expect(
      extractImageUrls(
        [{ url: "https://cdn.discordapp.com/doc.pdf", contentType: "application/pdf" }],
        [],
      ),
    ).toEqual([]);
  });

  it("deduplicates urls across attachments and embeds", () => {
    const url = "https://cdn.discordapp.com/same.png";
    expect(
      extractImageUrls([{ url, contentType: "image/png" }], [url]),
    ).toEqual([url]);
  });
});

describe("shouldCloseGithubOnThreadArchive", () => {
  it("closes when a synced forum thread is archived", () => {
    expect(
      shouldCloseGithubOnThreadArchive(FORUM_CHANNEL_ID, FORUM_CHANNEL_ID, false, true),
    ).toBe(true);
  });

  it("ignores when the thread stays active", () => {
    expect(
      shouldCloseGithubOnThreadArchive(FORUM_CHANNEL_ID, FORUM_CHANNEL_ID, false, false),
    ).toBe(false);
  });

  it("ignores when the thread was already archived", () => {
    expect(
      shouldCloseGithubOnThreadArchive(FORUM_CHANNEL_ID, FORUM_CHANNEL_ID, true, true),
    ).toBe(false);
  });

  it("ignores threads outside the synced forum channel", () => {
    expect(
      shouldCloseGithubOnThreadArchive("other-forum", FORUM_CHANNEL_ID, false, true),
    ).toBe(false);
  });
});

describe("isGithubSyncDiscordNotification", () => {
  it("detects workflow notification messages from bots", () => {
    expect(
      isGithubSyncDiscordNotification(
        "🔒 **This issue was closed on GitHub.**\nView: https://github.com",
        true,
      ),
    ).toBe(true);
  });

  it("ignores human messages with similar text", () => {
    expect(
      isGithubSyncDiscordNotification("This issue was closed on GitHub", false),
    ).toBe(false);
  });
});

describe("body + query builders", () => {
  it("embeds the thread marker in the issue body", () => {
    expect(buildIssueBody("hello", "999")).toContain(
      `<!-- ${THREAD_MARKER_PREFIX} 999 -->`,
    );
  });

  it("uses a placeholder when the starter post has no text", () => {
    expect(buildIssueBody("   ", "999")).toContain("_(no description provided)_");
  });

  it("appends image markdown to issue and comment bodies", () => {
    const url = "https://cdn.discordapp.com/shot.png";
    expect(buildIssueBody("text", "999", [url])).toContain(`![discord-image-1](${url})`);
    expect(buildCommentBody("bob", "text", [url])).toContain(`![discord-image-1](${url})`);
  });

  it("tags mirrored comments with the loop-guard marker", () => {
    expect(buildCommentBody("bob", "hi")).toContain(VIA_DISCORD_MARKER);
  });

  it("scopes the search query to the repo and thread marker", () => {
    expect(buildSearchQuery("Trustybits/grids", "999")).toBe(
      `repo:Trustybits/grids in:body "${THREAD_MARKER_PREFIX} 999"`,
    );
  });
});
