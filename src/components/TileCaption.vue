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
      {{ tile.caption || 'Caption...' }}
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
  background-color: white;
  color: black;
  cursor: pointer;
  display: none;
  position: absolute;
  left: 10px;
  bottom: 10px;
  border-radius: 4px;
}
p {
  margin-bottom: 0;
}
.caption-text {
  padding: 4px;
}
.caption-input {
  padding: 4px;
  border: none;
  outline: none;
  min-width: fit-content;
}
</style>
