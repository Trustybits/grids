import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import {
  ContentType,
  type XPostContent,
  type XPostSnapshot,
} from "@grids/contracts/types";
import XPostContentComponent from "@/components/tilecontent/XPostContent.vue";
import { FEATURE_FLAGS, useFeatureFlags } from "@/composables/useFeatureFlags";

const flags = useFeatureFlags();

const holder = vi.hoisted(() => ({
  gridView: null as Record<string, unknown> | null,
  callFunction: vi.fn(),
}));

vi.mock("@/grid-context/useGridViewContext", () => ({
  useGridViewContext: () => holder.gridView,
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getCloudFunctionsService: () => ({ callFunction: holder.callFunction }),
  }),
}));

vi.mock("@/stores/theme", () => ({
  useThemeStore: () => ({ isDarkMode: true }),
}));

const snapshot: XPostSnapshot = {
  postId: "123",
  postUrl: "https://x.com/ann/status/123",
  author: {
    name: "Ann",
    screenName: "ann",
    avatarUrl: "https://pbs.twimg.com/a_400x400.jpg",
    isVerified: true,
  },
  text: "Hi <b>@bob</b>",
  textSegments: [
    { kind: "text", text: "Hi <b>" },
    { kind: "mention", text: "@bob", href: "https://x.com/bob" },
    { kind: "text", text: "</b>" },
  ],
  isTruncated: false,
  createdAt: "2026-07-15T12:00:00.000Z",
  likeCount: 1200,
  replyCount: 4,
  media: [
    {
      type: "video",
      url: "https://pbs.twimg.com/poster.jpg",
      width: 1280,
      height: 720,
    },
  ],
};

function makeContent(overrides: Partial<XPostContent> = {}): XPostContent {
  return {
    type: ContentType.X_POST,
    postId: "123",
    postUrl: "https://x.com/ann/status/123",
    ...overrides,
  };
}

function storedContent(overrides: Partial<XPostContent> = {}): XPostContent {
  return makeContent({ post: snapshot, fetchedAt: Date.now(), ...overrides });
}

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

function mountPost(content: XPostContent) {
  return mount(XPostContentComponent, {
    props: { content },
    global: { provide: { tileId: "tile-1" } },
  });
}

describe("XPostContent", () => {
  beforeEach(() => {
    holder.callFunction.mockReset();
    holder.gridView = reactive({
      canEdit: true,
      patchTileContentSilently: vi.fn(),
    });
    flags.override(FEATURE_FLAGS.SOCIAL_X_FEEDS, false);
  });

  afterEach(() => flags.resetOverrides());

  it("fetches a missing post for editors and stores it without an undo step", async () => {
    holder.callFunction.mockResolvedValue({ post: snapshot, fetchedAt: 1 });
    mountPost(makeContent());
    await flushPromises();

    expect(holder.callFunction).toHaveBeenCalledWith("getXPostMetadata", {
      postId: "123",
    });
    expect(holder.gridView?.patchTileContentSilently).toHaveBeenCalledWith(
      "tile-1",
      { post: snapshot, fetchedAt: 1, unavailable: false },
    );
  });

  it("does not fill in a missing post for viewers and links out instead", async () => {
    holder.gridView = reactive({
      canEdit: false,
      patchTileContentSilently: vi.fn(),
    });
    const wrapper = mountPost(makeContent());
    await flushPromises();

    expect(holder.callFunction).not.toHaveBeenCalled();
    expect(wrapper.find("a").attributes("href")).toBe(
      "https://x.com/ann/status/123",
    );
  });

  it("does not refetch a post that is still fresh", async () => {
    mountPost(storedContent());
    await flushPromises();
    expect(holder.callFunction).not.toHaveBeenCalled();
  });

  it("refreshes a stale post for editors and saves it to the grid", async () => {
    const updated = { post: { ...snapshot, likeCount: 5000 }, fetchedAt: Date.now() };
    holder.callFunction.mockResolvedValue(updated);
    mountPost(storedContent({ fetchedAt: Date.now() - EIGHT_DAYS_MS }));
    await flushPromises();

    expect(holder.gridView?.patchTileContentSilently).toHaveBeenCalledWith(
      "tile-1",
      { ...updated, unavailable: false },
    );
  });

  it("refreshes a stale post for viewers in place, without writing to the grid", async () => {
    holder.gridView = reactive({ canEdit: false, patchTileContentSilently: vi.fn() });
    holder.callFunction.mockResolvedValue({
      post: { ...snapshot, textSegments: [{ kind: "text", text: "Edited" }] },
      fetchedAt: Date.now(),
    });
    const wrapper = mountPost(storedContent({ fetchedAt: Date.now() - EIGHT_DAYS_MS }));
    await flushPromises();

    expect(wrapper.find(".x-post-text").text()).toBe("Edited");
    expect(holder.gridView.patchTileContentSilently).not.toHaveBeenCalled();
  });

  it("keeps the stored post when a refresh fails or returns older data", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const stale = Date.now() - EIGHT_DAYS_MS;
    holder.callFunction.mockRejectedValueOnce(new Error("boom"));
    const failed = mountPost(storedContent({ fetchedAt: stale }));
    holder.callFunction.mockResolvedValueOnce({ post: snapshot, fetchedAt: stale - 1 });
    mountPost(storedContent({ fetchedAt: stale }));
    await flushPromises();

    expect(holder.callFunction).toHaveBeenCalledTimes(2);
    expect(holder.gridView?.patchTileContentSilently).not.toHaveBeenCalled();
    expect(failed.text()).not.toContain("Couldn't load this post.");
  });

  describe("replies", () => {
    const reply: XPostSnapshot = {
      ...snapshot,
      postId: "456",
      postUrl: "https://x.com/bob/status/456",
      author: { ...snapshot.author, name: "Bob", screenName: "bob" },
      text: "Nice",
      textSegments: [{ kind: "text", text: "Nice" }],
      replyCount: 0,
      media: [],
    };

    beforeEach(() => flags.override(FEATURE_FLAGS.SOCIAL_X_FEEDS, true));

    it("fetches replies for a stored post and stores them without an undo step", async () => {
      holder.callFunction.mockResolvedValue({ replies: [reply], fetchedAt: 5 });
      mountPost(storedContent());
      await flushPromises();

      expect(holder.callFunction).toHaveBeenCalledWith("getXPostReplies", {
        postId: "123",
        screenName: "ann",
      });
      expect(holder.gridView?.patchTileContentSilently).toHaveBeenCalledWith(
        "tile-1",
        { replies: [reply], repliesFetchedAt: 5 },
      );
    });

    it("skips the fetch when X feeds are off, replies are fresh, or there are none", async () => {
      flags.override(FEATURE_FLAGS.SOCIAL_X_FEEDS, false);
      mountPost(storedContent());
      flags.override(FEATURE_FLAGS.SOCIAL_X_FEEDS, true);
      mountPost(storedContent({ repliesFetchedAt: Date.now() }));
      mountPost(storedContent({ post: { ...snapshot, replyCount: 0 } }));
      await flushPromises();

      expect(holder.callFunction).not.toHaveBeenCalled();
    });

    it("refetches stale replies", async () => {
      holder.callFunction.mockResolvedValue({ replies: [], fetchedAt: 9 });
      mountPost(storedContent({ repliesFetchedAt: 1 }));
      await flushPromises();
      expect(holder.callFunction).toHaveBeenCalledWith(
        "getXPostReplies",
        expect.anything(),
      );
    });

    it("shows refreshed replies to viewers without writing to the grid", async () => {
      holder.gridView = reactive({ canEdit: false, patchTileContentSilently: vi.fn() });
      holder.callFunction.mockResolvedValue({ replies: [reply], fetchedAt: Date.now() });
      const wrapper = mountPost(storedContent());
      await flushPromises();

      expect(wrapper.findAll(".x-post-replies .x-feed-item")).toHaveLength(1);
      expect(holder.gridView.patchTileContentSilently).not.toHaveBeenCalled();
    });

    it("lists stored replies in a scroll area and plays reply videos", async () => {
      const videoReply = { ...reply, media: snapshot.media };
      const wrapper = mountPost(
        storedContent({
          replies: [videoReply],
          repliesFetchedAt: Date.now(),
        }),
      );

      const thread = wrapper.find(".x-post-scroll");
      expect(thread.findAll(".x-post-card")).toHaveLength(2);
      const list = thread.find(".x-post-replies");
      expect(list.findAll(".x-feed-item")).toHaveLength(1);
      expect(list.find(".x-post-name").text()).toBe("Bob");

      await list.find(".x-post-play").trigger("click");
      expect(wrapper.find("iframe").attributes("src")).toContain("id=456");
    });
  });

  it("renders post text as text, never as HTML", () => {
    const wrapper = mountPost(storedContent());
    const text = wrapper.find(".x-post-text");

    expect(text.text()).toBe("Hi <b>@bob</b>");
    expect(text.find("b").exists()).toBe(false);
    expect(text.find(".x-post-mention").attributes("href")).toBe(
      "https://x.com/bob",
    );
  });

  it("swaps the video poster for X's player when play is pressed", async () => {
    const wrapper = mountPost(storedContent());
    expect(wrapper.find("iframe").exists()).toBe(false);

    await wrapper.find(".x-post-play").trigger("click");
    const src = wrapper.find("iframe").attributes("src");
    expect(src).toContain("https://platform.twitter.com/embed/Tweet.html?");
    expect(src).toContain("id=123");
    expect(src).toContain("theme=dark");

    await wrapper.find(".x-post-player-close").trigger("click");
    expect(wrapper.find("iframe").exists()).toBe(false);
  });

  it("shows a retry when the fetch fails", async () => {
    holder.callFunction.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapper = mountPost(makeContent());
    await flushPromises();

    expect(wrapper.text()).toContain("Couldn't load this post.");
    holder.callFunction.mockResolvedValueOnce({ post: snapshot, fetchedAt: 2 });
    await wrapper.find(".x-post-retry").trigger("click");
    await flushPromises();
    expect(holder.callFunction).toHaveBeenCalledTimes(2);
  });

  it("shows the unavailable state for deleted posts", () => {
    const wrapper = mountPost(makeContent({ unavailable: true, fetchedAt: Date.now() }));
    expect(wrapper.text()).toContain("This post is unavailable.");
  });
});
