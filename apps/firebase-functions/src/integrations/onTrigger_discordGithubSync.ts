const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");

// Put your tokens here (Ideally use Firebase Secrets Manager)
const GITHUB_TOKEN = "your_github_pat";
const GITHUB_REPO = "your_username/your_repo";
const DISCORD_BOT_TOKEN = "your_discord_bot_token";

exports.discordToGithub = onRequest(async (req, res) => {
  // Validate Discord's webhook test pings
  if (req.body.type === 1) {
    return res.status(200).send({ type: 1 });
  }

  const message = req.body;
  
  // Verify the event is a message inside your forum channel
  if (!message || !message.channel_id) {
    return res.status(200).send("Invalid payload");
  }

  const threadId = message.channel_id;
  const isStarterMessage = message.id === threadId; // Core logic: Starter post shares the Thread ID

  try {
    if (isStarterMessage) {
      // 1. CREATE A NEW GITHUB ISSUE FOR A NEW POST
      const githubResponse = await axios.post(
        `https://github.com{GITHUB_REPO}/issues`,
        {
          title: `[Discord] ${message.embeds?.[0]?.title || "New Support Request"}`,
          body: `${message.content}\n\n<!-- discord_thread_id: ${threadId} -->` // Embed hidden tracking metadata
        },
        { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
      );

      return res.status(200).send(`Issue #${githubResponse.data.number} created.`);
    } else {
      // 2. CONVERT SUB-THREAD MESSAGES INTO GITHUB COMMENTS
      // First, find the associated GitHub Issue using GitHub search API for our metadata tag
      const searchResult = await axios.get(
        `https://github.com{GITHUB_REPO}+"${threadId}"+in:body`,
        { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
      );

      if (searchResult.data.total_count > 0) {
        const issueNumber = searchResult.data.items[0].number;
        
        // Post the reply text as a comment on that issue
        await axios.post(
          `https://github.com{GITHUB_REPO}/issues/${issueNumber}/comments`,
          { body: `**@${message.author.username} via Discord:**\n${message.content}` },
          { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
        );
        return res.status(200).send("Comment mirrored successfully.");
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error executing sync mapping.");
  }
  
  return res.status(200).send("No actions required.");
});
