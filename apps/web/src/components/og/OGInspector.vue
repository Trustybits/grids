<template>
  <div class="og-inspector">
    <div class="og-inspector__scroll">
      <!-- ── Content / Info Safe Zone ─────────────────────────────────── -->
      <MenuSection class="og-inspector__section">
        <h4 class="og-inspector__title">Info Safe Zone</h4>
        <p class="og-inspector__subtitle">Display live grid profile badge and titles</p>
        <Toggle
          label="Avatar Initials"
          :model-value="config.visibility.avatar"
          @update:model-value="(v) => updateVisibility({ avatar: v })"
        />
        <Toggle
          label="Grid Name"
          :model-value="config.visibility.name"
          @update:model-value="(v) => updateVisibility({ name: v })"
        />
        <Toggle
          label="Subtitle"
          :model-value="config.visibility.subtitle"
          @update:model-value="(v) => updateVisibility({ subtitle: v })"
        />
        <Toggle
          label="Handle Badge"
          :model-value="config.visibility.handle"
          @update:model-value="(v) => updateVisibility({ handle: v })"
        />
      </MenuSection>

      <Divider />

      <!-- ── Background ──────────────────────────────────────────────── -->
      <MenuSection class="og-inspector__section">
        <h4 class="og-inspector__title">Background</h4>

        <div class="og-inspector__tabs" role="tablist">
          <button
            v-for="cat in categories"
            :key="cat"
            type="button"
            class="og-inspector__tab"
            role="tab"
            :aria-selected="activeCategory === cat"
            :class="{ 'is-active': activeCategory === cat }"
            @click="setCategory(cat)"
          >
            {{ categoryLabel(cat) }}
          </button>
        </div>

        <!-- Solid -->
        <template v-if="activeCategory === 'solid'">
          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Color</label>
              <span class="og-inspector__color-code">{{ config.background.color }}</span>
            </div>
            <div class="og-inspector__color-row">
              <input
                type="color"
                class="og-inspector__color"
                :value="config.background.color"
                @input="onColorInput"
              />
              <input
                type="text"
                class="og-inspector__input"
                :value="config.background.color"
                @input="onColorInput"
              />
            </div>
          </div>

          <!-- Quick Palette -->
          <div class="og-inspector__swatches">
            <button
              v-for="swatch in SOLID_SWATCHES"
              :key="swatch"
              type="button"
              class="og-inspector__swatch"
              :style="{ background: swatch }"
              :class="{ 'is-selected': config.background.color === swatch }"
              @click="updateBackground({ color: swatch, presetId: 'solid' })"
            />
          </div>
        </template>

        <!-- Gradient -->
        <template v-if="activeCategory === 'gradient'">
          <!-- Preset picker for Gradient -->
          <div v-if="presetsInCategory.length > 1" class="og-inspector__preset-grid">
            <button
              v-for="preset in presetsInCategory"
              :key="preset.id"
              type="button"
              class="og-inspector__preset"
              :class="{ 'is-active': config.background.presetId === preset.id }"
              @click="selectPreset(preset.id)"
            >
              {{ preset.label }}
            </button>
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Angle</label>
              <span class="og-inspector__val">{{ config.background.angle ?? 135 }}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              :value="config.background.angle ?? 135"
              @input="onAngleInput"
            />
          </div>

          <div v-if="config.background.presetId !== 'linear-gradient'" class="og-inspector__row">
            <div class="og-inspector__field">
              <label class="og-inspector__label">Center X</label>
              <input
                type="range"
                min="0"
                max="100"
                :value="config.background.centerX ?? 50"
                @input="(e) => updateBackground({ centerX: Number((e.target as HTMLInputElement).value) })"
              />
            </div>
            <div class="og-inspector__field">
              <label class="og-inspector__label">Center Y</label>
              <input
                type="range"
                min="0"
                max="100"
                :value="config.background.centerY ?? 50"
                @input="(e) => updateBackground({ centerY: Number((e.target as HTMLInputElement).value) })"
              />
            </div>
          </div>

          <div class="og-inspector__stops">
            <label class="og-inspector__label">Color Stops</label>
            <div
              v-for="(stop, i) in config.background.stops ?? []"
              :key="i"
              class="og-inspector__stop"
            >
              <input
                type="color"
                class="og-inspector__color-sm"
                :value="stop.color"
                @input="(e) => updateStop(i, { color: (e.target as HTMLInputElement).value })"
              />
              <input
                type="range"
                min="0"
                max="100"
                :value="stop.offset"
                @input="(e) => updateStop(i, { offset: Number((e.target as HTMLInputElement).value) })"
              />
              <span class="og-inspector__stop-val">{{ stop.offset }}%</span>
              <button
                type="button"
                class="og-inspector__stop-remove"
                :disabled="(config.background.stops ?? []).length <= 2"
                @click="removeStop(i)"
              >
                &times;
              </button>
            </div>
            <button type="button" class="og-inspector__add-stop" @click="addStop">
              + Add color stop
            </button>
          </div>

          <Toggle
            label="Animated Rotation"
            :model-value="!!config.background.animated"
            @update:model-value="(v) => updateBackground({ animated: v })"
          />
        </template>

        <!-- Image Background -->
        <template v-if="activeCategory === 'image'">
          <div class="og-inspector__field">
            <label class="og-inspector__label">Image Source</label>
            <div class="og-inspector__btn-group">
              <Button variant="secondary" size="sm" @click="triggerImageFileInput">
                Upload Image
              </Button>
              <Button
                v-if="gridBgImage"
                variant="secondary"
                size="sm"
                @click="useGridBackground"
              >
                Use Grid Background
              </Button>
            </div>
            <input
              ref="imageFileInput"
              type="file"
              accept="image/*"
              style="display: none"
              @change="onImageFileSelected"
            />
          </div>

          <div class="og-inspector__field" v-if="config.background.imageUrl">
            <label class="og-inspector__label">Image URL / Path</label>
            <input
              type="text"
              class="og-inspector__input"
              :value="config.background.imageUrl"
              placeholder="https://... or data:..."
              @input="(e) => updateBackground({ imageUrl: (e.target as HTMLInputElement).value, presetId: 'image-background' })"
            />
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Blur</label>
              <span class="og-inspector__val">{{ config.background.imageBlur ?? 0 }}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              :value="config.background.imageBlur ?? 0"
              @input="(e) => updateBackground({ imageBlur: Number((e.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Overlay Darkness</label>
              <span class="og-inspector__val">
                {{ Math.round((config.background.imageOverlayOpacity ?? 0.35) * 100) }}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              :value="Math.round((config.background.imageOverlayOpacity ?? 0.35) * 100)"
              @input="(e) => updateBackground({ imageOverlayOpacity: Number((e.target as HTMLInputElement).value) / 100 })"
            />
          </div>

          <div class="og-inspector__field">
            <label class="og-inspector__label">Overlay Tint Color</label>
            <div class="og-inspector__color-row">
              <input
                type="color"
                class="og-inspector__color"
                :value="config.background.imageOverlayColor ?? '#000000'"
                @input="(e) => updateBackground({ imageOverlayColor: (e.target as HTMLInputElement).value })"
              />
              <span class="og-inspector__color-code">{{ config.background.imageOverlayColor ?? '#000000' }}</span>
            </div>
          </div>

          <div class="og-inspector__field">
            <label class="og-inspector__label">Fit</label>
            <select
              class="og-inspector__select"
              :value="config.background.imageFit ?? 'cover'"
              @change="(e) => updateBackground({ imageFit: (e.target as HTMLSelectElement).value as any })"
            >
              <option value="cover">Cover (Fill canvas)</option>
              <option value="contain">Contain (Fit inside)</option>
            </select>
          </div>
        </template>

        <!-- Animated Backgrounds -->
        <template v-if="activeCategory === 'animated'">
          <div class="og-inspector__field">
            <label class="og-inspector__label">Preset</label>
            <select
              class="og-inspector__select"
              :value="config.background.presetId"
              @change="(e) => selectPreset((e.target as HTMLSelectElement).value)"
            >
              <option v-for="preset in presetsInCategory" :key="preset.id" :value="preset.id">
                {{ preset.label }}
              </option>
            </select>
          </div>
          <div class="og-inspector__preview" :style="animatedPreviewStyle" />
          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Speed</label>
              <span class="og-inspector__val">{{ config.background.speed ?? 12 }}s</span>
            </div>
            <input
              type="range"
              min="2"
              max="30"
              :value="config.background.speed ?? 12"
              @input="(e) => updateBackground({ speed: Number((e.target as HTMLInputElement).value) })"
            />
          </div>
        </template>

        <!-- Patterns / Textures -->
        <template v-if="activeCategory === 'pattern'">
          <div class="og-inspector__field">
            <label class="og-inspector__label">Texture Style</label>
            <select
              class="og-inspector__select"
              :value="config.background.presetId"
              @change="(e) => selectPreset((e.target as HTMLSelectElement).value)"
            >
              <option v-for="preset in presetsInCategory" :key="preset.id" :value="preset.id">
                {{ preset.label }}
              </option>
            </select>
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Background Fill Color</label>
              <span class="og-inspector__color-code">{{ config.background.patternBackground ?? '#18181b' }}</span>
            </div>
            <div class="og-inspector__color-row">
              <input
                type="color"
                class="og-inspector__color"
                :value="config.background.patternBackground ?? '#18181b'"
                @input="(e) => updateBackground({ patternBackground: (e.target as HTMLInputElement).value })"
              />
              <span class="og-inspector__val-desc">Color behind the pattern</span>
            </div>
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Line / Texture Color</label>
              <span class="og-inspector__color-code">{{ patternColorHex }}</span>
            </div>
            <div class="og-inspector__color-row">
              <input
                type="color"
                class="og-inspector__color"
                :value="patternColorHex"
                @input="onPatternColorInput"
              />
              <span class="og-inspector__val-desc">Pattern stroke color</span>
            </div>
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Pattern Opacity</label>
              <span class="og-inspector__val">{{ patternOpacityPercent }}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              :value="patternOpacityPercent"
              @input="onPatternOpacityInput"
            />
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Stroke Thickness</label>
              <span class="og-inspector__val">{{ config.background.patternStrokeWidth ?? 1 }}px</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              :value="config.background.patternStrokeWidth ?? 1"
              @input="(e) => updateBackground({ patternStrokeWidth: Number((e.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Spacing & Density</label>
              <span class="og-inspector__val">{{ config.background.patternSize ?? 28 }}px</span>
            </div>
            <input
              type="range"
              min="8"
              max="80"
              :value="config.background.patternSize ?? 28"
              @input="(e) => updateBackground({ patternSize: Number((e.target as HTMLInputElement).value) })"
            />
          </div>

          <Toggle
            label="Animate Pattern Flow"
            :model-value="!!config.background.animated"
            @update:model-value="(v) => updateBackground({ animated: v })"
          />
        </template>
      </MenuSection>

      <!-- ── Selected Tile Controls ───────────────────────────────────── -->
      <template v-if="selectedPlacement">
        <Divider />
        <MenuSection class="og-inspector__section og-inspector__section--selected">
          <div class="og-inspector__selected-header">
            <h4 class="og-inspector__title">Selected Card</h4>
            <span class="og-inspector__badge">Card {{ selectedPlacement.tileId }}</span>
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Scale</label>
              <span class="og-inspector__val">{{ Math.round((selectedPlacement.scale ?? 1) * 100) }}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="200"
              :value="Math.round((selectedPlacement.scale ?? 1) * 100)"
              @input="(e) => updateSelectedPlacement({ scale: Number((e.target as HTMLInputElement).value) / 100 })"
            />
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Opacity</label>
              <span class="og-inspector__val">{{ Math.round(selectedPlacement.opacity * 100) }}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              :value="Math.round(selectedPlacement.opacity * 100)"
              @input="onOpacityInput"
            />
          </div>

          <div class="og-inspector__field">
            <div class="og-inspector__field-header">
              <label class="og-inspector__label">Rotation</label>
              <span class="og-inspector__val">{{ selectedPlacement.rotation }}°</span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              :value="selectedPlacement.rotation"
              @input="onRotationInput"
            />
          </div>

          <div class="og-inspector__field">
            <label class="og-inspector__label">Motion Override</label>
            <select
              class="og-inspector__select"
              :value="selectedPlacement.animation ?? ''"
              @change="(e) => updateSelectedPlacement({ animation: ((e.target as HTMLSelectElement).value || undefined) as any })"
            >
              <option value="">Use Global Motion</option>
              <option value="none">None (Static)</option>
              <option value="float">Float & Bob</option>
              <option value="pulse">Breathing Pulse</option>
              <option value="shimmer">Neon Shimmer</option>
              <option value="tilt">Dynamic Tilt</option>
            </select>
          </div>

          <Button variant="danger" size="sm" @click="removeSelectedTile">
            Remove from Canvas
          </Button>
        </MenuSection>
      </template>

      <!-- ── Motion & Animations Accordion ───────────────────────────── -->
      <Divider />
      <MenuSection class="og-inspector__section">
        <Accordion title="Motion & Physics" class="og-inspector__accordion">
          <div class="og-inspector__accordion-body">
            <div class="og-inspector__field">
              <label class="og-inspector__label">Global Tile Motion</label>
              <select
                class="og-inspector__select"
                :value="config.animation?.tileAnimation ?? 'none'"
                @change="(e) => updateAnimation({ tileAnimation: (e.target as HTMLSelectElement).value as any })"
              >
                <option value="none">None (Static)</option>
                <option value="float">Float & Bob</option>
                <option value="pulse">Breathing Pulse</option>
                <option value="shimmer">Neon Shimmer</option>
                <option value="tilt">Dynamic Tilt</option>
              </select>
            </div>

            <div v-if="(config.animation?.tileAnimation ?? 'none') !== 'none'" class="og-inspector__field">
              <div class="og-inspector__field-header">
                <label class="og-inspector__label">Cycle Speed</label>
                <span class="og-inspector__val">{{ config.animation?.tileSpeed ?? 3 }}s</span>
              </div>
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                :value="config.animation?.tileSpeed ?? 3"
                @input="(e) => updateAnimation({ tileSpeed: Number((e.target as HTMLInputElement).value) })"
              />
            </div>
          </div>
        </Accordion>
      </MenuSection>
    </div>

    <!-- ── Dedicated Apply Footer ────────────────────────────────────── -->
    <div class="og-inspector__footer">
      <Button
        variant="primary"
        size="md"
        class="og-inspector__apply-btn"
        :disabled="isApplying"
        @click="$emit('apply')"
      >
        <template #icon-left>
          <SpinnerIcon v-if="isApplying" :size="16" />
          <CheckIcon v-else :size="16" />
        </template>
        {{ isApplying ? "Applying to Grid…" : "Apply to Grid" }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import MenuSection from "@/components/ui-collections/MenuSection.vue";
import Toggle from "@/components/ui-controls/Toggle.vue";
import Divider from "@/components/ui-elements/Divider.vue";
import Button from "@/components/ui-elements/Button.vue";
import Accordion from "@/components/ui-controls/Accordion.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import SpinnerIcon from "@/components/icons/SpinnerIcon.vue";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import {
  getAllBackgroundPresets,
  getBackgroundPresetsByCategory,
  renderBackground,
  type BackgroundCategory,
  type BackgroundConfig,
  type GradientStop,
} from "@/lib/animate";
import type { OGConfig, OGVisibility, OGTilePlacement } from "@/types/og";

const props = defineProps<{
  config: OGConfig;
  selectedTileId?: string | null;
  isApplying?: boolean;
}>();

const emit = defineEmits<{
  "update:config": [config: OGConfig];
  "apply": [];
}>();

const sessionStore = useGridSessionStore();
const gridBgImage = computed(() => sessionStore.currentGrid?.backgroundImageSrc || "");

const categories: BackgroundCategory[] = ["solid", "gradient", "image", "animated", "pattern"];

const SOLID_SWATCHES = [
  "#18181b",
  "#09090b",
  "#1e1b4b",
  "#0f172a",
  "#14532d",
  "#701a75",
  "#7c2d12",
  "#312e81",
];

const categoryLabel = (cat: BackgroundCategory) =>
  cat.charAt(0).toUpperCase() + cat.slice(1);

const categoryForPreset = (presetId: string): BackgroundCategory =>
  getAllBackgroundPresets().find((p) => p.id === presetId)?.category ?? "solid";

const activeCategory = ref<BackgroundCategory>(categoryForPreset(props.config.background.presetId));

watch(
  () => props.config.background.presetId,
  (id) => {
    activeCategory.value = categoryForPreset(id);
  },
);

const presetsInCategory = computed(() => getBackgroundPresetsByCategory(activeCategory.value));

/**
 * Ensures that switching category tabs immediately updates `presetId` to an active preset
 * in that category, solving the solid vs gradient switching bug.
 */
const setCategory = (cat: BackgroundCategory) => {
  activeCategory.value = cat;
  const presets = getBackgroundPresetsByCategory(cat);
  if (presets.length > 0 && !presets.some((p) => p.id === props.config.background.presetId)) {
    updateBackground({ presetId: presets[0].id });
  }
};

const updateVisibility = (patch: Partial<OGVisibility>) => {
  emit("update:config", {
    ...props.config,
    visibility: { ...props.config.visibility, ...patch },
  });
};

const updateBackground = (patch: Partial<BackgroundConfig>) => {
  emit("update:config", {
    ...props.config,
    background: { ...props.config.background, ...patch },
  });
};

const selectPreset = (presetId: string) => {
  updateBackground({ presetId });
};

const onColorInput = (e: Event) => {
  updateBackground({ color: (e.target as HTMLInputElement).value, presetId: "solid" });
};

const onAngleInput = (e: Event) => {
  updateBackground({ angle: Number((e.target as HTMLInputElement).value) });
};

const updateStop = (index: number, patch: Partial<GradientStop>) => {
  const stops = (props.config.background.stops ?? []).map((s, i) =>
    i === index ? { ...s, ...patch } : s,
  );
  updateBackground({ stops });
};

const addStop = () => {
  const stops = [...(props.config.background.stops ?? [])];
  stops.push({ color: "#ffffff", offset: 100 });
  updateBackground({ stops });
};

const removeStop = (index: number) => {
  const stops = (props.config.background.stops ?? []).filter((_, i) => i !== index);
  updateBackground({ stops });
};

const animatedPreviewStyle = computed(() => renderBackground(props.config.background).css ?? "");

// Image Background handling
const imageFileInput = ref<HTMLInputElement | null>(null);

const triggerImageFileInput = () => {
  imageFileInput.value?.click();
};

const onImageFileSelected = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    const dataUrl = event.target?.result as string;
    if (dataUrl) {
      updateBackground({ imageUrl: dataUrl, presetId: "image-background" });
    }
  };
  reader.readAsDataURL(file);
};

const useGridBackground = () => {
  if (gridBgImage.value) {
    updateBackground({ imageUrl: gridBgImage.value, presetId: "image-background" });
  }
};

// Pattern Color helpers
const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

const parsePatternColor = (color: string | undefined): { hex: string; alpha: number } => {
  if (!color) return { hex: "#ffffff", alpha: 1 };
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/,
  );
  if (rgbaMatch) {
    return {
      hex: rgbToHex(Number(rgbaMatch[1]), Number(rgbaMatch[2]), Number(rgbaMatch[3])),
      alpha: rgbaMatch[4] !== undefined ? Number(rgbaMatch[4]) : 1,
    };
  }
  if (color.startsWith("#")) return { hex: color, alpha: 1 };
  return { hex: "#ffffff", alpha: 1 };
};

const patternColorHex = computed(
  () => parsePatternColor(props.config.background.patternColor).hex,
);

const patternOpacityPercent = computed(() =>
  Math.round(parsePatternColor(props.config.background.patternColor).alpha * 100),
);

const composePatternColor = (hex: string, alpha: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
};

const onPatternColorInput = (e: Event) => {
  const hex = (e.target as HTMLInputElement).value;
  const currentAlpha = parsePatternColor(props.config.background.patternColor).alpha;
  updateBackground({ patternColor: composePatternColor(hex, currentAlpha) });
};

const onPatternOpacityInput = (e: Event) => {
  const alpha = Number((e.target as HTMLInputElement).value) / 100;
  const currentHex = parsePatternColor(props.config.background.patternColor).hex;
  updateBackground({ patternColor: composePatternColor(currentHex, alpha) });
};

// Selected Tile logic
const selectedPlacement = computed<OGTilePlacement | undefined>(() =>
  props.config.tiles.find((t) => t.tileId === props.selectedTileId),
);

const updateSelectedPlacement = (patch: Partial<OGTilePlacement>) => {
  if (!props.selectedTileId) return;
  const tiles = props.config.tiles.map((t) =>
    t.tileId === props.selectedTileId ? { ...t, ...patch } : t,
  );
  emit("update:config", { ...props.config, tiles });
};

const updateAnimation = (patch: Partial<NonNullable<OGConfig["animation"]>>) => {
  emit("update:config", {
    ...props.config,
    animation: { ...(props.config.animation ?? {}), ...patch },
  });
};

const onOpacityInput = (e: Event) => {
  const opacity = Number((e.target as HTMLInputElement).value) / 100;
  updateSelectedPlacement({ opacity });
};

const onRotationInput = (e: Event) => {
  const rotation = Number((e.target as HTMLInputElement).value);
  updateSelectedPlacement({ rotation });
};

const removeSelectedTile = () => {
  if (!props.selectedTileId) return;
  emit("update:config", {
    ...props.config,
    tiles: props.config.tiles.filter((t) => t.tileId !== props.selectedTileId),
  });
};
</script>

<style lang="scss" scoped>
.og-inspector {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-content-background, #121215);
  overflow: hidden;
}

.og-inspector__scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.og-inspector__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.og-inspector__title {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: 700;
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.og-inspector__subtitle {
  margin: -4px 0 4px 0;
  font-size: 11px;
  color: var(--color-content-low);
  line-height: 1.4;
}

.og-inspector__tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  padding: 3px;
  border-radius: var(--radius-sm);
  gap: 2px;
  margin-bottom: var(--spacing-xs);
}

.og-inspector__tab {
  flex: 1;
  padding: 6px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-content-low);
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-sm) - 2px);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
  text-align: center;

  &:hover {
    color: var(--color-text-primary);
  }

  &.is-active {
    background: var(--color-input-edit, rgba(255, 255, 255, 0.14));
    color: var(--color-text-primary);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}

.og-inspector__preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  margin-bottom: var(--spacing-xs);
}

.og-inspector__preset {
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-content-low);
  border: 1px solid var(--color-stroke, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--duration-fast) var(--easing-smooth);
  text-align: center;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text-primary);
  }

  &.is-active {
    border-color: var(--color-figma-purple);
    background: rgba(168, 85, 247, 0.12);
    color: var(--color-text-primary);
  }
}

.og-inspector__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.og-inspector__field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.og-inspector__label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-content-low);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.og-inspector__val {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.og-inspector__val-desc {
  font-size: 11px;
  color: var(--color-content-low);
}

.og-inspector__color-code {
  font-size: 11px;
  font-family: monospace;
  color: var(--color-content-low);
}

.og-inspector__color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.og-inspector__color {
  width: 36px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-stroke, rgba(255, 255, 255, 0.15));
  border-radius: var(--radius-sm);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}

.og-inspector__color-sm {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}

.og-inspector__input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-stroke, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: var(--color-figma-purple);
  }
}

.og-inspector__select {
  height: 34px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-stroke, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: 12px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--color-figma-purple);
  }
}

.og-inspector__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.og-inspector__swatch {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease;

  &:hover {
    transform: scale(1.15);
  }

  &.is-selected {
    border-color: #ffffff;
    box-shadow: 0 0 0 1px var(--color-figma-purple);
  }
}

.og-inspector__btn-group {
  display: flex;
  gap: 8px;
}

.og-inspector__preview {
  width: 100%;
  height: 54px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.og-inspector__stops {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.og-inspector__stop {
  display: flex;
  align-items: center;
  gap: 8px;

  input[type="range"] {
    flex: 1;
  }
}

.og-inspector__stop-val {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-content-low);
  width: 32px;
  text-align: right;
}

.og-inspector__stop-remove {
  background: transparent;
  border: none;
  color: var(--color-content-low);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;

  &:hover:not(:disabled) {
    color: var(--color-figma-red);
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }
}

.og-inspector__add-stop {
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: var(--color-text-primary);
  font-size: 11px;
  font-weight: 600;
  padding: 6px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}

.og-inspector__selected-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.og-inspector__badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  background: rgba(168, 85, 247, 0.15);
  color: var(--color-figma-purple);
  border-radius: var(--radius-xs);
}

.og-inspector__accordion-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding-top: var(--spacing-sm);
}

.og-inspector__footer {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-stroke, rgba(255, 255, 255, 0.08));
  background: var(--color-content-background, #121215);
}

.og-inspector__apply-btn {
  width: 100%;
  font-weight: 700;
  justify-content: center;
}
</style>
