<template>
  <div
    class="profile-bio"
    ref="profileRoot"
    :class="[layoutClasses, { 'profile-bio--no-fill': hasNoFill }]"
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
              avatarControlsVisible
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
              avatarControlsVisible
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
            v-if="!isCompactProfileLayout && avatarSrc && avatarControlsVisible"
            class="avatar-action-bar"
            :class="{
              'avatar-action-bar--activated': tileActivated,
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
                @mouseenter="onQuickActionEnter('shape')"
                @mouseleave="onQuickActionLeave()"
              >
                <button
                  ref="shapeTriggerRef"
                  class="avatar-action-btn avatar-action-btn--active"
                  @click.stop="onShapeTriggerClick"
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
                @mouseenter="onQuickActionEnter('avatar')"
                @mouseleave="onQuickActionLeave()"
              >
                <button
                  ref="avatarTriggerRef"
                  class="avatar-action-btn"
                  :class="{ 'avatar-action-btn--active': avatarSrc }"
                  @click.stop="onAvatarTriggerClick"
                >
                  <UploadMediaIcon v-if="lastAvatarMethod === 'upload'" />
                  <UrlSourceIcon v-else />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Earned-badge row, sits to the right of the avatar.
             Hidden in compact layouts (mini/narrow/banner) since they
             dedicate the row to the avatar alone. -->
        <div
          v-if="!isCompactProfileLayout && earnedBadges.length > 0"
          class="profile-badges"
          @mousedown.stop
          @click.stop
        >
          <div
            v-for="badge in earnedBadges"
            :key="badge.id"
            class="profile-badge"
            :data-tooltip="`${badge.meta.label} \u00b7 since ${formatBadgeDate(badge.earnedAt)}`"
          >
            <component :is="badge.meta.icon" :size="20" />
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
            :class="{ 'can-edit': gridView.canEdit }"
            :spellcheck="gridView.canEdit && isEditing"
            @pointerdown="focusEditor(nameEditor, $event)"
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
            :class="{ 'can-edit': gridView.canEdit }"
            :spellcheck="gridView.canEdit && isEditing"
            @pointerdown="focusEditor(titleEditor, $event)"
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
        :class="{ 'can-edit': gridView.canEdit }"
        :spellcheck="gridView.canEdit && isEditing"
        :style="{ '--tile-text-color': textColor }"
        @pointerdown="focusEditor(bioEditor, $event)"
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
      ref="shapeFlyoutRef"
      class="sub-actions-flyout"
      :style="shapeFlyoutStyle"
      @mouseenter="onQuickActionEnter('shape')"
      @mouseleave="onQuickActionLeave()"
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
      ref="avatarFlyoutRef"
      class="sub-actions-flyout"
      :style="avatarFlyoutStyle"
      @mouseenter="onQuickActionEnter('avatar')"
      @mouseleave="onQuickActionLeave()"
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
  proxyRefs,
  defineComponent,
  ref,
  computed,
  toRef,
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
import type { AnyExtension, Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import Color from "@tiptap/extension-color";
import { FontSize } from "../../extensions/tiptap/FontSize";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useGridViewContext } from "@/grid-context/useGridViewContext";
import { type ProfileBioContent, type AvatarShape } from "@grids/contracts/types";
import { isDirectImageUrl } from "@/utils/TileUtils";
import {
  getPolygonGeometry,
  getPolygonVertices,
  getRoundedPolygonPath,
} from "@/utils/AvatarShape";
import { useFileUpload } from "@/composables/useFileUpload";
import { useColorPicker } from "@/composables/useColorPicker";
import { useEditorAutosave } from "@/composables/useEditorAutosave";
import { useTileContentWriter } from "@/composables/useTileContentWriter";
import { useBadges } from "@/composables/useBadges";
import { useEditorContentSync } from "@/composables/useEditingLifecycle";
import Placeholder from "@tiptap/extension-placeholder";
import CloseIcon from "@/components/icons/tile-actionbar/CloseIcon.vue";
import ShapeCircleIcon from "@/components/icons/tile-actionbar/ShapeCircleIcon.vue";
import ShapeSquareIcon from "@/components/icons/tile-actionbar/ShapeSquareIcon.vue";
import ShapePolygonIcon from "@/components/icons/tile-actionbar/ShapePolygonIcon.vue";
import UploadMediaIcon from "@/components/icons/tile-actionbar/UploadMediaIcon.vue";
import UrlSourceIcon from "@/components/icons/tile-actionbar/UrlSourceIcon.vue";

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
    const gridView = proxyRefs(useGridViewContext());
    const tileId = inject<string | null>("tileId", null);
    const gridTileW = inject<ComputedRef<number> | null>("gridTileW", null);
    const gridTileH = inject<ComputedRef<number> | null>("gridTileH", null);
    const hoveredToolbarZone = inject<Ref<string | null>>("hoveredToolbarZone");
    // Tile.vue sets this on first tap and clears it on a tap outside. It is the
    // touch-side stand-in for hover — see `avatarControlsVisible`.
    const tileActivated = inject<Ref<boolean>>("tileActivated", ref(false));

    // Guarded because this is reachable from plain method calls (setAvatarShape,
    // openUrlInput) rather than only from real pointer events — jsdom has no
    // matchMedia, so an unguarded call throws under test. Mirrors the same
    // defence in useMobileExperience's `matchTouchMedia`.
    const isTouchDevice = () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;

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

    const { uploadExternalImageToArchive, uploadFileToArchiveWithProgress } =
      useFileUpload();

    // ── Badges ────────────────────────────────────────────────────────
    // Resolve the grid owner's UID — works both for the owner editing
    // their own profile and for visitors viewing someone else's grid.
    const ownerUserId = computed(
      () => gridView.mode === "demo" ? null : gridView.grid?.userId ?? null,
    );
    const { earnedBadges } = useBadges(ownerUserId);

    const badgeDateFormatter = new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const formatBadgeDate = (date: Date): string =>
      badgeDateFormatter.format(date);

    const isUploadingAvatar = ref(false);
    const uploadPercent = ref(0);

    const isHovered = ref(false);
    const isEditing = ref(false);
    const activeEditor = ref(null) as Ref<Editor | null>;
    const pendingFocusEditor = ref(null) as Ref<Editor | null>;
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
    const shapeFlyoutRef = ref<HTMLElement | null>(null);
    const avatarFlyoutRef = ref<HTMLElement | null>(null);
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

    // ── Quick-action flyouts ──────────────────────────────────────────
    // On a mouse the flyouts open on hover. Touch has no hover, so they open
    // on tap instead. The two models can't both be live: tapping a <button>
    // still emits a synthesized mouseenter *before* the click, so leaving the
    // hover handlers active on touch would open the flyout on mouseenter and
    // then immediately have the click toggle it shut again.
    const onQuickActionEnter = (action: "shape" | "avatar") => {
      if (isTouchDevice()) return;
      cancelQuickActionClose();
      hoveredQuickAction.value = action;
    };

    const onQuickActionLeave = () => {
      if (isTouchDevice()) return;
      scheduleQuickActionClose();
    };

    const toggleQuickAction = (action: "shape" | "avatar") => {
      hoveredQuickAction.value =
        hoveredQuickAction.value === action ? null : action;
    };

    // The shape trigger has no mouse click behaviour — it exists purely to
    // reveal its flyout, which on touch only a tap can do.
    const onShapeTriggerClick = () => {
      if (!isTouchDevice()) return;
      toggleQuickAction("shape");
    };

    // On a mouse this button applies the last-used method and hover reveals the
    // alternatives. On touch that flyout is unreachable, and the shortcut would
    // strand the URL option, so the tap opens the flyout instead.
    const onAvatarTriggerClick = () => {
      if (isTouchDevice()) {
        toggleQuickAction("avatar");
        return;
      }
      onLastAvatarMethod();
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

    useEditorContentSync(nameEditor, () => props.content.name, parseContent);
    useEditorContentSync(titleEditor, () => props.content.title, parseContent);
    useEditorContentSync(bioEditor, () => props.content.bio, parseContent);

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

    // Gates every avatar-editing control. `isHovered` never becomes true on a
    // touch device, so tile activation stands in for it there — otherwise the
    // controls for an existing photo would be unreachable once one is set.
    const avatarControlsVisible = computed(
      () =>
        gridView.canEdit &&
        (isEditing.value || isHovered.value || tileActivated.value),
    );

    // Profile photo URL is stored in tile content.
    // Look up by the injected tile ID — this is stable and unique, unlike
    // content-field matching which breaks when multiple profile tiles share
    // the same default text or when text fields are edited mid-session.
    const persistedAvatarSrc = computed(() => {
      if (!tileId) return props.content.profilePhotoUrl ?? "";
      const tile = gridView.grid?.tiles.find((t) => t.i === tileId);
      return (tile?.content as ProfileBioContent | undefined)?.profilePhotoUrl ?? "";
    });

    // Local-only optimistic preview for an in-flight avatar upload. Kept out of
    // tile content on purpose: a `blob:` URL written through `patchContent`
    // lands in the scheduled save (and in undo history), and if the tab closes
    // before the upload resolves the grid document is left pointing at a blob
    // that no longer exists — every later page load then 404s on it.
    const pendingAvatarPreviewUrl = ref<string | null>(null);

    const avatarSrc = computed(
      () => pendingAvatarPreviewUrl.value ?? persistedAvatarSrc.value,
    );

    const { patchContent, autosaveContent } = useTileContentWriter(
      tileId,
      () => props.content,
    );

    const saveProfilePhoto = async (url: string, hash?: string) => {
      // Only archive-backed uploads carry a hash; clear it for removals and
      // external URLs so a stale hash never trails the photo.
      patchContent({ profilePhotoUrl: url, profilePhotoHash: hash ?? "" });
    };

    const serializeEditor = (editor: Editor) => {
      // An empty editor serializes to a non-empty doc rather than the `""` a
      // fresh tile stores; return "" so an untouched field registers no content
      // change (and captures no spurious undo snapshot on focus).
      if (editor.isEmpty) return "";
      let output = JSON.stringify(editor.getJSON());
      output = output.replace(/^"(.*)"$/, "$1");
      return output;
    };

    const persistContent = () => {
      if (!nameEditor.value || !titleEditor.value || !bioEditor.value) return;
      if (!gridView.canEdit) return;

      const name = serializeEditor(nameEditor.value);
      const title = serializeEditor(titleEditor.value);
      const bio = serializeEditor(bioEditor.value);

      autosaveContent({ name, title, bio });
    };

    watch(
      [() => gridView.canEdit, () => isEditing.value],
      ([isOwner, editing]) => {
        const editors = [
          nameEditor.value,
          titleEditor.value,
          bioEditor.value,
        ].filter(
          (editor): editor is NonNullable<typeof editor> => editor != null,
        );
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
            nextTick(() => {
              flushPersist();
              if (tileId) gridView.beginEditing(tileId);
            });
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
        gridView.commitEditing();
      },
    );

    const focusEditor = (editor: Editor | undefined, _event: PointerEvent) => {
      if (!gridView.canEdit) return;
      if (!editor) return;

      if (!isEditing.value) {
        // Record which field was tapped so the edit-mode watcher focuses it.
        // Uses pointerdown (not mousedown) so this fires on touch too — touch
        // devices suppress the synthesized mousedown via Tile's touchstart
        // preventDefault, which would otherwise leave this unset and default
        // focus to the name editor.
        pendingFocusEditor.value = editor;
      }
      // When already editing, let ProseMirror handle the pointer event
      // naturally so taps on text place the cursor at the correct position.
    };

    const catchEditorClick = (editor: Editor | undefined) => {
      if (!gridView.canEdit || !isEditing.value) return;
      if (!editor) return;

      if (!editor.isFocused) {
        editor.commands.focus("end");
      }
    };

    const onShortClick = () => {
      if (!gridView.canEdit) return;
      if (!isEditing.value) {
        isEditing.value = true;
        if (!activeEditor.value) {
          activeEditor.value =
            nameEditor.value || titleEditor.value || bioEditor.value || null;
        }
      }
    };

    const onExitClick = () => {
      if (!gridView.canEdit) return;
      if (!isEditing.value) return;
      isEditing.value = false;
    };

    // ─── Avatar measurement ────────────────────────────────────────────
    //
    // `avatarSize` feeds the polygon geometry, and the clip path is declared
    // `clipPathUnits="userSpaceOnUse"` — untransformed layout coordinates. So
    // this must be measured in *layout* space. `getBoundingClientRect()` is
    // transform-aware and reports visual size, which is wrong here twice over:
    //
    //   1. Tile.vue's `tileEnter` animation scales every tile 0.75 → 1 over
    //      250ms on mount, and this runs inside that window — so the avatar
    //      measures ~0.75× its real size and the polygon is drawn undersized.
    //   2. Any grid-level fit scale (e.g. the landing page's `grid-jack__scale`)
    //      multiplies the error again.
    //
    // ResizeObserver reports the border box in layout pixels — transform-
    // independent — and fires on each frame of `.avatar`'s 400ms width/height
    // transition, so the geometry tracks the box instead of sampling it at
    // `nextTick` and freezing on a value the box is about to leave.
    let avatarResizeObserver: ResizeObserver | null = null;

    const updateAvatarSize = () => {
      // offsetWidth, not getBoundingClientRect — see above.
      const width = avatarRef.value?.offsetWidth ?? 0;
      if (width > 0) avatarSize.value = width;
    };

    onMounted(() => {
      updateAvatarSize();

      if (typeof ResizeObserver !== "undefined") {
        avatarResizeObserver = new ResizeObserver((entries) => {
          const inlineSize = entries[0]?.borderBoxSize?.[0]?.inlineSize;
          if (typeof inlineSize === "number" && inlineSize > 0) {
            avatarSize.value = inlineSize;
          } else {
            // borderBoxSize is absent on older Safari; contentRect there is
            // still layout-space, but offsetWidth matches our box model.
            updateAvatarSize();
          }
        });
        if (avatarRef.value) avatarResizeObserver.observe(avatarRef.value);
      }

      document.addEventListener("pointerdown", onPointerDownOutside);
    });

    onBeforeUnmount(() => {
      avatarResizeObserver?.disconnect();
      avatarResizeObserver = null;
      document.removeEventListener("pointerdown", onPointerDownOutside);
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
      if (!gridView.canEdit) return;
      patchContent({ avatarShape: shape });
      // A mouse dismisses the flyout by leaving it; a tap has to say so.
      if (isTouchDevice()) hoveredQuickAction.value = null;
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
      if (!gridView.canEdit) return;
      patchContent({ avatarRadius: avatarRadius.value });
    };

    const polyGeometry = computed(() =>
      getPolygonGeometry({
        sides: avatarSides.value,
        size: avatarSize.value,
        fit: "cover",
      }),
    );

    // --- Radius drag handle ---
    // The handle sits on the bottom-left polygon corner. Dragging toward the
    // center of the avatar increases radius; dragging away decreases it.
    // We track the distance from the pointer to the polygon center and map
    // that to a radius value.

    const onRadiusHandleDown = (e: PointerEvent) => {
      if (!gridView.canEdit) return;
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
        if (gridView.canEdit) {
          patchContent({ avatarRadius: avatarRadius.value });
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

      // Polygon mode — pick the bottom-left-ish vertex
      const n = avatarSides.value;
      const vertices = getPolygonVertices(n, polyGeometry.value);
      const polygonCenterY =
        size / 2 + polyGeometry.value.bleedY - polyGeometry.value.bboxOffsetY;

      let bestIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < n; i++) {
        const v = vertices[i];
        if (v.y >= polygonCenterY) {
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
      if (!gridView.canEdit) return;
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
        if (gridView.canEdit) {
          patchContent({ avatarSides: avatarSides.value });
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
      if (!gridView.canEdit || isCompactProfileLayout.value) return;
      lastAvatarMethod.value = "upload";
      if (isTouchDevice()) hoveredQuickAction.value = null;
      avatarInput.value?.click();
    };

    const onLastAvatarMethod = () => {
      if (!gridView.canEdit || isCompactProfileLayout.value) return;
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

    // Listens on pointerdown rather than mousedown so it fires for touch too:
    // Tile.vue preventDefaults the touchstart on non-interactive targets, which
    // suppresses the synthesized mousedown that used to drive this.
    const onPointerDownOutside = (e: PointerEvent) => {
      const target = e.target as Node;
      const insideAvatar = avatarRef.value?.contains(target) ?? false;

      if (showUrlInput.value) {
        if (!insideAvatar && !popoverRef.value?.contains(target)) {
          showUrlInput.value = false;
        }
      }

      // The flyouts are teleported to <body>, so they aren't inside the avatar
      // and need their own containment check.
      if (hoveredQuickAction.value) {
        const insideFlyout =
          (shapeFlyoutRef.value?.contains(target) ?? false) ||
          (avatarFlyoutRef.value?.contains(target) ?? false);
        if (!insideAvatar && !insideFlyout) {
          hoveredQuickAction.value = null;
        }
      }
    };

    const onAvatarClick = () => {
      if (!gridView.canEdit || isCompactProfileLayout.value) return;
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
      if (!gridView.canEdit || isCompactProfileLayout.value) return;
      lastAvatarMethod.value = "url";
      if (isTouchDevice()) hoveredQuickAction.value = null;
      draftAvatarUrl.value = persistedAvatarSrc.value || "";
      urlError.value = "";
      updatePopoverPos();
      showUrlInput.value = true;
    };

    const cancelUrlInput = () => {
      showUrlInput.value = false;
      urlError.value = "";
    };

    const applyAvatarUrl = async () => {
      if (!gridView.canEdit) return;
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
        const { url: ownedUrl, hash } =
          await uploadExternalImageToArchive(normalized);
        await saveProfilePhoto(ownedUrl, hash);
      } catch (err: unknown) {
        console.error("Failed to import external image:", err);
        urlError.value =
          "Could not import image. Try uploading the file directly.";
        showUrlInput.value = true;
      }
    };

    const removeCustomImage = async () => {
      if (!gridView.canEdit || isCompactProfileLayout.value) return;
      showUrlInput.value = false;
      await saveProfilePhoto("");
    };

    const uploadAvatarImage = async (file: File) => {
      if (!gridView.canEdit) return;

      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }

      // Show the local file immediately, but only in component state — the
      // persisted photo URL is left untouched until the archive URL lands.
      const blobUrl = URL.createObjectURL(file);
      pendingAvatarPreviewUrl.value = blobUrl;

      isUploadingAvatar.value = true;
      uploadPercent.value = 0;

      try {
        const { url: permanentUrl, hash } =
          await uploadFileToArchiveWithProgress(
            file,
            { fileType: "images" },
            (fraction) => {
              uploadPercent.value = Math.round(fraction * 100);
            },
          );

        await saveProfilePhoto(permanentUrl, hash);
      } catch (error: unknown) {
        console.error("Avatar upload failed:", error);
        alert(error instanceof Error ? error.message : "Failed to upload image. Please try again.");
      } finally {
        // Drop the preview before revoking so the <img> is already pointed at
        // the persisted URL (new or previous) when the blob goes away.
        if (pendingAvatarPreviewUrl.value === blobUrl) {
          pendingAvatarPreviewUrl.value = null;
        }
        URL.revokeObjectURL(blobUrl);
        isUploadingAvatar.value = false;
        uploadPercent.value = 0;
      }
    };

    const onAvatarSelected = async (event: Event) => {
      if (!gridView.canEdit) return;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await uploadAvatarImage(file);
      if (avatarInput.value) avatarInput.value.value = "";
    };

    const FIXED_POLYGON_PATH_SEGMENTS = 24;

    const polygonPath = computed(() =>
      getRoundedPolygonPath({
        vertices: getPolygonVertices(avatarSides.value * 0.98, polyGeometry.value),
        radius: avatarRadius.value,
        fixedSegments: FIXED_POLYGON_PATH_SEGMENTS,
      }),
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
      useColorPicker(tileId, toRef(props, "content"), emit);

    // The title's luminosity blend needs an opaque fill underneath to tint
    // against; with no fill it composites over nothing and renders raw green.
    const hasNoFill = computed(() => backgroundColor.value === "transparent");

    watch(isDraggingRadius, (dragging) => {
      if (!hoveredToolbarZone) return;
      hoveredToolbarZone.value = dragging ? "radius" : null;
    });

    watch(isDraggingSides, (dragging) => {
      if (!hoveredToolbarZone) return;
      hoveredToolbarZone.value = dragging ? "sides" : null;
    });

    // Gap between the trigger and its flyout, in the trigger's own scale.
    const FLYOUT_GAP_PX = 4;

    // The flyouts are teleported to <body> to escape `.profile-bio`'s
    // overflow:hidden — which also lifts them out of the grid's viewport-fit
    // transform (`mobileScale` in useResponsiveGridLayout, < 1 whenever the
    // viewport is narrower than the grid). Left alone they render at their true
    // 32px while the action bar that spawned them is scaled down with the grid,
    // so the flyout buttons come out visibly larger than their own trigger.
    //
    // Rather than reach for `mobileScale` and couple this tile to grid
    // internals, derive the trigger's own visual/layout ratio and apply it. That
    // self-corrects for any ancestor transform — grid auto-scale, the landing
    // embed's fit scale, or the tile enter animation.
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
      const scale = el.offsetWidth > 0 ? rect.width / el.offsetWidth : 1;
      return {
        position: "fixed" as const,
        top: `${rect.top}px`,
        left: `${rect.right + FLYOUT_GAP_PX * scale}px`,
        // Anchored top-left so the flyout's top edge stays aligned with the
        // trigger's, which is where `top: rect.top` places it.
        transform: `scale(${scale})`,
        transformOrigin: "top left" as const,
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
      gridView,
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
      nameEditor,
      titleEditor,
      bioEditor,
      backgroundColor,
      textColor,
      hasNoFill,
      onShortClick,
      onExitClick,
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
      tileActivated,
      avatarControlsVisible,
      shapeTriggerRef,
      avatarTriggerRef,
      shapeFlyoutRef,
      avatarFlyoutRef,
      shapeFlyoutStyle,
      avatarFlyoutStyle,
      onQuickActionEnter,
      onQuickActionLeave,
      onShapeTriggerClick,
      onAvatarTriggerClick,
      earnedBadges,
      formatBadgeDate,
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

/* ── Earned badges (right of avatar) ───────────────────────────────
   Sits in the empty space alongside the avatar. Wraps onto multiple
   lines if more than ~6 badges are earned. */
.profile-badges {
  display: flex;
  flex-wrap: wrap;
  align-self: flex-start;
  align-items: center;
  gap: var(--spacing-xs, 6px);
  padding-top: 4px;
  flex: 1 1 auto;
  min-width: 0;
}

.profile-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: var(--tile-text-color);
  /* lift slightly so the gradient pops against the tile background */
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
  transition: transform var(--duration-fast) var(--easing-smooth);

  svg {
    display: block;
  }
}

.profile-badge:hover {
  transform: translateY(-1px) scale(1.06);
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
  //background: var(--color-base-8);
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
  color: #0c0;
  mix-blend-mode: luminosity;
  line-height: 1.3;
  font-family:
    "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
}

.profile-bio--no-fill .profile-title :deep(.ProseMirror) {
  color: color-mix(in srgb, var(--tile-text-color) 65%, transparent);
  mix-blend-mode: normal;
}

.profile-bio-text {
  flex: 1;
  min-height: 0;
  align-self: stretch;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
}

.profile-bio:hover .profile-bio-text {
  scrollbar-color: var(--color-border) transparent;
}

.profile-bio-text :deep(.ProseMirror) {
  font-size: 16px;
  line-height: 1.3;
  font-weight: 400;
  font-family: inherit;
  color: color-mix(
    in srgb,
    var(--tile-bg) 30%,
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

/* `--activated` is the touch counterpart to the hover selectors: a tap can't
   trigger :hover, so tile activation reveals the bar instead. Deliberately a
   single class so it sits below `--dimmed`/`--zone-dimmed` in specificity and
   the drag-dimming rules below still win, exactly as they do on hover. */
.avatar:hover .avatar-action-bar,
.avatar-action-bar:hover,
.avatar-action-bar--flyout-open,
.avatar-action-bar--activated {
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
