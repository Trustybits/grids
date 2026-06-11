#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

const TOOL_ENTRYPOINT = join(process.cwd(), ".infra-sync", "index.mjs");

function maintainerOnlyMessage() {
  return [
    "Infra sync is maintainer-only and is not required for ordinary contributors.",
    "Run `npm run infra:setup` from the canonical public repo if you are a maintainer with access to the private devops repo.",
  ].join("\n");
}

async function main() {
  try {
    await access(TOOL_ENTRYPOINT, constants.F_OK);
  } catch {
    console.error(maintainerOnlyMessage());
    process.exit(1);
  }

  const child = spawn(process.execPath, [TOOL_ENTRYPOINT, ...process.argv.slice(2)], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  child.on("close", (code) => {
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
