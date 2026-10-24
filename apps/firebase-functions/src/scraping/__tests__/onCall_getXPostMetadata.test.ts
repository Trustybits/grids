import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import { noopIfMaintenance } from "../../maintenance.js";
import { resetMaintenanceMock } from "../../__tests__/utils_testMocks.js";

vi.mock("firebase-functions/v1", () => ({
  runWith: vi.fn(() => ({
    https: {
      onCall: (handler: unknown) => handler,
    },
  })),
}));

vi.mock("firebase-functions/v1/https", async () => {
  const { createHttpsModuleMock } = await import("../../__tests__/utils_testMocks.js");
  return createHttpsModuleMock();
});

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../utils_xCache.js", () => ({
  readThroughXCache: vi.fn(),
}));

import { getXPostMetadata as callable } from "../onCall_getXPostMetadata.js";
import { syndicationUrl } from "../utils_xPost.js";
import { readThroughXCache, type XCacheRequest } from "../utils_xCache.js";

const getXPostMetadata = callable as unknown as (
  data: unknown,
  context: { auth?: { uid: string } },
) => Promise<unknown>;

const auth = { auth: { uid: "user-1" } };

function expectHttpsError(error: unknown, code: string, message: string): void {
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
  expect((error as Error).message).toBe(message);
}

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

const syndicationPost = (id: string, screenName: string, text: string) => ({
  __typename: "Tweet",
  id_str: id,
  text,
  user: {
    name: screenName,
    screen_name: screenName,
    profile_image_url_https: `https://pbs.twimg.com/profile_images/${id}/a_normal.jpg`,
  },
  created_at: "2026-10-15T01:00:00.000Z",
  favorite_count: 29,
  conversation_count: 2,
});

beforeEach(() => {
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  vi.mocked(readThroughXCache).mockReset();
  vi.mocked(readThroughXCache).mockImplementation(
    async (request: XCacheRequest<{ fetchedAt: number }>) =>
      request.canSeed ? request.load() : null,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(Date.now).mockRestore();
});

describe("getXPostMetadata", () => {
  it("returns null without validating auth or fetching when maintenance mode is enabled", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getXPostMetadata({}, {})).resolves.toBeNull();

    expect(noopIfMaintenance).toHaveBeenCalledWith("getXPostMetadata");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads through the shared cache, letting only signed-in callers fill it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, syndicationPost("1", "a", "hello"))),
    );

    await getXPostMetadata({ postId: "1" }, auth);

    expect(readThroughXCache).toHaveBeenCalledWith(
      expect.objectContaining({ key: "post_1", canSeed: true }),
    );
  });

  it("rejects anonymous callers when the post isn't cached yet", async () => {
    await expect(getXPostMetadata({ postId: "1" }, {})).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "unauthenticated", "You must be signed in to fetch X posts.");
        return true;
      },
    );
    expect(readThroughXCache).toHaveBeenCalledWith(
      expect.objectContaining({ canSeed: false }),
    );
  });

  it("serves anonymous callers a cached post", async () => {
    const cached = { unavailable: true, fetchedAt: 5 };
    vi.mocked(readThroughXCache).mockResolvedValue(cached);

    await expect(getXPostMetadata({ postId: "1" }, {})).resolves.toBe(cached);
  });

  it("requires a postId", async () => {
    await expect(getXPostMetadata({}, auth)).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Missing postId.");
      return true;
    });
  });

  it("rejects post IDs that are not numeric", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getXPostMetadata({ postId: "../../evil" }, auth),
    ).rejects.toSatisfy((error: unknown) => {
      expectHttpsError(error, "invalid-argument", "Invalid postId: ../../evil");
      return true;
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the post and the post it quotes from the syndication endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ...syndicationPost("2110536140063457441", "ann_nnng", "thanks for the love"),
        quoted_tweet: syndicationPost("2110234900616126769", "ann_nnng", "margarita sloshing"),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = (await getXPostMetadata({ postId: "2110536140063457441" }, auth)) as {
      post: { postId: string; text: string; author: { avatarUrl: string } };
      quotedPost: { postId: string; text: string };
      fetchedAt: number;
    };

    expect(fetchMock).toHaveBeenCalledWith(
      syndicationUrl("2110536140063457441"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.post.postId).toBe("2110536140063457441");
    expect(result.post.text).toBe("thanks for the love");
    expect(result.post.author.avatarUrl).toBe(
      "https://pbs.twimg.com/profile_images/2110536140063457441/a_400x400.jpg",
    );
    expect(result.quotedPost.postId).toBe("2110234900616126769");
    expect(result.quotedPost.text).toBe("margarita sloshing");
    expect(result.fetchedAt).toBe(1_700_000_000_000);
  });

  it("omits quotedPost when the post quotes nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, syndicationPost("1", "a", "hello"))),
    );

    const result = await getXPostMetadata({ postId: "1" }, auth);

    expect(result).not.toHaveProperty("quotedPost");
  });

  it.each([
    ["X returns 404", jsonResponse(404, {})],
    ["X returns a tombstone", jsonResponse(200, { __typename: "TweetTombstone", tombstone: {} })],
  ])("resolves as unavailable when %s", async (_label, response) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    await expect(getXPostMetadata({ postId: "1" }, auth)).resolves.toEqual({
      unavailable: true,
      fetchedAt: 1_700_000_000_000,
    });
  });

  it("throws unavailable when X rate limits or errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(429, {})));

    await expect(getXPostMetadata({ postId: "1" }, auth)).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "unavailable", "X did not return the post.");
        return true;
      },
    );
    expect(logger.error).toHaveBeenCalledWith("X returned an error for post", {
      status: 429,
      postId: "1",
    });
  });

  it("throws unavailable when X cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")));

    await expect(getXPostMetadata({ postId: "1" }, auth)).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "unavailable", "Could not reach X.");
        return true;
      },
    );
  });

  it("throws internal when X returns unreadable data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }),
    );

    await expect(getXPostMetadata({ postId: "1" }, auth)).rejects.toSatisfy(
      (error: unknown) => {
        expectHttpsError(error, "internal", "Failed to read X post data.");
        return true;
      },
    );
  });
});
