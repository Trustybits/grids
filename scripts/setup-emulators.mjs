#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const PROJECT_ID = "demo-grids-local";
const STORAGE_BUCKET = `${PROJECT_ID}.firebasestorage.app`;
const FORCE = process.argv.includes("--force");
const HELP = process.argv.includes("--help") || process.argv.includes("-h");

const generatedFiles = new Map([
  [
    ".firebaserc",
    json({
      projects: {
        default: PROJECT_ID,
      },
      targets: {},
    }),
  ],
  [
    "firebase.json",
    json({
      firestore: {
        rules: "firestore.rules",
        indexes: "firestore.indexes.json",
      },
      storage: {
        rules: "storage.rules",
      },
      functions: {
        source: "apps/firebase-functions",
      },
      emulators: {
        auth: {
          port: 9099,
        },
        firestore: {
          port: 8080,
        },
        functions: {
          port: 5001,
        },
        storage: {
          port: 9199,
        },
        ui: {
          enabled: true,
        },
        singleProjectMode: true,
      },
    }),
  ],
  [
    "firestore.indexes.json",
    json({
      indexes: [],
      fieldOverrides: [],
    }),
  ],
  [
    "firestore.rules",
    `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Contributor-local emulator rules. These intentionally do not mirror
    // production authorization; they make local forks usable with demo data.
    match /users/{document=**} {
      allow read, write: if true;
    }
    match /publicProfiles/{document=**} {
      allow read, write: if true;
    }
    match /userBadges/{document=**} {
      allow read, write: if true;
    }
    match /userGameData/{document=**} {
      allow read, write: if true;
    }
    match /grids/{document=**} {
      allow read, write: if true;
    }
    match /slugs/{document=**} {
      allow read, write: if true;
    }
    match /customers/{document=**} {
      allow read, write: if true;
    }
    match /products/{document=**} {
      allow read, write: if true;
    }
    match /analyticsEvents/{document=**} {
      allow read, write: if true;
    }
    match /gridStats/{document=**} {
      allow read, write: if true;
    }
    match /businessStats/{document=**} {
      allow read, write: if true;
    }
    match /rateLimits/{document=**} {
      allow read, write: if true;
    }
    match /notification_tracking/{document=**} {
      allow read, write: if true;
    }
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
`,
  ],
  [
    "storage.rules",
    `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Contributor-local emulator rules. Do not deploy these rules to Firebase.
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
`,
  ],
  [
    "packages/pro/src/runtime/firebaseConfigs.json",
    json({
      prod: demoFirebaseConfig(),
      stage: demoFirebaseConfig(),
    }),
  ],
]);

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function demoFirebaseConfig() {
  return {
    apiKey: "demo-api-key",
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:demo",
    measurementId: "G-DEMOLOCAL",
  };
}

function usage() {
  console.log(`Set up local Firebase Emulator Suite config for contributors.

Usage:
  npm run emulators:setup
  npm run emulators:setup -- --force

Creates gitignored, demo-only Firebase config files for project ${PROJECT_ID}.
Existing files are skipped unless --force is supplied.`);
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ code: 127, stdout, stderr, error });
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

async function checkTool(label, command, args, installMessage, isFound) {
  const result = await run(command, args);
  const combined = `${result.stdout}${result.stderr}`.trim();
  const found = !result.error && isFound(result, combined);

  if (found) {
    const firstLine = combined.split("\n").find(Boolean) ?? "found";
    console.log(`[ok] ${label}: ${firstLine}`);
    return true;
  }

  console.log(`[missing] ${label}: not found`);
  console.log(`  ${installMessage}`);
  return false;
}

async function confirmContinueAfterMissingTools(missingTools) {
  if (missingTools.length === 0) return true;

  console.log("");
  console.log(
    "You can still create the config files now, but install the missing tools before running the emulators.",
  );

  const rl = createInterface({ input, output });
  try {
    const answer = (
      await rl.question("Continue creating emulator config files? [y/N] ")
    )
      .trim()
      .toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

async function writeGeneratedFiles() {
  const written = [];
  const skipped = [];

  for (const [path, contents] of generatedFiles) {
    if ((await exists(path)) && !FORCE) {
      skipped.push(path);
      continue;
    }

    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, contents, "utf8");
    written.push(path);
  }

  return { written, skipped };
}

function printSummary({ written, skipped }) {
  console.log("");
  console.log("Firebase emulator setup files:");
  for (const path of written) {
    console.log(`  created ${path}`);
  }
  for (const path of skipped) {
    console.log(`  skipped ${path} (already exists)`);
  }

  console.log("");
  console.log("Next steps:");
  console.log("  1. Install repo dependencies if you have not already: npm install");
  console.log("  2. Install Firebase CLI if missing: npm install -g firebase-tools");
  console.log("  3. Install a Java JDK if missing. JDK 11+ is required; JDK 17 or 21 is fine.");
  console.log("  4. Start the local Firebase services: npm run emulators");
  console.log("  5. In another terminal, start the app against emulators: npm run dev:emulator");

  if (skipped.length > 0 && !FORCE) {
    console.log("");
    console.log(
      "Existing files were left untouched. To replace them with the demo scaffold, rerun with:",
    );
    console.log("  npm run emulators:setup -- --force");
  }

  console.log("");
  console.log(
    "These generated Firebase files are demo-only local scaffolding. Do not deploy them to a real Firebase project.",
  );
}

async function main() {
  if (HELP) {
    usage();
    return;
  }

  console.log("Checking Firebase Emulator Suite prerequisites...");
  const checks = [
    await checkTool(
      "Firebase CLI",
      "firebase",
      ["--version"],
      "Install it with: npm install -g firebase-tools",
      (result, combined) =>
        result.code === 0 || /^\d+\.\d+\.\d+/m.test(combined),
    ),
    await checkTool(
      "Java JDK",
      "java",
      ["-version"],
      "Install a JDK with your system package manager, for example: brew install openjdk@21",
      (result, combined) =>
        result.code === 0 && /\b(?:openjdk|java) version\b/i.test(combined),
    ),
  ];

  const missingTools = checks.filter((found) => !found);
  if (!(await confirmContinueAfterMissingTools(missingTools))) {
    console.log("Emulator setup cancelled.");
    process.exit(1);
  }

  const result = await writeGeneratedFiles();
  printSummary(result);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
