<!-- eslint-disable vue/no-mutating-props -->
<template>
  <div
    class="brand-tile-content"
    :class="{
      'is-editing': isEditing,
      'is-owner': gridStore.canEdit,
      'is-empty': items.length === 0,
    }"
    ref="tileRef"
    @click="onTileClick"
  >
    <div
      v-if="overlayColor"
      class="brand-color-overlay"
      :style="{ backgroundColor: overlayColor }"
      aria-hidden="true"
    />

    <p v-if="displayTitle" class="brand-title">{{ displayTitle }}</p>

    <!-- Empty prompt (owner only) -->
    <div
      v-if="items.length === 0 && !isEditing"
      class="brand-empty"
    >
      <BrandIcon :size="28" class="brand-empty-icon" />
      <p class="brand-empty-text">
        {{ gridStore.canEdit ? "Click to add brand logos" : "No brands yet" }}
      </p>
    </div>

    <!-- Display strip: scrolls when logos overflow the tile viewport -->
    <div
      v-else-if="items.length"
      class="brand-strip"
      :style="{ gap: gap + 'px' }"
    >
      <BrandLogo
        v-for="logo in items"
        :key="logo.id"
        :logo="logo"
        :size="iconSize"
        :linkable="!isEditing"
      />
    </div>

    <!-- Owner editing panel -->
    <div v-if="isEditing" class="brand-editor" @mousedown.stop @click.stop>
      <BrandLogoPicker @select="addLogo" />

      <div v-if="items.length" class="brand-editor__list-wrap">
        <draggable
          v-model="draggableItems"
          item-key="id"
          handle=".brand-editor__drag"
          class="brand-editor__list"
        >
          <template #item="{ element }">
            <div class="brand-editor__row">
              <span class="brand-editor__drag" aria-hidden="true">⠿</span>
              <BrandLogo :logo="element" :size="24" :linkable="false" />
              <span class="brand-editor__label">{{ element.label }}</span>
              <button
                type="button"
                class="brand-editor__link-toggle"
                :class="{ 'is-off': element.linkDisabled }"
                :title="element.linkDisabled ? 'Linking off — click to enable' : 'Linked — click for options'"
                @click="toggleLinkMenu(element.id)"
              >
                {{ element.linkDisabled ? "Link off" : "Linked" }}
              </button>
              <button
                type="button"
                class="brand-editor__remove"
                title="Remove"
                @click="removeLogo(element.id)"
              >
                ×
              </button>

              <!-- Per-logo link controls -->
              <div
                v-if="openLinkMenuId === element.id"
                class="brand-editor__link-menu"
              >
                <label class="brand-editor__field-label">
                  <input
                    type="checkbox"
                    :checked="!element.linkDisabled"
                    @change="setLinkEnabled(element.id, ($event.target as HTMLInputElement).checked)"
                  />
                  Make this logo clickable
                </label>
                <input
                  v-if="!element.linkDisabled"
                  type="text"
                  class="brand-editor__link-input"
                  :placeholder="defaultLinkPlaceholder(element)"
                  :value="element.link ?? ''"
                  @input="setLinkUrl(element.id, ($event.target as HTMLInputElement).value)"
                />
                <p v-if="!element.linkDisabled && !element.link" class="brand-editor__hint">
                  Defaults to the brand's site.
                </p>
              </div>
            </div>
          </template>
        </draggable>
      </div>

      <!-- Size control -->
      <div class="brand-editor__control">
        <span class="brand-editor__control-label">Logo size</span>
        <div class="brand-editor__sizes">
          <button
            v-for="preset in SIZE_PRESETS"
            :key="preset"
            type="button"
            class="brand-editor__size-btn"
            :class="{ 'is-active': !customMode && iconSize === preset }"
            @click="setSize(preset)"
          >
            {{ preset }}
          </button>
          <button
            type="button"
            class="brand-editor__size-btn"
            :class="{ 'is-active': customMode }"
            @click="enableCustomSize"
          >
            Custom
          </button>
          <input
            v-if="customMode"
            type="number"
            min="8"
            max="256"
            class="brand-editor__size-input"
            :value="iconSize"
            @input="setCustomSize(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>

      <!-- Spacing control -->
      <div class="brand-editor__control">
        <span class="brand-editor__control-label">Spacing: {{ gap }}px</span>
        <input
          type="range"
          min="0"
          max="48"
          :value="gap"
          class="brand-editor__range"
          @input="setGap(($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, onUnmounted, ref } from "vue";
import draggable from "vuedraggable";
import type {
  BrandShowcaseContent as BrandShowcaseContentType,
  BrandLogoRef,
} from "@grids/contracts/types";
import { useGridStore } from "@/stores/grid";
import BrandLogo from "@/components/brand/BrandLogo.vue";
import BrandLogoPicker from "@/components/brand/BrandLogoPicker.vue";
import BrandIcon from "@/components/icons/appbar/BrandsIcon.vue";
import { useColorPicker } from "@/composables/useColorPicker";

const SIZE_PRESETS = [16, 20, 24, 32, 48];

export default defineComponent({
  name: "BrandShowcaseContent",
  components: { draggable, BrandLogo, BrandLogoPicker, BrandIcon },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as () => BrandShowcaseContentType,
      required: true,
    },
    tileId: {
      type: String,
      required: true,
    },
  },
  setup(props, { emit }) {
    const gridStore = useGridStore();

    const { overlayColor, handleBackgroundColorChange } = useColorPicker(
      props.tileId,
      props.content,
      emit,
      "background",
    );

    const items = computed(() => props.content.items ?? []);
    const iconSize = computed(() => props.content.iconSize ?? 32);
    const gap = computed(() => props.content.gap ?? 12);
    const displayTitle = computed(() => props.content.customTitle?.trim() || "");

    const isEditing = ref(false);
    const tileRef = ref<HTMLElement | null>(null);
    const openLinkMenuId = ref<string | null>(null);
    const customMode = ref(!SIZE_PRESETS.includes(props.content.iconSize ?? 32));

    // ── Persistence helper ──
    const commit = (partial: Partial<BrandShowcaseContentType>) => {
      Object.assign(props.content, partial);
      gridStore.patchTileContent(props.tileId, partial);
    };

    const setItems = (next: BrandLogoRef[]) => commit({ items: next });

    // ── Reorder (two-way for vuedraggable) ──
    const draggableItems = computed<BrandLogoRef[]>({
      get: () => items.value,
      set: (next) => setItems(next),
    });

    // ── Logo CRUD ──
    const addLogo = (logo: BrandLogoRef) => {
      setItems([...items.value, logo]);
    };

    const removeLogo = (id: string) => {
      setItems(items.value.filter((l) => l.id !== id));
      if (openLinkMenuId.value === id) openLinkMenuId.value = null;
    };

    const patchLogo = (id: string, patch: Partial<BrandLogoRef>) => {
      setItems(items.value.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    };

    // ── Per-logo link controls ──
    const toggleLinkMenu = (id: string) => {
      openLinkMenuId.value = openLinkMenuId.value === id ? null : id;
    };

    const setLinkEnabled = (id: string, enabled: boolean) => {
      patchLogo(id, { linkDisabled: !enabled });
    };

    const setLinkUrl = (id: string, url: string) => {
      patchLogo(id, { link: url.trim() ? url.trim() : undefined });
    };

    const defaultLinkPlaceholder = (logo: BrandLogoRef): string =>
      logo.provider === "brandfetch" && logo.domain
        ? `https://${logo.domain}`
        : "https://example.com";

    // ── Size control ──
    const setSize = (size: number) => {
      customMode.value = false;
      commit({ iconSize: size });
    };

    const enableCustomSize = () => {
      customMode.value = true;
    };

    const setCustomSize = (raw: string) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      const clamped = Math.min(256, Math.max(8, Math.round(n)));
      commit({ iconSize: clamped });
    };

    // ── Spacing control ──
    const setGap = (raw: string) => {
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      commit({ gap: Math.min(48, Math.max(0, Math.round(n))) });
    };

    // ── Editing lifecycle (mirrors DocumentsContent) ──
    let exitClickHandler: ((event: MouseEvent) => void) | null = null;
    const removeExitClickHandler = () => {
      if (exitClickHandler) {
        document.removeEventListener("click", exitClickHandler);
        exitClickHandler = null;
      }
    };

    const stopEditing = () => {
      if (!isEditing.value) return;
      gridStore.commitEditing();
      removeExitClickHandler();
      isEditing.value = false;
      openLinkMenuId.value = null;
    };

    const startEditing = () => {
      if (!gridStore.canEdit || isEditing.value) return;
      gridStore.beginEditing(props.tileId);
      isEditing.value = true;
      nextTick(() => {
        setTimeout(() => {
          exitClickHandler = (event: MouseEvent) => {
            if (tileRef.value && !tileRef.value.contains(event.target as Node)) {
              stopEditing();
            }
          };
          document.addEventListener("click", exitClickHandler);
        }, 0);
      });
    };

    const onTileClick = () => {
      if (!gridStore.canEdit) return;
      if (!isEditing.value) startEditing();
    };

    const onShortClick = () => {
      if (!isEditing.value) startEditing();
    };

    onMounted(() => {
      handleBackgroundColorChange(props.content.backgroundColor ?? "");
    });

    onUnmounted(() => {
      removeExitClickHandler();
    });

    return {
      gridStore,
      items,
      iconSize,
      gap,
      displayTitle,
      overlayColor,
      isEditing,
      tileRef,
      draggableItems,
      openLinkMenuId,
      customMode,
      SIZE_PRESETS,
      addLogo,
      removeLogo,
      toggleLinkMenu,
      setLinkEnabled,
      setLinkUrl,
      defaultLinkPlaceholder,
      setSize,
      enableCustomSize,
      setCustomSize,
      setGap,
      onTileClick,
      onShortClick,
      startEditing,
    };
  },
});
</script>

<style scoped>
.brand-tile-content {
  position: relative;
  width: 100%;
  height: 100%;
  padding: var(--tile-padding);
  border-radius: var(--tile-border-radius);
  overflow: hidden;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
}

.brand-tile-content.is-owner {
  cursor: pointer;
}

.brand-color-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  mix-blend-mode: color;
  pointer-events: none;
}

.brand-title {
  position: relative;
  z-index: 1;
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  opacity: 0.85;
}

/* Scroll overflow: logos that don't fit the viewport scroll. */
.brand-strip {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: center;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
}

.brand-empty {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--color-content-default);
  text-align: center;
}

.brand-empty-icon {
  opacity: 0.5;
}

.brand-empty-text {
  margin: 0;
  font-size: 12px;
}

/* ── Editor panel ── */
.brand-editor {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
  padding: var(--spacing-sm, 8px);
  overflow-y: auto;
  background-color: var(--color-tile-background);
  border-radius: var(--tile-border-radius);
}

.brand-editor__list-wrap {
  display: flex;
  flex-direction: column;
}

.brand-editor__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-editor__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: var(--radius-sm, 6px);
}

.brand-editor__row:hover {
  background-color: var(--color-base-55, rgba(127, 127, 127, 0.1));
}

.brand-editor__drag {
  cursor: grab;
  color: var(--color-content-default);
  user-select: none;
}

.brand-editor__label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--color-text-primary);
}

.brand-editor__link-toggle {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
}

.brand-editor__link-toggle.is-off {
  opacity: 0.5;
}

.brand-editor__remove {
  width: 22px;
  height: 22px;
  line-height: 1;
  font-size: 16px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-content-default);
  cursor: pointer;
}

.brand-editor__remove:hover {
  background-color: var(--color-base-55, rgba(127, 127, 127, 0.15));
  color: var(--color-danger, #e5484d);
}

.brand-editor__link-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 4;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background-color: var(--color-content-background);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm, 6px);
}

.brand-editor__field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-primary);
}

.brand-editor__link-input {
  width: 100%;
  padding: 6px;
  font-size: 12px;
  color: var(--color-text-primary);
  background-color: var(--color-tile-background);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  border-radius: 4px;
  outline: none;
}

.brand-editor__hint {
  margin: 0;
  font-size: 11px;
  color: var(--color-content-default);
}

.brand-editor__control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-editor__control-label {
  font-size: 12px;
  color: var(--color-content-default);
}

.brand-editor__sizes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}

.brand-editor__size-btn {
  min-width: 30px;
  padding: 4px 8px;
  font-size: 12px;
  border-radius: 4px;
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  background: transparent;
  color: var(--color-text-primary);
  cursor: pointer;
}

.brand-editor__size-btn.is-active {
  background-color: var(--color-content-default);
  color: var(--color-tile-background);
}

.brand-editor__size-input {
  width: 64px;
  padding: 4px 6px;
  font-size: 12px;
  border-radius: 4px;
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  background-color: var(--color-content-background);
  color: var(--color-text-primary);
}

.brand-editor__range {
  width: 100%;
}
</style>
