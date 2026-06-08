<template>
  <div class="brand-picker" @mousedown.stop @click.stop>
    <div class="brand-picker__search">
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        class="brand-picker__input"
        placeholder="Search a brand or tool…"
        @input="onInput"
        @keyup.esc="$emit('close')"
      />
    </div>

    <p v-if="error" class="brand-picker__msg brand-picker__msg--error">{{ error }}</p>
    <p v-else-if="isSearching" class="brand-picker__msg">Searching…</p>
    <p
      v-else-if="query.trim() && results.length === 0"
      class="brand-picker__msg"
    >
      No matches. Upload a custom logo below.
    </p>

    <ul v-if="results.length" class="brand-picker__results">
      <li v-for="r in results" :key="r.domain">
        <button type="button" class="brand-picker__result" @click="selectResult(r)">
          <img
            v-if="r.icon"
            class="brand-picker__result-icon"
            :src="r.icon"
            :alt="r.name"
            width="24"
            height="24"
            loading="lazy"
          />
          <span v-else class="brand-picker__result-icon brand-picker__result-icon--ph">
            {{ r.name.charAt(0).toUpperCase() }}
          </span>
          <span class="brand-picker__result-text">
            <span class="brand-picker__result-name">{{ r.name }}</span>
            <span class="brand-picker__result-domain">{{ r.domain }}</span>
          </span>
        </button>
      </li>
    </ul>

    <div class="brand-picker__footer">
      <button type="button" class="brand-picker__upload" @click="fileInput?.click()">
        Upload custom logo
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        style="display: none"
        @change="onUpload"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from "vue";
import { v4 as uuidv4 } from "uuid";
import type { BrandLogoRef } from "@grids/contracts/types";
import { useBrandSearch } from "@/composables/useBrandSearch";
import { useFileUpload } from "@/composables/useFileUpload";
import type { BrandSearchResult } from "@/utils/brandLogo";

const emit = defineEmits<{
  select: [logo: BrandLogoRef];
  close: [];
}>();

const { results, isSearching, error, search } = useBrandSearch();
const { uploadFileToUrl } = useFileUpload();

const query = ref("");
const inputEl = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  void nextTick(() => inputEl.value?.focus());
});

const onInput = () => {
  search(query.value);
};

const selectResult = (r: BrandSearchResult) => {
  emit("select", {
    id: uuidv4(),
    provider: "brandfetch",
    domain: r.domain,
    label: r.name,
    theme: "auto",
  });
};

const onUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const url = await uploadFileToUrl(file, { fileType: "images" });
    const label = file.name.replace(/\.[^.]+$/, "");
    emit("select", {
      id: uuidv4(),
      provider: "custom",
      src: url,
      label,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    alert(`Failed to upload logo: ${message}`);
  }
};
</script>

<style scoped>
.brand-picker {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 8px);
  width: 100%;
  max-width: 320px;
  padding: var(--spacing-sm, 8px);
  background-color: var(--color-tile-background);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  border-radius: var(--radius-md, 10px);
}

.brand-picker__input {
  width: 100%;
  padding: var(--spacing-sm, 8px);
  font-size: var(--font-size-md, 14px);
  font-family: var(--font-family-base, inherit);
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm, 6px);
  outline: none;
}

.brand-picker__input:focus {
  border-color: var(--color-content-default);
}

.brand-picker__msg {
  margin: 0;
  font-size: 12px;
  color: var(--color-content-default);
}

.brand-picker__msg--error {
  color: var(--color-danger, #e5484d);
}

.brand-picker__results {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.brand-picker__result {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm, 8px);
  width: 100%;
  padding: 6px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
  text-align: left;
  color: var(--color-text-primary);
}

.brand-picker__result:hover {
  background-color: var(--color-base-55, rgba(127, 127, 127, 0.12));
}

.brand-picker__result-icon {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  object-fit: contain;
  border-radius: 4px;
}

.brand-picker__result-icon--ph {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background-color: var(--color-base-55, rgba(127, 127, 127, 0.15));
}

.brand-picker__result-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.brand-picker__result-name {
  font-size: 13px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand-picker__result-domain {
  font-size: 11px;
  color: var(--color-content-default);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand-picker__footer {
  display: flex;
  justify-content: flex-start;
}

.brand-picker__upload {
  font-size: 12px;
  padding: 6px 8px;
  color: var(--color-text-primary);
  background-color: var(--color-content-background);
  border: var(--tile-border-width, 1px) solid var(--color-tile-stroke);
  border-radius: var(--radius-sm, 6px);
  cursor: pointer;
}

.brand-picker__upload:hover {
  background-color: var(--color-base-55, rgba(127, 127, 127, 0.12));
}
</style>
