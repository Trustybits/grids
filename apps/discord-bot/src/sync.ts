// Hidden marker embedded in a created issue's body so later thread replies can
// be matched back to their issue via the GitHub search API.
export const THREAD_MARKER_PREFIX = "discord_thread_id:";

// Hidden marker embedded in comments mirrored from Discord. The GitHub -> Discord
// workflow skips any comment containing it so a mirrored reply is never echoed
// back into the same Discord thread (loop guard on the GitHub side).
export const VIA_DISCORD_MARKER = "<!-- via_discord -->";

/**
 * A flattened view of a Discord message, decoupled from discord.js so the
 * routing logic stays pure and unit-testable.
 */
export interface ForumMessage {
  authorIsBot: boolean;
  authorUsername: string;
  messageId: string;
  /** The channel the message was posted in (a thread id, for forum posts). */
  channelId: string;
  /** Parent channel id when the channel is a thread, else null. */
  channelParentId: string | null;
  channelIsThread: boolean;
  /** Thread/post title (only meaningful for forum threads). */
  threadName: string;
  content: string;
  /** Image URLs from attachments and embeds on the message. */
  imageUrls: string[];
}

export interface DiscordImageRef {
  url: string;
  contentType?: string;
  name?: string;
}

const IMAGE_EXTENSION_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?|$)/i;

function isImageRef(ref: DiscordImageRef): boolean {
  if (ref.contentType?.startsWith("image/")) return true;
  if (ref.name && IMAGE_EXTENSION_RE.test(ref.name)) return true;
  return IMAGE_EXTENSION_RE.test(ref.url);
}

/** Collect unique image URLs from message attachments and embed media. */
export function extractImageUrls(
  attachments: DiscordImageRef[],
  embedImageUrls: string[],
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const add = (url: string | undefined | null) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  for (const attachment of attachments) {
    if (isImageRef(attachment)) {
      add(attachment.url);
    }
  }
  for (const url of embedImageUrls) {
    add(url);
  }

  return urls;
}

export function formatImageMarkdown(imageUrls: string[]): string {
  if (imageUrls.length === 0) return "";
  return `\n\n${imageUrls
    .map((url, index) => `![discord-image-${index + 1}](${url})`)
    .join("\n")}`;
}

export function buildIssueBody(
  content: string,
  threadId: string,
  imageUrls: string[] = [],
): string {
  const text = content.trim() || "_(no description provided)_";
  return `${text}${formatImageMarkdown(imageUrls)}\n\n<!-- ${THREAD_MARKER_PREFIX} ${threadId} -->`;
}

export function buildCommentBody(
  username: string,
  content: string,
  imageUrls: string[] = [],
): string {
  const text = content.trim();
  const body = text.length > 0 ? text : "_(no text)_";
  return `**@${username} via Discord:**\n\n${body}${formatImageMarkdown(imageUrls)}\n\n${VIA_DISCORD_MARKER}`;
}

export function buildSearchQuery(repo: string, threadId: string): string {
  return `repo:${repo} in:body "${THREAD_MARKER_PREFIX} ${threadId}"`;
}

export type SyncAction =
  | { kind: "ignore"; reason: string }
  | { kind: "create_issue"; title: string; body: string; threadId: string }
  | { kind: "comment"; threadId: string; body: string };

/**
 * Decide what to do with an incoming forum message.
 *
 * In a Discord forum, creating a post creates a thread whose starter message
 * shares the thread's id — so `messageId === channelId` identifies the opening
 * post (-> new issue), and anything else in the thread is a reply (-> comment).
 *
 * Bot-authored messages are ignored: that covers the bot's own posts and the
 * GitHub -> Discord workflow's thread updates, preventing a sync loop.
 */
export function decideAction(msg: ForumMessage, forumChannelId: string): SyncAction {
  if (msg.authorIsBot) {
    return { kind: "ignore", reason: "bot-authored" };
  }
  if (!msg.channelIsThread) {
    return { kind: "ignore", reason: "not-a-thread" };
  }
  if (msg.channelParentId !== forumChannelId) {
    return { kind: "ignore", reason: "different-channel" };
  }

  if (msg.messageId === msg.channelId) {
    return {
      kind: "create_issue",
      title: `[Discord] ${msg.threadName || "New Support Request"}`,
      body: buildIssueBody(msg.content, msg.channelId, msg.imageUrls),
      threadId: msg.channelId,
    };
  }

  return {
    kind: "comment",
    threadId: msg.channelId,
    body: buildCommentBody(msg.authorUsername, msg.content, msg.imageUrls),
  };
}

/**
 * Returns true when a forum thread was archived (closed on Discord) and should
 * close the linked GitHub issue.
 */
export function shouldCloseGithubOnThreadArchive(
  parentId: string | null,
  forumChannelId: string,
  wasArchived: boolean,
  isArchived: boolean,
): boolean {
  return parentId === forumChannelId && !wasArchived && isArchived;
}

/** Phrases in GitHub → Discord workflow notification messages (loop guard). */
export const GITHUB_SYNC_DISCORD_NOTIFICATION_MARKERS = [
  "This issue was closed on GitHub",
  "This issue was reopened on GitHub",
] as const;

export function isGithubSyncDiscordNotification(
  content: string,
  authorIsBot: boolean,
): boolean {
  if (!authorIsBot) return false;
  return GITHUB_SYNC_DISCORD_NOTIFICATION_MARKERS.some((marker) =>
    content.includes(marker),
  );
}
