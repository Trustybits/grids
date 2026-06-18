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
}

export type SyncAction =
  | { kind: "ignore"; reason: string }
  | { kind: "create_issue"; title: string; body: string; threadId: string }
  | { kind: "comment"; threadId: string; body: string };

export function buildIssueBody(content: string, threadId: string): string {
  const text = content.trim() || "_(no description provided)_";
  return `${text}\n\n<!-- ${THREAD_MARKER_PREFIX} ${threadId} -->`;
}

export function buildCommentBody(username: string, content: string): string {
  return `**@${username} via Discord:**\n\n${content}\n\n${VIA_DISCORD_MARKER}`;
}

export function buildSearchQuery(repo: string, threadId: string): string {
  return `repo:${repo} in:body "${THREAD_MARKER_PREFIX} ${threadId}"`;
}

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
      body: buildIssueBody(msg.content, msg.channelId),
      threadId: msg.channelId,
    };
  }

  return {
    kind: "comment",
    threadId: msg.channelId,
    body: buildCommentBody(msg.authorUsername, msg.content),
  };
}

/**
 * Returns true when a forum thread was unarchived (reopened on Discord) and
 * should trigger a matching GitHub issue reopen.
 */
export function shouldReopenGithubOnThreadUnarchive(
  parentId: string | null,
  forumChannelId: string,
  wasArchived: boolean,
  isArchived: boolean,
): boolean {
  return parentId === forumChannelId && wasArchived && !isArchived;
}
