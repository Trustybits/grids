import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase-functions/logger", () => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

import * as logger from "firebase-functions/logger";
import {
  decodePageData,
  extractPinnedPostId,
  extractProfile,
  extractReplyIds,
  extractTimelineIds,
  getXDiscoverySource,
  pageDiscoverySource,
  readJsonValue,
} from "../utils_xDiscovery.js";

// x.com embeds its JSON inside JavaScript string literals.
function asPageScript(value: unknown): string {
  const literal = JSON.stringify(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\x3C");
  return `<script>$R[1]=JSON.parse("${literal}")</script>`;
}

const owner = {
  __typename: "User",
  avatar: { image_url: "https://pbs.twimg.com/profile_images/1/a_normal.jpg" },
  banner: { image_url: "https://pbs.twimg.com/profile_banners/1/1744434703" },
  core: { name: "Ann <3", screen_name: "ann_nnng" },
  profile_bio: {
    description: "Designer. Say \"hi\" at https://t.co/abc",
    entities: {
      description: {
        urls: [
          {
            url: "https://t.co/abc",
            expanded_url: "https://ann.design",
            display_url: "ann.design",
            indices: [22, 38],
          },
        ],
      },
    },
  },
  relationship_counts: { followers: 14240, following: 1011 },
  verification: { is_blue_verified: true },
};

const mentionedUser = {
  __typename: "User",
  core: { name: "Ann (mention)", screen_name: "ann_nnng" },
};

const profilePage = asPageScript({
  data: {
    user: { result: owner },
    timeline: {
      instructions: [
        {
          type: "TimelinePinEntry",
          entry: {
            entry_id: "tweet-111",
            content: { tweet_results: { id: "VHdlZXQ6MTEx", rest_id: "111" } },
          },
        },
        {
          type: "TimelineAddEntries",
          entries: [
            { entry_id: "tweet-222", sort: 1 },
            { entry_id: "profile-conversation-9-tweet-333", sort: 2 },
            { entry_id: "tweet-222", sort: 3 },
            { entry_id: "cursor-bottom-1", sort: 4 },
          ],
        },
      ],
    },
    mentions: [mentionedUser],
  },
});

const statusPage = asPageScript({
  entries: [
    { entry_id: "tweet-100" },
    { entry_id: "conversationthread-101" },
    { entry_id: "conversationthread-100" },
    { entry_id: "conversationthread-102" },
    { entry_id: "conversationthread-101" },
  ],
});

function htmlResponse(status: number, html = "") {
  return { status, ok: status >= 200 && status < 300, text: async () => html };
}

describe("decodePageData", () => {
  it("undoes JavaScript string escaping", () => {
    expect(decodePageData('\\"a\\" \\x3Cb\\u003E \\\\n')).toBe('"a" <b> \\n');
  });
});

describe("readJsonValue", () => {
  it("parses a balanced object, ignoring brackets inside strings", () => {
    const text = 'x{"a":"}]","b":[1,{"c":2}]} trailing}';
    expect(readJsonValue(text, 1)).toEqual({ a: "}]", b: [1, { c: 2 }] });
  });

  it("returns null when there is no object or it is cut off", () => {
    expect(readJsonValue('"a"', 0)).toBeNull();
    expect(readJsonValue('{"a":', 0)).toBeNull();
  });
});

describe("page parsers", () => {
  it("lists reply threads once each, without the focal post", () => {
    expect(extractReplyIds(decodePageData(statusPage), "100")).toEqual(["101", "102"]);
  });

  it("lists timeline posts in page order, skipping cursors and duplicates", () => {
    expect(extractTimelineIds(decodePageData(profilePage))).toEqual(["111", "222", "333"]);
  });

  it("finds the pinned post", () => {
    expect(extractPinnedPostId(decodePageData(profilePage))).toBe("111");
    expect(extractPinnedPostId(decodePageData(statusPage))).toBeUndefined();
  });

  it("reads the owner's profile, matching the handle case-insensitively", () => {
    const profile = extractProfile(decodePageData(profilePage), "ANN_NNNG");
    expect(profile).toEqual({
      screenName: "ann_nnng",
      name: "Ann <3",
      profileUrl: "https://x.com/ann_nnng",
      isVerified: true,
      avatarUrl: "https://pbs.twimg.com/profile_images/1/a_400x400.jpg",
      bannerUrl: "https://pbs.twimg.com/profile_banners/1/1744434703/1500x500",
      followersCount: 14240,
      followingCount: 1011,
      bioSegments: [
        { kind: "text", text: 'Designer. Say "hi" at ' },
        { kind: "link", text: "ann.design", href: "https://ann.design" },
      ],
    });
  });

  it("returns null when the owner isn't on the page", () => {
    expect(extractProfile(decodePageData(profilePage), "someone_else")).toBeNull();
  });
});

describe("pageDiscoverySource", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads reply IDs from the post page, up to the limit", async () => {
    fetchMock.mockResolvedValue(htmlResponse(200, statusPage));
    await expect(pageDiscoverySource.findReplyIds("100", "ann_nnng", 1)).resolves.toEqual(["101"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://x.com/ann_nnng/status/100",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("reads the profile and post IDs from the profile page", async () => {
    fetchMock.mockResolvedValue(htmlResponse(200, profilePage));
    const discovery = await pageDiscoverySource.findProfile("ann_nnng", 2);
    expect(discovery?.postIds).toEqual(["111", "222"]);
    expect(discovery?.pinnedPostId).toBe("111");
    expect(discovery?.profile?.followersCount).toBe(14240);
  });

  it("returns null for a missing account or a page with no data", async () => {
    fetchMock.mockResolvedValueOnce(htmlResponse(404));
    await expect(pageDiscoverySource.findProfile("ghost", 10)).resolves.toBeNull();
    fetchMock.mockResolvedValueOnce(htmlResponse(200, "<html></html>"));
    await expect(pageDiscoverySource.findProfile("ghost", 10)).resolves.toBeNull();
  });

  it("throws on other HTTP errors so callers can log them", async () => {
    fetchMock.mockResolvedValue(htmlResponse(429));
    await expect(pageDiscoverySource.findReplyIds("100", "ann_nnng", 10)).rejects.toThrow("429");
  });
});

describe("getXDiscoverySource", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the page source", () => {
    vi.stubEnv("X_DISCOVERY_SOURCE", "");
    expect(getXDiscoverySource()).toBe(pageDiscoverySource);
  });

  it("is off when set to off, and when set to an unknown source", () => {
    vi.stubEnv("X_DISCOVERY_SOURCE", "off");
    expect(getXDiscoverySource()).toBeNull();
    vi.stubEnv("X_DISCOVERY_SOURCE", "firehose");
    expect(getXDiscoverySource()).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      "Unknown X_DISCOVERY_SOURCE; X discovery is off",
      { name: "firehose" },
    );
  });
});
