/**
 * Tests for useBadges — subscribes to a user's badges and exposes a reactive
 * view model (earned list, hasBadge, loading state).
 *
 * The BadgeService is mocked so we can feed badge payloads through the
 * subscribe callback. Tests mount a host component so the composable's watch
 * (immediate) and onUnmounted teardown run as they would in a real component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { defineComponent, h, ref, type Ref } from "vue";
import { mount } from "@vue/test-utils";
import { useBadges, BADGE_META, type UseBadgesReturn } from "@/composables/useBadges";
import type { UserBadges } from "@grids/contracts/types";

const { mockSubscribeToBadges, mockUnsub } = vi.hoisted(() => ({
  mockSubscribeToBadges: vi.fn(),
  mockUnsub: vi.fn(),
}));

vi.mock("@/services/ServiceFactorySingleton", () => ({
  getServiceFactory: () => ({
    getBadgeService: () => ({ subscribeToBadges: mockSubscribeToBadges }),
  }),
}));

let badgesCb: ((badges: UserBadges | null | undefined) => void) | null = null;

beforeEach(() => {
  badgesCb = null;
  mockSubscribeToBadges.mockReset();
  mockUnsub.mockReset();
  mockSubscribeToBadges.mockImplementation((_uid, cb) => {
    badgesCb = cb;
    return mockUnsub;
  });
});

/** Mount a host that runs useBadges with the given userId source. */
function mountBadges(userId: string | null | Ref<string | null | undefined>) {
  let api: UseBadgesReturn;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useBadges(userId);
        return () => h("div");
      },
    }),
  );
  return { wrapper, api: api! };
}

describe("subscription lifecycle", () => {
  it("subscribes immediately for a static userId", () => {
    mountBadges("uid-1");
    expect(mockSubscribeToBadges).toHaveBeenCalledWith(
      "uid-1",
      expect.any(Function),
    );
  });

  it("does not subscribe when userId is null and stops loading", () => {
    const { api } = mountBadges(null);
    expect(mockSubscribeToBadges).not.toHaveBeenCalled();
    expect(api.isLoading.value).toBe(false);
  });

  it("re-subscribes and tears down the old listener when userId changes", async () => {
    const userId = ref<string | null | undefined>("uid-1");
    mountBadges(userId);
    expect(mockSubscribeToBadges).toHaveBeenCalledTimes(1);

    userId.value = "uid-2";
    await Promise.resolve();

    expect(mockUnsub).toHaveBeenCalledTimes(1);
    expect(mockSubscribeToBadges).toHaveBeenCalledTimes(2);
    expect(mockSubscribeToBadges).toHaveBeenLastCalledWith(
      "uid-2",
      expect.any(Function),
    );
  });

  it("clears badges and stops loading when userId becomes null", async () => {
    const userId = ref<string | null | undefined>("uid-1");
    const { api } = mountBadges(userId);
    badgesCb?.({ earlyAdopter: { earnedAt: new Date() } });
    expect(api.earnedBadges.value).toHaveLength(1);

    userId.value = null;
    await Promise.resolve();

    expect(mockUnsub).toHaveBeenCalledTimes(1);
    expect(api.badges.value).toEqual({});
    expect(api.isLoading.value).toBe(false);
  });

  it("unsubscribes and stops the watcher on unmount", () => {
    const { wrapper } = mountBadges("uid-1");
    wrapper.unmount();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
  });
});

describe("badge view model", () => {
  it("starts in a loading state until the first payload arrives", () => {
    const { api } = mountBadges("uid-1");
    expect(api.isLoading.value).toBe(true);
    badgesCb?.({});
    expect(api.isLoading.value).toBe(false);
  });

  it("normalizes a null payload to an empty badge map", () => {
    const { api } = mountBadges("uid-1");
    badgesCb?.(null);
    expect(api.badges.value).toEqual({});
    expect(api.earnedBadges.value).toEqual([]);
  });

  it("builds earned badges with attached metadata", () => {
    const { api } = mountBadges("uid-1");
    badgesCb?.({ supporter: { earnedAt: new Date("2026-01-01") } });

    expect(api.earnedBadges.value).toHaveLength(1);
    const earned = api.earnedBadges.value[0];
    expect(earned.id).toBe("supporter");
    expect(earned.meta).toBe(BADGE_META.supporter);
    expect(earned.earnedAt).toEqual(new Date("2026-01-01"));
  });

  it("sorts earned badges most-recent first", () => {
    const { api } = mountBadges("uid-1");
    badgesCb?.({
      earlyAdopter: { earnedAt: new Date("2026-01-01") },
      supporter: { earnedAt: new Date("2026-05-01") },
    });

    const ids = api.earnedBadges.value.map((b) => b.id);
    expect(ids).toEqual(["supporter", "earlyAdopter"]);
  });

  it("omits badge ids that are absent from the payload", () => {
    const { api } = mountBadges("uid-1");
    badgesCb?.({ earlyAdopter: { earnedAt: new Date() } });

    const ids = api.earnedBadges.value.map((b) => b.id);
    expect(ids).toEqual(["earlyAdopter"]);
  });
});

describe("hasBadge", () => {
  it("returns true for a present badge and false otherwise", () => {
    const { api } = mountBadges("uid-1");
    badgesCb?.({ supporter: { earnedAt: new Date() } });

    expect(api.hasBadge("supporter")).toBe(true);
    expect(api.hasBadge("earlyAdopter")).toBe(false);
  });
});
