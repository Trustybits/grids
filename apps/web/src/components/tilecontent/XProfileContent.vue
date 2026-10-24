<template>
  <div class="x-profile" :class="{ 'x-profile--compact': isCompact }">
    <template v-if="playingPostId">
      <iframe
        class="x-profile-player"
        :src="playerSrc"
        title="X post player"
        frameborder="no"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowfullscreen="true"
      />
      <button
        class="x-profile-player-close"
        aria-label="Close player"
        @mousedown.stop
        @click.stop="playingPostId = null"
      >
        &times;
      </button>
    </template>

    <template v-else-if="profile && !content.unavailable">
      <header class="x-profile-header">
        <img
          v-if="showBanner && profile.bannerUrl"
          class="x-profile-banner"
          :src="profile.bannerUrl"
          alt=""
        />
        <div class="x-profile-identity">
          <a
            class="x-profile-author"
            :href="profile.profileUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              v-if="profile.avatarUrl"
              class="x-profile-avatar"
              :src="profile.avatarUrl"
              alt=""
            />
            <span class="x-profile-names">
              <span class="x-profile-name">
                {{ profile.name }}
                <svg
                  v-if="profile.isVerified"
                  class="x-profile-verified"
                  viewBox="0 0 24 24"
                  aria-label="Verified account"
                >
                  <path :d="X_VERIFIED_PATH" />
                </svg>
              </span>
              <span class="x-profile-handle">@{{ profile.screenName }}</span>
            </span>
          </a>
          <a
            class="x-profile-logo"
            :href="profile.profileUrl"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on X"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path :d="X_LOGO_PATH" />
            </svg>
          </a>
        </div>
        <p v-if="!isCompact && profile.bioSegments?.length" class="x-profile-bio">
          <template v-for="(segment, index) in profile.bioSegments" :key="index">
            <a
              v-if="segment.href"
              :class="`x-profile-${segment.kind}`"
              :href="segment.href"
              target="_blank"
              rel="noopener noreferrer"
              >{{ segment.text }}</a
            >
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>
        <p v-if="!isCompact && hasCounts" class="x-profile-counts">
          <span v-if="profile.followingCount !== undefined">
            <strong>{{ formatXCount(profile.followingCount) }}</strong> Following
          </span>
          <span v-if="profile.followersCount !== undefined">
            <strong>{{ formatXCount(profile.followersCount) }}</strong> Followers
          </span>
        </p>
      </header>

      <ol
        v-if="showFeed"
        ref="feedList"
        class="x-feed-scroll x-profile-feed"
        :style="{ '--x-feed-gutter': `${feedGutter}px` }"
        aria-label="Posts"
      >
        <li v-for="post in posts" :key="post.postId" class="x-feed-item">
          <p v-if="post.postId === content.pinnedPostId" class="x-feed-pinned">
            Pinned
          </p>
          <XPostCard
            :post="post"
            :quoted-post="post.quoted"
            feed
            @play="playingPostId = $event"
          />
        </li>
        <li class="x-feed-item x-feed-more">
          <a :href="profile.profileUrl" target="_blank" rel="noopener noreferrer"
            >View more on X</a
          >
        </li>
      </ol>
    </template>

    <div v-else class="x-profile-status">
      <p v-if="isLoading">Loading profile…</p>
      <p v-else-if="content.unavailable">This account is unavailable.</p>
      <p v-else-if="hasError">Couldn't load this profile.</p>
      <button
        v-if="hasError && canEdit"
        class="x-profile-retry"
        @mousedown.stop
        @click.stop="fetchFeed"
      >
        Retry
      </button>
      <a
        v-if="!isLoading && content.profileUrl"
        :href="content.profileUrl"
        target="_blank"
        rel="noopener noreferrer"
        >View on X</a
      >
    </div>
  </div>
</template>

<script lang="ts">
import {
  proxyRefs,
  computed,
  defineComponent,
  inject,
  onMounted,
  ref,
  watch,
  type ComputedRef,
} from "vue";
import type {
  XProfileContent,
  XProfileFeedResponse,
} from "@grids/contracts/types";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useThemeStore } from "@/stores/theme";
import { FEATURE_FLAGS, useFeatureFlags } from "@/composables/useFeatureFlags";
import { useScrollArea } from "@/composables/useScrollArea";
import {
  X_LOGO_PATH,
  X_STALE_AFTER_MS,
  X_VERIFIED_PATH,
  formatXCount,
  xPlayerSrc,
} from "@/utils/xPostDisplay";
import XPostCard from "./XPostCard.vue";

export default defineComponent({
  components: { XPostCard },
  props: {
    content: {
      type: Object as () => XProfileContent,
      required: true,
    },
  },
  setup(props) {
    const gridView = proxyRefs(useGridViewContext());
    const themeStore = useThemeStore();
    const { isEnabled } = useFeatureFlags();
    const tileId = inject<string | null>("tileId", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);

    const isLoading = ref(false);
    const hasError = ref(false);
    const playingPostId = ref<string | null>(null);
    const feedList = ref<HTMLElement | null>(null);
    const { gutter: feedGutter } = useScrollArea(feedList);

    const canEdit = computed(() => gridView.canEdit);
    const w = computed(() => gridTileW?.value ?? 4);
    const h = computed(() => gridTileH?.value ?? 4);
    const isCompact = computed(() => w.value <= 2 && h.value <= 2);

    const profile = computed(() => props.content.profile);
    const posts = computed(() => props.content.posts ?? []);
    const showBanner = computed(() => w.value >= 3 && h.value >= 4);
    const showFeed = computed(
      () => !isCompact.value && h.value >= 3 && posts.value.length > 0,
    );
    const hasCounts = computed(
      () =>
        profile.value?.followersCount !== undefined ||
        profile.value?.followingCount !== undefined,
    );
    const playerSrc = computed(() =>
      xPlayerSrc(playingPostId.value ?? "", themeStore.isDarkMode),
    );

    const fetchFeed = async () => {
      if (!canEdit.value || !tileId || !props.content.screenName) return;
      if (!isEnabled(FEATURE_FLAGS.SOCIAL_X_FEEDS)) return;

      const hasStoredFeed = !!props.content.profile;
      isLoading.value = !hasStoredFeed;
      hasError.value = false;
      try {
        const data = await getServiceFactory()
          .getCloudFunctionsService()
          .callFunction<{ screenName: string }, XProfileFeedResponse | null>(
            "getXProfileFeed",
            { screenName: props.content.screenName },
          );
        if (!data) throw new Error("getXProfileFeed returned no data");

        gridView.patchTileContentSilently(
          tileId,
          "profile" in data
            ? { ...data, pinnedPostId: data.pinnedPostId ?? "", unavailable: false }
            : data,
        );
      } catch (error) {
        if (hasStoredFeed) {
          console.warn("Failed to refresh X profile:", error);
        } else {
          console.error("Failed to fetch X profile:", error);
          hasError.value = true;
        }
      } finally {
        isLoading.value = false;
      }
    };

    const fetchIfDue = () => {
      const { profile: stored, unavailable, fetchedAt } = props.content;
      const isStale = !fetchedAt || Date.now() - fetchedAt >= X_STALE_AFTER_MS;
      if ((!stored && !unavailable) || isStale) void fetchFeed();
    };

    watch(
      () => props.content.screenName,
      () => {
        playingPostId.value = null;
        fetchIfDue();
      },
    );

    onMounted(fetchIfDue);

    return {
      isLoading,
      hasError,
      playingPostId,
      feedList,
      feedGutter,
      canEdit,
      isCompact,
      profile,
      posts,
      showBanner,
      showFeed,
      hasCounts,
      playerSrc,
      fetchFeed,
      formatXCount,
      X_LOGO_PATH,
      X_VERIFIED_PATH,
    };
  },
});
</script>

<style scoped lang="scss">
.x-profile {
  --x-post-subdued: color-mix(in srgb, var(--tile-text-color) 60%, transparent);
  --x-post-hairline: color-mix(in srgb, var(--tile-text-color) 16%, transparent);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  overflow: hidden;
  color: var(--tile-text-color);
  font-family: var(--font-family-base);
}

.x-profile-header {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.x-profile-banner {
  display: block;
  width: 100%;
  height: 64px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

.x-profile-identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.x-profile-author {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.x-profile-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  object-fit: cover;
  flex-shrink: 0;
}

.x-profile-names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.x-profile-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.x-profile-verified {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: currentColor;
}

.x-profile-handle {
  color: var(--x-post-subdued);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.x-profile-logo {
  display: flex;
  color: inherit;
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
}

.x-profile-bio {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;

  a {
    color: inherit;
    font-weight: 600;
    text-decoration: none;
  }
}

.x-profile-counts {
  display: flex;
  gap: var(--spacing-md);
  margin: 0;
  color: var(--x-post-subdued);
  font-size: 13px;

  strong {
    color: var(--tile-text-color);
  }
}

// The scrollbar gutter sits in the tile's right padding, so the list's
// content lines up with the header above it.
.x-feed-scroll {
  flex: 1 1 0;
  min-height: 0;
  margin: 0 calc(-1 * var(--x-feed-gutter, 0px)) 0 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  overscroll-behavior: auto;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
}

.x-profile:hover .x-feed-scroll {
  scrollbar-color: var(--color-border) transparent;
}

.x-feed-item {
  padding: var(--spacing-sm) 0;
  border-top: 1px solid var(--x-post-hairline);
}

.x-feed-pinned {
  margin: 0 0 4px;
  color: var(--x-post-subdued);
  font-size: 12px;
  font-weight: 600;
}

.x-feed-more {
  text-align: center;

  a {
    color: var(--tile-text-color);
  }
}

.x-profile-status {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  text-align: center;
  color: var(--x-post-subdued);

  p {
    margin: 0;
  }

  a {
    color: var(--tile-text-color);
  }
}

.x-profile-retry {
  padding: 4px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--x-post-hairline);
  color: var(--tile-text-color);
  cursor: pointer;
}

.x-profile-player {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.x-profile-player-close {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  z-index: 1;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--color-black-55);
  color: var(--color-white-100);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
</style>
