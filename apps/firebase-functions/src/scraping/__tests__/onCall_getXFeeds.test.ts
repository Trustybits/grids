import { beforeEach, describe, expect, it, vi } from "vitest";
import * as logger from "firebase-functions/logger";
import { HttpsError } from "firebase-functions/v1/https";
import type { XPostSnapshot } from "@grids/contracts/types";
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
  warn: vi.fn(),
}));

vi.mock("../../maintenance.js", () => ({
  noopIfMaintenance: vi.fn(),
}));

vi.mock("../utils_xDiscovery.js", () => ({
  getXDiscoverySource: vi.fn(),
}));

vi.mock("../utils_xFetch.js", () => ({
  loadXPostSnapshots: vi.fn(),
}));

import { getXPostReplies as repliesCallable } from "../onCall_getXPostReplies.js";
import { getXProfileFeed as feedCallable } from "../onCall_getXProfileFeed.js";
import { getXDiscoverySource } from "../utils_xDiscovery.js";
import { loadXPostSnapshots } from "../utils_xFetch.js";

type Callable = (data: unknown, context: { auth?: { uid: string } }) => Promise<unknown>;
const getXPostReplies = repliesCallable as unknown as Callable;
const getXProfileFeed = feedCallable as unknown as Callable;

const auth = { auth: { uid: "user-1" } };
const fetchedAt = 1_700_000_000_000;

const source = {
  findReplyIds: vi.fn(),
  findProfile: vi.fn(),
};

function snapshot(postId: string, screenName: string): XPostSnapshot {
  return {
    postId,
    postUrl: `https://x.com/${screenName}/status/${postId}`,
    author: {
      name: `${screenName} name`,
      screenName,
      avatarUrl: `https://pbs.twimg.com/${screenName}_400x400.jpg`,
      isVerified: false,
    },
    text: `post ${postId}`,
    textSegments: [{ kind: "text", text: `post ${postId}` }],
    isTruncated: false,
    createdAt: "2026-10-15T01:00:00.000Z",
    likeCount: 0,
    replyCount: 0,
    media: [],
  };
}

async function expectHttpsError(promise: Promise<unknown>, code: string): Promise<void> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(HttpsError);
  expect((error as HttpsError).code).toBe(code);
}

beforeEach(() => {
  resetMaintenanceMock(noopIfMaintenance);
  vi.mocked(logger.error).mockClear();
  vi.mocked(logger.warn).mockClear();
  vi.spyOn(Date, "now").mockReturnValue(fetchedAt);
  source.findReplyIds.mockReset();
  source.findProfile.mockReset();
  vi.mocked(getXDiscoverySource).mockReturnValue(source);
  vi.mocked(loadXPostSnapshots).mockReset();
  vi.mocked(loadXPostSnapshots).mockImplementation(async (ids) =>
    ids.map((id) => snapshot(id, "ann_nnng")),
  );
});

describe("getXPostReplies", () => {
  it("rebuilds discovered replies from the syndication feed", async () => {
    source.findReplyIds.mockResolvedValue(["101", "102"]);

    const result = await getXPostReplies({ postId: "100", screenName: "ann_nnng" }, auth);

    expect(source.findReplyIds).toHaveBeenCalledWith("100", "ann_nnng", 10);
    expect(loadXPostSnapshots).toHaveBeenCalledWith(["101", "102"]);
    expect(result).toEqual({
      replies: [snapshot("101", "ann_nnng"), snapshot("102", "ann_nnng")],
      fetchedAt,
    });
  });

  it("returns no replies when discovery fails or is turned off", async () => {
    source.findReplyIds.mockRejectedValue(new Error("x.com returned 429"));
    await expect(
      getXPostReplies({ postId: "100", screenName: "ann_nnng" }, auth),
    ).resolves.toEqual({ replies: [], fetchedAt });
    expect(logger.warn).toHaveBeenCalledWith("X reply discovery failed", {
      error: "Error: x.com returned 429",
      postId: "100",
    });

    vi.mocked(getXDiscoverySource).mockReturnValue(null);
    await expect(
      getXPostReplies({ postId: "100", screenName: "ann_nnng" }, auth),
    ).resolves.toEqual({ replies: [], fetchedAt });
  });

  it("validates auth and input", async () => {
    await expectHttpsError(
      getXPostReplies({ postId: "100", screenName: "ann_nnng" }, {}),
      "unauthenticated",
    );
    await expectHttpsError(
      getXPostReplies({ postId: "abc", screenName: "ann_nnng" }, auth),
      "invalid-argument",
    );
    await expectHttpsError(
      getXPostReplies({ postId: "100", screenName: "../admin" }, auth),
      "invalid-argument",
    );
    expect(source.findReplyIds).not.toHaveBeenCalled();
  });

  it("does nothing during maintenance", async () => {
    vi.mocked(noopIfMaintenance).mockReturnValue(true);
    await expect(
      getXPostReplies({ postId: "100", screenName: "ann_nnng" }, auth),
    ).resolves.toBeNull();
  });
});

describe("getXProfileFeed", () => {
  it("returns the page profile, the posts, and the pinned post", async () => {
    source.findProfile.mockResolvedValue({
      postIds: ["111", "222"],
      pinnedPostId: "111",
      profile: {
        screenName: "ann_nnng",
        name: "Ann",
        avatarUrl: "https://pbs.twimg.com/page_400x400.jpg",
        isVerified: true,
        followersCount: 14240,
      },
    });

    const result = await getXProfileFeed({ screenName: "Ann_nnng" }, auth);

    expect(source.findProfile).toHaveBeenCalledWith("Ann_nnng", 10);
    expect(result).toEqual({
      profile: {
        screenName: "ann_nnng",
        name: "Ann",
        profileUrl: "https://x.com/ann_nnng",
        avatarUrl: "https://pbs.twimg.com/page_400x400.jpg",
        isVerified: true,
        followersCount: 14240,
      },
      posts: [snapshot("111", "ann_nnng"), snapshot("222", "ann_nnng")],
      pinnedPostId: "111",
      fetchedAt,
    });
  });

  it("builds the profile from the owner's own post when the page has none", async () => {
    source.findProfile.mockResolvedValue({ postIds: ["111"], profile: null });

    const result = (await getXProfileFeed({ screenName: "ANN_NNNG" }, auth)) as {
      profile: unknown;
      pinnedPostId?: string;
    };

    expect(result.profile).toEqual({
      screenName: "ann_nnng",
      name: "ann_nnng name",
      profileUrl: "https://x.com/ann_nnng",
      avatarUrl: "https://pbs.twimg.com/ann_nnng_400x400.jpg",
      isVerified: false,
    });
    expect(result).not.toHaveProperty("pinnedPostId");
  });

  it("drops a pinned post ID whose post couldn't be loaded", async () => {
    source.findProfile.mockResolvedValue({
      postIds: ["111", "222"],
      pinnedPostId: "111",
      profile: null,
    });
    vi.mocked(loadXPostSnapshots).mockResolvedValue([snapshot("222", "ann_nnng")]);

    const result = await getXProfileFeed({ screenName: "ann_nnng" }, auth);

    expect(result).not.toHaveProperty("pinnedPostId");
  });

  it("is unavailable when the account can't be found", async () => {
    source.findProfile.mockResolvedValue(null);
    await expect(getXProfileFeed({ screenName: "ghost" }, auth)).resolves.toEqual({
      unavailable: true,
      fetchedAt,
    });

    source.findProfile.mockResolvedValue({ postIds: ["9"], profile: null });
    vi.mocked(loadXPostSnapshots).mockResolvedValue([snapshot("9", "someone_else")]);
    await expect(getXProfileFeed({ screenName: "ghost" }, auth)).resolves.toEqual({
      unavailable: true,
      fetchedAt,
    });
  });

  it("throws unavailable when discovery fails, and failed-precondition when off", async () => {
    source.findProfile.mockRejectedValue(new Error("x.com returned 503"));
    await expectHttpsError(getXProfileFeed({ screenName: "ann_nnng" }, auth), "unavailable");
    expect(logger.error).toHaveBeenCalledWith("X profile discovery failed", {
      error: "Error: x.com returned 503",
      screenName: "ann_nnng",
    });

    vi.mocked(getXDiscoverySource).mockReturnValue(null);
    await expectHttpsError(
      getXProfileFeed({ screenName: "ann_nnng" }, auth),
      "failed-precondition",
    );
  });

  it("validates auth and input", async () => {
    await expectHttpsError(getXProfileFeed({ screenName: "ann_nnng" }, {}), "unauthenticated");
    await expectHttpsError(
      getXProfileFeed({ screenName: "much_too_long_handle" }, auth),
      "invalid-argument",
    );
    expect(source.findProfile).not.toHaveBeenCalled();
  });
});
