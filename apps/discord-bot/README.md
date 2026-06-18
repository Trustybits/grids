# @grids/discord-bot

Gateway bot that mirrors a Discord **forum channel** into **GitHub issues**.

This is the inbound half of the Discord ↔ GitHub loop:

```
Discord forum ──gateway──► this bot ──► GitHub REST API        (inbound, automatic)
GitHub Actions ───────────────────────► Discord REST API       (outbound; see .github/workflows/github_discord_sync.yml)
```

- New forum post → opens a GitHub issue (the Discord thread id is embedded in
  the issue body as a hidden marker).
- Reply in a forum thread → adds a comment on the matching issue.
- Bot-authored messages are ignored, and mirrored comments carry a
  `<!-- via_discord -->` marker the GitHub → Discord workflow skips, so updates
  never loop.

It needs a **persistent gateway connection**, so unlike the Firebase functions
it must run as an always-on process (e.g. Cloud Run with a warm instance).

## Configuration (environment variables)

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | yes | Bot token (Developer Portal → Bot → Reset Token). |
| `GITHUB_TOKEN` | yes | PAT with `repo` scope (or fine-grained issues read/write on the repo). |
| `DISCORD_FORUM_CHANNEL_ID` | yes | Id of the forum channel to mirror (right-click channel → Copy Channel ID, with Developer Mode on). |
| `GITHUB_REPO` | no | `owner/repo` target. Defaults to `Trustybits/grids`. |
| `PORT` | no | Health server port. Defaults to `8080` (Cloud Run sets this). |

### Discord Developer Portal prerequisites

- Enable **Message Content Intent** (Bot → Privileged Gateway Intents).
- Invite the bot with permissions: **Send Messages**, **Create Public Threads**,
  **Send Messages in Threads**, **Manage Threads**.

## Local development

```bash
npm install                       # from the repo root (workspaces)
DISCORD_BOT_TOKEN=... \
GITHUB_TOKEN=... \
DISCORD_FORUM_CHANNEL_ID=... \
GITHUB_REPO=you/your-test-repo \
  npm --workspace @grids/discord-bot run dev
```

Point it at a throwaway GitHub repo while testing so you don't open real issues.

```bash
npm --workspace @grids/discord-bot run test
npm --workspace @grids/discord-bot run lint
npm --workspace @grids/discord-bot run type-check
```

## Deploy to Cloud Run

A gateway bot must stay connected, so it needs a **warm instance with CPU always
allocated** — otherwise Cloud Run throttles CPU between requests and the Discord
socket drops.

1. Store secrets in Secret Manager (one-time):

   ```bash
   printf '%s' "$DISCORD_BOT_TOKEN" | gcloud secrets create DISCORD_BOT_TOKEN --data-file=-
   printf '%s' "$GITHUB_TOKEN"      | gcloud secrets create GITHUB_TOKEN      --data-file=-
   ```

2. Deploy from this directory (uses the Dockerfile):

   ```bash
   cd apps/discord-bot
   gcloud run deploy grids-discord-bot \
     --source . \
     --region us-central1 \
     --no-allow-unauthenticated \
     --min-instances 1 \
     --max-instances 1 \
     --no-cpu-throttling \
     --set-env-vars "DISCORD_FORUM_CHANNEL_ID=<forum-channel-id>,GITHUB_REPO=Trustybits/grids" \
     --set-secrets "DISCORD_BOT_TOKEN=DISCORD_BOT_TOKEN:latest,GITHUB_TOKEN=GITHUB_TOKEN:latest"
   ```

Key flags:

- `--min-instances 1` keeps the bot alive (one persistent gateway connection).
- `--max-instances 1` avoids multiple connections double-posting to GitHub.
- `--no-cpu-throttling` keeps CPU allocated so the WebSocket stays healthy.

To update after code changes, re-run the same `gcloud run deploy` command.

> Truly-free alternative: a Compute Engine `e2-micro` (always-free tier in
> `us-west1`/`us-central1`/`us-east1`) running `node lib/index.js` under systemd.
> More manual upkeep than Cloud Run.
