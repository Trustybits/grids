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
  shouldCloseGithubOnThreadArchive,
  shouldReopenGithubOnThreadUnarchive,
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

  const issueNumber = await github.findIssueNumberByThreadId(action.threadId);
  if (issueNumber === null) {
    console.log(
      `No matching issue for Discord thread ${action.threadId}; skipping comment`,
    );
    return;
  }
  await github.addComment(issueNumber, action.body);
  console.log(`Mirrored Discord reply to issue #${issueNumber}`);
}

async function handleThreadUnarchive(thread: ThreadChannel): Promise<void> {
  const issueNumber = await github.findIssueNumberByThreadId(thread.id);
  if (issueNumber === null) {
    console.log(
      `No matching issue for unarchived Discord thread ${thread.id}; skipping reopen`,
    );
    return;
  }
  await github.reopenIssue(issueNumber);
  console.log(
    `Reopened issue #${issueNumber} after Discord thread ${thread.id} was unarchived`,
  );
}

async function handleThreadArchive(thread: ThreadChannel): Promise<void> {
  const issueNumber = await github.findIssueNumberByThreadId(thread.id);
  if (issueNumber === null) {
    console.log(
      `No matching issue for archived Discord thread ${thread.id}; skipping close`,
    );
    return;
  }
  await github.closeIssue(issueNumber);
  console.log(
    `Closed issue #${issueNumber} after Discord thread ${thread.id} was archived`,
  );
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Discord bot logged in as ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, (message) => {
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
    shouldReopenGithubOnThreadUnarchive(
      newThread.parentId,
      config.forumChannelId,
      wasArchived,
      isArchived,
    )
  ) {
    void handleThreadUnarchive(newThread).catch((error) => {
      console.error("Failed to reopen GitHub issue for unarchived thread", error);
    });
    return;
  }

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
