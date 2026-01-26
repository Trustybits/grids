<template>
  <div
    class="link-tile-content"
    :class="{
      'is-wide-1-high': isWideOneHigh,
      'is-tall-1-wide': isTallOneWide,
      'is-editing': isEditing,
      'is-owner': layoutStore.isOwner,
    }"
    :style="{ '--link-title-lines': String(titleLineClamp) }"
  >
    <div v-if="content.metaImageUrl" class="tile-background" aria-hidden="true">
      <img
        class="tile-background-image"
        :src="content.metaImageUrl"
        :alt="content.metaTitle || content.domain"
      />
      <div class="tile-background-overlay"></div>
    </div>

    <div class="tile-foreground">
      <div class="tile-header">
        <div class="tile-logo">
          <img :src="content.faviconUrl" :alt="content.domain" />
        </div>

        <template v-if="isWideOneHigh">
          <p v-if="!isEditing" class="tile-title tile-title--wide" @mousedown="markTextIntent">
            {{ displayTitle }}
          </p>
          <input
            v-else
            v-model="draftTitle"
            class="tile-input tile-input--title tile-input--wide"
            type="text"
            placeholder="Add a title"
            @keydown.enter.prevent
          />
        </template>

        <div v-if="!isTallOneWide" class="tile-link-indicator" aria-hidden="true">
          <svg
            class="tile-link-indicator-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 17L17 7"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M10 7H17V14"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>

      <div v-if="isTallOneWide" class="tile-link-indicator tile-link-indicator--bottom" aria-hidden="true">
        <svg
          class="tile-link-indicator-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M7 17L17 7"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M10 7H17V14"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div v-if="!isWideOneHigh && !isTallOneWide" class="tile-text" @mousedown="markTextIntent">
        <template v-if="isEditing">
          <textarea
            v-model="draftTitle"
            class="tile-input tile-input--title"
            :rows="titleLineClamp"
            placeholder="Add a title"
          ></textarea>
          <textarea
            v-model="draftDescription"
            class="tile-input tile-input--description"
            rows="2"
            placeholder="Add a description"
          ></textarea>
          <input
            v-model="draftSubtitle"
            class="tile-input tile-input--subtitle"
            type="text"
            placeholder="Add a subtitle"
          />
        </template>
        <template v-else>
          <p class="tile-title">{{ displayTitle }}</p>
          <p v-if="displayDescription" class="tile-description">{{ displayDescription }}</p>
          <p class="tile-subtitle">{{ displaySubtitle }}</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject, computed, ref, type ComputedRef } from "vue";
import { type LinkContent } from "@/types/TileContent";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  props: {
    content: {
      type: Object as () => LinkContent,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);

    const isWideOneHigh = computed(() => (gridTileW?.value ?? 0) > 1 && (gridTileH?.value ?? 0) === 1);
    const isTallOneWide = computed(() => (gridTileW?.value ?? 0) === 1 && (gridTileH?.value ?? 0) > 1);
    const titleLineClamp = computed(() => ((gridTileH?.value ?? 0) < 3 ? 2 : 3));

    const isEditing = ref(false);
    const wantsEdit = ref(false);
    const draftTitle = ref("");
    const draftDescription = ref("");
    const draftSubtitle = ref("");

    const formatLink = (link: string) => {
      if (!link) return '@handle or address';
      
      if (link.startsWith('http://') || link.startsWith('https://')) {
        try {
          const url = new URL(link);
          return `@${url.hostname.replace('www.', '')}`;
        } catch {
          return `@${link}`;
        }
      }
      
      return link.startsWith('@') ? link : `@${link}`;
    };

    const defaultTitle = computed(
      () => props.content.metaTitle || props.content.metaSiteName || props.content.domain || "Link"
    );
    const defaultDescription = computed(() => props.content.metaDescription || "");
    const defaultSubtitle = computed(() => formatLink(props.content.link));

    const displayTitle = computed(() => props.content.customTitle?.trim() || defaultTitle.value);
    const displayDescription = computed(
      () => props.content.customDescription?.trim() || defaultDescription.value
    );
    const displaySubtitle = computed(
      () => props.content.customSubtitle?.trim() || defaultSubtitle.value
    );

    const syncDrafts = () => {
      draftTitle.value = displayTitle.value;
      draftDescription.value = displayDescription.value;
      draftSubtitle.value = displaySubtitle.value;
    };

    const saveEdits = () => {
      if (!layoutStore.isOwner) return;

      const nextTitle = draftTitle.value.trim();
      const nextDescription = draftDescription.value.trim();
      const nextSubtitle = draftSubtitle.value.trim();

      props.content.customTitle = nextTitle || undefined;
      props.content.customDescription = nextDescription || undefined;
      props.content.customSubtitle = nextSubtitle || undefined;

      layoutStore.saveLayout();
    };

    const markTextIntent = () => {
      if (!layoutStore.isOwner || isEditing.value) return;
      wantsEdit.value = true;
    };

    const onShortClick = () => {
      if (isEditing.value) {
        wantsEdit.value = false;
        return;
      }

      if (layoutStore.isOwner && wantsEdit.value) {
        isEditing.value = true;
        wantsEdit.value = false;
        syncDrafts();
        return;
      }

      wantsEdit.value = false;

      const url = props.content.link.startsWith("http")
        ? props.content.link
        : `https://${props.content.link}`;
      window.open(url, "_blank");
    };

    const onExitClick = () => {
      if (!layoutStore.isOwner) return;
      if (!isEditing.value) {
        wantsEdit.value = false;
        return;
      }
      isEditing.value = false;
      wantsEdit.value = false;
      saveEdits();
    };

    return {
      layoutStore,
      formatLink,
      onShortClick,
      onExitClick,
      isEditing,
      markTextIntent,
      titleLineClamp,
      isWideOneHigh,
      isTallOneWide,
      displayTitle,
      displayDescription,
      displaySubtitle,
      draftTitle,
      draftDescription,
      draftSubtitle,
    }
  },
});
</script>

<style scoped>
.link-tile-content {
  --link-title-lines: 3;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  position: relative;
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  isolation: isolate;
  transform: translateZ(0);
}

.tile-background {
  position: absolute;
  inset: -1px;
  z-index: 0;
  pointer-events: none;
}

.tile-wrapper[data-link-background='off'] .tile-background {
  display: none;
}

.tile-background-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  transform: translateZ(0);
}

.tile-background-overlay {
  position: absolute;
  inset: 0;
  /*
    Keeps link tile text readable on top of busy images.
    Two layers:
    - bottom-up fade into the theme's content background
    - subtle overall wash (matches the Figma example's white @ 34%)
  */
  background-image:
    linear-gradient(
      180deg,
      transparent 21%,
      color-mix(in srgb, var(--color-tile-background) 76%, transparent) 76%,
      var(--color-tile-background) 100%
    ),
    linear-gradient(90deg, color-mix(in srgb, var(--color-tile-background) 34%, transparent) 0%, color-mix(in srgb, var(--color-tile-background) 34%, transparent) 100%);
    transform: translateZ(0);
}

.tile-foreground {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--spacing-md);
  width: 100%;
  height: 100%;
}

.tile-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  width: 100%;
}

.link-tile-content.is-wide-1-high .tile-header {
  align-items: center;
  gap: 12px;
}

.link-tile-content.is-wide-1-high .tile-link-indicator {
  margin-left: auto;
}

.link-tile-content.is-tall-1-wide .tile-foreground {
  gap: 0;
}

.link-tile-content.is-tall-1-wide .tile-link-indicator--bottom {
  margin-top: auto;
  align-self: flex-end;
  width: 100%;
}

.tile-logo {
  width: 32px;
  height: 32px;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.tile-logo img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

.tile-link-indicator {
  width: 24px;
  height: 24px;
  color: var(--color-text-primary);
  opacity: 0.21;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-in-out);
}

.link-tile-content:hover .tile-link-indicator {
  opacity: 1;
}

.tile-link-indicator-icon {
  width: 100%;
  height: 100%;
  display: block;
}

.tile-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tile-title {
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: var(--link-title-lines);
  -webkit-line-clamp: var(--link-title-lines);
}

.tile-title--wide {
  display: block;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  line-clamp: unset;
  -webkit-line-clamp: unset;
}

.tile-description {
  color: var(--color-content-high);
  font-size: 12px;
  line-height: 16px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  -webkit-line-clamp: 2;
}

.tile-subtitle {
  color: var(--color-content-high);
  font-size: 12px;
  line-height: 16px;
  margin: 0;
}

.link-tile-content.is-owner .tile-text,
.link-tile-content.is-owner .tile-title--wide {
  cursor: text;
}

.tile-input {
  width: 100%;
  /* border-radius: var(--radius-sm); */
  border: 0px solid transparent;
  /* border: 1px solid color-mix(in srgb, var(--color-text-primary) 18%, transparent); */
  background: color-mix(in srgb, var(--color-tile-background) 84%, transparent);
  color: var(--color-text-primary);
  field-sizing: content;
  padding: 0;
  /* font-family: "Inter", sans-serif; */
  line-height: inherit;
  resize: none;
}

.tile-input:focus {
  outline: none;
  border: 0px solid transparent;
  padding: 0;
  field-sizing: content;
  font-family: "Inter", sans-serif;
  /* border-color: color-mix(in srgb, var(--color-text-primary) 40%, transparent); */
  /* box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-text-primary) 25%, transparent); */
}

.tile-input--title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.25;
  font-family: "Inter", sans-serif;
  margin: 0;
}

.tile-input--wide {
  min-width: 0;
}

.tile-input--description {
  font-size: 12px;
  line-height: 16px;
  color: var(--color-content-high);
}

.tile-input--subtitle {
  font-size: 12px;
  line-height: 16px;
  font-family: "Inter", sans-serif;
  color: var(--color-content-high);
}
</style>