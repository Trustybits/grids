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
      contenteditable="true"
      class="caption-input"
      @blur="saveCaption"
      @input="updateEditableCaption($event)"
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
      editing.value = true;
      editableCaption.value = props.tile.caption;
      nextTick(() => {
        editableCaptionElement.value?.focus();
      });
    };

    const saveCaption = () => {
      editing.value = false;
      props.tile.caption = editableCaption.value;

      // Save the layout using the layoutStore
      layoutStore.updateLayout();
    };

    const updateEditableCaption = (event) => {
      editableCaption.value = event.target.innerText;
    };

    const editableCaptionElement = ref(null);

    return {
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
  color: var(--color-text-primary)/0.5;
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
