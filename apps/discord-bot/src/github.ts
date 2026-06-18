import { buildSearchQuery } from "./sync.js";

const GITHUB_API = "https://api.github.com";

export class GitHubApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "GitHubApiError";
    this.status = status;
  }
}

/** Thin GitHub REST client scoped to a single `owner/repo`. */
export class GitHubClient {
  constructor(
    private readonly getToken: () => Promise<string>,
    private readonly repo: string,
  ) {}

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "grids-discord-bot",
    };
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const response = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers: await this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new GitHubApiError(
        response.status,
        `GitHub ${method} ${path} failed (${response.status}): ${text.slice(0, 300)}`,
      );
    }
    return text ? JSON.parse(text) : null;
  }

  async createIssue(title: string, body: string): Promise<number> {
    const data = (await this.request("POST", `/repos/${this.repo}/issues`, {
      title,
      body,
    })) as { number: number };
    return data.number;
  }

  async findIssueNumberByThreadId(threadId: string): Promise<number | null> {
    const query = buildSearchQuery(this.repo, threadId);
    const data = (await this.request(
      "GET",
      `/search/issues?q=${encodeURIComponent(query)}`,
    )) as { total_count: number; items: Array<{ number: number }> };

    if (data.total_count > 0 && data.items.length > 0) {
      return data.items[0].number;
    }
    return null;
  }

  async addComment(issueNumber: number, body: string): Promise<void> {
    await this.request(
      "POST",
      `/repos/${this.repo}/issues/${issueNumber}/comments`,
      { body },
    );
  }

  async reopenIssue(issueNumber: number): Promise<void> {
    await this.request("PATCH", `/repos/${this.repo}/issues/${issueNumber}`, {
      state: "open",
    });
  }
}
