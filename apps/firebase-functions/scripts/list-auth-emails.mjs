#!/usr/bin/env node

/**
 * Print all Firebase Auth user emails as a comma-separated list.
 *
 * Usage from apps/firebase-functions:
 *   node scripts/list-auth-emails.mjs
 *   node scripts/list-auth-emails.mjs --project-id=grids-one
 *
 * Auth:
 *   Requires Application Default Credentials, usually either:
 *   - GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   - gcloud auth application-default login
 */

import admin from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EXCLUDED_EMAIL_DOMAINS = ["@trustybits.com", "grids.so"];
const MAX_RESULTS = 1000;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..", "..");

function parseArgs(argv) {
  const options = {
    projectId: null,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg.startsWith("--project-id=")) {
      options.projectId = parseProjectId(arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.warn(`
Print Firebase Auth user emails as one comma-separated line.

Usage:
  node scripts/list-auth-emails.mjs
  node scripts/list-auth-emails.mjs --project-id=grids-one

Options:
  --project-id=<id>  Firebase/GCP project ID. Defaults to env vars, then .firebaserc default.
`);
}

function parseProjectId(arg) {
  const value = arg.slice("--project-id=".length);
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value)) {
    throw new Error(
      `--project-id does not look like a valid project ID: ${value}`,
    );
  }
  return value;
}

function readFirebaseRcDefaultProject() {
  const path = join(REPO_ROOT, ".firebaserc");
  if (!existsSync(path)) return null;

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const projectId = parsed?.projects?.default;
    return typeof projectId === "string" ? projectId : null;
  } catch (error) {
    console.warn(`Could not parse .firebaserc for default project: ${error}`);
    return null;
  }
}

function resolveProjectId(projectIdArg) {
  return (
    projectIdArg ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    readFirebaseRcDefaultProject()
  );
}

function initializeAdmin(projectId) {
  if (admin.apps.length) return;
  admin.initializeApp(projectId ? { projectId } : undefined);
}

function shouldIncludeEmail(email) {
  const lowerEmail = email.toLowerCase();
  return !EXCLUDED_EMAIL_DOMAINS.some((domain) => lowerEmail.endsWith(domain));
}

async function listAuthEmails() {
  const emails = [];
  let pageToken;

  do {
    const result = await admin.auth().listUsers(MAX_RESULTS, pageToken);
    for (const user of result.users) {
      if (user.email && shouldIncludeEmail(user.email)) {
        emails.push(user.email);
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);

  return emails;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectId = resolveProjectId(options.projectId);

  initializeAdmin(projectId);

  const emails = await listAuthEmails();
  process.stdout.write(`${emails.join(",")}\n`);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
