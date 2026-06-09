import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Production build guard against silently shipping a backend-less app.
//
// Normally a missing firebaseConfigs.json just makes @grids/pro fall back to
// the stubbed backend — desirable for public/OSS checkouts, dangerous for a
// real deploy (a green build with no Firebase). When REQUIRE_FIREBASE_CONFIG
// is set (do this only in the Vercel project env), this asserts the config is
// actually present, valid, and wired up, failing the build loudly otherwise.
//
// Unset (local dev, CI, OSS builds) → this is a no-op.

if (!process.env.REQUIRE_FIREBASE_CONFIG) {
  process.exit(0);
}

const configPath = fileURLToPath(
  new URL("../src/runtime/firebaseConfigs.json", import.meta.url),
);

function fail(message) {
  console.error(`\n✘ Firebase config check failed: ${message}\n`);
  process.exit(1);
}

// The runtime only loads @grids/pro when VITE_USE_FIREBASE === "true"; without
// it, a present-and-valid config still silently yields the stubbed backend.
if (process.env.VITE_USE_FIREBASE !== "true") {
  fail(
    'REQUIRE_FIREBASE_CONFIG is set but VITE_USE_FIREBASE is not "true". ' +
      "The app would ignore the Firebase config and use the stubbed backend. " +
      'Set VITE_USE_FIREBASE="true" in the deploy environment.',
  );
}

if (!existsSync(configPath)) {
  fail(
    "REQUIRE_FIREBASE_CONFIG is set but packages/pro/src/runtime/" +
      "firebaseConfigs.json is missing. The build would silently fall back " +
      "to the stubbed backend. Commit the config (git add -f) in this repo.",
  );
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(configPath, "utf8"));
} catch (err) {
  fail(`firebaseConfigs.json is not valid JSON: ${err.message}`);
}

// Validate the specific environment this deploy targets (defaults to "prod",
// matching the runtime's parseFirebaseEnv fallback).
const env = process.env.VITE_FIREBASE_ENV ?? "prod";
const envConfig = parsed?.[env];
if (!envConfig?.apiKey || envConfig.apiKey === "REPLACE_ME") {
  fail(
    `firebaseConfigs.json has no usable "${env}" config ` +
      "(missing or REPLACE_ME apiKey).",
  );
}

process.stdout.write(`✓ Firebase config present and valid for "${env}".\n`);
