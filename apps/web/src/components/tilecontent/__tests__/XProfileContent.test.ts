import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import {
  ContentType,
  type XPostSnapshot,
  type XProfileContent,
  type XProfileSnapshot,
} from "@grids/contracts/types";
import XProfileContentComponent from "@/components/tilecontent/XProfileContent.vue";
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
  useThemeStore: () => ({ isDarkMode: false }),
}));

const profile: XProfileSnapshot = {
  screenName: "ann",
  name: "Ann",
  profileUrl: "https://x.com/ann",
  avatarUrl: "https://pbs.twimg.com/a_400x400.jpg",
  isVerified: false,
  bioSegments: [
    { kind: "text", text: "Designer at " },
    { kind: "link", text: "ann.design", href: "https://ann.design" },
  ],
  followersCount: 14240,
  followingCount: 1011,
};

function post(postId: string, overrides: Partial<XPostSnapshot> = {}): XPostSnapshot {
  return {
    postId,
    postUrl: `https://x.com/ann/status/${postId}`,
    author: { name: "Ann", screenName: "ann", avatarUrl: "", isVerified: false },
    text: `post ${postId}`,
    textSegments: [{ kind: "text", text: `post ${postId}` }],
    isTruncated: false,
    createdAt: "2026-07-15T12:00:00.000Z",
    likeCount: 0,
    replyCount: 0,
    media: [],
    ...overrides,
  };
}

function makeContent(overrides: Partial<XProfileContent> = {}): XProfileContent {
  return {
    type: ContentType.X_PROFILE,
    screenName: "ann",
    profileUrl: "https://x.com/ann",
    ...overrides,
  };
}

function mountProfile(content: XProfileContent) {
  return mount(XProfileContentComponent, {
    props: { content },
    global: { provide: { tileId: "tile-1" } },
  });
}

describe("XProfileContent", () => {
  beforeEach(() => {
    holder.callFunction.mockReset();
    holder.gridView = reactive({
      canEdit: true,
      patchTileContentSilently: vi.fn(),
    });
    flags.override(FEATURE_FLAGS.SOCIAL_X_FEEDS, true);
  });

  afterEach(() => flags.resetOverrides());

  it("fetches a missing feed for editors and stores it without an undo step", async () => {
    const response = { profile, posts: [post("1")], fetchedAt: 1 };
    holder.callFunction.mockResolvedValue(response);
    mountProfile(makeContent());
    await flushPromises();

    expect(holder.callFunction).toHaveBeenCalledWith("getXProfileFeed", {
      screenName: "ann",
    });
    expect(holder.gridView?.patchTileContentSilently).toHaveBeenCalledWith(
      "tile-1",
      { ...response, pinnedPostId: "", unavailable: false },
    );
  });

  it("refreshes a stale feed for viewers in place, without writing to the grid", async () => {
    holder.gridView = reactive({ canEdit: false, patchTileContentSilently: vi.fn() });
    holder.callFunction.mockResolvedValue({
      profile: { ...profile, name: "Ann Renamed" },
      posts: [post("1")],
      fetchedAt: Date.now(),
    });
    const wrapper = mountProfile(makeContent({ profile, posts: [], fetchedAt: 1 }));
    await flushPromises();

    expect(wrapper.find(".x-profile-name").text()).toBe("Ann Renamed");
    expect(holder.gridView.patchTileContentSilently).not.toHaveBeenCalled();
  });

  it("does not fill in a missing feed for viewers, or fetch when X feeds are off or the feed is fresh", async () => {
    holder.gridView = reactive({ canEdit: false, patchTileContentSilently: vi.fn() });
    mountProfile(makeContent());

    holder.gridView = reactive({ canEdit: true, patchTileContentSilently: vi.fn() });
    mountProfile(makeContent({ profile, posts: [], fetchedAt: Date.now() }));

    flags.override(FEATURE_FLAGS.SOCIAL_X_FEEDS, false);
    mountProfile(makeContent());
    await flushPromises();

    expect(holder.callFunction).not.toHaveBeenCalled();
  });

  it("refreshes a stale feed but keeps showing it when the refresh fails", async () => {
    holder.callFunction.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const wrapper = mountProfile(
      makeContent({ profile, posts: [post("1")], fetchedAt: 1 }),
    );
    await flushPromises();

    expect(holder.callFunction).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".x-profile-name").text()).toBe("Ann");
    expect(wrapper.text()).not.toContain("Couldn't load this profile.");
  });

  it("renders the header, bio links as text, and the feed with the pinned post marked", () => {
    const wrapper = mountProfile(
      makeContent({
        profile,
        posts: [post("1"), post("2")],
        pinnedPostId: "1",
        fetchedAt: Date.now(),
      }),
    );

    expect(wrapper.find(".x-profile-handle").text()).toBe("@ann");
    expect(wrapper.find(".x-profile-bio .x-profile-link").attributes("href")).toBe(
      "https://ann.design",
    );
    expect(wrapper.find(".x-profile-counts").text()).toContain("Followers");

    const items = wrapper.findAll(".x-feed-scroll .x-feed-item");
    expect(items).toHaveLength(3);
    expect(items[0].find(".x-feed-pinned").exists()).toBe(true);
    expect(items[1].find(".x-feed-pinned").exists()).toBe(false);
    expect(items[2].find("a").attributes("href")).toBe("https://x.com/ann");
  });

  it("plays a feed video in X's player", async () => {
    const wrapper = mountProfile(
      makeContent({
        profile,
        posts: [post("7", { media: [{ type: "video", url: "p.jpg", width: 1, height: 1 }] })],
        fetchedAt: Date.now(),
      }),
    );

    await wrapper.find(".x-post-play").trigger("click");
    const src = wrapper.find("iframe").attributes("src");
    expect(src).toContain("id=7");
    expect(src).toContain("theme=light");

    await wrapper.find(".x-profile-player-close").trigger("click");
    expect(wrapper.find("iframe").exists()).toBe(false);
  });

  it("shows a retry when the first fetch fails", async () => {
    holder.callFunction.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const wrapper = mountProfile(makeContent());
    await flushPromises();

    expect(wrapper.text()).toContain("Couldn't load this profile.");
    holder.callFunction.mockResolvedValueOnce({ unavailable: true, fetchedAt: 2 });
    await wrapper.find(".x-profile-retry").trigger("click");
    await flushPromises();
    expect(holder.callFunction).toHaveBeenCalledTimes(2);
  });

  it("shows the unavailable state, even over a previously stored profile", () => {
    const wrapper = mountProfile(
      makeContent({ profile, unavailable: true, fetchedAt: Date.now() }),
    );
    expect(wrapper.text()).toContain("This account is unavailable.");
    expect(wrapper.find(".x-profile-header").exists()).toBe(false);
  });
});
