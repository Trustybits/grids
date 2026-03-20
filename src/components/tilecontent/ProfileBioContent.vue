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
              <clipPath :id="clipPathId" clipPathUnits="userSpaceOnUse">
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

          <!-- Radius drag handle — bottom-left hex corner -->
          <svg
            v-if="avatarShape === 'hex' && layoutStore.canEdit && isEditing"
            class="radius-handle"
            :style="radiusHandleStyle"
            @pointerdown.stop.prevent="onRadiusHandleDown"
          >
            <path
              :d="radiusHandlePath"
              fill="none"
              stroke="white"
              :stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span
            v-if="isDraggingRadius"
            class="radius-value-label"
            :style="radiusLabelStyle"
          >{{ avatarRadius }}</span>
        </div>
      </div>

      <div class="profile-meta" :style="{ '--tile-text-color': textColor }">
        <div
          class="profile-name profile-editor"
          :class="{ 'can-edit': layoutStore.canEdit }"
          :spellcheck="layoutStore.canEdit && isEditing"
          @mousedown="focusEditor(nameEditor, $event)"
          @click="catchEditorClick(nameEditor)"
        >
          <EditorContent :editor="nameEditor" />
        </div>
        <div
          class="profile-title profile-editor"
          :class="{ 'can-edit': layoutStore.canEdit }"
          :spellcheck="layoutStore.canEdit && isEditing"
          @mousedown="focusEditor(titleEditor, $event)"
          @click="catchEditorClick(titleEditor)"
        >
          <EditorContent :editor="titleEditor" />
        </div>
      </div>
    </div>

    <div
      class="profile-bio-text profile-editor"
      :class="{ 'can-edit': layoutStore.canEdit }"
      :spellcheck="layoutStore.canEdit && isEditing"
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

  <Teleport to="body">
    <transition name="profile-popover">
      <div
        v-if="showControls"
        class="profile-controls-popover"
        :style="popoverStyle"
        ref="popoverRef"
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

        <div v-if="avatarShape === 'square'" class="control-row">
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
    </transition>
  </Teleport>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
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
    const tileId = inject<string | null>("tileId", null);

    const { uploadFileToUrl, uploadExternalImageToStorage } = useFileUpload();
    const auth = getAuth();

    const isEditing = ref(false);
    const activeEditor = ref<any>(null);
    const pendingFocusEditor = ref<any>(null);
    const avatarInput = ref<HTMLInputElement | null>(null);
    const avatarRef = ref<HTMLDivElement | null>(null);
    const profileRoot = ref<HTMLDivElement | null>(null);
    const popoverRef = ref<HTMLDivElement | null>(null);
    const avatarSize = ref(152);
    const showControls = ref(false);
    const popoverPos = ref({ top: 0, left: 0 });

    const clipPathId = `avatar-clip-${Math.random().toString(36).slice(2, 9)}`;

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

    // Profile photo URL is stored in tile content.
    // Look up by the injected tile ID — this is stable and unique, unlike
    // content-field matching which breaks when multiple profile tiles share
    // the same default text or when text fields are edited mid-session.
    const avatarSrc = computed(() => {
      if (!tileId) return "";
      const tile = layoutStore.currentLayout?.tiles.find(t => t.i === tileId);
      return (tile?.content as any)?.profilePhotoUrl ?? "";
    });

    const saveProfilePhoto = async (url: string) => {
      if (!tileId) {
        console.error("No tileId injected — cannot save profile photo");
        return;
      }

      const tile = layoutStore.currentLayout?.tiles.find(t => t.i === tileId);
      if (!tile) {
        console.error(`Could not find tile ${tileId} in store for profile photo save`);
        return;
      }

      // Mutate the store's content reference directly, not props.content
      (tile.content as any).profilePhotoUrl = url;

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
      if (!layoutStore.canEdit) return;

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
      [() => layoutStore.canEdit, () => isEditing.value],
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
      if (!layoutStore.canEdit) return;
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
      if (!layoutStore.canEdit || !isEditing.value) return;
      const ed = editorRef?.value ?? editorRef;
      if (!ed) return;

      // If ProseMirror couldn't place a cursor (click was on empty space),
      // the editor will have lost focus. Re-focus at the end of the text.
      if (!ed.isFocused) {
        ed.commands.focus("end");
      }
    };

    const onShortClick = () => {
      if (!layoutStore.canEdit) return;
      if (!isEditing.value) {
        isEditing.value = true;
        if (!activeEditor.value) {
          activeEditor.value =
            nameEditor.value || titleEditor.value || bioEditor.value || null;
        }
      }
    };

    const onExitClick = () => {
      if (!layoutStore.canEdit) return;
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
      document.addEventListener("mousedown", onClickOutside);
    });

    onBeforeUnmount(() => {
      document.removeEventListener("mousedown", onClickOutside);
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
      if (!layoutStore.canEdit) return;
      props.content.avatarShape = shape;
      layoutStore.saveLayout();
    };

    const isDraggingRadius = ref(false);

    const onRadiusInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      avatarRadius.value = Number(target.value);
    };

    const onRadiusCommit = () => {
      if (!layoutStore.canEdit) return;
      props.content.avatarRadius = avatarRadius.value;
      layoutStore.saveLayout();
    };

    const hexBleed = computed(() => {
      // How many px the hex top/bottom extend beyond the square container
      const w = avatarSize.value;
      const fullHeight = w * 2 / Math.sqrt(3); // regular hex height
      return (fullHeight - w) / 2;
    });

    // --- Radius drag handle ---
    // The handle sits on the bottom-left hex corner. Dragging toward the
    // center of the avatar increases radius; dragging away decreases it.
    // We track the distance from the pointer to the hex center and map
    // that to a radius value.

    const onRadiusHandleDown = (e: PointerEvent) => {
      if (!layoutStore.canEdit) return;
      isDraggingRadius.value = true;

      const startRadius = avatarRadius.value;
      const startY = e.clientY;
      const startX = e.clientX;

      // Bottom-left corner direction: toward center is up-right,
      // away from center is down-left. We use a combined diagonal axis.
      const onMove = (me: PointerEvent) => {
        // Positive delta = dragged up-right (toward center) = increase radius
        const dx = me.clientX - startX;
        const dy = -(me.clientY - startY); // invert Y so up = positive
        const diag = (dx + dy) / 2; // average of both axes
        const sensitivity = 0.5;
        const newRadius = Math.round(
          Math.max(0, Math.min(40, startRadius + diag * sensitivity)),
        );
        avatarRadius.value = newRadius;
      };

      const onUp = () => {
        isDraggingRadius.value = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        // Commit the final value
        if (layoutStore.canEdit) {
          props.content.avatarRadius = avatarRadius.value;
          layoutStore.saveLayout();
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    };

    // Compute the position and arc path for the radius handle.
    // The handle is an arc segment drawn at the bottom-left hex corner,
    // matching the current corner radius.
    const radiusHandleStyle = computed(() => {
      const w = avatarSize.value;
      const h = w / Math.sqrt(3);
      const cy = w / 2 + hexBleed.value;
      // Bottom-left corner of hex: point index 4 = { x: 0, y: cy + h/2 }
      const cornerX = 0;
      const cornerY = cy + h / 2;
      // The handle SVG is positioned around this corner
      const pad = 20; // extra space around the arc
      return {
        position: "absolute" as const,
        left: `-26px`,
        top: `102px`,
        width: `${pad * 2 + avatarRadius.value}px`,
        height: `${pad * 2 + avatarRadius.value}px`,
        overflow: "visible",
        pointerEvents: "auto" as const,
        cursor: "grab",
        zIndex: 10,
      };
    });

    const radiusHandlePath = computed(() => {
      const w = avatarSize.value;
      const h = w / Math.sqrt(3);
      const cy = w / 2 + hexBleed.value;
      const r = avatarRadius.value;

      // Bottom-left corner: vertex 4 = (0, cy + h/2)
      // Prev vertex 3 = (w/2, cy + h), Next vertex 5 = (0, cy - h/2)
      const corner = { x: 0, y: cy + h / 2 };
      const prev = { x: w / 2, y: cy + h };
      const next = { x: 0, y: cy - h / 2 };

      // Direction from corner toward prev
      const dx1 = prev.x - corner.x;
      const dy1 = prev.y - corner.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

      // Direction from corner toward next
      const dx2 = next.x - corner.x;
      const dy2 = next.y - corner.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      const offset = Math.min(r, len1 / 2, len2 / 2);
      if (offset < 1) {
        // Too small to draw
        return "";
      }

      // Points where the arc starts and ends (on the hex edges)
      const arcStart = {
        x: corner.x + (dx1 / len1) * offset,
        y: corner.y + (dy1 / len1) * offset,
      };
      const arcEnd = {
        x: corner.x + (dx2 / len2) * offset,
        y: corner.y + (dy2 / len2) * offset,
      };

      // Offset into the SVG's local coordinate space
      const pad = 20;
      const lx = (x: number) => x - (corner.x - pad);
      const ly = (y: number) => y - (corner.y - pad);

      return `M ${lx(arcStart.x)} ${ly(arcStart.y)} Q ${lx(corner.x)} ${ly(corner.y)} ${lx(arcEnd.x)} ${ly(arcEnd.y)}`;
    });

    const radiusLabelStyle = computed(() => {
      const w = avatarSize.value;
      const h = w / Math.sqrt(3);
      const cy = w / 2 + hexBleed.value;
      // Position the label to the left of the bottom-left corner
      return {
        position: "absolute" as const,
        left: `-24px`,
        top: `${cy + h / 2 - 6}px`,
        fontSize: "12px",
        fontWeight: "700",
        color: "white",
        pointerEvents: "none" as const,
        whiteSpace: "nowrap" as const,
      };
    });

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
      if (!layoutStore.canEdit) return;
      avatarInput.value?.click();
    };

    const updatePopoverPos = () => {
      if (!avatarRef.value) return;
      const rect = avatarRef.value.getBoundingClientRect();
      popoverPos.value = {
        top: rect.top,
        left: rect.right + 8,
      };
    };

    const onClickOutside = (e: MouseEvent) => {
      if (!showControls.value) return;
      const target = e.target as Node;
      if (popoverRef.value?.contains(target)) return;
      if (avatarRef.value?.contains(target)) return;
      showControls.value = false;
      showUrlInput.value = false;
    };

    const onAvatarClick = () => {
      if (!layoutStore.canEdit) return;
      if (!isEditing.value) {
        isEditing.value = true;
      }
      if (showControls.value) {
        showControls.value = false;
        showUrlInput.value = false;
        return;
      }
      updatePopoverPos();
      showControls.value = true;
    };

    const popoverStyle = computed(() => ({
      position: "fixed" as const,
      top: `${popoverPos.value.top}px`,
      left: `${popoverPos.value.left}px`,
    }));

    const openUrlInput = () => {
      if (!layoutStore.canEdit) return;
      draftAvatarUrl.value = avatarSrc.value || "";
      urlError.value = "";
      showUrlInput.value = true;
    };

    const cancelUrlInput = () => {
      showUrlInput.value = false;
      urlError.value = "";
    };

    const applyAvatarUrl = async () => {
      if (!layoutStore.canEdit) return;
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
      if (!layoutStore.canEdit) return;
      showUrlInput.value = false;
      await saveProfilePhoto("");
    };

    const uploadAvatarImage = async (file: File) => {
      if (!layoutStore.canEdit) return;

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
      if (!layoutStore.canEdit) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadAvatarImage(file);
      if (avatarInput.value) avatarInput.value.value = "";
    };

    const generateRoundedHexagonPath = (size: number, radius: number) => {
      // Regular flat-top hexagon in pixel coords (userSpaceOnUse).
      // Width = size, height = size * 2/√3 ≈ size * 1.1547.
      // Centered vertically on the avatar-media element which is offset
      // upward by hexBleed so that the hex is visually centered in .avatar.
      const w = size;
      const h = w / Math.sqrt(3); // half-height in px
      const cy = w / 2 + hexBleed.value; // center Y inside the taller media box
      const points = [
        { x: w / 2, y: cy - h },
        { x: w,     y: cy - h / 2 },
        { x: w,     y: cy + h / 2 },
        { x: w / 2, y: cy + h },
        { x: 0,     y: cy + h / 2 },
        { x: 0,     y: cy - h / 2 },
      ];

      if (radius === 0) {
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

        const offset = Math.min(radius, len1 / 2, len2 / 2);
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
      generateRoundedHexagonPath(avatarSize.value * 0.98, avatarRadius.value),
    );

    const avatarMediaStyle = computed(() => {
      if (avatarShape.value === "hex") {
        const bleed = hexBleed.value;
        return {
          clipPath: `url(#${clipPathId})`,
          top: `${-bleed}px`,
          height: `calc(100% + ${bleed * 2}px)`,
        };
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
      popoverRef,
      avatarShape,
      avatarRadius,
      avatarSrc,
      avatarMediaStyle,
      clipPathId,
      hexPath,
      showControls,
      popoverStyle,
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
      isDraggingRadius,
      onRadiusHandleDown,
      radiusHandleStyle,
      radiusHandlePath,
      radiusLabelStyle,
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
  align-items: center;
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

.radius-handle {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
  transition: opacity 0.15s ease;
}

.radius-value-label {
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  user-select: none;
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
  margin: -6px -8px;
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

:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--tile-text-color, var(--color-content-default));
  opacity: 0.4;
  pointer-events: none;
  height: 0;
}
</style>

<style lang="scss">
/* Unscoped styles for the teleported popover */
.profile-controls-popover {
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  background: var(--color-base-8);
  border: 1px solid var(--color-base-34);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(16px);
  min-width: 200px;
}

.profile-popover-enter-active,
.profile-popover-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.profile-popover-enter-from,
.profile-popover-leave-to {
  opacity: 0;
  transform: translateX(-4px);
}

.profile-controls-popover .control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.profile-controls-popover .control-label {
  font-size: 12px;
  color: var(--color-content-default);
}

.profile-controls-popover .control-value {
  font-size: 12px;
  color: var(--color-content-default);
}

.profile-controls-popover .control-btn {
  border: none;
  background: var(--color-base-34);
  color: var(--color-text-primary);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
}

.profile-controls-popover .control-btn--ghost {
  background: transparent;
  border: 1px solid var(--color-base-34);
}

.profile-controls-popover .control-btn--danger {
  background: var(--color-figma-red);
  color: #fff;
}

.profile-controls-popover .control-url {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-controls-popover .control-url input {
  border: 1px solid var(--color-base-34);
  border-radius: var(--radius-sm);
  padding: 6px 8px;
  background: transparent;
  color: var(--color-text-primary);
}

.profile-controls-popover .control-error {
  font-size: 11px;
  color: var(--color-figma-red);
}

.profile-controls-popover .control-segment {
  display: flex;
  gap: 6px;
}

.profile-controls-popover .control-segment button {
  border: 1px solid var(--color-base-34);
  background: transparent;
  color: var(--color-text-primary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
}

.profile-controls-popover .control-segment button.active {
  background: var(--color-text-primary);
  color: var(--color-content-background);
}
</style>
