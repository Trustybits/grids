<template>
  <BaseModal
    :show="isOpen"
    variant="centered"
    content-class="file-archive-modal-content"
    @close="handleClose"
  >
    <div class="fa">
      <header class="fa__header">
        <h2>File Archive</h2>
        <button class="fa__close" aria-label="Close" @click="handleClose">
          <CloseXIcon :size="20" />
        </button>
      </header>

      <!-- Storage usage -->
      <section class="fa__usage">
        <div class="fa__usage-row">
          <span class="fa__usage-label">Storage</span>
          <span class="fa__usage-value">
            {{ formatBytes(storageUsed) }} /
            <span v-if="isDevAccount" class="fa__usage-infinity">∞</span>
            <span v-else>{{ formatBytes(quota) }}</span>
          </span>
        </div>
        <div
          class="fa__usage-bar"
          :class="{ 'is-unlimited': isDevAccount }"
        >
          <div
            class="fa__usage-fill"
            :class="{ 'is-warning': usedPct >= 90 }"
            :style="{ width: barWidth }"
          ></div>
        </div>
      </section>

      <!-- Toolbar: filter pills + upload -->
      <div class="fa__toolbar">
        <div class="fa__pills" role="tablist">
          <button
            v-for="filter in FILTERS"
            :key="filter.value"
            type="button"
            role="tab"
            class="fa__pill"
            :class="{ 'is-active': activeFilter === filter.value }"
            :aria-selected="activeFilter === filter.value"
            @click="activeFilter = filter.value"
          >
            {{ filter.label }}
          </button>
        </div>
        <Button
          variant="primary"
          size="sm"
          :loading="uploading"
          @click="triggerUpload"
        >
          <template #icon-left><UploadIcon :size="16" /></template>
          Upload
        </Button>
        <input
          ref="fileInput"
          type="file"
          multiple
          :accept="uploadAccept"
          class="fa__file-input"
          @change="onUploadChange"
        />
      </div>

      <!-- Body -->
      <div class="fa__body scrollable-thin">
        <div v-if="loading" class="fa__state">Loading files…</div>
        <div v-else-if="error" class="fa__state fa__state--error">
          {{ error }}
        </div>
        <div v-else-if="filteredUploads.length === 0" class="fa__state">
          <FolderIcon :size="36" class="fa__state-icon" />
          <span>{{ emptyMessage }}</span>
        </div>
        <ul v-else class="fa__list">
          <li v-for="doc in filteredUploads" :key="doc.hash" class="fa__row">
            <div class="fa__preview" :class="`fa__preview--${doc.kind}`">
              <img
                v-if="doc.kind === 'images' && doc.url"
                :src="doc.url"
                :alt="displayName(doc)"
                loading="lazy"
              />
              <video
                v-else-if="doc.kind === 'videos' && doc.url"
                :src="doc.url"
                muted
                preload="metadata"
                playsinline
              />
              <ImageIcon
                v-else-if="doc.kind === 'images'"
                :size="20"
              />
              <FileIcon v-else :size="20" />
            </div>

            <div class="fa__info">
              <div class="fa__name" :title="displayName(doc)">
                {{ displayName(doc) }}
              </div>
              <div class="fa__meta">
                <span class="fa__badge">{{ kindLabel(doc.kind) }}</span>
                <span>{{ formatBytes(doc.size) }}</span>
                <span
                  class="fa__refcount"
                  :class="{ 'is-used': doc.refCount > 0 }"
                >
                  {{ doc.refCount > 0 ? `Used ${doc.refCount}×` : "Unused" }}
                </span>
                <span v-if="formatDate(doc.createdAt)" class="fa__date">
                  {{ formatDate(doc.createdAt) }}
                </span>
              </div>
            </div>

            <div class="fa__row-actions">
              <button
                type="button"
                class="fa__switch"
                role="switch"
                :aria-checked="doc.shareable"
                :class="{
                  'is-on': doc.shareable,
                  'is-pending': savingShare.has(doc.hash),
                }"
                :data-tooltip="
                  doc.shareable
                    ? 'Shareable — others can copy & download this file'
                    : 'Private — only you can use this file'
                "
                @click="onToggleShareable(doc)"
              >
                <span class="fa__switch-track">
                  <span class="fa__switch-thumb"></span>
                </span>
                <span class="fa__switch-text">Share</span>
              </button>

              <button
                v-if="canAddToGrid"
                type="button"
                class="fa__icon-btn"
                data-tooltip="Add to grid"
                aria-label="Add to grid"
                @click="onAddToGrid(doc)"
              >
                <PlusIcon :size="18" />
              </button>

              <button
                type="button"
                class="fa__icon-btn"
                data-tooltip="Rename"
                aria-label="Rename"
                @click="openRename(doc)"
              >
                <EditIcon :size="15" />
              </button>

              <button
                type="button"
                class="fa__icon-btn fa__icon-btn--danger"
                data-tooltip="Delete permanently"
                aria-label="Delete permanently"
                @click="openDelete(doc)"
              >
                <DeleteTileIcon :size="16" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </BaseModal>

  <!-- Rename -->
  <PromptModal
    :show="!!renameTarget"
    title="Rename file"
    description="Changes only the display label. The file, its links, and any grid references are untouched."
    placeholder="File name"
    :initial-value="renameTarget ? displayName(renameTarget) : ''"
    select-on-open
    confirm-label="Rename"
    @close="renameTarget = null"
    @confirm="confirmRename"
  />

  <!-- Delete confirmation -->
  <BaseModal
    :show="!!deleteTarget"
    variant="centered"
    @close="deleteTarget = null"
  >
    <h3 class="fa-confirm__title">Delete file permanently?</h3>
    <p class="fa-confirm__body">
      <template v-if="deleteTarget && deleteTarget.refCount > 0">
        <strong>{{ displayName(deleteTarget) }}</strong> is used in
        {{ deleteTarget.refCount }}
        {{ deleteTarget.refCount === 1 ? "place" : "places" }}. Deleting it
        permanently removes the file and may break those places. This cannot be
        undone.
      </template>
      <template v-else-if="deleteTarget">
        <strong>{{ displayName(deleteTarget) }}</strong> will be permanently
        removed from your storage. This cannot be undone.
      </template>
    </p>
    <div class="fa-confirm__actions">
      <Button variant="secondary" @click="deleteTarget = null">Cancel</Button>
      <Button variant="danger" :loading="deleting" @click="confirmDelete">
        Delete
      </Button>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useToastStore } from "@/stores/toast";
import { useFileArchive } from "@/composables/useFileArchive";
import { formatBytes, STORAGE_QUOTA_BYTES } from "@/utils/StorageFormat";
import { SUPPORTED_UPLOAD_ACCEPT } from "@/utils/UploadFileClassification";
import type {
  UploadArchiveDocument,
  UploadKind,
} from "@grids/contracts/types";
import BaseModal from "./BaseModal.vue";
import PromptModal from "./PromptModal.vue";
import Button from "@/components/ui-elements/Button.vue";
import CloseXIcon from "@/components/icons/CloseXIcon.vue";
import UploadIcon from "@/components/icons/UploadIcon.vue";
import ImageIcon from "@/components/icons/ImageIcon.vue";
import FileIcon from "@/components/icons/FileIcon.vue";
import FolderIcon from "@/components/icons/FolderIcon.vue";
import EditIcon from "@/components/icons/EditIcon.vue";
import PlusIcon from "@/components/icons/PlusIcon.vue";
// The same delete affordance shown when hovering a tile.
import DeleteTileIcon from "@/components/icons/tile-actionbar/CloseIcon.vue";

const props = defineProps<{ isOpen: boolean }>();
const emit = defineEmits<{ close: [] }>();

type FilterValue = "all" | UploadKind;

const FILTERS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Images", value: "images" },
  { label: "Videos", value: "videos" },
  { label: "Documents", value: "documents" },
];

const KIND_LABELS: Record<UploadKind, string> = {
  images: "Image",
  videos: "Video",
  documents: "Document",
};

const uploadAccept = SUPPORTED_UPLOAD_ACCEPT;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const sessionStore = useGridSessionStore();
const toast = useToastStore();
const archive = useFileArchive();
const { uploads, loading, uploading, error } = archive;

const quota = STORAGE_QUOTA_BYTES;
const storageUsed = ref(0);
const isDevAccount = ref(false);
let unsubscribeProfile: (() => void) | null = null;

const activeFilter = ref<FilterValue>("all");
const fileInput = ref<HTMLInputElement | null>(null);
const savingShare = ref<Set<string>>(new Set());
const renameTarget = ref<UploadArchiveDocument | null>(null);
const deleteTarget = ref<UploadArchiveDocument | null>(null);
const deleting = ref(false);

const usedPct = computed(() =>
  isDevAccount.value || quota <= 0
    ? 0
    : Math.min(100, Math.round((storageUsed.value / quota) * 100)),
);

const barWidth = computed(() =>
  isDevAccount.value
    ? "0%"
    : `${Math.min(100, (storageUsed.value / quota) * 100)}%`,
);

const canAddToGrid = computed(
  () => !!sessionStore.currentGrid && sessionStore.isOwner,
);

const filteredUploads = computed(() =>
  activeFilter.value === "all"
    ? uploads.value
    : uploads.value.filter((u) => u.kind === activeFilter.value),
);

const emptyMessage = computed(() => {
  if (uploads.value.length === 0) return "No files in archive";
  if (activeFilter.value === "all") return "No files in archive";
  return `No ${activeFilter.value} in archive`;
});

const displayName = (doc: UploadArchiveDocument): string =>
  doc.displayName?.trim() || `${doc.hash.slice(0, 10)}.${doc.ext}`;

const kindLabel = (kind: UploadKind): string => KIND_LABELS[kind];

const toDate = (
  value: UploadArchiveDocument["createdAt"],
): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && "toDate" in value) {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  return null;
};

const formatDate = (value: UploadArchiveDocument["createdAt"]): string => {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "";
};

// The grid page scrolls the document; lock it while the modal is open so the
// wheel/trackpad doesn't scroll the grid behind the overlay.
let scrollLock: { html: string; body: string } | null = null;

const lockBackgroundScroll = () => {
  if (scrollLock || typeof document === "undefined") return;
  scrollLock = {
    html: document.documentElement.style.overflow,
    body: document.body.style.overflow,
  };
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
};

const unlockBackgroundScroll = () => {
  if (!scrollLock || typeof document === "undefined") return;
  document.documentElement.style.overflow = scrollLock.html;
  document.body.style.overflow = scrollLock.body;
  scrollLock = null;
};

const loadUsage = () => {
  const uid = getAuthProvider().getCurrentUserId();
  unsubscribeProfile?.();
  unsubscribeProfile = null;
  if (!uid) return;
  unsubscribeProfile = getServiceFactory()
    .getUserService()
    .subscribeToUserProfile(uid, (profile) => {
      storageUsed.value = profile?.storageUsed ?? 0;
      isDevAccount.value = profile?.isDevAccount === true;
    });
};

const triggerUpload = () => fileInput.value?.click();

const onUploadChange = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = "";
  if (files.length === 0) return;
  try {
    await archive.uploadFiles(files);
    toast.addToast(
      files.length === 1 ? "File uploaded" : `${files.length} files uploaded`,
      "success",
    );
  } catch (err) {
    toast.addToast(
      err instanceof Error ? err.message : "Upload failed",
      "error",
    );
  }
};

const onToggleShareable = async (doc: UploadArchiveDocument) => {
  if (savingShare.value.has(doc.hash)) return;
  savingShare.value = new Set(savingShare.value).add(doc.hash);
  try {
    await archive.setShareable(doc.hash, !doc.shareable);
  } catch {
    toast.addToast("Could not update sharing. Please try again.", "error");
  } finally {
    const next = new Set(savingShare.value);
    next.delete(doc.hash);
    savingShare.value = next;
  }
};

const onAddToGrid = async (doc: UploadArchiveDocument) => {
  try {
    const tileId = await archive.addToGrid(doc);
    if (tileId) {
      toast.addToast("Added to grid", "success");
      emit("close");
    } else {
      toast.addToast("Couldn't add to grid — the grid may be full.", "error");
    }
  } catch {
    toast.addToast("Couldn't add to grid. Please try again.", "error");
  }
};

const openRename = (doc: UploadArchiveDocument) => {
  renameTarget.value = doc;
};

const confirmRename = async (value: string) => {
  const target = renameTarget.value;
  renameTarget.value = null;
  if (!target) return;
  try {
    await archive.rename(target.hash, value);
  } catch {
    toast.addToast("Could not rename file. Please try again.", "error");
  }
};

const openDelete = (doc: UploadArchiveDocument) => {
  deleteTarget.value = doc;
};

const confirmDelete = async () => {
  const target = deleteTarget.value;
  if (!target) return;
  deleting.value = true;
  try {
    await archive.remove(target.hash, target.refCount > 0);
    toast.addToast("File deleted", "success");
    deleteTarget.value = null;
  } catch {
    toast.addToast("Could not delete file. Please try again.", "error");
  } finally {
    deleting.value = false;
  }
};

const handleClose = () => emit("close");

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      lockBackgroundScroll();
      activeFilter.value = "all";
      loadUsage();
      void archive.refresh().catch(() => {
        // Surfaced via the composable's `error` state in the body.
      });
    } else {
      unlockBackgroundScroll();
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      renameTarget.value = null;
      deleteTarget.value = null;
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  unlockBackgroundScroll();
  unsubscribeProfile?.();
});
</script>

<!--
  Global (unscoped): BaseModal teleports `.modal-content` to <body>, outside
  this component's style scope, so a scoped `:deep()` override cannot reliably
  reach it and loses to BaseModal's centered caps (`width: 90%; max-width: 500px`).
  This selector is more specific than that rule and pins the archive to a large,
  fixed size that never shrinks to fit its content.
-->
<style lang="scss">
.modal-overlay:not(.is-floating) .modal-content.file-archive-modal-content {
  padding: 0;
  width: min(1600px, 95vw);
  max-width: 95vw;
  height: min(1040px, 92vh);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 600px) {
  .modal-overlay:not(.is-floating) .modal-content.file-archive-modal-content {
    width: 100vw;
    max-width: 100vw;
    height: 100dvh;
    max-height: 100dvh;
    border-radius: 0;
  }
}
</style>

<style lang="scss" scoped>
.fa {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  font-family: "Inter", var(--font-family-base), sans-serif;
}

.fa__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-lg);
  border-bottom: var(--border-width) solid var(--color-stroke);
  flex-shrink: 0;

  h2 {
    margin: 0;
    font-size: 20px;
    color: var(--color-text-primary);
  }
}

.fa__close {
  background: transparent;
  border: none;
  color: var(--color-content-default);
  cursor: pointer;
  padding: var(--spacing-xs);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast) var(--easing-smooth);

  &:hover {
    background-color: var(--color-content-background);
    color: var(--color-text-primary);
  }
}

.fa__usage {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: var(--border-width) solid var(--color-stroke);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.fa__usage-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.fa__usage-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-content-low);
}

.fa__usage-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.fa__usage-infinity {
  font-size: 16px;
  line-height: 1;
  vertical-align: middle;
}

.fa__usage-bar {
  position: relative;
  height: 6px;
  border-radius: 999px;
  background-color: var(--color-content-background);
  overflow: hidden;

  &.is-unlimited {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--color-figma-purple) 40%, transparent),
      var(--color-content-background)
    );
  }
}

.fa__usage-fill {
  position: absolute;
  inset: 0 auto 0 0;
  background-color: var(--color-figma-purple);
  border-radius: 999px;
  transition: width var(--duration-medium) var(--easing-smooth);

  &.is-warning {
    background-color: var(--color-figma-red);
  }
}

.fa__toolbar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  flex-shrink: 0;
}

.fa__pills {
  display: flex;
  gap: var(--spacing-xs);
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  // Match the app's shared thin scrollbar (see `.scrollable-thin` in main.css)
  // without its `touch-action: pan-y`, which would block horizontal panning.
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.fa__pill {
  border: var(--border-width) solid var(--color-stroke);
  background: transparent;
  color: var(--color-content-default);
  font-family: inherit;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  padding: 5px 14px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--duration-fast) var(--easing-smooth);

  &:hover {
    background-color: var(--color-content-background);
    color: var(--color-text-primary);
  }

  &.is-active {
    background-color: var(--color-figma-purple);
    border-color: var(--color-figma-purple);
    color: var(--color-light-100);
  }
}

.fa__file-input {
  display: none;
}

.fa__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  // Belt-and-suspenders with the background scroll lock: don't chain scroll to
  // the page when the list reaches its top/bottom.
  overscroll-behavior: contain;
  padding: 0 var(--spacing-lg) var(--spacing-lg);
}

.fa__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  min-height: 220px;
  color: var(--color-content-low);
  font-size: var(--font-size-md);
  text-align: center;

  &--error {
    color: var(--color-figma-red);
  }
}

.fa__state-icon {
  color: var(--color-content-low);
  opacity: 0.6;
}

.fa__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.fa__row {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--easing-smooth);

  &:hover {
    background-color: var(--color-content-background);
    border-color: var(--color-stroke);
  }
}

.fa__preview {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background-color: var(--color-base-8, var(--color-content-background));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-content-low);

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.fa__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.fa__name {
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fa__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  font-size: 12px;
  color: var(--color-content-low);
}

.fa__badge {
  padding: 2px 8px;
  border-radius: 999px;
  background-color: var(--color-content-background);
  border: var(--border-width) solid var(--color-stroke);
  color: var(--color-content-default);
  font-weight: var(--font-weight-medium);
}

.fa__refcount.is-used {
  color: var(--color-content-default);
}

.fa__date {
  margin-left: auto;
}

.fa__row-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.fa__switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-content-default);
  font-family: inherit;
  font-size: 12px;
  transition: opacity var(--duration-fast) var(--easing-smooth);

  &.is-pending {
    opacity: 0.6;
    pointer-events: none;
  }
}

.fa__switch-track {
  position: relative;
  width: 30px;
  height: 17px;
  border-radius: 999px;
  background-color: var(--color-content-low);
  border: 1px solid var(--color-tile-stroke);
  box-sizing: border-box;
  transition: all var(--duration-fast) var(--easing-smooth);
  flex-shrink: 0;
}

.fa__switch-thumb {
  position: absolute;
  top: 1px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: white;
  transition: transform var(--duration-fast) var(--easing-smooth);
}

.fa__switch.is-on {
  color: var(--color-text-primary);

  .fa__switch-track {
    background-color: var(--color-figma-purple);
    border-color: var(--color-figma-purple);
  }

  .fa__switch-thumb {
    transform: translateX(13px);
    background-color: var(--color-light-100);
  }
}

.fa__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-content-high);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);

  :deep(svg) {
    display: block;
    width: 16px;
    height: 16px;
  }

  &:hover {
    background-color: var(--color-base-34, var(--color-content-background));
    color: var(--color-text-primary);
  }

  &--danger:hover {
    color: var(--color-figma-red);
  }
}

.fa-confirm__title {
  margin: 0 0 var(--spacing-sm);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.fa-confirm__body {
  margin: 0 0 var(--spacing-lg);
  color: var(--color-content-default);
  font-size: var(--font-size-md);
  line-height: 1.5;

  strong {
    color: var(--color-text-primary);
  }
}

.fa-confirm__actions {
  display: flex;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

@media (max-width: 600px) {
  .fa__date {
    display: none;
  }

  .fa__switch-text {
    display: none;
  }
}
</style>
