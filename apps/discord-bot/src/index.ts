import { createServer } from "node:http";
import {
  Client,
  Events,
  GatewayIntentBits,
  type Message,
  type ThreadChannel,
} from "discord.js";
import { loadConfig } from "./config.js";
import { GitHubClient } from "./github.js";
import { GitHubAppAuth } from "./githubAuth.js";
import {
  decideAction,
  extractImageUrls,
  isGithubSyncDiscordNotification,
  shouldCloseGithubOnThreadArchive,
  type ForumMessage,
} from "./sync.js";

const config = loadConfig();
const githubAppAuth = new GitHubAppAuth({
  appId: config.githubAppId,
  installationId: config.githubAppInstallationId,
  privateKey: config.githubAppPrivateKey,
});
const github = new GitHubClient(
  () => githubAppAuth.getToken(),
  config.githubRepo,
);

const client = new Client({
  // Guilds: thread lifecycle. GuildMessages + MessageContent: read posts/replies.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function toForumMessage(message: Message): ForumMessage {
  const channel = message.channel;
  const isThread = channel.isThread();
  const attachments = message.attachments.map((attachment) => ({
    url: attachment.url,
    contentType: attachment.contentType ?? undefined,
    name: attachment.name,
  }));
  const embedImageUrls = message.embeds.flatMap((embed) =>
    [embed.image?.url, embed.thumbnail?.url].filter(
      (url): url is string => typeof url === "string",
    ),
  );

  return {
    authorIsBot: message.author.bot,
    authorUsername: message.author.username,
    messageId: message.id,
    channelId: channel.id,
    channelParentId: isThread ? channel.parentId : null,
    channelIsThread: isThread,
    threadName: isThread ? channel.name : "",
    content: message.content,
    imageUrls: extractImageUrls(attachments, embedImageUrls),
  };
}

async function handleMessage(message: Message): Promise<void> {
  const action = decideAction(toForumMessage(message), config.forumChannelId);

  if (action.kind === "ignore") {
    return;
  }

  if (action.kind === "create_issue") {
    const issueNumber = await github.createIssue(action.title, action.body);
    console.log(
      `Created issue #${issueNumber} from Discord thread ${action.threadId}`,
    );
    return;
  }

  const issue = await github.findIssueByThreadId(action.threadId);
  if (issue === null) {
    console.log(
      `No matching issue for Discord thread ${action.threadId}; skipping comment`,
    );
    return;
  }

  // Reopen on human activity (a real message), not on thread unarchive alone.
  // That avoids loops from sync notification posts briefly unarchiving a thread.
  if (issue.state === "closed") {
    await github.reopenIssue(issue.number);
    console.log(
      `Reopened issue #${issue.number} after human message in Discord thread ${action.threadId}`,
    );
  }

  await github.addComment(issue.number, action.body);
  console.log(`Mirrored Discord reply to issue #${issue.number}`);
}

async function handleThreadArchive(thread: ThreadChannel): Promise<void> {
  const issue = await github.findIssueByThreadId(thread.id);
  if (issue === null) {
    console.log(
      `No matching issue for archived Discord thread ${thread.id}; skipping close`,
    );
    return;
  }
  if (issue.state === "closed") {
    console.log(
      `Issue #${issue.number} already closed for Discord thread ${thread.id}`,
    );
    return;
  }
  await github.closeIssue(issue.number);
  console.log(
    `Closed issue #${issue.number} after Discord thread ${thread.id} was archived`,
  );
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Discord bot logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, (message) => {
  if (
    message.channel.isThread() &&
    message.channel.parentId === config.forumChannelId &&
    isGithubSyncDiscordNotification(message.content, message.author.bot)
  ) {
    return;
  }

  void handleMessage(message).catch((error) => {
    console.error("Failed to process Discord message", error);
  });
});

client.on(Events.ThreadUpdate, (oldThread, newThread) => {
  if (!newThread.isThread()) return;
  if (newThread.parentId !== config.forumChannelId) return;

  const wasArchived = oldThread.archived === true;
  const isArchived = newThread.archived === true;

  if (
    shouldCloseGithubOnThreadArchive(
      newThread.parentId,
      config.forumChannelId,
      wasArchived,
      isArchived,
    )
  ) {
    void handleThreadArchive(newThread).catch((error) => {
      console.error("Failed to close GitHub issue for archived thread", error);
    });
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error", error);
});

void client.login(config.discordToken);

// Cloud Run requires the container to listen on $PORT; this also serves as a
// lightweight health endpoint while the bot holds its gateway connection.
createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("ok");
}).listen(config.port, () => {
  console.log(`Health server listening on :${config.port}`);
});
