<template>
  <article class="x-post-card" :class="{ 'x-post-card--feed': feed }">
    <header class="x-post-header">
      <a
        class="x-post-author"
        :href="authorUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <img
          v-if="post.author.avatarUrl"
          class="x-post-avatar"
          :src="post.author.avatarUrl"
          alt=""
        />
        <span class="x-post-names">
          <span class="x-post-name">
            {{ post.author.name }}
            <svg
              v-if="post.author.isVerified"
              class="x-post-verified"
              viewBox="0 0 24 24"
              aria-label="Verified account"
            >
              <path :d="X_VERIFIED_PATH" />
            </svg>
          </span>
          <span class="x-post-handle">@{{ post.author.screenName }}</span>
        </span>
      </a>
      <a
        class="x-post-logo"
        :href="post.postUrl"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View on X"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path :d="X_LOGO_PATH" />
        </svg>
      </a>
    </header>

    <p class="x-post-text">
      <template v-for="(segment, index) in post.textSegments" :key="index">
        <a
          v-if="segment.href"
          :class="`x-post-${segment.kind}`"
          :href="segment.href"
          target="_blank"
          rel="noopener noreferrer"
          >{{ segment.text }}</a
        >
        <template v-else>{{ segment.text }}</template>
      </template>
      <a
        v-if="post.isTruncated"
        class="x-post-more"
        :href="post.postUrl"
        target="_blank"
        rel="noopener noreferrer"
        >Show more</a
      >
    </p>

    <div v-if="showMedia && leadMedia" class="x-post-media">
      <img :src="leadMedia.url" alt="" loading="lazy" />
      <button
        v-if="leadMedia.type !== 'photo'"
        class="x-post-play"
        aria-label="Play"
        @mousedown.stop
        @click.stop="$emit('play', post.postId)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      <span v-if="extraMediaCount > 0" class="x-post-media-count">
        +{{ extraMediaCount }}
      </span>
    </div>

    <a
      v-if="showQuote && quotedPost"
      class="x-post-quote"
      :href="quotedPost.postUrl"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="x-post-quote-author">
        {{ quotedPost.author.name }}
        <span class="x-post-handle">@{{ quotedPost.author.screenName }}</span>
      </span>
      <span class="x-post-quote-text">{{ quotedPost.text }}</span>
    </a>

    <footer v-if="!compact" class="x-post-footer">
      <time :datetime="post.createdAt">{{ formatXDate(post.createdAt) }}</time>
      <span>{{ formatXCount(post.likeCount) }} likes</span>
      <span>{{ formatXCount(post.replyCount) }} replies</span>
    </footer>
  </article>
</template>

<script lang="ts">
import { computed, defineComponent, type PropType } from "vue";
import type { XPostSnapshot } from "@grids/contracts/types";
import {
  X_LOGO_PATH,
  X_VERIFIED_PATH,
  formatXCount,
  formatXDate,
} from "@/utils/xPostDisplay";

export default defineComponent({
  props: {
    post: {
      type: Object as PropType<XPostSnapshot>,
      required: true,
    },
    quotedPost: {
      type: Object as PropType<XPostSnapshot>,
      default: undefined,
    },
    compact: { type: Boolean, default: false },
    showMedia: { type: Boolean, default: true },
    showQuote: { type: Boolean, default: true },
    /** Natural height inside a scrolling list, instead of filling the tile. */
    feed: { type: Boolean, default: false },
  },
  emits: {
    play: (postId: string) => typeof postId === "string",
  },
  setup(props) {
    const leadMedia = computed(() => props.post.media[0]);
    const extraMediaCount = computed(() =>
      Math.max(0, props.post.media.length - 1),
    );
    const authorUrl = computed(
      () => `https://x.com/${props.post.author.screenName}`,
    );

    return {
      leadMedia,
      extraMediaCount,
      authorUrl,
      formatXCount,
      formatXDate,
      X_LOGO_PATH,
      X_VERIFIED_PATH,
    };
  },
});
</script>

<style scoped lang="scss">
.x-post-card {
  --x-post-subdued: color-mix(in srgb, var(--tile-text-color) 60%, transparent);
  --x-post-hairline: color-mix(in srgb, var(--tile-text-color) 16%, transparent);

  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-height: 0;
}

.x-post-card--feed {
  flex: none;

  .x-post-text {
    flex: none;
    overflow: visible;
    mask-image: none;
  }

  .x-post-media {
    max-height: 240px;
  }
}

.x-post-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.x-post-author {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.x-post-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  object-fit: cover;
  flex-shrink: 0;
}

.x-post-names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.x-post-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.x-post-verified {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  fill: currentColor;
}

.x-post-handle {
  color: var(--x-post-subdued);
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.x-post-logo {
  display: flex;
  color: inherit;
  flex-shrink: 0;

  svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
}

.x-post-text {
  flex: 1 1 auto;
  min-height: 0;
  margin: 0;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.4;
  mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent);

  a {
    color: inherit;
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.x-post-more {
  margin-left: 4px;
}

.x-post-media {
  position: relative;
  flex: 0 1 auto;
  min-height: 0;
  max-height: 60%;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--x-post-hairline);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.x-post-play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-full);
  background: var(--color-black-55);
  color: var(--color-white-100);
  cursor: pointer;

  svg {
    width: 28px;
    height: 28px;
    fill: currentColor;
  }
}

.x-post-media-count {
  position: absolute;
  right: var(--spacing-sm);
  bottom: var(--spacing-sm);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-black-55);
  color: var(--color-white-100);
  font-size: 12px;
  font-weight: 600;
}

.x-post-quote {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  padding: var(--spacing-sm);
  border: 1px solid var(--x-post-hairline);
  border-radius: var(--radius-md);
  color: inherit;
  text-decoration: none;
  font-size: 13px;
}

.x-post-quote-author {
  display: flex;
  gap: 4px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
}

.x-post-quote-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.x-post-footer {
  display: flex;
  gap: var(--spacing-md);
  flex-shrink: 0;
  color: var(--x-post-subdued);
  font-size: 13px;
}
</style>
