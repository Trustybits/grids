<template>
  <div class="profile-bio" ref="profileRoot">
    <div class="profile-header">
      <div class="profile-avatar-row">
        <div class="avatar" ref="avatarRef" @click="onAvatarClick">
          <svg
            v-if="avatarShape === 'hex'"
            class="avatar-clip-defs"
            width="0"
            height="0"
          >
            <defs>
              <clipPath :id="clipPathId" clipPathUnits="objectBoundingBox">
                <path :d="hexPath" />
              </clipPath>
            </defs>
          </svg>
          <div class="avatar-media" :style="avatarMediaStyle">
            <img
              v-if="avatarSrc"
              :src="avatarSrc"
              alt="Avatar"
              class="avatar-image"
            />
            <div v-else class="avatar-placeholder">Add photo</div>
          </div>
        </div>

        <div
          v-if="layoutStore.isOwner && isEditing"
          class="profile-controls"
          @mousedown.stop
        >
          <div class="control-row">
            <button
              type="button"
              class="control-btn"
              @click.stop="openCustomImagePicker"
            >
              Upload
            </button>
            <button
              type="button"
              class="control-btn"
              @click.stop="openUrlInput"
            >
              Use URL
            </button>
            <button
              v-if="avatarSrc"
              type="button"
              class="control-btn control-btn--danger"
              @click.stop="removeCustomImage"
            >
              Remove
            </button>
          </div>

          <div v-if="showUrlInput" class="control-url">
            <input
              v-model="draftAvatarUrl"
              type="text"
              placeholder="https://..."
            />
            <div class="control-row">
              <button
                type="button"
                class="control-btn"
                @click.stop="applyAvatarUrl"
              >
                Apply
              </button>
              <button
                type="button"
                class="control-btn control-btn--ghost"
                @click.stop="cancelUrlInput"
              >
                Cancel
              </button>
            </div>
            <div v-if="urlError" class="control-error">{{ urlError }}</div>
          </div>

          <div class="control-row">
            <label class="control-label">Shape</label>
            <div class="control-segment">
              <button
                type="button"
                :class="{ active: avatarShape === 'circle' }"
                @click.stop="setAvatarShape('circle')"
              >
                Circle
              </button>
              <button
                type="button"
                :class="{ active: avatarShape === 'square' }"
                @click.stop="setAvatarShape('square')"
              >
                Square
              </button>
              <button
                type="button"
                :class="{ active: avatarShape === 'hex' }"
                @click.stop="setAvatarShape('hex')"
              >
                Hex
              </button>
            </div>
          </div>

          <div v-if="avatarShape !== 'circle'" class="control-row">
            <label class="control-label">Radius</label>
            <input
              type="range"
              min="0"
              max="40"
              step="1"
              :value="avatarRadius"
              @input="onRadiusInput"
              @change="onRadiusCommit"
            />
            <span class="control-value">{{ avatarRadius }}px</span>
          </div>
        </div>
      </div>

      <div class="profile-meta" :style="{ '--tile-text-color': textColor }">
        <div
          class="profile-name profile-editor"
          :class="{ 'can-edit': layoutStore.isOwner }"
          :spellcheck="layoutStore.isOwner && isEditing"
          @mousedown="focusEditor(nameEditor, $event)"
          @click="catchEditorClick(nameEditor)"
        >
          <EditorContent :editor="nameEditor" />
        </div>
        <div
          class="profile-title profile-editor"
          :class="{ 'can-edit': layoutStore.isOwner }"
          :spellcheck="layoutStore.isOwner && isEditing"
          @mousedown="focusEditor(titleEditor, $event)"
          @click="catchEditorClick(titleEditor)"
        >
          <EditorContent :editor="titleEditor" />
        </div>
      </div>
    </div>

    <div
      class="profile-bio-text profile-editor"
      :class="{ 'can-edit': layoutStore.isOwner }"
      :spellcheck="layoutStore.isOwner && isEditing"
      :style="{ '--tile-text-color': textColor }"
      @mousedown="focusEditor(bioEditor, $event)"
      @click="catchEditorClick(bioEditor)"
    >
      <EditorContent :editor="bioEditor" />
    </div>

    <input
      ref="avatarInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change.stop="onAvatarSelected"
    />
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  type PropType,
  inject,
} from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { FontSize } from "../tiptap/FontSize";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useLayoutStore } from "@/stores/layout";
import { type ProfileBioContent, type AvatarShape } from "@/types/TileContent";
import { isDirectImageUrl } from "@/utils/TileUtils";
import { useFileUpload } from "@/composables/useFileUpload";
import { getAuth } from "firebase/auth";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import Placeholder from "@tiptap/extension-placeholder";

const baseExtensions: AnyExtension[] = [
  StarterKit,
  TextStyle,
  Color,
  FontFamily,
  FontSize,
  TaskList,
  TaskItem,
];

const makeExtensions = (placeholder: string): AnyExtension[] => [
  ...baseExtensions,
  Placeholder.configure({ placeholder, showOnlyWhenEditable: false }),
];

export default defineComponent({
  components: {
    EditorContent,
  },
  emits: ["background-color-change", "text-color-change"],
  props: {
    content: {
      type: Object as PropType<ProfileBioContent>,
      required: true,
    },
  },
  setup(props, { emit }) {
    const layoutStore = useLayoutStore();

    const { uploadFileToUrl, uploadExternalImageToStorage } = useFileUpload();
    const auth = getAuth();

    const isEditing = ref(false);
    const activeEditor = ref<any>(null);
    const pendingFocusEditor = ref<any>(null);
    const avatarInput = ref<HTMLInputElement | null>(null);
    const avatarRef = ref<HTMLDivElement | null>(null);
    const profileRoot = ref<HTMLDivElement | null>(null);
    const avatarSize = ref(152);

    const clipPathId = `avatar-clip-${Math.random().toString(36).slice(2, 9)}`;

    const tileId = inject<string | null>("tileId", null);

    const avatarRadius = ref(props.content.avatarRadius ?? 12);
    const showUrlInput = ref(false);
    const draftAvatarUrl = ref("");
    const urlError = ref("");

    const parseContent = (value: string) => {
      if (!value) return "";
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    };

    const { schedulePersist, flushPersist } = useEditorAutosave(() =>
      persistContent(),
    );

    const onEditorUpdate = () => {
      if (isEditing.value) schedulePersist();
    };

    const nameEditor = useEditor({
      editable: false,
      extensions: makeExtensions("Your name"),
      content: parseContent(props.content.name),
      onFocus: ({ editor }) => {
        activeEditor.value = editor;
      },
      onUpdate: onEditorUpdate,
    });

    const titleEditor = useEditor({
      editable: false,
      extensions: makeExtensions("Add your title"),
      content: parseContent(props.content.title),
      onFocus: ({ editor }) => {
        activeEditor.value = editor;
      },
      onUpdate: onEditorUpdate,
    });

    const bioEditor = useEditor({
      editable: false,
      extensions: makeExtensions("Tell us about yourself..."),
      content: parseContent(props.content.bio),
      onFocus: ({ editor }) => {
        activeEditor.value = editor;
      },
      onUpdate: onEditorUpdate,
    });

    const avatarShape = computed(() => props.content.avatarShape || "circle");

    // Profile photo URL is stored in tile content
    // Read from the store's tile content so it updates reactively when we upload/delete
    const avatarSrc = computed(() => {
      const currentTile = layoutStore.currentLayout?.tiles.find((tile) => {
        if (tile.content?.type !== "profile") return false;
        const tileContent = tile.content as any;
        const propsContent = props.content as any;
        // Match by comparing unique properties (name, title, bio)
        return (
          tileContent.name === propsContent.name &&
          tileContent.title === propsContent.title &&
          tileContent.bio === propsContent.bio
        );
      });
      return (currentTile?.content as any)?.profilePhotoUrl ?? "";
    });

    const saveProfilePhoto = async (url: string) => {
      // Find which tile this component is rendering by comparing content properties
      // We can't use reference equality because props.content may be a different object
      const currentTile = layoutStore.currentLayout?.tiles.find((tile) => {
        if (tile.content?.type !== "profile") return false;
        const tileContent = tile.content as any;
        const propsContent = props.content as any;
        // Match by comparing unique properties (name, title, bio)
        return (
          tileContent.name === propsContent.name &&
          tileContent.title === propsContent.title &&
          tileContent.bio === propsContent.bio
        );
      });

      if (!currentTile) {
        console.error("Could not find tile in store for profile photo save");
        return;
      }

      // Mutate the store's content reference directly, not props.content
      (currentTile.content as any).profilePhotoUrl = url;

      // Persist to Firestore via layout store
      await layoutStore.saveLayout();
    };

    const serializeEditor = (editor: any) => {
      let output = JSON.stringify(editor.getJSON());
      output = output.replace(/^"(.*)"$/, "$1");
      return output;
    };

    const persistContent = () => {
      if (!nameEditor.value || !titleEditor.value || !bioEditor.value) return;
      if (!layoutStore.isOwner) return;

      const name = serializeEditor(nameEditor.value);
      const title = serializeEditor(titleEditor.value);
      const bio = serializeEditor(bioEditor.value);

      if (tileId) {
        layoutStore.patchTileContent(tileId, { name, title, bio });
      } else {
        props.content.name = name;
        props.content.title = title;
        props.content.bio = bio;
        layoutStore.saveLayout();
      }
    };

    watch(
      [() => layoutStore.isOwner, () => isEditing.value],
      ([isOwner, editing]) => {
        const editors = [
          nameEditor.value,
          titleEditor.value,
          bioEditor.value,
        ].filter((editor) => editor != null) as any[];
        if (!editors.length) return;

        const shouldBeEditable = isOwner && editing;
        editors.forEach((editor) => {
          editor.setEditable(shouldBeEditable);
        });

        if (shouldBeEditable) {
          nextTick(() => {
            const target =
              pendingFocusEditor.value ||
              activeEditor.value ||
              nameEditor.value ||
              titleEditor.value ||
              bioEditor.value;
            pendingFocusEditor.value = null;
            target?.commands.focus("end");
          });
          return;
        }

        editors.forEach((editor) => {
          editor.commands.blur();
        });

        if (!isOwner) {
          isEditing.value = false;
          return;
        }

        flushPersist();
      },
    );

    const focusEditor = (editorRef: any, _event: MouseEvent) => {
      if (!layoutStore.isOwner) return;
      const ed = editorRef?.value ?? editorRef;
      if (!ed) return;

      if (!isEditing.value) {
        // Store which editor was clicked so the isEditing watch focuses it.
        pendingFocusEditor.value = ed;
      }
      // When already editing, let ProseMirror handle mousedown naturally
      // so clicks on text place the cursor at the correct position.
    };

    const catchEditorClick = (editorRef: any) => {
      if (!layoutStore.isOwner || !isEditing.value) return;
      const ed = editorRef?.value ?? editorRef;
      if (!ed) return;

      // If ProseMirror couldn't place a cursor (click was on empty space),
      // the editor will have lost focus. Re-focus at the end of the text.
      if (!ed.isFocused) {
        ed.commands.focus("end");
      }
    };

    const onShortClick = () => {
      if (!layoutStore.isOwner) return;
      if (!isEditing.value) {
        isEditing.value = true;
        if (!activeEditor.value) {
          activeEditor.value =
            nameEditor.value || titleEditor.value || bioEditor.value || null;
        }
      }
    };

    const onExitClick = () => {
      if (!layoutStore.isOwner) return;
      if (!isEditing.value) return;
      isEditing.value = false;
    };

    const updateAvatarSize = () => {
      if (!avatarRef.value) return;
      const rect = avatarRef.value.getBoundingClientRect();
      if (rect.width > 0) {
        avatarSize.value = rect.width;
      }
    };

    const onResize = () => {
      nextTick(() => updateAvatarSize());
    };

    onMounted(() => {
      updateAvatarSize();
    });

    watch(
      () => props.content.avatarRadius,
      (value) => {
        if (typeof value === "number") {
          avatarRadius.value = value;
        }
      },
    );

    const setAvatarShape = (shape: AvatarShape) => {
      if (!layoutStore.isOwner) return;
      props.content.avatarShape = shape;
      layoutStore.saveLayout();
    };

    const onRadiusInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      avatarRadius.value = Number(target.value);
    };

    const onRadiusCommit = () => {
      if (!layoutStore.isOwner) return;
      props.content.avatarRadius = avatarRadius.value;
      layoutStore.saveLayout();
    };

    const normalizeImageUrl = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return "";
      const normalized =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`;
      try {
        new URL(normalized);
        return normalized;
      } catch {
        return "";
      }
    };

    const openCustomImagePicker = () => {
      if (!layoutStore.isOwner) return;
      avatarInput.value?.click();
    };

    const onAvatarClick = () => {
      if (!layoutStore.isOwner) return;
      if (!isEditing.value) {
        isEditing.value = true;
      }
      openCustomImagePicker();
    };

    const openUrlInput = () => {
      if (!layoutStore.isOwner) return;
      draftAvatarUrl.value = avatarSrc.value || "";
      urlError.value = "";
      showUrlInput.value = true;
    };

    const cancelUrlInput = () => {
      showUrlInput.value = false;
      urlError.value = "";
    };

    const applyAvatarUrl = async () => {
      if (!layoutStore.isOwner) return;
      const normalized = normalizeImageUrl(draftAvatarUrl.value);
      if (!normalized) {
        urlError.value = "Enter a valid URL.";
        return;
      }
      if (!isDirectImageUrl(normalized)) {
        urlError.value =
          "Only direct image URLs are supported (png, jpg, gif, webp, svg).";
        return;
      }

      urlError.value = "";
      showUrlInput.value = false;
      try {
        const ownedUrl = await uploadExternalImageToStorage(
          normalized,
          "images",
        );
        await saveProfilePhoto(ownedUrl);
      } catch (err: any) {
        console.error("Failed to import external image:", err);
        urlError.value =
          "Could not import image. Try uploading the file directly.";
        showUrlInput.value = true;
      }
    };

    const removeCustomImage = async () => {
      if (!layoutStore.isOwner) return;
      showUrlInput.value = false;
      await saveProfilePhoto("");
    };

    const uploadAvatarImage = async (file: File) => {
      if (!layoutStore.isOwner) return;

      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }

      try {
        const url = await uploadFileToUrl(file, { fileType: "images" });
        await saveProfilePhoto(url);
      } catch (error: any) {
        console.error("Avatar upload failed:", error);
        alert(error.message || "Failed to upload image. Please try again.");
      }
    };

    const onAvatarSelected = async (event: Event) => {
      if (!layoutStore.isOwner) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadAvatarImage(file);
      if (avatarInput.value) avatarInput.value.value = "";
    };

    const generateRoundedHexagonPath = (size: number, radius: number) => {
      const hPadding = (0.97 - Math.sqrt(3) / 2) / 2;
      const vPadding = -0.02;
      const xMin = hPadding;
      const xMax = 1 - hPadding;
      const yMin = vPadding;
      const yMax = 1 - vPadding;
      const yScale = yMax - yMin;
      const points = [
        { x: 0.5, y: yMin },
        { x: xMax, y: yMin + 0.25 * yScale },
        { x: xMax, y: yMin + 0.75 * yScale },
        { x: 0.5, y: yMax },
        { x: xMin, y: yMin + 0.75 * yScale },
        { x: xMin, y: yMin + 0.25 * yScale },
      ];

      const normalizedRadius = radius / size;

      if (normalizedRadius === 0) {
        return `M ${points[0].x} ${points[0].y} ${points
          .slice(1)
          .map((point) => `L ${point.x} ${point.y}`)
          .join(" ")} Z`;
      }

      let path = "";
      for (let i = 0; i < points.length; i += 1) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        const prev = points[(i - 1 + points.length) % points.length];

        const dx1 = current.x - prev.x;
        const dy1 = current.y - prev.y;
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

        const dx2 = next.x - current.x;
        const dy2 = next.y - current.y;
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        const offset = Math.min(normalizedRadius, len1 / 2, len2 / 2);
        const x1 = current.x - (dx1 / len1) * offset;
        const y1 = current.y - (dy1 / len1) * offset;
        const x2 = current.x + (dx2 / len2) * offset;
        const y2 = current.y + (dy2 / len2) * offset;

        path += i === 0 ? `M ${x1} ${y1} ` : `L ${x1} ${y1} `;
        path += `Q ${current.x} ${current.y} ${x2} ${y2} `;
      }
      return `${path}Z`;
    };

    const hexPath = computed(() =>
      generateRoundedHexagonPath(avatarSize.value, avatarRadius.value),
    );

    const avatarMediaStyle = computed(() => {
      if (avatarShape.value === "hex") {
        return { clipPath: `url(#${clipPathId})` };
      }
      const radius =
        avatarShape.value === "circle" ? "50%" : `${avatarRadius.value}px`;
      return { borderRadius: radius };
    });

    const { backgroundColor, textColor, handleBackgroundColorChange } =
      useColorPicker(tileId, props.content, emit);

    return {
      layoutStore,
      profileRoot,
      avatarRef,
      avatarInput,
      avatarShape,
      avatarRadius,
      avatarSrc,
      avatarMediaStyle,
      clipPathId,
      hexPath,
      showUrlInput,
      draftAvatarUrl,
      urlError,
      isEditing,
      activeEditor,
      nameEditor,
      titleEditor,
      bioEditor,
      backgroundColor,
      textColor,
      onShortClick,
      onExitClick,
      onResize,
      openCustomImagePicker,
      openUrlInput,
      cancelUrlInput,
      applyAvatarUrl,
      removeCustomImage,
      onAvatarSelected,
      onAvatarClick,
      setAvatarShape,
      onRadiusInput,
      onRadiusCommit,
      handleBackgroundColorChange,
      focusEditor,
      catchEditorClick,
    };
  },
});
</script>

<style scoped lang="scss">
@keyframes profile-tile-settle {
  0% {
    background-color: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.45);
  }
  100% {
    background-color: transparent;
    box-shadow: inset 0 0 0 2px transparent;
  }
}

.profile-bio {
  height: 100%;
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-md);
  overflow: hidden;
  animation: profile-tile-settle 0.9s var(--easing-ease-in-out) forwards;
}

.profile-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-lg);
  width: 100%;
}

.profile-avatar-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-lg);
  width: 100%;
}

.avatar {
  width: 152px;
  height: 152px;
  flex: 0 0 auto;
  cursor: pointer;
  position: relative;
  overflow: visible;
}

.avatar-media {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--color-base-8);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 11px;
  color: var(--color-content-default);
  text-align: center;
  padding: 6px;
}

.profile-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.profile-editor {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  transition: background-color var(--transition-normal);
}

.profile-editor.can-edit:hover {
  background-color: color-mix(
    in srgb,
    var(--tile-text-color) 5%,
    var(--color-editable-hover) 95%
  );
  cursor: text;
}

.profile-name :deep(.ProseMirror) {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.1;
  font-family: inherit;
  color: var(--tile-text-color);
}

.profile-title :deep(.ProseMirror) {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: color-mix(
    in srgb,
    var(--tile-text-color) 40%,
    var(--color-content-default) 60%
  );
  line-height: 1.3;
  font-family:
    "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  text-shadow: 0 0 34px rgba(51, 49, 44, 0.55);
}

.profile-bio-text {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.profile-bio-text :deep(.ProseMirror) {
  font-size: 16px;
  line-height: 1.3;
  font-weight: 400;
  font-family: inherit;
  color: color-mix(
    in srgb,
    var(--color-content-high) 30%,
    var(--tile-text-color) 70%
  );
}

.profile-bio :deep(.ProseMirror p) {
  margin: 0;
}

:deep(.ProseMirror:focus-visible) {
  outline: none;
}

.profile-controls {
  margin-left: auto;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background: var(--color-base-8);
  border: 1px solid var(--color-base-34);
}

.control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.control-label {
  font-size: 12px;
  color: var(--color-content-default);
}

.control-value {
  font-size: 12px;
  color: var(--color-content-default);
}

.control-btn {
  border: none;
  background: var(--color-base-34);
  color: var(--color-text-primary);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
}

.control-btn--ghost {
  background: transparent;
  border: 1px solid var(--color-base-34);
}

.control-btn--danger {
  background: var(--color-figma-red);
  color: #fff;
}

.control-url {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-url input {
  border: 1px solid var(--color-base-34);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  background: transparent;
  color: var(--color-text-primary);
}

.control-error {
  font-size: 11px;
  color: var(--color-figma-red);
}

.control-segment {
  display: flex;
  gap: 6px;
}

.control-segment button {
  border: 1px solid var(--color-base-34);
  background: transparent;
  color: var(--color-text-primary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
}

.control-segment button.active {
  background: var(--color-text-primary);
  color: var(--color-content-background);
}

:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--tile-text-color, var(--color-content-default));
  opacity: 0.4;
  pointer-events: none;
  height: 0;
}
</style>
