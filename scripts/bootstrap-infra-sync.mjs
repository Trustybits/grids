#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdtemp, mkdir, cp, rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOOL_SOURCE_PATH = "tools/infra-sync";
const LOCAL_TOOL_DIR = ".infra-sync";
const fullRefresh = process.argv.includes("--full-refresh");

function maintainerOnlyMessage() {
  return [
    "Infra sync is maintainer-only and is not required for ordinary contributors.",
    "If you are a maintainer, run `gh auth login` with access to the private devops repo and try again.",
  ].join("\n");
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? "pipe",
      cwd: options.cwd ?? process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const auth = await run("gh", ["auth", "status"]);

  if (auth.code !== 0) {
    console.error(maintainerOnlyMessage());
    process.exit(1);
  }

  const rl = createInterface({ input, output });
  let devopsRepo = "";

  try {
    devopsRepo = (
      await rl.question("Private devops repo to copy infra sync from (OWNER/NAME): ")
    ).trim();
  } finally {
    rl.close();
  }

  if (!/^[^/\s]+\/[^/\s]+$/.test(devopsRepo)) {
    console.error("Expected a GitHub repo in OWNER/NAME format.");
    process.exit(1);
  }

  if (fullRefresh && (await exists(LOCAL_TOOL_DIR))) {
    const rl = createInterface({ input, output });
    let answer = "";

    try {
      console.log("");
      console.log(
        "Full infra refresh will delete .infra-sync/, including local sync state and baselines.",
      );
      console.log("After this completes, you must run `npm run infra:new` again.");
      answer = (
        await rl.question("Continue with full infra refresh? Type yes to continue: ")
      ).trim().toLowerCase();
    } finally {
      rl.close();
    }

    if (answer !== "yes") {
      console.log("Full infra refresh cancelled.");
      return;
    }

    await rm(LOCAL_TOOL_DIR, { recursive: true, force: true });
  }

  const tempRoot = await mkdtemp(join(tmpdir(), "infra-sync-bootstrap-"));
  const cloneDir = join(tempRoot, "devops");

  try {
    const clone = await run("gh", ["repo", "clone", devopsRepo, cloneDir], {
      stdio: "pipe",
    });

    if (clone.code !== 0) {
      console.error(maintainerOnlyMessage());
      console.error("");
      console.error("GitHub CLI could not clone the requested devops repo.");
      process.exit(1);
    }

    const sourceDir = join(cloneDir, TOOL_SOURCE_PATH);

    if (!(await exists(sourceDir))) {
      console.error(
        `The devops repo was accessible, but ${TOOL_SOURCE_PATH} was not found.`,
      );
      process.exit(1);
    }

    await mkdir(LOCAL_TOOL_DIR, { recursive: true });
    await cp(sourceDir, LOCAL_TOOL_DIR, {
      recursive: true,
      force: true,
      errorOnExist: false,
    });

    console.log(`Infra sync tooling copied from ${devopsRepo}:${TOOL_SOURCE_PATH}`);
    console.log(`Installed locally at ${LOCAL_TOOL_DIR}/`);
    if (fullRefresh) {
      console.log("Run `npm run infra:new` before `infra:status`, `infra:pull`, or `infra:sync`.");
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
