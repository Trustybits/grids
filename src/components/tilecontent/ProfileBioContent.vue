<template>
  <div
    class="profile-bio"
    ref="profileRoot"
    :class="layoutClasses"
    @mouseenter="isHovered = true"
    @mouseleave="if (!hoveredQuickAction) isHovered = false;"
  >
    <div class="profile-header">
      <div class="profile-avatar-row">
        <div
          class="avatar"
          ref="avatarRef"
          @click="onAvatarClick"
          :class="{ 'is-dragging-radius': isDraggingRadius }"
        >
          <svg
            v-if="effectiveAvatarShape === 'polygon'"
            class="avatar-clip-defs"
            width="0"
            height="0"
          >
            <defs>
              <clipPath :id="clipPathId" clipPathUnits="userSpaceOnUse">
                <path class="polygon-clip-path" :d="polygonPath" />
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
            <div
              v-else
              class="avatar-placeholder"
              @mouseenter="placeholderHovered = true"
              @mouseleave="placeholderHovered = false"
            >
              <span class="avatar-placeholder-label">Add photo</span>
              <div
                v-if="!isCompactProfileLayout"
                class="avatar-placeholder-buttons"
              >
                <button
                  class="placeholder-btn"
                  :class="{ 'placeholder-btn--default': placeholderHovered }"
                  @click.stop="openCustomImagePicker"
                >
                  <UploadMediaIcon />
                </button>
                <button
                  class="placeholder-btn"
                  :class="{ 'placeholder-btn--default': placeholderHovered }"
                  @click.stop="openUrlInput"
                >
                  <UrlSourceIcon />
                </button>
              </div>
            </div>

            <!-- Upload progress overlay -->
            <div v-if="isUploadingAvatar" class="avatar-upload-overlay">
              <div class="avatar-upload-track">
                <div
                  class="avatar-upload-fill"
                  :style="{ width: `${uploadPercent}%` }"
                ></div>
              </div>
            </div>
          </div>

          <!-- Radius knob — 10×10px circle, 8px inset from bottom-left corner -->
          <div
            v-if="
              !isCompactProfileLayout &&
              (effectiveAvatarShape === 'polygon' ||
                effectiveAvatarShape === 'square') &&
              avatarSrc &&
              layoutStore.canEdit &&
              (isEditing || isHovered)
            "
            class="radius-knob"
            :class="{ 'radius-knob--active': isDraggingRadius }"
            :style="radiusKnobPositionStyle"
            @pointerdown.stop.prevent="onRadiusHandleDown"
          ></div>
          <span
            v-if="isDraggingRadius"
            class="radius-value-label"
            :style="radiusLabelStyle"
            >{{ avatarRadius }}</span
          >

          <!-- Corners-count slider — centered below avatar -->
          <div
            v-if="
              !isCompactProfileLayout &&
              effectiveAvatarShape === 'polygon' &&
              avatarSrc &&
              layoutStore.canEdit &&
              (isEditing || isHovered)
            "
            class="sides-slider"
            @mouseenter="sidesSliderHovered = true"
            @mouseleave="sidesSliderHovered = false"
          >
            <span
              class="sides-label sides-label--min"
              :class="{ visible: sidesSliderHovered || isDraggingSides }"
              >3</span
            >
            <div class="sides-track-container" ref="sidesTrackRef">
              <div
                class="sides-track"
                :class="{ visible: sidesSliderHovered || isDraggingSides }"
              ></div>
              <div
                class="sides-knob"
                :class="{ 'sides-knob--active': isDraggingSides }"
                :style="sidesKnobStyle"
                @pointerdown.stop.prevent="onSidesKnobDown"
              ></div>
            </div>
            <span
              class="sides-label sides-label--max"
              :class="{ visible: sidesSliderHovered || isDraggingSides }"
              >8</span
            >
          </div>

          <!-- Avatar Action Bar — positioned on the avatar itself -->
          <div
            v-if="
              !isCompactProfileLayout &&
              avatarSrc &&
              layoutStore.canEdit &&
              (isEditing || isHovered)
            "
            class="avatar-action-bar"
            :class="{
              'avatar-action-bar--dimmed': isDraggingRadius,
              'avatar-action-bar--flyout-open': hoveredQuickAction !== null,
              'avatar-action-bar--zone-dimmed':
                hoveredToolbarZone === 'radius' ||
                hoveredToolbarZone === 'sides',
            }"
            @mousedown.stop
            @click.stop
            @mouseenter="hoveredToolbarZone = 'avatar'"
            @mouseleave="hoveredToolbarZone = null"
          >
            <!-- Delete / Remove Image -->
            <button
              v-if="avatarSrc"
              class="avatar-action-btn avatar-action-btn--delete"
              @click.stop="removeCustomImage"
            >
              <CloseIcon />
            </button>

            <!-- Quick Actions Group -->
            <div class="avatar-quick-actions">
              <!-- Shape Selector quickActionMenu -->
              <div
                v-if="avatarSrc"
                class="quick-action-menu"
                @mouseenter="
                  cancelQuickActionClose();
                  hoveredQuickAction = 'shape';
                "
                @mouseleave="scheduleQuickActionClose()"
              >
                <button
                  ref="shapeTriggerRef"
                  class="avatar-action-btn avatar-action-btn--active"
                  @click.stop
                >
                  <ShapeCircleIcon v-if="effectiveAvatarShape === 'circle'" />
                  <ShapeSquareIcon
                    v-else-if="effectiveAvatarShape === 'square'"
                  />
                  <ShapePolygonIcon v-else />
                </button>
              </div>

              <!-- Avatar Method quickActionMenu -->
              <div
                v-if="avatarSrc"
                class="quick-action-menu"
                @mouseenter="
                  cancelQuickActionClose();
                  hoveredQuickAction = 'avatar';
                "
                @mouseleave="scheduleQuickActionClose()"
              >
                <button
                  ref="avatarTriggerRef"
                  class="avatar-action-btn"
                  :class="{ 'avatar-action-btn--active': avatarSrc }"
                  @click.stop="onLastAvatarMethod"
                >
                  <UploadMediaIcon v-if="lastAvatarMethod === 'upload'" />
                  <UrlSourceIcon v-else />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="profile-meta" :style="{ '--tile-text-color': textColor }">
        <div
          class="profile-collapse"
          :class="{
            'profile-collapse--hidden': !isEditing && isNameEmpty && !allEmpty,
          }"
        >
          <div
            class="profile-name profile-editor"
            :class="{ 'can-edit': layoutStore.canEdit }"
            :spellcheck="layoutStore.canEdit && isEditing"
            @mousedown="focusEditor(nameEditor, $event)"
            @click="catchEditorClick(nameEditor)"
          >
            <EditorContent :editor="nameEditor" />
          </div>
        </div>
        <div
          class="profile-collapse"
          :class="{
            'profile-collapse--hidden': !isEditing && isTitleEmpty && !allEmpty,
          }"
        >
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
    </div>

    <div
      class="profile-collapse"
      :class="{
        'profile-collapse--hidden': !isEditing && isBioEmpty && !allEmpty,
      }"
      :style="{
        flex: isEditing || !isBioEmpty || allEmpty ? '1' : '0',
        minHeight: 0,
      }"
    >
      <div
        class="profile-bio-text profile-editor scrollable-thin"
        :class="{ 'can-edit': layoutStore.canEdit }"
        :spellcheck="layoutStore.canEdit && isEditing"
        :style="{ '--tile-text-color': textColor }"
        @mousedown="focusEditor(bioEditor, $event)"
        @click="catchEditorClick(bioEditor)"
      >
        <EditorContent :editor="bioEditor" />
      </div>
    </div>

    <input
      ref="avatarInput"
      type="file"
      accept="image/*"
      style="display: none"
      @change.stop="onAvatarSelected"
    />
  </div>

  <!-- URL Input overlay (shown when user picks "Use URL") -->
  <Teleport to="body">
    <transition name="profile-popover">
      <div
        v-if="showUrlInput"
        class="profile-controls-popover"
        :style="popoverStyle"
        ref="popoverRef"
        @mousedown.stop
      >
        <div class="control-url">
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
      </div>
    </transition>
  </Teleport>

  <!-- Teleported shape flyout -->
  <Teleport to="body">
    <div
      v-show="hoveredQuickAction === 'shape'"
      class="sub-actions-flyout"
      :style="shapeFlyoutStyle"
      @mouseenter="
        cancelQuickActionClose();
        hoveredQuickAction = 'shape';
      "
      @mouseleave="scheduleQuickActionClose()"
      @mousedown.stop
      @click.stop
    >
      <button
        class="avatar-action-btn"
        :class="{
          'avatar-action-btn--active': effectiveAvatarShape === 'circle',
        }"
        @click.stop="setAvatarShape('circle')"
      >
        <ShapeCircleIcon />
      </button>
      <button
        class="avatar-action-btn"
        :class="{
          'avatar-action-btn--active': effectiveAvatarShape === 'square',
        }"
        @click.stop="setAvatarShape('square')"
      >
        <ShapeSquareIcon />
      </button>
      <button
        class="avatar-action-btn"
        :class="{
          'avatar-action-btn--active': effectiveAvatarShape === 'polygon',
        }"
        @click.stop="setAvatarShape('polygon')"
      >
        <ShapePolygonIcon />
      </button>
    </div>
  </Teleport>

  <!-- Teleported avatar method flyout -->
  <Teleport to="body">
    <div
      v-show="hoveredQuickAction === 'avatar'"
      class="sub-actions-flyout"
      :style="avatarFlyoutStyle"
      @mouseenter="
        cancelQuickActionClose();
        hoveredQuickAction = 'avatar';
      "
      @mouseleave="scheduleQuickActionClose()"
      @mousedown.stop
      @click.stop
    >
      <button
        class="avatar-action-btn"
        :class="{
          'avatar-action-btn--active': lastAvatarMethod === 'url',
        }"
        @click.stop="openUrlInput"
      >
        <UrlSourceIcon />
      </button>
      <button
        class="avatar-action-btn"
        :class="{
          'avatar-action-btn--active': lastAvatarMethod === 'upload',
        }"
        @click.stop="openCustomImagePicker"
      >
        <UploadMediaIcon />
      </button>
    </div>
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
  type ComputedRef,
  type Ref,
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
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import Placeholder from "@tiptap/extension-placeholder";
import CloseIcon from "@/components/icons/actionbar/CloseIcon.vue";
import ShapeCircleIcon from "@/components/icons/actionbar/ShapeCircleIcon.vue";
import ShapeSquareIcon from "@/components/icons/actionbar/ShapeSquareIcon.vue";
import ShapePolygonIcon from "@/components/icons/actionbar/ShapePolygonIcon.vue";
import UploadMediaIcon from "@/components/icons/actionbar/UploadMediaIcon.vue";
import UrlSourceIcon from "@/components/icons/actionbar/UrlSourceIcon.vue";

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
    CloseIcon,
    ShapeCircleIcon,
    ShapeSquareIcon,
    ShapePolygonIcon,
    UploadMediaIcon,
    UrlSourceIcon,
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
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const hoveredToolbarZone = inject<Ref<string | null>>("hoveredToolbarZone");

    const layoutMode = computed((): string => {
      const w = gridTileW?.value ?? 4;
      const h = gridTileH?.value ?? 4;
      if (w <= 1 && h <= 1) return "mini";
      if (w === 1) return "narrow";
      if (h === 1) return "banner";
      if (h <= 2 && w >= 3) return "horizontal";
      return "default";
    });

    const layoutClasses = computed(() => {
      const h = gridTileH?.value ?? 4;
      const classes: Record<string, boolean> = {};
      classes[`layout-${layoutMode.value}`] = true;
      if (layoutMode.value === "narrow" && h < 2) {
        classes["narrow-short"] = true;
      }
      return classes;
    });

    const { uploadFileToUrl, uploadExternalImageToStorage } = useFileUpload();
    const auth = getAuth();
    const storage = getStorage();

    const isUploadingAvatar = ref(false);
    const uploadPercent = ref(0);

    const isHovered = ref(false);
    const isEditing = ref(false);
    const activeEditor = ref<any>(null);
    const pendingFocusEditor = ref<any>(null);
    const avatarInput = ref<HTMLInputElement | null>(null);
    const avatarRef = ref<HTMLDivElement | null>(null);
    const profileRoot = ref<HTMLDivElement | null>(null);
    const popoverRef = ref<HTMLDivElement | null>(null);
    const avatarSize = ref(152);
    const showControls = ref(false);
    const placeholderHovered = ref(false);
    const popoverPos = ref({ top: 0, left: 0 });
    const hoveredQuickAction = ref<"shape" | "avatar" | null>(null);
    const lastAvatarMethod = ref<"upload" | "url">("upload");
    const shapeTriggerRef = ref<HTMLElement | null>(null);
    const avatarTriggerRef = ref<HTMLElement | null>(null);
    let quickActionCloseTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleQuickActionClose = () => {
      quickActionCloseTimer = setTimeout(() => {
        hoveredQuickAction.value = null;
        // If the mouse already left the tile while the flyout was open,
        // isHovered was kept true to preserve the action bar. Clear it now
        // unless the pointer is actually still inside the tile.
        if (profileRoot.value && !profileRoot.value.matches(":hover")) {
          isHovered.value = false;
        }
      }, 60);
    };

    const cancelQuickActionClose = () => {
      if (quickActionCloseTimer) {
        clearTimeout(quickActionCloseTimer);
        quickActionCloseTimer = null;
      }
    };

    const clipPathId = `avatar-clip-${Math.random().toString(36).slice(2, 9)}`;

    const avatarRadius = ref(props.content.avatarRadius ?? 12);
    const avatarSides = ref(props.content.avatarSides ?? 6);
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

    const isNameEmpty = computed(() => nameEditor.value?.isEmpty ?? true);
    const isTitleEmpty = computed(() => titleEditor.value?.isEmpty ?? true);
    const isBioEmpty = computed(() => bioEditor.value?.isEmpty ?? true);
    const allEmpty = computed(
      () => isNameEmpty.value && isTitleEmpty.value && isBioEmpty.value,
    );

    const avatarShape = computed(() => props.content.avatarShape || "square");
    const isCompactProfileLayout = computed(
      () =>
        layoutMode.value === "mini" ||
        layoutMode.value === "narrow" ||
        layoutMode.value === "banner",
    );
    const effectiveAvatarShape = computed<AvatarShape>(() =>
      isCompactProfileLayout.value ? "square" : avatarShape.value,
    );

    // Profile photo URL is stored in tile content.
    // Look up by the injected tile ID — this is stable and unique, unlike
    // content-field matching which breaks when multiple profile tiles share
    // the same default text or when text fields are edited mid-session.
    const avatarSrc = computed(() => {
      if (!tileId) return "";
      const tile = layoutStore.currentLayout?.tiles.find((t) => t.i === tileId);
      return (tile?.content as any)?.profilePhotoUrl ?? "";
    });

    const saveProfilePhoto = async (url: string) => {
      if (!tileId) {
        console.error("No tileId injected — cannot save profile photo");
        return;
      }

      const tile = layoutStore.currentLayout?.tiles.find((t) => t.i === tileId);
      if (!tile) {
        console.error(
          `Could not find tile ${tileId} in store for profile photo save`,
        );
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

    watch(layoutMode, () => {
      nextTick(() => updateAvatarSize());
    });

    onMounted(() => {
      updateAvatarSize();
      document.addEventListener("mousedown", onClickOutside);
    });

    onBeforeUnmount(() => {
      document.removeEventListener("mousedown", onClickOutside);
      cancelQuickActionClose();
    });

    watch(
      () => props.content.avatarRadius,
      (value) => {
        if (typeof value === "number") {
          avatarRadius.value = value;
        }
      },
    );

    watch(
      () => props.content.avatarSides,
      (value) => {
        if (typeof value === "number") {
          avatarSides.value = value;
        }
      },
    );

    const setAvatarShape = (shape: AvatarShape) => {
      if (!layoutStore.canEdit) return;
      props.content.avatarShape = shape;
      layoutStore.saveLayout();
    };

    const isDraggingRadius = ref(false);
    const isDraggingSides = ref(false);
    const sidesSliderHovered = ref(false);
    const sidesTrackRef = ref<HTMLDivElement | null>(null);

    const onRadiusInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      avatarRadius.value = Number(target.value);
    };

    const onRadiusCommit = () => {
      if (!layoutStore.canEdit) return;
      props.content.avatarRadius = avatarRadius.value;
      layoutStore.saveLayout();
    };

    // Compute geometry for a regular N-gon oriented with a vertex at top.
    // The polygon is sized so min(bboxWidth, bboxHeight) = avatarSize,
    // ensuring all shapes are at least 152×152. The larger dimension overflows.
    // The polygon's BOUNDING BOX is centered within the container so that
    // overflow is distributed equally on all sides.
    const polyGeometry = computed(() => {
      const n = avatarSides.value;
      const size = avatarSize.value;
      const angleOffset = -Math.PI / 2;

      // Compute bounding box of a unit-circumradius N-gon (R=1)
      let minX = Infinity,
        maxX = -Infinity;
      let minY = Infinity,
        maxY = -Infinity;
      for (let i = 0; i < n; i++) {
        const angle = angleOffset + (2 * Math.PI * i) / n;
        const x = Math.cos(angle);
        const y = Math.sin(angle);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      const unitW = maxX - minX;
      const unitH = maxY - minY;

      // Center of the bounding box in unit space (relative to circumcenter)
      const unitBboxCenterX = (minX + maxX) / 2;
      const unitBboxCenterY = (minY + maxY) / 2;

      // Scale R so that min(bboxW, bboxH) = size
      const R = size / Math.min(unitW, unitH);
      const bboxW = unitW * R;
      const bboxH = unitH * R;

      // Overflow beyond the 152px container on each side
      const bleedX = Math.max(0, (bboxW - size) / 2);
      const bleedY = Math.max(0, (bboxH - size) / 2);

      // Offset from circumcenter to bounding-box center (in px).
      // For odd-sided polygons this is non-zero vertically.
      const bboxOffsetX = unitBboxCenterX * R;
      const bboxOffsetY = unitBboxCenterY * R;

      return { R, bboxW, bboxH, bleedX, bleedY, bboxOffsetX, bboxOffsetY };
    });

    // --- Radius drag handle ---
    // The handle sits on the bottom-left polygon corner. Dragging toward the
    // center of the avatar increases radius; dragging away decreases it.
    // We track the distance from the pointer to the polygon center and map
    // that to a radius value.

    const onRadiusHandleDown = (e: PointerEvent) => {
      if (!layoutStore.canEdit) return;
      isDraggingRadius.value = true;

      const startRadius = avatarRadius.value;
      const startX = e.clientX;
      const startY = e.clientY;

      // Get the inward direction (toward avatar center) at drag start so we
      // can project mouse movement onto it. This makes the drag feel natural:
      // moving the mouse toward the center increases radius, away decreases.
      // Note: computeArcMidpoint works in DOM/SVG coordinates (Y increases
      // downward), which matches clientX/clientY — no axis flip needed.
      const { inwardX, inwardY } = computeArcMidpoint();
      const screenInX = inwardX;
      const screenInY = inwardY;

      // Sensitivity: radius units per pixel of mouse movement along the
      // inward axis.  Higher = less mouse travel needed.
      // At 1.5, ~27px of diagonal drag covers the full 0–40 range.
      const DRAG_SENSITIVITY = 1.5; // ← adjust drag speed here

      const onMove = (me: PointerEvent) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        // Project mouse delta onto the inward direction vector
        const projected = dx * screenInX + dy * screenInY;
        const newRadius = Math.round(
          Math.max(0, Math.min(40, startRadius + projected * DRAG_SENSITIVITY)),
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

    // Get the corner + adjacent edge directions for the radius handle.
    // Works for both 'square' (bottom-left corner) and 'polygon' (polygon vertex).
    const radiusHandleVertex = computed(() => {
      const size = avatarSize.value;

      if (avatarShape.value === "square") {
        // Bottom-left corner of the 152×152 square
        return {
          corner: { x: 0, y: size },
          prev: { x: 0, y: 0 }, // left edge going up
          next: { x: size, y: size }, // bottom edge going right
        };
      }

      // Polygon (polygon) mode — pick the bottom-left-ish vertex
      const n = avatarSides.value;
      const { R, bleedX, bleedY, bboxOffsetX, bboxOffsetY } =
        polyGeometry.value;
      const cx = size / 2 + bleedX - bboxOffsetX;
      const cy = size / 2 + bleedY - bboxOffsetY;
      const angleOffset = -Math.PI / 2;

      const vertices: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const angle = angleOffset + (2 * Math.PI * i) / n;
        vertices.push({
          x: cx + R * Math.cos(angle),
          y: cy + R * Math.sin(angle),
        });
      }

      let bestIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < n; i++) {
        const v = vertices[i];
        if (v.y >= cy) {
          const score = v.x - v.y;
          if (score < bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
      }

      const corner = vertices[bestIdx];
      const prev = vertices[(bestIdx - 1 + n) % n];
      const next = vertices[(bestIdx + 1) % n];
      return { corner, prev, next };
    });

    // ─── Arc-midpoint helper ───────────────────────────────────────────
    //
    // Both the radius knob and the radius label need the same geometric
    // point: the *midpoint of the rounded corner arc*. This helper
    // computes that point plus a unit vector pointing INWARD (toward
    // the avatar center), which callers use to offset the knob/label.
    //
    // Geometry overview (same for square & polygon):
    //
    //   1. `corner` is the raw vertex of the polygon/square in media-box
    //      coordinates (for polygon, this includes bleed padding).
    //
    //   2. `prev` and `next` are the neighbouring vertices.
    //
    //   3. `offset = min(radius, halfEdge1, halfEdge2)` — how far from
    //      the corner the arc starts/ends along each edge.
    //
    //   4. `arcStart` / `arcEnd` are the two points on the edges where
    //      the rounding arc begins and ends.
    //
    //   5. For **square**: the arc is a true circular arc. We find the
    //      circle center (`cc`) inset from the corner along both edges
    //      by `offset`, then project from `cc` toward the corner to
    //      land on the circle ⇒ `arcMid`.
    //
    //   6. For **polygon**: the arc is a quadratic Bézier with control
    //      point at `corner`. The midpoint B(0.5) = 0.25·P0 + 0.5·P1
    //      + 0.25·P2.
    //
    //   7. `inwardX/Y` is the unit vector from `arcMid` pointing toward
    //      the avatar center. Multiply by a positive px value to move
    //      *toward* center; negative to move *away*.
    //
    // Returns: { arcMidX, arcMidY, inwardX, inwardY } in media-box coords.
    //
    const computeArcMidpoint = () => {
      const { corner, prev, next } = radiusHandleVertex.value;
      const isSquare = avatarShape.value === "square";
      const bleedX = isSquare ? 0 : polyGeometry.value.bleedX;
      const bleedY = isSquare ? 0 : polyGeometry.value.bleedY;
      const r = avatarRadius.value;
      const size = avatarSize.value;

      // Step 1 — edge vectors from corner to neighbours
      const dx1 = prev.x - corner.x;
      const dy1 = prev.y - corner.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const dx2 = next.x - corner.x;
      const dy2 = next.y - corner.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      // Step 2 — how far the rounding extends along each edge
      //          (clamped so arcs of adjacent corners don't overlap)
      const offset = Math.min(r, len1 / 2, len2 / 2);

      // Step 3 — arc start/end points on the two edges
      const arcStart = {
        x: corner.x + (dx1 / len1) * offset,
        y: corner.y + (dy1 / len1) * offset,
      };
      const arcEnd = {
        x: corner.x + (dx2 / len2) * offset,
        y: corner.y + (dy2 / len2) * offset,
      };

      // Step 4 — arc midpoint
      let arcMidX: number;
      let arcMidY: number;

      if (isSquare) {
        // Circle center: corner + offset along edge1 + offset along edge2
        const ccX = corner.x + (dx1 / len1) * offset + (dx2 / len2) * offset;
        const ccY = corner.y + (dy1 / len1) * offset + (dy2 / len2) * offset;
        // Direction from cc toward the corner (outward)
        const toCX = corner.x - ccX;
        const toCY = corner.y - ccY;
        const toCLen = Math.sqrt(toCX * toCX + toCY * toCY) || 1;
        // Project from cc toward corner by `offset` to land on the arc
        arcMidX = ccX + (toCX / toCLen) * offset;
        arcMidY = ccY + (toCY / toCLen) * offset;
      } else {
        // Quadratic Bézier midpoint: B(0.5) = 0.25·start + 0.5·corner + 0.25·end
        arcMidX = 0.25 * arcStart.x + 0.5 * corner.x + 0.25 * arcEnd.x;
        arcMidY = 0.25 * arcStart.y + 0.5 * corner.y + 0.25 * arcEnd.y;
      }

      // Step 5 — inward unit vector (arcMid → avatar center)
      //          Avatar center in media-box coords = (size/2 + bleedX, size/2 + bleedY)
      const centerX = size / 2 + bleedX;
      const centerY = size / 2 + bleedY;
      const towardCX = centerX - arcMidX;
      const towardCY = centerY - arcMidY;
      const towardLen =
        Math.sqrt(towardCX * towardCX + towardCY * towardCY) || 1;
      const inwardX = towardCX / towardLen;
      const inwardY = towardCY / towardLen;

      return { arcMidX, arcMidY, inwardX, inwardY, bleedX, bleedY };
    };

    // ─── Radius label position ──────────────────────────────────────────
    //
    // The label sits INWARD from the arc midpoint (toward avatar center).
    //
    // Tunables (change these to adjust placement):
    //   LABEL_INWARD_PX  — how far toward center from the arc midpoint
    //   LABEL_W          — fixed width of the label box (right-aligned text)
    //   LABEL_H          — approximate rendered height of the label text
    //
    const LABEL_INWARD_PX = -10; // ← adjust to move label closer/further from corner
    const LABEL_W = 20; // fixed width — fits up to 2-digit values
    const LABEL_H = 14; // approx line-height for 12px bold

    const radiusLabelStyle = computed(() => {
      const { arcMidX, arcMidY, inwardX, inwardY, bleedX, bleedY } =
        computeArcMidpoint();

      // Offset the anchor inward from the arc midpoint
      const anchorX = arcMidX + inwardX * LABEL_INWARD_PX - bleedX;
      const anchorY = arcMidY + inwardY * LABEL_INWARD_PX - bleedY;

      return {
        position: "absolute" as const,
        // Right-align: the right edge of the box sits at anchorX
        left: `${anchorX - LABEL_W / 2}px`,
        top: `${anchorY - LABEL_H / 2}px`,
        width: `${LABEL_W}px`,
        fontSize: "12px",
        fontWeight: "700",
        textAlign: "center" as const,
        color: "var(--tile-text-color)",
        pointerEvents: "none" as const,
        whiteSpace: "nowrap" as const,
      };
    });

    // ─── Radius knob position ───────────────────────────────────────────
    //
    // The knob sits on the arc midpoint, pushed INWARD toward the avatar
    // center so it doesn't overlap the visible edge of the rounded corner.
    //
    // Tunables:
    //   KNOB_INWARD_PX — how far toward center from the arc midpoint
    //   KNOB_SIZE      — knob element width/height (for centering)
    //
    const KNOB_INWARD_PX = 12; // ← adjust to move knob closer/further from corner
    const KNOB_SIZE = 10;

    const radiusKnobPositionStyle = computed(() => {
      const { arcMidX, arcMidY, inwardX, inwardY, bleedX, bleedY } =
        computeArcMidpoint();

      // Offset inward from the arc midpoint, then convert to avatar-container
      // coords by subtracting bleed, and center the knob element.
      const x = arcMidX + inwardX * KNOB_INWARD_PX - bleedX - KNOB_SIZE / 2;
      const y = arcMidY + inwardY * KNOB_INWARD_PX - bleedY - KNOB_SIZE / 2;

      return {
        position: "absolute" as const,
        left: `${x}px`,
        top: `${y}px`,
        zIndex: 10,
      };
    });

    // --- Sides slider (corners count) ---
    // The knob position maps avatarSides (3–8) to a 0–1 fraction on the track.
    const SIDES_MIN = 3;
    const SIDES_MAX = 8;

    const sidesKnobStyle = computed(() => {
      const fraction =
        (avatarSides.value - SIDES_MIN) / (SIDES_MAX - SIDES_MIN);
      return {
        left: `${fraction * 100}%`,
      };
    });

    const onSidesKnobDown = (e: PointerEvent) => {
      if (!layoutStore.canEdit) return;
      isDraggingSides.value = true;

      const track = sidesTrackRef.value;
      if (!track) return;

      const updateSidesFromPointer = (clientX: number) => {
        const rect = track.getBoundingClientRect();
        const fraction = Math.max(
          0,
          Math.min(1, (clientX - rect.left) / rect.width),
        );
        const raw = SIDES_MIN + fraction * (SIDES_MAX - SIDES_MIN);
        avatarSides.value = Math.round(raw);
      };

      updateSidesFromPointer(e.clientX);

      const onMove = (me: PointerEvent) => {
        updateSidesFromPointer(me.clientX);
      };

      const onUp = () => {
        isDraggingSides.value = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (layoutStore.canEdit) {
          props.content.avatarSides = avatarSides.value;
          layoutStore.saveLayout();
        }
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
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
      if (!layoutStore.canEdit || isCompactProfileLayout.value) return;
      lastAvatarMethod.value = "upload";
      avatarInput.value?.click();
    };

    const onLastAvatarMethod = () => {
      if (!layoutStore.canEdit || isCompactProfileLayout.value) return;
      if (lastAvatarMethod.value === "upload") {
        openCustomImagePicker();
      } else {
        openUrlInput();
      }
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
      if (!showUrlInput.value) return;
      const target = e.target as Node;
      if (popoverRef.value?.contains(target)) return;
      if (avatarRef.value?.contains(target)) return;
      showUrlInput.value = false;
    };

    const onAvatarClick = () => {
      if (!layoutStore.canEdit || isCompactProfileLayout.value) return;
      if (!isEditing.value) {
        isEditing.value = true;
      }
    };

    const popoverStyle = computed(() => ({
      position: "fixed" as const,
      top: `${popoverPos.value.top}px`,
      left: `${popoverPos.value.left}px`,
    }));

    const openUrlInput = () => {
      if (!layoutStore.canEdit || isCompactProfileLayout.value) return;
      lastAvatarMethod.value = "url";
      draftAvatarUrl.value = avatarSrc.value || "";
      urlError.value = "";
      updatePopoverPos();
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
      if (!layoutStore.canEdit || isCompactProfileLayout.value) return;
      showUrlInput.value = false;
      await saveProfilePhoto("");
    };

    const uploadAvatarImage = async (file: File) => {
      if (!layoutStore.canEdit) return;

      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        alert("You must be logged in to upload.");
        return;
      }

      // Remember previous photo in case we need to revert on failure
      const previousUrl = avatarSrc.value;

      // Optimistic: show local blob preview immediately
      const blobUrl = URL.createObjectURL(file);
      await saveProfilePhoto(blobUrl);

      isUploadingAvatar.value = true;
      uploadPercent.value = 0;

      try {
        const filePath = `users/${currentUser.uid}/images/${Date.now()}_${file.name}`;
        const fileRef = storageRef(storage, filePath);
        const metadata = { customMetadata: { published: "true" } };

        const uploadTask = uploadBytesResumable(fileRef, file, metadata);
        uploadTask.on("state_changed", (snapshot) => {
          uploadPercent.value = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );
        });

        await uploadTask;
        const permanentUrl = await getDownloadURL(fileRef);

        // Swap blob URL for permanent Firebase URL
        URL.revokeObjectURL(blobUrl);
        await saveProfilePhoto(permanentUrl);
      } catch (error: any) {
        console.error("Avatar upload failed:", error);
        URL.revokeObjectURL(blobUrl);
        // Revert to previous photo
        await saveProfilePhoto(previousUrl);
        alert(error.message || "Failed to upload image. Please try again.");
      } finally {
        isUploadingAvatar.value = false;
        uploadPercent.value = 0;
      }
    };

    const onAvatarSelected = async (event: Event) => {
      if (!layoutStore.canEdit) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadAvatarImage(file);
      if (avatarInput.value) avatarInput.value.value = "";
    };

    // Always emit exactly FIXED_SEGMENTS segments so that CSS `d` transition
    // can interpolate smoothly between any two side counts (3–8).
    // Each segment = L … Q … — same command structure regardless of N.
    const FIXED_SEGMENTS = 24; // LCM-friendly count; enough for smooth curves

    const generateRoundedPolygonPath = (sides: number, radius: number) => {
      const n = Math.max(3, Math.min(8, Math.round(sides)));
      const { R, bleedX, bleedY, bboxOffsetX, bboxOffsetY } =
        polyGeometry.value;
      const size = avatarSize.value;

      // The media box is (size + 2*bleedX) × (size + 2*bleedY).
      // We want the polygon's BOUNDING BOX centered in the media box.
      // The media-box center is at (size/2 + bleedX, size/2 + bleedY).
      // The bbox center = circumcenter + bboxOffset, so:
      // circumcenter = media-box center - bboxOffset
      const cx = size / 2 + bleedX - bboxOffsetX;
      const cy = size / 2 + bleedY - bboxOffsetY;

      const angleOffset = -Math.PI / 2;
      const vertices: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const angle = angleOffset + (2 * Math.PI * i) / n;
        vertices.push({
          x: cx + R * Math.cos(angle),
          y: cy + R * Math.sin(angle),
        });
      }

      // Upsample to FIXED_SEGMENTS points by distributing extras along edges.
      // This ensures every path has exactly the same number of L/Q commands.
      // Track which points are actual polygon vertices (get rounding) vs
      // intermediate edge points (pass through with zero rounding).
      // For vertex points, store the vertex index so we can look up the
      // correct edge direction vectors from the original vertices array.
      const points: {
        x: number;
        y: number;
        isVertex: boolean;
        vertexIdx: number;
      }[] = [];
      const perEdge = Math.floor(FIXED_SEGMENTS / n);
      let remainder = FIXED_SEGMENTS - perEdge * n;
      for (let i = 0; i < n; i++) {
        const a = vertices[i];
        const b = vertices[(i + 1) % n];
        const segs = perEdge + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        for (let j = 0; j < segs; j++) {
          const t = j / segs;
          points.push({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            isVertex: j === 0,
            vertexIdx: i,
          });
        }
      }

      // Compute the max rounding offset from the actual edge length
      const edgeLen = Math.sqrt(
        (vertices[1].x - vertices[0].x) ** 2 +
          (vertices[1].y - vertices[0].y) ** 2,
      );
      const maxOffset = edgeLen / 2;

      // Build path with rounded corners only at real vertices;
      // intermediate upsampled points get degenerate Q (no rounding).
      let path = "";
      const pLen = points.length;
      for (let i = 0; i < pLen; i++) {
        const current = points[i];
        const next = points[(i + 1) % pLen];
        const prev = points[(i - 1 + pLen) % pLen];

        if (current.isVertex) {
          // Use direction vectors from the actual polygon vertices
          // so the offset scales correctly along the real edges.
          const vi = current.vertexIdx;
          const vPrev = vertices[(vi - 1 + n) % n];
          const vNext = vertices[(vi + 1) % n];

          const edx1 = vPrev.x - current.x;
          const edy1 = vPrev.y - current.y;
          const elen1 = Math.sqrt(edx1 * edx1 + edy1 * edy1);

          const edx2 = vNext.x - current.x;
          const edy2 = vNext.y - current.y;
          const elen2 = Math.sqrt(edx2 * edx2 + edy2 * edy2);

          const offset = Math.min(radius, maxOffset);

          if (offset < 0.1 || elen1 === 0 || elen2 === 0) {
            if (i === 0) path += `M ${current.x} ${current.y} `;
            else path += `L ${current.x} ${current.y} `;
            path += `Q ${current.x} ${current.y} ${current.x} ${current.y} `;
          } else {
            const x1 = current.x + (edx1 / elen1) * offset;
            const y1 = current.y + (edy1 / elen1) * offset;
            const x2 = current.x + (edx2 / elen2) * offset;
            const y2 = current.y + (edy2 / elen2) * offset;

            path += i === 0 ? `M ${x1} ${y1} ` : `L ${x1} ${y1} `;
            path += `Q ${current.x} ${current.y} ${x2} ${y2} `;
          }
        } else {
          // Intermediate upsampled point — degenerate Q (no rounding)
          if (i === 0) path += `M ${current.x} ${current.y} `;
          else path += `L ${current.x} ${current.y} `;
          path += `Q ${current.x} ${current.y} ${current.x} ${current.y} `;
        }
      }
      return `${path}Z`;
    };

    const polygonPath = computed(() =>
      generateRoundedPolygonPath(avatarSides.value * 0.98, avatarRadius.value),
    );

    const avatarMediaStyle = computed(() => {
      if (effectiveAvatarShape.value === "polygon") {
        const { bleedX, bleedY } = polyGeometry.value;
        return {
          clipPath: `url(#${clipPathId})`,
          top: `${-bleedY}px`,
          left: `${-bleedX}px`,
          width: `calc(100% + ${bleedX * 2}px)`,
          height: `calc(100% + ${bleedY * 2}px)`,
        };
      }
      const radius = isCompactProfileLayout.value
        ? "0px"
        : effectiveAvatarShape.value === "circle"
          ? "50%"
          : `${avatarRadius.value}px`;
      return { borderRadius: radius };
    });

    const { backgroundColor, textColor, handleBackgroundColorChange } =
      useColorPicker(tileId, props.content, emit);

    watch(isDraggingRadius, (dragging) => {
      if (!hoveredToolbarZone) return;
      hoveredToolbarZone.value = dragging ? "radius" : null;
    });

    watch(isDraggingSides, (dragging) => {
      if (!hoveredToolbarZone) return;
      hoveredToolbarZone.value = dragging ? "sides" : null;
    });

    const getFlyoutStyle = (triggerRef: Ref<HTMLElement | null>) => {
      const el = triggerRef.value;
      if (!el)
        return {
          position: "fixed" as const,
          top: "0px",
          left: "0px",
          visibility: "hidden" as const,
        };
      const rect = el.getBoundingClientRect();
      return {
        position: "fixed" as const,
        top: `${rect.top}px`,
        left: `${rect.right + 4}px`,
      };
    };

    const shapeFlyoutStyle = computed(() => {
      // Touch hoveredQuickAction so we recalculate position when flyout opens
      void hoveredQuickAction.value;
      return getFlyoutStyle(shapeTriggerRef);
    });
    const avatarFlyoutStyle = computed(() => {
      void hoveredQuickAction.value;
      return getFlyoutStyle(avatarTriggerRef);
    });

    return {
      layoutStore,
      profileRoot,
      avatarRef,
      avatarInput,
      popoverRef,
      avatarShape,
      effectiveAvatarShape,
      isCompactProfileLayout,
      avatarRadius,
      avatarSides,
      avatarSrc,
      avatarMediaStyle,
      isUploadingAvatar,
      uploadPercent,
      clipPathId,
      polygonPath,
      showControls,
      placeholderHovered,
      popoverStyle,
      showUrlInput,
      draftAvatarUrl,
      urlError,
      isHovered,
      isEditing,
      isNameEmpty,
      isTitleEmpty,
      isBioEmpty,
      allEmpty,
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
      radiusKnobPositionStyle,
      radiusLabelStyle,
      isDraggingSides,
      sidesSliderHovered,
      sidesTrackRef,
      sidesKnobStyle,
      onSidesKnobDown,
      handleBackgroundColorChange,
      focusEditor,
      catchEditorClick,
      hoveredQuickAction,
      lastAvatarMethod,
      onLastAvatarMethod,
      layoutClasses,
      hoveredToolbarZone,
      shapeTriggerRef,
      avatarTriggerRef,
      shapeFlyoutStyle,
      avatarFlyoutStyle,
      scheduleQuickActionClose,
      cancelQuickActionClose,
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
  border-radius: var(--tile-border-radius);
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
  transition:
    width var(--duration-slow) var(--easing-smooth),
    height var(--duration-slow) var(--easing-smooth);
}

/* ── Horizontal Layout (Nx2 tiles) ─────────────────────────────────
   When the tile is short and wide (h ≤ 2, w ≥ 3), switch to a
   side-by-side layout: avatar left, name/title/bio stacked right.
   Uses display:contents on .profile-header so its children become
   direct grid participants without restructuring the DOM. */

.profile-bio.layout-horizontal {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--spacing-lg) var(--spacing-lg);
  align-items: start;
}

.layout-horizontal .profile-header {
  display: contents;
}

.layout-horizontal .profile-avatar-row {
  grid-column: 1;
  grid-row: 1 / -1;
  align-self: center;
  width: auto;
}

.layout-horizontal .avatar {
  min-width: 32px;
  min-height: 32px;
  max-width: 152px;
  max-height: 152px;
}

.layout-horizontal .profile-meta {
  grid-column: 2;
  grid-row: 1;
  align-self: end;
}

.layout-horizontal > .profile-collapse {
  grid-column: 2;
  grid-row: 2;
  min-height: 0;
  overflow: hidden;
  height: 100%;
}

.layout-horizontal .profile-name :deep(.ProseMirror) {
  font-size: 30px;
}

.layout-horizontal .profile-bio-text :deep(.ProseMirror) {
  font-size: 14px;
}

/* ── Mini (1×1) ────────────────────────────────────────────────────
   Avatar only, centered, everything else hidden. */

.profile-bio.layout-mini {
  padding: var(--spacing-sm);
  align-items: center;
  justify-content: center;
  gap: 0;
}

.layout-mini .profile-header {
  align-items: center;
  justify-content: center;
  gap: 0;
  flex: 0 0 auto;
}

.layout-mini .profile-avatar-row {
  justify-content: center;
  width: auto;
}

.layout-mini .avatar {
  width: 75px;
  height: 75px;
}

.layout-mini .profile-meta {
  display: none;
}

.layout-mini > .profile-collapse {
  display: none;
}

/* ── Narrow (1×N) ──────────────────────────────────────────────────
   Vertical stack, compact padding, small centered avatar,
   name below. Title shown when h ≥ 2, bio always hidden. */

.profile-bio.layout-narrow {
  padding: 0 var(--spacing-sm);
  align-items: center;
  gap: var(--spacing-md);
}

.layout-narrow > .profile-collapse {
  display: none;
}

.narrow-short .profile-meta > .profile-collapse:last-child {
  display: none;
}

.layout-narrow .profile-header {
  align-items: center;
  gap: var(--spacing-md);
}

.layout-narrow .profile-avatar-row {
  justify-content: center;
  width: auto;
}

.layout-narrow .avatar {
  width: 75px;
  height: 75px;
}

.layout-narrow .profile-meta {
  align-items: center;
  width: 100%;
}

.layout-narrow .profile-name :deep(.ProseMirror) {
  font-size: 16px;
  text-align: center;
  line-height: 1.2;
}

.layout-narrow .profile-title :deep(.ProseMirror) {
  font-size: 10px;
  text-align: center;
  letter-spacing: 0.08em;
}

/* ── Banner (N×1) ──────────────────────────────────────────────────
   Horizontal row: small avatar left, name right.
   Title and bio hidden. */

.profile-bio.layout-banner {
  padding: 0 var(--spacing-sm) 0 0;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: 1fr;
  gap: 0 var(--spacing-md);
  align-items: center;
}

.layout-banner .profile-header {
  display: contents;
}

.layout-banner > .profile-collapse {
  display: none;
}

.layout-banner .profile-avatar-row {
  grid-column: 1;
  grid-row: 1;
  align-self: center;
  width: auto;
}

.layout-banner .avatar {
  width: 75px;
  height: 75px;
}

.layout-banner .profile-meta {
  grid-column: 2;
  grid-row: 1;
  align-self: center;
  min-width: 0;
  gap: 2px;
}

.layout-banner .profile-name :deep(.ProseMirror) {
  font-size: 26px;
  line-height: 1.1;
}

.layout-banner .profile-title :deep(.ProseMirror) {
  font-size: 12px;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.polygon-clip-path {
  transition: d 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Kill transitions while dragging the radius knob so the clip path
   and border-radius update instantly in sync with the knob position */
.avatar.is-dragging-radius .polygon-clip-path {
  transition: none;
}

.avatar.is-dragging-radius .avatar-media {
  transition: none !important;
}

.radius-knob {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 100px;
  background: var(--color-knob);
  border: 0.2px solid rgba(0, 0, 0, 0.21);
  box-shadow:
    0 0 12px 0 rgba(0, 0, 0, 0.25),
    0 4px 4px 0 rgba(0, 0, 0, 0.25),
    0 0 4px 0 rgba(0, 0, 0, 0.25),
    0 0 8px 0 rgba(0, 0, 0, 0.25);
  cursor: grab;
  pointer-events: auto;
  transition:
    border-color var(--duration-fast) var(--easing-ease-in-out),
    transform var(--transition-slow);
}

.radius-knob::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}

.radius-knob:hover {
  transform: scale(1.4);
}

.radius-knob--active,
.radius-knob--active:hover {
  cursor: grabbing;
  border: 1px solid var(--color-figma-purple);
  transform: scale(2);
  transition:
    border-color var(--duration-fast) var(--easing-ease-in-out),
    transform 1.2s var(--easing-spring);
}

.radius-value-label {
  user-select: none;
  color: var(--tile-text-color);
}

.sides-slider {
  position: absolute;
  bottom: -20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
  pointer-events: auto;
}

.sides-label {
  font-family: "Inter", sans-serif;
  font-weight: 700;
  font-size: 15px;
  line-height: 1;
  color: transparent;
  transition: color 0.15s ease;
  user-select: none;
  pointer-events: none;
}

.sides-label.visible {
  color: var(--tile-text-color);
}

.sides-track-container {
  position: relative;
  width: 100px;
  height: 10px;
}

.sides-track {
  position: absolute;
  top: 3px;
  left: 0;
  width: 100%;
  height: 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--tile-text-color) 13%, transparent 15%);
  transition: background 0.15s ease;
}

.sides-track.visible {
  background: color-mix(in srgb, var(--tile-text-color) 13%, transparent 15%);
}

.sides-knob {
  position: absolute;
  top: 0;
  width: 10px;
  height: 10px;
  border-radius: 100px;
  background: var(--tile-text-color);
  transform: translateX(-50%) scale(1);
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  transition: transform var(--transition-slow);
}

.sides-knob::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 30px;
  height: 30px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
}

.sides-knob:hover {
  transform: translateX(-50%) scale(1.4);
}

.sides-knob--active,
.sides-knob--active:hover {
  cursor: grabbing;
  transform: translateX(-50%) scale(2);
  transition: transform 1.2s var(--easing-spring);
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
  //border-radius: 50%;
  transition:
    top 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    left 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  //border-radius: calc(var(--tile-border-radius) - 16px);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-upload-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 8px;
  pointer-events: none;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.35) 0%, transparent 40%);
}

.avatar-upload-track {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  overflow: hidden;
}

.avatar-upload-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 2px;
  transition: width 0.2s ease-out;
}

.avatar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding-top: 16px;
  border-radius: calc(var(--tile-border-radius) - 16px);
  border: 2px dashed var(--color-tile-stroke);
  width: 100%;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.avatar-placeholder-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-content-low);
  white-space: nowrap;
}

.avatar-placeholder-buttons {
  display: flex;
  gap: 8px;
  overflow: hidden;
}

.placeholder-btn {
  display: flex;
  align-items: center;
  padding: 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-content-low);
  cursor: pointer;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.placeholder-btn svg {
  width: 24px;
  height: 24px;
}

.placeholder-btn--default {
  color: var(--color-content-default);
}

.placeholder-btn--default:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.profile-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.profile-collapse {
  display: grid;
  grid-template-rows: 1fr;
  transition:
    grid-template-rows 0.3s var(--easing-ease-in-out),
    opacity 0.3s var(--easing-ease-in-out),
    flex 0.3s var(--easing-ease-in-out);
  opacity: 1;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  //height: 100%;
}

.profile-collapse > * {
  overflow: hidden;
}

.profile-collapse--hidden {
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
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
  align-self: stretch;
  overflow-y: auto;
  overscroll-behavior: contain;
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

/* ── Avatar Action Bar ── */
.avatar-action-bar {
  position: absolute;
  top: -16px;
  right: -16px;
  z-index: 11;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
  width: 32px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--easing-ease-out);
}

.avatar-action-bar--dimmed {
  opacity: 0.34;
}

.avatar:hover .avatar-action-bar,
.avatar-action-bar:hover,
.avatar-action-bar--flyout-open {
  opacity: 1;
  pointer-events: auto;
}

.avatar-action-bar--dimmed,
.avatar:hover .avatar-action-bar--dimmed {
  opacity: 0.34;
  pointer-events: auto;
}

.avatar-action-bar--zone-dimmed,
.avatar:hover .avatar-action-bar--zone-dimmed,
.avatar-action-bar--zone-dimmed.avatar-action-bar--dimmed {
  opacity: 0.15;
  pointer-events: none;
}

/* When a flyout is open, force action bar visible even over dimmed/zone-dimmed */
.avatar-action-bar--flyout-open.avatar-action-bar--dimmed,
.avatar-action-bar--flyout-open.avatar-action-bar--zone-dimmed {
  opacity: 1;
  pointer-events: auto;
}

.avatar-quick-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.quick-action-menu {
  position: relative;
  display: flex;
  gap: 0px; /* no real gap — sub-actions handles its own spacing */
  align-items: flex-start;
  height: 32px;
}

/* ── quickAction_Button base ── */
.avatar-action-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid var(--color-tile-stroke);
  border-radius: 8px;
  background-color: var(--color-actionbar-background);
  color: var(--color-content-high);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    border-color var(--duration-fast) var(--easing-ease-in-out),
    color var(--duration-fast) var(--easing-ease-in-out);

  :deep(svg) {
    width: 16px;
    height: 16px;
    display: block;
    flex-shrink: 0;
  }
}

/* Active/selected state — white bg & border (Variant4 in Figma) */
.avatar-action-btn--active {
  background-color: var(--color-text-primary);
  border-color: var(--color-text-primary);
  color: var(--color-content-background);
}

/* Hover on default buttons */
.avatar-action-btn:not(.avatar-action-btn--active):not(
    .avatar-action-btn--delete
  ):hover {
  background-color: color-mix(
    in srgb,
    var(--color-actionbar-background) 85%,
    var(--color-text-primary) 15%
  );
}

/* Delete / Remove Image button */
.avatar-action-btn--delete {
  padding: 4px;
  border-color: var(--color-tile-stroke);
  background-color: var(--color-actionbar-background);

  :deep(svg) {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background-color: var(--color-figma-red);
    border-color: var(--color-figma-red);
    color: var(--color-light-100);
  }
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
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
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

/* ── Teleported sub-actions flyout ── */
.sub-actions-flyout {
  z-index: 1200;
  display: flex;
  gap: 2px;
  align-items: center;
  height: 32px;
  pointer-events: auto;

  /* Invisible bridge covering the gap between trigger and flyout so
     the mouse doesn't lose hover when crossing */
  &::before {
    content: "";
    position: absolute;
    right: 100%;
    top: 0;
    width: 12px;
    height: 100%;
  }
}

.sub-actions-flyout .avatar-action-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  border: 1px solid var(--color-tile-stroke);
  border-radius: 8px;
  background-color: var(--color-actionbar-background);
  color: var(--color-content-high);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--easing-ease-in-out),
    border-color var(--duration-fast) var(--easing-ease-in-out),
    color var(--duration-fast) var(--easing-ease-in-out);

  svg {
    width: 16px;
    height: 16px;
    display: block;
    flex-shrink: 0;
  }
}

.sub-actions-flyout .avatar-action-btn--active {
  background-color: var(--color-text-primary);
  border-color: var(--color-text-primary);
  color: var(--color-content-background);
}

.sub-actions-flyout .avatar-action-btn:not(.avatar-action-btn--active):hover {
  background-color: color-mix(
    in srgb,
    var(--color-actionbar-background) 85%,
    var(--color-text-primary) 15%
  );
}
</style>
