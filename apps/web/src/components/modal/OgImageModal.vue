<template>
  <BaseModal :show="show" variant="centered" content-class="og-image-modal" @close="handleClose">
    <h3>Social Share Image</h3>
    <p class="modal-description">
      This image is shown when your grid is shared on social platforms.
      Upload your own, or use the auto-generated one.
    </p>

    <div class="og-preview" :class="{ 'is-busy': busy }">
      <img
        v-if="previewUrl && !imgError"
        :key="previewUrl"
        :src="previewUrl"
        alt="Social share image preview"
        @load="imgLoading = false"
        @error="handleImgError"
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
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BaseModal from "./BaseModal.vue";
import Button from "@/components/ui-elements/Button.vue";
import { useGridStore } from "@/stores/grid";
import { useToastStore } from "@/stores/toast";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
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
    if (!open) return;
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
  uploading.value = true;
  try {
    storageService.validateFile(file, { fileType: "images" });
    const url = await storageService.uploadToPath(
      customOgImagePath(gridId.value),
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
</style>
