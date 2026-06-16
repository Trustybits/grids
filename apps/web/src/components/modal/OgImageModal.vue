<template>
  <BaseModal
    :show="show"
    variant="centered"
    content-class="og-image-modal"
    mobile-sheet
    @close="handleClose"
  >
    <h3>Social Share Image</h3>
    <p class="modal-description">
      This image is shown when your grid is shared on social platforms.
      Upload your own, or use the auto-generated one.
    </p>

    <div class="og-preview" :class="{ 'is-busy': busy, 'is-zoomable': zoomable }">
      <img
        v-if="previewUrl && !imgError"
        :key="previewUrl"
        :src="previewUrl"
        alt="Social share image preview"
        :role="zoomable ? 'button' : undefined"
        :tabindex="zoomable ? 0 : undefined"
        :title="zoomable ? 'View full size' : undefined"
        @load="imgLoading = false"
        @error="handleImgError"
        @click="openLightbox"
        @keydown.enter.prevent="openLightbox"
        @keydown.space.prevent="openLightbox"
      />
      <div v-if="imgError" class="og-preview-fallback">
        Preview unavailable right now.
      </div>
      <div v-if="showOverlay" class="og-preview-overlay">
        <span class="og-spinner" aria-hidden="true"></span>
        <span class="og-overlay-text">{{ overlayText }}</span>
      </div>
      <span class="og-source-badge" :class="badgeClass">
        {{ badgeText }}
      </span>
      <span v-if="zoomable" class="og-zoom-hint" aria-hidden="true">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 3H5a2 2 0 0 0-2 2v4m18 0V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4m6 0h4a2 2 0 0 0 2-2v-4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        View full size
      </span>
    </div>

    <p v-if="isNeverGenerated && !busy" class="og-callout">
      <strong>No share image yet</strong> — you're seeing the grids.so
      default. One is created automatically the first time your grid is
      shared, or you can generate it now.
    </p>
    <p v-else class="og-hint">Recommended size: 1200 × 630 px (PNG or JPG).</p>

    <input
      type="file"
      ref="fileInput"
      style="display: none"
      accept="image/*"
      @change.stop="handleFileSelected"
    />

    <div class="modal-actions">
      <Button
        v-if="isCustom"
        variant="danger"
        :disabled="busy"
        @click="handleRemove"
      >
        Remove
      </Button>
      <Button
        v-else
        :variant="isNeverGenerated ? 'primary' : 'secondary'"
        :disabled="busy || checking"
        @click="handleGenerate"
      >
        {{ isNeverGenerated ? "Generate" : "Regenerate" }}
      </Button>
      <div class="modal-actions-right">
        <Button variant="secondary" :disabled="busy" @click="handleClose">Close</Button>
        <Button
          :variant="isNeverGenerated ? 'secondary' : 'primary'"
          :disabled="busy"
          @click="triggerFilePicker"
        >
          {{ isCustom ? "Replace Image" : "Upload Image" }}
        </Button>
      </div>
    </div>
  </BaseModal>

  <teleport to="body">
    <transition name="og-lightbox-fade">
      <div
        v-if="lightboxOpen"
        class="og-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Full size social share image"
        @click="closeLightbox"
      >
        <button
          type="button"
          class="og-lightbox-close"
          aria-label="Close full size preview"
          @click.stop="closeLightbox"
        >
          <CloseXIcon :size="26" />
        </button>
        <img
          :src="previewUrl"
          alt="Full size social share image"
          class="og-lightbox-img"
        />
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import Button from "@/components/ui-elements/Button.vue";
import CloseXIcon from "@/components/icons/CloseXIcon.vue";
import { useGridStore } from "@/stores/grid";
import { useToastStore } from "@/stores/toast";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import {
  customOgImagePath,
  defaultOgImageUrl,
  generatedOgImageUrl,
  ogImageCheckUrl,
  withVersionParam,
} from "@/utils/OgImageUtils";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ close: [] }>();

const gridStore = useGridStore();
const toastStore = useToastStore();
const storageService = getServiceFactory().getStorageService();
const authProvider = getAuthProvider();

const fileInput = ref<HTMLInputElement | null>(null);
const uploading = ref(false);
const generating = ref(false);
const imgLoading = ref(false);
const imgError = ref(false);
// Bumped after a (re)generate so the <img> bypasses the CDN cache.
const cacheBust = ref(0);

// Whether the auto-generated image exists in the cache. 'unknown' while the
// existence probe is in flight; only meaningful when no custom image is set.
type GeneratedState = "unknown" | "none" | "exists";
const generatedState = ref<GeneratedState>("unknown");

const busy = computed(() => uploading.value || generating.value);
const checking = computed(
  () => !isCustom.value && generatedState.value === "unknown",
);

const gridId = computed(() => gridStore.currentGrid?.id ?? "");
const customUrl = computed(() => gridStore.currentGrid?.ogImageSrc ?? "");
const isCustom = computed(() => !!customUrl.value);
const isNeverGenerated = computed(
  () => !isCustom.value && generatedState.value === "none",
);

// Effective preview: custom upload > generated image > site-wide default
// (for grids whose image has never been generated — loading the generated
// URL would trigger a generation, which we only do on explicit request).
const previewUrl = computed(() => {
  if (!gridId.value) return "";
  if (isCustom.value) return customUrl.value;
  if (generatedState.value === "exists") {
    return generatedOgImageUrl(gridId.value, {
      cacheBust: cacheBust.value || undefined,
    });
  }
  if (generatedState.value === "none") return defaultOgImageUrl();
  return ""; // unknown — probe in flight, overlay is showing
});

const showOverlay = computed(
  () => busy.value || checking.value || (imgLoading.value && !!previewUrl.value),
);

// The preview is clickable to view full size once there's a real image to show
// (not while busy/checking and not in the error state).
const zoomable = computed(() => !!previewUrl.value && !imgError.value && !busy.value);

const lightboxOpen = ref(false);

const openLightbox = () => {
  if (zoomable.value) lightboxOpen.value = true;
};

const closeLightbox = () => {
  lightboxOpen.value = false;
};

const onLightboxKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape") closeLightbox();
};

watch(lightboxOpen, (open) => {
  if (open) window.addEventListener("keydown", onLightboxKeydown);
  else window.removeEventListener("keydown", onLightboxKeydown);
});

onBeforeUnmount(() => window.removeEventListener("keydown", onLightboxKeydown));

const overlayText = computed(() => {
  if (uploading.value) return "Uploading…";
  if (generating.value) {
    return "Generating share image… this can take up to a minute";
  }
  if (checking.value) return "Checking for an existing image…";
  return "Loading preview…";
});

const badgeText = computed(() => {
  if (isCustom.value) return "Custom";
  if (isNeverGenerated.value) return "Default";
  return "Auto-generated";
});

const badgeClass = computed(() => ({
  "is-custom": isCustom.value,
  "is-default": isNeverGenerated.value,
}));

// Ask the OG function whether a generated image is cached for this grid —
// without triggering generation. Older deployments don't understand ?check=1
// and answer with the image itself; treat any image response as "exists".
const checkGeneratedExists = async () => {
  if (!gridId.value) return;
  generatedState.value = "unknown";
  try {
    const res = await fetch(ogImageCheckUrl(gridId.value));
    const contentType = res.headers.get("content-type") ?? "";
    if (res.ok && contentType.includes("application/json")) {
      const body = (await res.json()) as { exists?: boolean };
      generatedState.value = body.exists ? "exists" : "none";
    } else {
      generatedState.value = res.ok ? "exists" : "none";
    }
  } catch {
    // Probe unreachable (offline?) — fall back to showing the generated URL.
    generatedState.value = "exists";
  }
};

watch(
  () => props.show,
  (open) => {
    if (!open) {
      closeLightbox();
      return;
    }
    imgError.value = false;
    imgLoading.value = true;
    if (!isCustom.value) void checkGeneratedExists();
  },
);

watch(previewUrl, (url) => {
  imgError.value = false;
  imgLoading.value = !!url;
});

const handleClose = () => {
  if (busy.value) return;
  emit("close");
};

const handleImgError = () => {
  imgLoading.value = false;
  imgError.value = true;
};

const triggerFilePicker = () => {
  fileInput.value?.click();
};

const handleFileSelected = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file || !gridId.value) return;
  const userId = authProvider.getCurrentUserId();
  if (!userId) {
    toastStore.addToast("You must be logged in to upload.", "error");
    return;
  }
  uploading.value = true;
  try {
    storageService.validateFile(file, { fileType: "images" });
    const url = await storageService.uploadToPath(
      customOgImagePath(userId, gridId.value),
      file,
      { contentType: file.type || "image/png" },
    );
    // Version param makes the (otherwise stable) URL unique per upload so
    // CDNs and social platforms pick up the replacement.
    gridStore.setCustomOgImage(withVersionParam(url, Date.now()));
    toastStore.addToast("Social share image updated", "success");
  } catch (error: unknown) {
    console.error("Failed to upload social share image:", error);
    toastStore.addToast(
      error instanceof Error ? error.message : "Failed to upload image",
      "error",
    );
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
};

const handleRemove = () => {
  gridStore.removeCustomOgImage();
  toastStore.addToast("Custom image removed", "success");
  // Back on the generated pipeline — find out whether an image exists.
  void checkGeneratedExists();
};

// Generate (first time) or regenerate the automatic OG image.
const handleGenerate = async () => {
  if (!gridId.value) return;
  const firstTime = isNeverGenerated.value;
  generating.value = true;
  try {
    const res = await fetch(
      generatedOgImageUrl(gridId.value, {
        // refresh only when one already exists; a missing image generates anyway
        refresh: !firstTime,
        cacheBust: Date.now(),
      }),
    );
    if (!res.ok) throw new Error("Generation failed");
    cacheBust.value = Date.now();
    generatedState.value = "exists";
    toastStore.addToast(
      firstTime
        ? "Social share image generated"
        : "Social share image regenerated",
      "success",
    );
  } catch (error: unknown) {
    console.error("Failed to generate social share image:", error);
    toastStore.addToast("Failed to generate image", "error");
  } finally {
    generating.value = false;
  }
};
</script>

<style scoped>
h3 {
  margin: 0 0 var(--spacing-sm) 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.modal-description {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--color-content-default);
  font-size: var(--font-size-md);
  line-height: 1.5;
}

.og-preview {
  position: relative;
  width: 100%;
  aspect-ratio: 1200 / 630;
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-md);
  background: var(--color-content-background);
  overflow: hidden;
}

.og-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.og-preview-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
  padding: var(--spacing-md);
  text-align: center;
}

.og-preview-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-md);
}

.og-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: og-spin 0.8s linear infinite;
}

@keyframes og-spin {
  to {
    transform: rotate(360deg);
  }
}

.og-source-badge {
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs, 11px);
  font-weight: 700;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
}

.og-source-badge.is-custom {
  background: var(--color-figma-purple, #7b61ff);
}

.og-source-badge.is-default {
  background: rgba(0, 0, 0, 0.6);
  color: rgba(255, 255, 255, 0.7);
}

.og-preview.is-zoomable img {
  cursor: zoom-in;
}

.og-zoom-hint {
  position: absolute;
  bottom: var(--spacing-sm);
  left: var(--spacing-sm);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px var(--spacing-sm);
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: var(--font-size-xs, 11px);
  font-weight: 600;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.og-preview.is-zoomable:hover .og-zoom-hint,
.og-preview.is-zoomable:focus-within .og-zoom-hint {
  opacity: 1;
  transform: translateY(0);
}

/* Full-size lightbox (teleported to body, sits above the modal) */
.og-lightbox {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-modal-backdrop, 1000) + 50);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  cursor: zoom-out;
}

.og-lightbox-img {
  max-width: min(1200px, 95vw);
  max-height: 90vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}

.og-lightbox-close {
  position: absolute;
  top: var(--spacing-lg);
  right: var(--spacing-lg);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease;
}

.og-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.25);
}

.og-lightbox-fade-enter-active,
.og-lightbox-fade-leave-active {
  transition: opacity 0.2s ease;
}

.og-lightbox-fade-enter-from,
.og-lightbox-fade-leave-to {
  opacity: 0;
}

.og-callout {
  margin: var(--spacing-sm) 0 var(--spacing-lg) 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 3px solid var(--color-figma-purple, #7b61ff);
  border-radius: var(--radius-sm);
  background: var(--color-content-background);
  color: var(--color-content-default);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.og-callout strong {
  color: var(--color-text-primary);
}

.og-hint {
  margin: var(--spacing-sm) 0 var(--spacing-lg) 0;
  color: var(--color-content-low);
  font-size: var(--font-size-sm);
}

.modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.modal-actions-right {
  display: flex;
  gap: var(--spacing-sm);
}

/* Mobile: the dialog becomes a bottom sheet (see BaseModal `mobile-sheet`),
   so stack the actions full-width with the primary action above Close, and
   give the lightbox tighter chrome. */
@media (max-width: 600px) {
  .modal-actions {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);
  }

  /* DOM order is [Close, Upload]; reverse so the primary (Upload/Replace)
     sits above Close. */
  .modal-actions-right {
    flex-direction: column-reverse;
    width: 100%;
    gap: var(--spacing-sm);
  }

  .modal-actions :deep(.ui-btn) {
    width: 100%;
  }

  .og-lightbox {
    padding: var(--spacing-md);
  }

  .og-lightbox-close {
    top: var(--spacing-md);
    right: var(--spacing-md);
  }
}
</style>
