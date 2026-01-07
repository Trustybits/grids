<template>
  <TextOptions v-if="editor" v-show="isEditing" :editor="editor" />
  <div 
    class="text-container" 
    ref="textContentDiv"
  >
    <div 
      class="text-content" 
      :class="{ 'not-editing': !isEditing, 'overflowing': isTextOverflowing }"
      :spellcheck="isEditing"
    >
      <EditorContent :editor="editor" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import TextOptions from "./TextOptions.vue";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { FontSize } from "../tiptap/FontSize";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useLayoutStore } from "@/stores/layout";

export default defineComponent({
  components: {
    EditorContent,
    TextOptions,
  },
  props: {
    content: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const layoutStore = useLayoutStore();

    const isTextOverflowing = ref(false);
    const isEditing = ref(false);
    const textContentDiv = ref<HTMLDivElement | null>(null);

    const editor = useEditor({
      extensions: [
        StarterKit,
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        TaskList,
        TaskItem,
      ],
      content: props.content.text ? JSON.parse(props.content.text) : '',
      onUpdate({ editor }) {
        // props.content.text = editor.getHTML();
        checkOverflow();
      },
    });

    const checkOverflow = () => {
      if (!editor || !editor.value?.view) return;

      const container = textContentDiv.value;
      if (!container) return;

      const editorDom = editor.value.view.dom as HTMLElement;
      const isOverflowing = container.clientHeight < editorDom.clientHeight + 5;

      isTextOverflowing.value = isOverflowing;
    };  

    watch(
      () => isEditing.value, 
      (newVal) => {
        if (newVal) {
          if (editor?.value) {
            editor.value.setEditable(true);
            editor.value.commands.focus('end');
          }
        } else {
          editor.value?.setEditable(false);
          editor.value?.commands.focus('start');
          editor.value?.commands.blur();

          let output = JSON.stringify(editor.value?.getJSON());
          output = output.replace(/^"(.*)"$/, "$1");
          console.log(output);
          props.content.text = output;
          layoutStore.saveLayout();
        }
      }
    );

    const onShortClick = () => {
      if (editor?.value && !isEditing.value) {
        isEditing.value = true;
      } else if (!editor.value?.isFocused) {
        // editor?.value?.commands.focus('end');
      }
    }

    const onExitClick = () => {
      if (editor?.value?.view?.dom) {
        editor.value.commands.focus('start');
      }
      setTimeout(() => {
        isEditing.value = false;
      }, 50);
    }

    onMounted(() => {
      checkOverflow();
    });

    return {
      editor,
      isTextOverflowing,
      isEditing,
      textContentDiv,
      onShortClick,
      onExitClick,
    };
  },
});
</script>

<style scoped>
.text-container {
  height: 100%;
  padding: var(--spacing-sm);
  display: flex;
  font-family: 'Inter';
}

.text-content {
  background-color: rgba(255, 255, 255, 0.1);
  padding: var(--spacing-md);
  width: 100%;
  scroll-behavior: smooth;
  border-radius: var(--radius-lg);
  overflow: auto;
  margin: 0;
  line-height: 1.3;
  transition: background-color 0.3s ease;

  &::-webkit-scrollbar {
    display: none;
  }
}

.not-editing {
  background-color: transparent;
  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

.overflowing::after {
  content: "...";
  position: absolute;
  right: 8px;
  bottom: 8px;
  color: inherit;
}

:deep(.ProseMirror:focus-visible) {
  outline: transparent !important;
}

.text-content ::selection {
  background: highlight;
  color: inherit;
}

/* Fix for Task List Items */
:deep(ul[data-type="taskList"]) {
  padding: 0;
  margin: 0;
  list-style-type: none; /* Removes the default bullet point */
}

:deep(ul[data-type="taskList"] li) {
  display: flex;
  align-items: center;
  gap: 8px;
}

:deep(ul[data-type="taskList"] li label) {
  display: inline-flex;
  align-items: center;
}

:deep(ul[data-type="taskList"] li input[type="checkbox"]) {
  margin: 0;
}

:deep(ul[data-type="taskList"] li div) {
  min-height: 1em;
  min-width: 1px;
  display: inline-block;
}

:deep(ul[data-type="taskList"] li p) {
  margin: 0;
  min-height: 1em;
  min-width: 1px;
  display: inline-block;
}
</style>
