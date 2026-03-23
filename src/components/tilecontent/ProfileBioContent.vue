<template>
  <div class="profile-bio" ref="profileRoot">
    <div class="profile-header">
      <div class="profile-avatar-row">
        <div class="avatar" ref="avatarRef" @click="onAvatarClick">
          <svg
            v-if="avatarShape === 'polygon'"
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
            <div v-else class="avatar-placeholder">Add photo</div>
          </div>

          <!-- Radius drag handle — overlaid on the media box coordinate space -->
          <svg
            v-if="(avatarShape === 'polygon' || avatarShape === 'square') && layoutStore.canEdit && isEditing"
            class="radius-handle"
            :style="radiusHandleOverlayStyle"
          >
            <path
              :d="radiusHandlePath"
              fill="none"
              stroke="transparent"
              :stroke-width="12"
              stroke-linecap="round"
              style="pointer-events: stroke; cursor: grab;"
              @pointerdown.stop.prevent="onRadiusHandleDown"
            />
            <path
              :d="radiusHandlePath"
              fill="none"
              stroke="white"
              :stroke-width="2"
              stroke-linecap="round"
              style="pointer-events: none;"
            />
          </svg>
          <span
            v-if="isDraggingRadius"
            class="radius-value-label"
            :style="radiusLabelStyle"
          >{{ avatarRadius }}</span>

          <!-- Corners-count slider — centered below avatar -->
          <div
            v-if="avatarShape === 'polygon' && layoutStore.canEdit && isEditing"
            class="sides-slider"
            @mouseenter="sidesSliderHovered = true"
            @mouseleave="sidesSliderHovered = false"
          >
            <span
              class="sides-label sides-label--min"
              :class="{ visible: sidesSliderHovered || isDraggingSides }"
            >3</span>
            <div
              class="sides-track-container"
              ref="sidesTrackRef"
            >
              <div
                class="sides-track"
                :class="{ visible: sidesSliderHovered || isDraggingSides }"
              ></div>
              <div
                class="sides-knob"
                :style="sidesKnobStyle"
                @pointerdown.stop.prevent="onSidesKnobDown"
              ></div>
            </div>
            <span
              class="sides-label sides-label--max"
              :class="{ visible: sidesSliderHovered || isDraggingSides }"
            >8</span>
          </div>
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
              :class="{ active: avatarShape === 'polygon' }"
              @click.stop="setAvatarShape('polygon')"
            >
              Polygon
            </button>
          </div>
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
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
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

    // Get the corner + adjacent edge directions for the radius handle.
    // Works for both 'square' (bottom-left corner) and 'polygon' (polygon vertex).
    const radiusHandleVertex = computed(() => {
      const size = avatarSize.value;

      if (avatarShape.value === 'square') {
        // Bottom-left corner of the 152×152 square
        return {
          corner: { x: 0, y: size },
          prev: { x: 0, y: 0 },       // left edge going up
          next: { x: size, y: size },   // bottom edge going right
        };
      }

      // Polygon (polygon) mode — pick the bottom-left-ish vertex
      const n = avatarSides.value;
      const { R, bleedX, bleedY, bboxOffsetX, bboxOffsetY } = polyGeometry.value;
      const cx = size / 2 + bleedX - bboxOffsetX;
      const cy = size / 2 + bleedY - bboxOffsetY;
      const angleOffset = -Math.PI / 2;

      const vertices: { x: number; y: number }[] = [];
      for (let i = 0; i < n; i++) {
        const angle = angleOffset + (2 * Math.PI * i) / n;
        vertices.push({ x: cx + R * Math.cos(angle), y: cy + R * Math.sin(angle) });
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

    // The radius handle SVG overlays the coordinate space where the
    // corner lives. For polygon: the media box (with bleed). For square: the avatar.
    const radiusHandleOverlayStyle = computed(() => {
      const size = avatarSize.value;
      if (avatarShape.value === 'square') {
        return {
          position: "absolute" as const,
          left: "0px",
          top: "0px",
          width: `${size}px`,
          height: `${size}px`,
          overflow: "visible",
          pointerEvents: "none" as const,
          zIndex: 10,
        };
      }
      const { bleedX, bleedY, bboxW, bboxH } = polyGeometry.value;
      return {
        position: "absolute" as const,
        left: `${-bleedX}px`,
        top: `${-bleedY}px`,
        width: `${bboxW}px`,
        height: `${bboxH}px`,
        overflow: "visible",
        pointerEvents: "none" as const,
        zIndex: 10,
      };
    });

    const radiusHandlePath = computed(() => {
      const { corner, prev, next } = radiusHandleVertex.value;
      const r = avatarRadius.value;

      const dx1 = prev.x - corner.x;
      const dy1 = prev.y - corner.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

      const dx2 = next.x - corner.x;
      const dy2 = next.y - corner.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      const offset = Math.min(r, len1 / 2, len2 / 2);
      if (offset < 1) return "";

      const arcStart = {
        x: corner.x + (dx1 / len1) * offset,
        y: corner.y + (dy1 / len1) * offset,
      };
      const arcEnd = {
        x: corner.x + (dx2 / len2) * offset,
        y: corner.y + (dy2 / len2) * offset,
      };

      // For square, use a circular arc (A) to exactly match CSS border-radius.
      // For polygon, keep quadratic Bézier (Q) which matches the polygon path rounding.
      if (avatarShape.value === 'square') {
        return `M ${arcStart.x} ${arcStart.y} A ${offset} ${offset} 0 0 0 ${arcEnd.x} ${arcEnd.y}`;
      }
      return `M ${arcStart.x} ${arcStart.y} Q ${corner.x} ${corner.y} ${arcEnd.x} ${arcEnd.y}`;
    });

    const radiusLabelStyle = computed(() => {
      const { corner, prev, next } = radiusHandleVertex.value;
      const isSquare = avatarShape.value === 'square';
      const bleedX = isSquare ? 0 : polyGeometry.value.bleedX;
      const bleedY = isSquare ? 0 : polyGeometry.value.bleedY;
      const r = avatarRadius.value;
      const size = avatarSize.value;

      const dx1 = prev.x - corner.x;
      const dy1 = prev.y - corner.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      const dx2 = next.x - corner.x;
      const dy2 = next.y - corner.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      const offset = Math.min(r, len1 / 2, len2 / 2);

      const arcStart = {
        x: corner.x + (dx1 / len1) * offset,
        y: corner.y + (dy1 / len1) * offset,
      };
      const arcEnd = {
        x: corner.x + (dx2 / len2) * offset,
        y: corner.y + (dy2 / len2) * offset,
      };

      let arcMidX: number;
      let arcMidY: number;
      let outX: number;
      let outY: number;

      if (isSquare) {
        // Border-radius circle center, inset from corner along each edge
        const ccX = corner.x + (dx1 / len1) * offset + (dx2 / len2) * offset;
        const ccY = corner.y + (dy1 / len1) * offset + (dy2 / len2) * offset;
        const toCX = corner.x - ccX;
        const toCY = corner.y - ccY;
        const toCLen = Math.sqrt(toCX * toCX + toCY * toCY) || 1;
        // Arc midpoint on the circle, toward the corner (dark ear area)
        arcMidX = ccX + (toCX / toCLen) * offset;
        arcMidY = ccY + (toCY / toCLen) * offset;
        // Push toward corner so label sits in the dark ear outside the arc
        outX = toCX / toCLen;
        outY = toCY / toCLen;
      } else {
        // Polygon: Bézier midpoint B(0.5) = 0.25*P0 + 0.5*P1 + 0.25*P2
        arcMidX = 0.25 * arcStart.x + 0.5 * corner.x + 0.25 * arcEnd.x;
        arcMidY = 0.25 * arcStart.y + 0.5 * corner.y + 0.25 * arcEnd.y;
        const centerX = size / 2 + bleedX;
        const centerY = size / 2 + bleedY;
        const awayX = arcMidX - centerX;
        const awayY = arcMidY - centerY;
        const awayDist = Math.sqrt(awayX * awayX + awayY * awayY) || 1;
        outX = awayX / awayDist;
        outY = awayY / awayDist;
      }

      const labelDist = 14;
      const labelX = arcMidX + outX * labelDist - bleedX;
      const labelY = arcMidY + outY * labelDist - bleedY;

      return {
        position: "absolute" as const,
        left: `${labelX - 8}px`,
        top: `${labelY - 8}px`,
        fontSize: "12px",
        fontWeight: "700",
        color: "var(--color-content-full)",
        pointerEvents: "none" as const,
        whiteSpace: "nowrap" as const,
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

    // Always emit exactly FIXED_SEGMENTS segments so that CSS `d` transition
    // can interpolate smoothly between any two side counts (3–8).
    // Each segment = L … Q … — same command structure regardless of N.
    const FIXED_SEGMENTS = 24; // LCM-friendly count; enough for smooth curves

    const generateRoundedPolygonPath = (
      sides: number,
      radius: number,
    ) => {
      const n = Math.max(3, Math.min(8, Math.round(sides)));
      const { R, bleedX, bleedY, bboxOffsetX, bboxOffsetY } = polyGeometry.value;
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
      const points: { x: number; y: number; isVertex: boolean; vertexIdx: number }[] = [];
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
      generateRoundedPolygonPath(
        avatarSides.value,
        avatarRadius.value,
      ),
    );

    const avatarMediaStyle = computed(() => {
      if (avatarShape.value === "polygon") {
        const { bleedX, bleedY } = polyGeometry.value;
        return {
          clipPath: `url(#${clipPathId})`,
          top: `${-bleedY}px`,
          left: `${-bleedX}px`,
          width: `calc(100% + ${bleedX * 2}px)`,
          height: `calc(100% + ${bleedY * 2}px)`,
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
      avatarSides,
      avatarSrc,
      avatarMediaStyle,
      clipPathId,
      polygonPath,
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
      radiusHandleOverlayStyle,
      radiusHandlePath,
      radiusLabelStyle,
      isDraggingSides,
      sidesSliderHovered,
      sidesTrackRef,
      sidesKnobStyle,
      onSidesKnobDown,
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

.polygon-clip-path {
  transition: d 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.radius-handle {
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
  transition: opacity 0.15s ease;
  color: var(--color-content-high);
}

.radius-value-label {
  //text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
  user-select: none;
  color: var(--color-content-high)
}

.sides-slider {
  position: absolute;
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
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
  color: var(--color-content-default);
}

.sides-track-container {
  position: relative;
  width: 30px;
  height: 10px;
}

.sides-track {
  position: absolute;
  top: 3px;
  left: 0;
  width: 100%;
  height: 4px;
  border-radius: 4px;
  background: var(--color-tile-stroke);
  transition: background 0.15s ease;
}

.sides-track.visible {
  background: var(--color-tile-stroke);
}

.sides-knob {
  position: absolute;
  top: 0;
  width: 10px;
  height: 10px;
  border-radius: 100px;
  background: var(--color-content-high);
  transform: translateX(-50%);
  cursor: grab;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.sides-knob:active {
  cursor: grabbing;
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
  transition: top 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    left 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
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
