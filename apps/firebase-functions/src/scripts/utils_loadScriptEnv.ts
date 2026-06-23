import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Loads KEY=VALUE pairs from a dotenv file into process.env without overwriting
 * variables that are already set in the shell.
 */
function loadEnvFile(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

/** Load Resend-related env vars for local email scripts. */
export function loadResendScriptEnv(): void {
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../");
  const repoRoot = join(packageRoot, "../../");

  loadEnvFile(join(packageRoot, ".env.local"));
  loadEnvFile(join(packageRoot, ".env.resend.local"));
  loadEnvFile(join(packageRoot, ".env.grids-one"));
  loadEnvFile(join(repoRoot, ".env.grids-one"));
}

export function getResendScriptCredentials(): {
  apiKey: string | undefined;
  from: string | undefined;
} {
  loadResendScriptEnv();

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  return { apiKey, from };
}
