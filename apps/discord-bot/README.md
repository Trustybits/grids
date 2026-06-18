# @grids/discord-bot

Gateway bot that mirrors a Discord **forum channel** into **GitHub issues**.

This is the inbound half of the Discord ↔ GitHub loop:

```
Discord forum ──gateway──► this bot ──► GitHub REST API        (inbound, automatic)
GitHub Actions ───────────────────────► Discord REST API       (outbound; see .github/workflows/github_discord_sync.yml)
```

- New forum post → opens a GitHub issue (authored by your **GitHub App**, not a personal user).
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
| `GITHUB_APP_ID` | yes | GitHub App id (Developer settings → your app). |
| `GITHUB_APP_INSTALLATION_ID` | yes | Installation id after installing the app on the repo/org (URL: `.../installations/<id>`). |
| `GITHUB_APP_PRIVATE_KEY` | yes | PEM private key for the app (full `-----BEGIN...` / `-----END...` block). |
| `DISCORD_FORUM_CHANNEL_ID` | yes | Id of the forum channel to mirror (right-click channel → Copy Channel ID, with Developer Mode on). |
| `GITHUB_REPO` | no | `owner/repo` target. Defaults to `Trustybits/grids`. |
| `PORT` | no | Health server port. Defaults to `8080` (Cloud Run sets this). |

### GitHub App prerequisites

Create a GitHub App (org or user) with:

- **Webhook**: disabled (this bot does not receive GitHub events).
- **Repository permissions**: **Issues: Read & write**.
- Install on `Trustybits/grids` (or the org), then note the **Installation ID**.

Issues and comments created by the bot appear as **`your-app-name[bot]`**, not your personal account.

### Discord Developer Portal prerequisites

- Enable **Message Content Intent** (Bot → Privileged Gateway Intents).
- Invite the bot with permissions: **Send Messages**, **Create Public Threads**,
  **Send Messages in Threads**, **Manage Threads**.

## Local development

```bash
npm install                       # from the repo root (workspaces)
DISCORD_BOT_TOKEN=... \
GITHUB_APP_ID=... \
GITHUB_APP_INSTALLATION_ID=... \
GITHUB_APP_PRIVATE_KEY="$(cat /path/to/app.private-key.pem)" \
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

   # GitHub App — paste the downloaded PEM file for the private key secret:
   gcloud secrets create GITHUB_APP_PRIVATE_KEY --data-file=./your-app.private-key.pem

   printf '%s' "$GITHUB_APP_ID" | gcloud secrets create GITHUB_APP_ID --data-file=-
   printf '%s' "$GITHUB_APP_INSTALLATION_ID" | gcloud secrets create GITHUB_APP_INSTALLATION_ID --data-file=-
   ```

   If you already have a `GITHUB_TOKEN` secret from the PAT setup, you can remove
   it from the Cloud Run service after migrating (the bot no longer uses it).

2. Grant the Cloud Run runtime access to each secret (one-time per secret):

   Creating a secret does **not** grant Cloud Run permission to read it. The
   service runs as the project default Compute Engine service account
   (`{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`). Every secret
   referenced in `--set-secrets` needs `roles/secretmanager.secretAccessor` on
   that account — otherwise deploy builds successfully but fails at
   "Creating Revision" with `Permission denied on secret ... for Revision
   service account`.

   ```bash
   export PROJECT_ID=grids-one
   export PROJECT_NUMBER=598562210148
   export RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

   for SECRET in \
     DISCORD_BOT_TOKEN \
     GITHUB_APP_ID \
     GITHUB_APP_INSTALLATION_ID \
     GITHUB_APP_PRIVATE_KEY
   do
     gcloud secrets add-iam-policy-binding "$SECRET" \
       --project="${PROJECT_ID}" \
       --member="serviceAccount:${RUNTIME_SA}" \
       --role="roles/secretmanager.secretAccessor"
   done
   ```

   Re-run the binding for any **new** secret you add later. For tighter scope,
   create a dedicated service account, grant it accessor on only these secrets,
   and pass `--service-account=grids-discord-bot@${PROJECT_ID}.iam.gserviceaccount.com`
   on deploy.

3. Deploy from this directory (uses the Dockerfile):

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
     --set-secrets "DISCORD_BOT_TOKEN=DISCORD_BOT_TOKEN:latest,GITHUB_APP_ID=GITHUB_APP_ID:latest,GITHUB_APP_INSTALLATION_ID=GITHUB_APP_INSTALLATION_ID:latest,GITHUB_APP_PRIVATE_KEY=GITHUB_APP_PRIVATE_KEY:latest"
   ```

Key flags:

- `--min-instances 1` keeps the bot alive (one persistent gateway connection).
- `--max-instances 1` avoids multiple connections double-posting to GitHub.
- `--no-cpu-throttling` keeps CPU allocated so the WebSocket stays healthy.

To update after code changes, re-run the same `gcloud run deploy` command.

### Permissions split (inbound vs outbound)

| Component | Where secrets live | IAM / setup |
| --- | --- | --- |
| This bot (Discord → GitHub) | GCP Secret Manager + Cloud Run | Step 2 above — runtime SA needs `secretAccessor` on each secret |
| GitHub → Discord workflow | GitHub Actions repo secret `DISCORD_BOT_TOKEN` | Set in repo Settings → Secrets; no GCP IAM involved |

> Truly-free alternative: a Compute Engine `e2-micro` (always-free tier in
> `us-west1`/`us-central1`/`us-east1`) running `node lib/index.js` under systemd.
> More manual upkeep than Cloud Run.
