<template>
  <div
    class="tile-caption hover-display"
    :style="{ display: editing || tile.caption ? 'flex' : '' }"
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
      :contenteditable="layoutStore.isOwner"
      class="caption-input"
      @blur="saveCaption"
    >
      {{ editableCaption }}
    </p>
  </div>
</template>

<script>
import { ref, nextTick } from "vue";
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
    const editableCaption = ref(props.tile.caption);

    const startEditing = () => {
      if (!layoutStore.isOwner) {
        return;
      }
      editing.value = true;
      nextTick(() => {
        if (editableCaptionElement.value) {
          editableCaptionElement.value.textContent = props.tile.caption || '';
          // Optionally place caret at end here
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

    const updateEditableCaption = (event) => {
      editableCaption.value = event.target.innerText;
    };

    const editableCaptionElement = ref(null);

    return {
      layoutStore,
      editing,
      editableCaption,
      startEditing,
      saveCaption,
      updateEditableCaption,
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
.tile-caption:hover {
  background-color: var(--color-tile-background);
  color: var(--color-text-primary);
  transition: color 0.5s ease-out;
  transition: background-color 0.5s ease-out;
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
  min-width: fit-content;
}
</style>
