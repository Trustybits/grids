<template>
  <div
    class="tile-caption"
    :class="captionClasses"
    :style="captionStyle"
    @click="startEditing"
  >
    <p
      v-if="!editing"
      class="caption-text"
    >
      {{ tile.caption || '+ caption' }}
    </p>
    <p
      v-else
      ref="editableCaptionElement"
      contenteditable="true"
      class="caption-input"
      @blur="saveCaption"
      @keydown.enter.prevent="saveCaption"
    ></p>
  </div>
</template>

<script>
import { ref, computed, nextTick } from "vue";
import { useLayoutStore } from "@/stores/layout";

export default {
  name: "TileCaption",
  props: {
    tile: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();
    const editing = ref(false);
    const editableCaptionElement = ref(null);

    const captionClasses = computed(() => {
      if (layoutStore.isOwner) {
        return 'hover-display';
      }
      // Non-owner: show if caption exists, hide on hover
      return props.tile.caption ? 'viewer-caption' : '';
    });

    const captionStyle = computed(() => {
      // Only force display:flex for owner editing state.
      // For non-owners, the .viewer-caption class handles display
      // and must not be overridden by an inline style (so the
      // hide-on-hover rule in GridTile.vue can take effect).
      if (layoutStore.isOwner && (editing.value || props.tile.caption)) {
        return { display: 'flex' };
      }
      return {};
    });

    const startEditing = () => {
      if (!layoutStore.isOwner) {
        return;
      }
      editing.value = true;
      nextTick(() => {
        const el = editableCaptionElement.value;
        if (el) {
          el.textContent = props.tile.caption || '';
          el.focus();
          // Place caret at end
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      });
    };

    const saveCaption = () => {
      if (!layoutStore.isOwner) {
        editing.value = false;
        return;
      }
      const text = editableCaptionElement.value?.innerText.trim() ?? '';
      props.tile.caption = text;
      layoutStore.updateLayout();
      editing.value = false;
    };

    return {
      layoutStore,
      editing,
      captionClasses,
      captionStyle,
      startEditing,
      saveCaption,
      editableCaptionElement,
    };
  },
};
</script>

<style scoped>
.tile-caption {
  background-color: var(--color-tile-background);
  color: var(--color-content-low);
  cursor: pointer;
  display: none;
  position: absolute;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: auto;
  max-width: 85%;
  left: 13px;
  bottom: 13px;
  border-radius: var(--radius-md);
  border: var(--tile-border-width) solid var(--color-tile-stroke);
}

/* Non-owner: visible by default, hides on parent hover (hide rule in GridTile.vue) */
.tile-caption.viewer-caption {
  display: flex;
}

.tile-caption:hover {
  background-color: var(--color-tile-background);
  color: var(--color-text-primary);
  transition: color 0.5s ease-out, background-color 0.5s ease-out;
}

p {
  margin-bottom: 0;
}

.caption-text {
  font-size: 13px;
  padding: 5px 13px;
}

.caption-input {
  font-size: 13px;
  padding: 5px 13px;
  border: none;
  outline: none;
  min-width: 120px;
  min-height: 1.4em;
  white-space: pre-wrap;
  cursor: text;
}
</style>
