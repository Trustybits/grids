<template>
  <div class="x-post" :class="{ 'x-post--compact': isCompact }">
    <template v-if="playingPostId">
      <iframe
        class="x-post-player"
        :src="playerSrc"
        title="X post player"
        frameborder="no"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowfullscreen="true"
      />
      <button
        class="x-post-player-close"
        aria-label="Close player"
        @mousedown.stop
        @click.stop="playingPostId = null"
      >
        &times;
      </button>
    </template>

    <div
      v-else-if="post"
      ref="scrollArea"
      class="x-post-scroll"
      :class="{ 'x-feed-scroll': isOverflowing }"
      :style="{ '--x-feed-gutter': `${scrollGutter}px` }"
    >
      <div class="x-post-thread">
        <XPostCard
          :post="post"
          :quoted-post="quotedPost"
          :compact="isCompact"
          :show-media="showMedia"
          :show-quote="showQuote"
          feed
          @play="playingPostId = $event"
        />
        <ol v-if="showReplies" class="x-post-replies" aria-label="Replies">
          <li v-for="reply in replies" :key="reply.postId" class="x-feed-item">
            <XPostCard
              :post="reply"
              :quoted-post="reply.quoted"
              feed
              @play="playingPostId = $event"
            />
          </li>
        </ol>
      </div>
    </div>

    <div v-else class="x-post-status">
      <p v-if="isLoading">Loading post…</p>
      <p v-else-if="tile.unavailable">This post is unavailable.</p>
      <p v-else-if="hasError">Couldn't load this post.</p>
      <button
        v-if="hasError && canEdit"
        class="x-post-retry"
        @mousedown.stop
        @click.stop="fetchPost"
      >
        Retry
      </button>
      <a
        v-if="!isLoading && tile.postUrl"
        :href="tile.postUrl"
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
import {
  xPostRefreshAfterMs,
  type XPostContent,
  type XPostMetadataResponse,
  type XPostRepliesResponse,
} from "@grids/contracts/types";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { useThemeStore } from "@/stores/theme";
import { FEATURE_FLAGS, useFeatureFlags } from "@/composables/useFeatureFlags";
import { useRefreshedTileContent } from "@/composables/useRefreshedTileContent";
import { useScrollArea } from "@/composables/useScrollArea";
import { xPlayerSrc } from "@/utils/xPostDisplay";
import XPostCard from "./XPostCard.vue";

export default defineComponent({
  components: { XPostCard },
  props: {
    content: {
      type: Object as () => XPostContent,
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
    const scrollArea = ref<HTMLElement | null>(null);
    const { gutter: scrollGutter, isOverflowing } = useScrollArea(scrollArea);
    const { content: tile, applyRefresh } = useRefreshedTileContent(
      () => props.content,
      tileId,
    );
    let repliesLoading = false;

    const canEdit = computed(() => gridView.canEdit);
    const w = computed(() => gridTileW?.value ?? 4);
    const h = computed(() => gridTileH?.value ?? 4);
    const isCompact = computed(() => w.value <= 2 && h.value <= 2);

    const post = computed(() => tile.value.post);
    const quotedPost = computed(() => tile.value.quotedPost);
    const replies = computed(() => tile.value.replies ?? []);
    const showReplies = computed(
      () => !isCompact.value && replies.value.length > 0,
    );
    const showMedia = computed(() => h.value >= 3);
    const showQuote = computed(() => h.value >= 4);

    const playerSrc = computed(() =>
      xPlayerSrc(playingPostId.value ?? "", themeStore.isDarkMode),
    );

    const callFunction = <TRequest, TResponse>(name: string, data: TRequest) =>
      getServiceFactory()
        .getCloudFunctionsService()
        .callFunction<TRequest, TResponse | null>(name, data);

    const isDue = (fetchedAt: number | undefined) =>
      !fetchedAt ||
      Date.now() - fetchedAt >= xPostRefreshAfterMs(tile.value.postId, Date.now());

    const fetchPost = async () => {
      if (!tileId || !tile.value.postId) return;

      const hasStored = !!tile.value.post || !!tile.value.unavailable;
      isLoading.value = !hasStored;
      hasError.value = false;
      try {
        const data = await callFunction<{ postId: string }, XPostMetadataResponse>(
          "getXPostMetadata",
          { postId: tile.value.postId },
        );
        if (!data) throw new Error("getXPostMetadata returned no data");

        if (data.fetchedAt > (tile.value.fetchedAt ?? 0)) {
          applyRefresh("post" in data ? { ...data, unavailable: false } : data);
        }
      } catch (error) {
        if (hasStored) {
          console.warn("Failed to refresh X post:", error);
        } else {
          console.error("Failed to fetch X post:", error);
          hasError.value = true;
        }
      } finally {
        isLoading.value = false;
      }
    };

    const fetchRepliesIfDue = async () => {
      const current = tile.value.post;
      if (!tileId || !current || current.replyCount === 0) return;
      if (repliesLoading || !isEnabled(FEATURE_FLAGS.SOCIAL_X_FEEDS)) return;
      const lastFetched = tile.value.repliesFetchedAt;
      if (!isDue(lastFetched)) return;

      repliesLoading = true;
      try {
        const data = await callFunction<
          { postId: string; screenName: string },
          XPostRepliesResponse
        >("getXPostReplies", {
          postId: current.postId,
          screenName: current.author.screenName,
        });
        if (data && Array.isArray(data.replies) && data.fetchedAt > (lastFetched ?? 0)) {
          applyRefresh({ replies: data.replies, repliesFetchedAt: data.fetchedAt });
        }
      } catch (error) {
        console.warn("Failed to fetch X replies:", error);
      } finally {
        repliesLoading = false;
      }
    };

    // Only editors fill in a missing post; anyone viewing refreshes stored data.
    const fetchIfDue = () => {
      const { post: stored, unavailable, fetchedAt } = tile.value;
      if (stored || unavailable) {
        if (isDue(fetchedAt)) void fetchPost();
      } else if (canEdit.value) {
        void fetchPost();
      }
    };

    watch(
      () => props.content.postId,
      () => {
        playingPostId.value = null;
        fetchIfDue();
      },
    );
    watch(() => tile.value.post?.postId, () => void fetchRepliesIfDue());

    onMounted(() => {
      fetchIfDue();
      void fetchRepliesIfDue();
    });

    return {
      tile,
      isLoading,
      hasError,
      playingPostId,
      scrollArea,
      scrollGutter,
      isOverflowing,
      canEdit,
      isCompact,
      showMedia,
      showQuote,
      showReplies,
      post,
      quotedPost,
      replies,
      playerSrc,
      fetchPost,
    };
  },
});
</script>

<style scoped lang="scss">
.x-post {
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

// The scrollbar gutter sits in the tile's right padding, so the post lines up
// with the tile's left edge spacing.
.x-post-scroll {
  flex: 1 1 0;
  min-height: 0;
  margin-right: calc(-1 * var(--x-feed-gutter, 0px));
  overflow-y: auto;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
}

// Only while the thread overflows: scrolling owns the vertical swipe, and the
// grid's drag-ignore list skips `.x-feed-scroll` so the swipe can't move the
// tile. A post that fits stays draggable from anywhere.
.x-post-scroll.x-feed-scroll {
  overscroll-behavior: auto;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
}

.x-post:hover .x-post-scroll {
  scrollbar-color: var(--color-border) transparent;
}

.x-post-replies {
  margin: var(--spacing-sm) 0 0;
  padding: 0;
  list-style: none;
}

.x-feed-item {
  padding: var(--spacing-sm) 0;
  border-top: 1px solid var(--x-post-hairline);
}

.x-post-status {
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

.x-post-retry {
  padding: 4px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--x-post-hairline);
  color: var(--tile-text-color);
  cursor: pointer;
}

.x-post-player {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

.x-post-player-close {
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
