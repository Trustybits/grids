import { createAppAuth } from "@octokit/auth-app";

export interface GitHubAppCredentials {
  appId: string;
  installationId: string;
  privateKey: string;
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

/** Normalize PEM stored in env/Secret Manager (often escaped as `\n`). */
export function normalizePrivateKey(privateKey: string): string {
  return privateKey.includes("\\n") ? privateKey.replace(/\\n/g, "\n") : privateKey;
}

/**
 * Issues and caches short-lived GitHub App installation tokens for API calls.
 * Tokens are refreshed before expiry so the long-running gateway bot stays
 * authenticated without holding a personal PAT.
 */
export class GitHubAppAuth {
  private cached: CachedToken | null = null;
  private readonly auth: ReturnType<typeof createAppAuth>;

  constructor(credentials: GitHubAppCredentials) {
    this.auth = createAppAuth({
      appId: credentials.appId,
      privateKey: normalizePrivateKey(credentials.privateKey),
      installationId: credentials.installationId,
    });
  }

  async getToken(): Promise<string> {
    const now = Date.now();
    // Refresh one minute before GitHub's expiry to avoid edge-case 401s.
    if (this.cached && this.cached.expiresAtMs > now + 60_000) {
      return this.cached.token;
    }

    const result = await this.auth({ type: "installation" });
    this.cached = {
      token: result.token,
      expiresAtMs: new Date(result.expiresAt).getTime(),
    };
    return this.cached.token;
  }
}
