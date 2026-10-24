import { describe, expect, it } from "vitest";
import {
  buildTextSegments,
  syndicationToken,
  syndicationUrl,
  toXPostSnapshot,
  type SyndicationPost,
} from "../utils_xPost.js";

const user = {
  name: "Ann Nguyen",
  screen_name: "ann_nnng",
  profile_image_url_https: "https://pbs.twimg.com/profile_images/1/abc_normal.jpg",
  is_blue_verified: true,
  verified: false,
};

describe("syndicationToken", () => {
  it("derives the token X's embed sends for a post ID", () => {
    expect(syndicationToken("20")).toBe(
      ((20 / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ""),
    );
  });

  it("builds the tweet-result URL with id, lang and token", () => {
    const url = new URL(syndicationUrl("2110698132225106303"));
    expect(url.origin + url.pathname).toBe("https://cdn.syndication.twimg.com/tweet-result");
    expect(url.searchParams.get("id")).toBe("2110698132225106303");
    expect(url.searchParams.get("lang")).toBe("en");
    expect(url.searchParams.get("token")).toBe(syndicationToken("2110698132225106303"));
  });
});

describe("buildTextSegments", () => {
  it("splits mentions out and drops the trailing media link, counting emoji as one code point", () => {
    const post: SyndicationPost = {
      text: "thanks @Google for the love on my post 😆 https://t.co/yqWzaYD0gg",
      display_text_range: [0, 41],
      entities: {
        media: [{ url: "https://t.co/yqWzaYD0gg", indices: [41, 64] }],
        user_mentions: [{ screen_name: "Google", indices: [7, 14] }],
      },
    };

    expect(buildTextSegments(post)).toEqual([
      { kind: "text", text: "thanks " },
      { kind: "mention", text: "@Google", href: "https://x.com/Google" },
      { kind: "text", text: " for the love on my post 😆" },
    ]);
  });

  it("replaces t.co links with their display text and expanded href", () => {
    const post: SyndicationPost = {
      text: "read this https://t.co/abc #ai",
      entities: {
        urls: [
          {
            url: "https://t.co/abc",
            expanded_url: "https://example.com/article",
            display_url: "example.com/article",
            indices: [10, 26],
          },
        ],
        hashtags: [{ text: "ai", indices: [27, 30] }],
      },
    };

    expect(buildTextSegments(post)).toEqual([
      { kind: "text", text: "read this " },
      { kind: "link", text: "example.com/article", href: "https://example.com/article" },
      { kind: "text", text: " " },
      { kind: "hashtag", text: "#ai", href: "https://x.com/hashtag/ai" },
    ]);
  });

  it("decodes HTML entities and still finds entities whose indices drifted", () => {
    const post: SyndicationPost = {
      text: "salt &amp; pepper @chef",
      // Indices computed against the escaped text are 4 code points too far.
      entities: { user_mentions: [{ screen_name: "chef", indices: [18, 23] }] },
    };

    expect(buildTextSegments(post)).toEqual([
      { kind: "text", text: "salt & pepper " },
      { kind: "mention", text: "@chef", href: "https://x.com/chef" },
    ]);
  });

  it("hides leading reply mentions outside the display range", () => {
    const post: SyndicationPost = {
      text: "@someone yes, exactly",
      display_text_range: [9, 21],
      entities: { user_mentions: [{ screen_name: "someone", indices: [0, 8] }] },
    };

    expect(buildTextSegments(post)).toEqual([{ kind: "text", text: "yes, exactly" }]);
  });
});

describe("toXPostSnapshot", () => {
  it("maps a syndication post to a snapshot", () => {
    const post: SyndicationPost = {
      __typename: "Tweet",
      id_str: "2110698132225106303",
      text: "made with a skill https://t.co/T8WNt6Z7cL",
      display_text_range: [0, 17],
      entities: { media: [{ url: "https://t.co/T8WNt6Z7cL", indices: [18, 41] }] },
      user,
      created_at: "2026-10-15T11:43:44.000Z",
      favorite_count: 721,
      conversation_count: 22,
      mediaDetails: [
        {
          type: "video",
          media_url_https: "https://pbs.twimg.com/amplify_video_thumb/1/img/poster.jpg",
          original_info: { width: 1080, height: 1080 },
        },
      ],
    };

    expect(toXPostSnapshot(post)).toEqual({
      postId: "2110698132225106303",
      postUrl: "https://x.com/ann_nnng/status/2110698132225106303",
      author: {
        name: "Ann Nguyen",
        screenName: "ann_nnng",
        avatarUrl: "https://pbs.twimg.com/profile_images/1/abc_400x400.jpg",
        isVerified: true,
      },
      text: "made with a skill",
      textSegments: [{ kind: "text", text: "made with a skill" }],
      isTruncated: false,
      createdAt: "2026-10-15T11:43:44.000Z",
      likeCount: 721,
      replyCount: 22,
      media: [
        {
          type: "video",
          url: "https://pbs.twimg.com/amplify_video_thumb/1/img/poster.jpg",
          width: 1080,
          height: 1080,
        },
      ],
    });
  });

  it("flags long posts, maps gifs and photos, and falls back to reply_count", () => {
    const snapshot = toXPostSnapshot({
      id_str: "1",
      text: "long post",
      user,
      note_tweet: { id: "Tm90ZVR3ZWV0" },
      reply_count: 3,
      mediaDetails: [
        { type: "photo", media_url_https: "https://pbs.twimg.com/media/a.jpg" },
        { type: "animated_gif", media_url_https: "https://pbs.twimg.com/tweet_video_thumb/b.jpg" },
        { type: "unknown", media_url_https: "https://pbs.twimg.com/c.jpg" },
      ],
    });

    expect(snapshot?.isTruncated).toBe(true);
    expect(snapshot?.replyCount).toBe(3);
    expect(snapshot?.likeCount).toBe(0);
    expect(snapshot?.media).toEqual([
      { type: "photo", url: "https://pbs.twimg.com/media/a.jpg" },
      { type: "gif", url: "https://pbs.twimg.com/tweet_video_thumb/b.jpg" },
    ]);
  });

  it.each([
    ["undefined", undefined],
    ["a tombstone", { __typename: "TweetTombstone", tombstone: {} } as SyndicationPost],
    ["a post without an author", { id_str: "1", text: "hi" }],
  ])("returns null for %s", (_label, post) => {
    expect(toXPostSnapshot(post)).toBeNull();
  });
});
