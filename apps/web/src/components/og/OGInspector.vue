<template>
  <div class="og-inspector">
    <!-- ── Content ─────────────────────────────────────────────────── -->
    <section class="og-inspector__section">
      <h4 class="og-inspector__title">Content</h4>
      <Toggle
        label="Avatar"
        :model-value="config.visibility.avatar"
        @update:model-value="(v) => updateVisibility({ avatar: v })"
      />
      <Toggle
        label="Name"
        :model-value="config.visibility.name"
        @update:model-value="(v) => updateVisibility({ name: v })"
      />
      <Toggle
        label="Subtitle"
        :model-value="config.visibility.subtitle"
        @update:model-value="(v) => updateVisibility({ subtitle: v })"
      />
      <Toggle
        label="Handle"
        :model-value="config.visibility.handle"
        @update:model-value="(v) => updateVisibility({ handle: v })"
      />
    </section>

    <Divider />

    <!-- ── Background ──────────────────────────────────────────────── -->
    <section class="og-inspector__section">
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
          @click="activeCategory = cat"
        >
          {{ categoryLabel(cat) }}
        </button>
      </div>

      <!-- Preset picker for the active category -->
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

      <!-- Solid -->
      <div v-if="activeCategory === 'solid'" class="og-inspector__field">
        <label class="og-inspector__label">Color</label>
        <input
          type="color"
          class="og-inspector__color"
          :value="config.background.color"
          @input="onColorInput"
        />
      </div>

      <!-- Gradient -->
      <template v-if="activeCategory === 'gradient'">
        <div class="og-inspector__field">
          <label class="og-inspector__label">Angle</label>
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
          <label class="og-inspector__label">Stops</label>
          <div
            v-for="(stop, i) in config.background.stops ?? []"
            :key="i"
            class="og-inspector__stop"
          >
            <input
              type="color"
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
            + Add stop
          </button>
        </div>
        <Toggle
          label="Animated"
          :model-value="!!config.background.animated"
          @update:model-value="(v) => updateBackground({ animated: v })"
        />
      </template>

      <!-- Animated -->
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
          <label class="og-inspector__label">Speed ({{ config.background.speed ?? 12 }}s)</label>
          <input
            type="range"
            min="2"
            max="30"
            :value="config.background.speed ?? 12"
            @input="(e) => updateBackground({ speed: Number((e.target as HTMLInputElement).value) })"
          />
        </div>
      </template>

      <!-- Pattern -->
      <template v-if="activeCategory === 'pattern'">
        <div class="og-inspector__field">
          <label class="og-inspector__label">Style</label>
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
          <label class="og-inspector__label">Background</label>
          <input
            type="color"
            class="og-inspector__color"
            :value="config.background.patternBackground"
            @input="(e) => updateBackground({ patternBackground: (e.target as HTMLInputElement).value })"
          />
        </div>
        <div class="og-inspector__field">
          <label class="og-inspector__label">Color</label>
          <input
            type="color"
            class="og-inspector__color"
            :value="patternColorHex"
            @input="onPatternColorInput"
          />
        </div>
        <div class="og-inspector__field">
          <label class="og-inspector__label">Opacity ({{ patternOpacityPercent }}%)</label>
          <input
            type="range"
            min="0"
            max="100"
            :value="patternOpacityPercent"
            @input="onPatternOpacityInput"
          />
        </div>
        <div class="og-inspector__field">
          <label class="og-inspector__label">Size</label>
          <input
            type="range"
            min="1"
            max="8"
            :value="config.background.patternStrokeWidth ?? 1"
            @input="(e) => updateBackground({ patternStrokeWidth: Number((e.target as HTMLInputElement).value) })"
          />
        </div>
        <div class="og-inspector__field">
          <label class="og-inspector__label">Spacing</label>
          <input
            type="range"
            min="8"
            max="80"
            :value="config.background.patternSize ?? 28"
            @input="(e) => updateBackground({ patternSize: Number((e.target as HTMLInputElement).value) })"
          />
        </div>
        <Toggle
          label="Animated"
          :model-value="!!config.background.animated"
          @update:model-value="(v) => updateBackground({ animated: v })"
        />
      </template>
    </section>

    <!-- ── Animation & Motion ─────────────────────────────────────── -->
    <Divider />
    <section class="og-inspector__section">
      <h4 class="og-inspector__title">Motion & Animations</h4>
      <div class="og-inspector__field">
        <label class="og-inspector__label">Tile Motion Effect</label>
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
        <label class="og-inspector__label">Motion Duration ({{ config.animation?.tileSpeed ?? 3 }}s)</label>
        <input
          type="range"
          min="1"
          max="6"
          step="0.5"
          :value="config.animation?.tileSpeed ?? 3"
          @input="(e) => updateAnimation({ tileSpeed: Number((e.target as HTMLInputElement).value) })"
        />
      </div>
    </section>

    <template v-if="selectedPlacement">
      <Divider />
      <section class="og-inspector__section">
        <h4 class="og-inspector__title">Selected Tile</h4>
        <div class="og-inspector__field">
          <label class="og-inspector__label">
            Scale ({{ Math.round((selectedPlacement.scale ?? 1) * 100) }}%)
          </label>
          <input
            type="range"
            min="50"
            max="200"
            :value="Math.round((selectedPlacement.scale ?? 1) * 100)"
            @input="(e) => updateSelectedPlacement({ scale: Number((e.target as HTMLInputElement).value) / 100 })"
          />
        </div>
        <div class="og-inspector__field">
          <label class="og-inspector__label">
            Opacity ({{ Math.round(selectedPlacement.opacity * 100) }}%)
          </label>
          <input
            type="range"
            min="0"
            max="100"
            :value="Math.round(selectedPlacement.opacity * 100)"
            @input="onOpacityInput"
          />
        </div>
        <div class="og-inspector__field">
          <label class="og-inspector__label">Rotation ({{ selectedPlacement.rotation }}°)</label>
          <input
            type="number"
            class="og-inspector__number"
            min="-180"
            max="180"
            :value="selectedPlacement.rotation"
            @input="onRotationInput"
          />
        </div>
        <div class="og-inspector__field">
          <label class="og-inspector__label">Tile Override Motion</label>
          <select
            class="og-inspector__select"
            :value="selectedPlacement.animation ?? ''"
            @change="(e) => updateSelectedPlacement({ animation: ((e.target as HTMLSelectElement).value || undefined) as any })"
          >
            <option value="">Use Global Setting</option>
            <option value="none">None</option>
            <option value="float">Float</option>
            <option value="pulse">Pulse</option>
            <option value="shimmer">Shimmer</option>
            <option value="tilt">Tilt</option>
          </select>
        </div>
        <Button variant="danger" size="sm" @click="removeSelectedTile">Remove Tile</Button>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Toggle from "@/components/ui-controls/Toggle.vue";
import Divider from "@/components/ui-elements/Divider.vue";
import Button from "@/components/ui-elements/Button.vue";
import {
  getAllBackgroundPresets,
  getBackgroundPresetsByCategory,
  renderBackground,
  type BackgroundCategory,
  type BackgroundConfig,
  type GradientStop,
} from "@/lib/animate";
import type { OGConfig, OGVisibility } from "@/types/og";

const props = defineProps<{
  config: OGConfig;
  selectedTileId?: string | null;
}>();

const emit = defineEmits<{
  "update:config": [config: OGConfig];
}>();

const categories: BackgroundCategory[] = ["solid", "gradient", "animated", "pattern"];

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
  updateBackground({ color: (e.target as HTMLInputElement).value });
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

// Pattern color is stored as a plain CSS color (often rgba) — split into a
// hex swatch + separate opacity slider for editing, recomposing to rgba on
// change.
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

const patternColorHex = computed(() => parsePatternColor(props.config.background.patternColor).hex);
const patternOpacityPercent = computed(() =>
  Math.round(parsePatternColor(props.config.background.patternColor).alpha * 100),
);

const composePatternColor = (hex: string, alphaPercent: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${(alphaPercent / 100).toFixed(2)})`;
};

const onPatternColorInput = (e: Event) => {
  const hex = (e.target as HTMLInputElement).value;
  updateBackground({ patternColor: composePatternColor(hex, patternOpacityPercent.value) });
};

const onPatternOpacityInput = (e: Event) => {
  const alpha = Number((e.target as HTMLInputElement).value);
  updateBackground({ patternColor: composePatternColor(patternColorHex.value, alpha) });
};

const updateAnimation = (patch: Partial<NonNullable<OGConfig["animation"]>>) => {
  emit("update:config", {
    ...props.config,
    animation: {
      ...(props.config.animation ?? {
        tileAnimation: "none",
        tileSpeed: 3,
        livePlay: true,
      }),
      ...patch,
    },
  });
};

// ── Selected tile ──────────────────────────────────────────────────────
const selectedPlacement = computed(() =>
  props.config.tiles.find((t) => t.tileId === props.selectedTileId) ?? null,
);

const updateSelectedPlacement = (
  patch: Partial<{ opacity: number; rotation: number; scale: number; animation?: any }>,
) => {
  if (!props.selectedTileId) return;
  const tiles = props.config.tiles.map((t) =>
    t.tileId === props.selectedTileId ? { ...t, ...patch } : t,
  );
  emit("update:config", { ...props.config, tiles });
};

const onOpacityInput = (e: Event) => {
  updateSelectedPlacement({ opacity: Number((e.target as HTMLInputElement).value) / 100 });
};

const onRotationInput = (e: Event) => {
  updateSelectedPlacement({ rotation: Number((e.target as HTMLInputElement).value) });
};

const removeSelectedTile = () => {
  if (!props.selectedTileId) return;
  const tiles = props.config.tiles.filter((t) => t.tileId !== props.selectedTileId);
  emit("update:config", { ...props.config, tiles });
};
</script>

<style lang="scss" scoped>
.og-inspector {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  height: 100%;
  padding: var(--spacing-md);
  overflow-y: auto;
}

.og-inspector__section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.og-inspector__title {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.og-inspector__tabs {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--color-content-low);
}

.og-inspector__tab {
  flex: 1;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-xs, 11px);
  cursor: pointer;

  &.is-active {
    background: var(--color-text-primary);
    color: var(--color-tile-background);
  }
}

.og-inspector__preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-xs);
}

.og-inspector__preset {
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  border: var(--border-width) solid var(--color-stroke);
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-xs, 11px);
  cursor: pointer;

  &.is-active {
    border-color: var(--color-figma-purple);
    background: color-mix(in srgb, var(--color-figma-purple) 15%, transparent);
  }
}

.og-inspector__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.og-inspector__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-sm);
}

.og-inspector__label {
  font-size: var(--font-size-xs, 11px);
  color: var(--color-content-default);
}

.og-inspector__color {
  width: 100%;
  height: 32px;
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-sm);
  background: transparent;
  padding: 2px;
  cursor: pointer;
}

.og-inspector__select {
  width: 100%;
  height: 32px;
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-sm);
  background: var(--color-content-background);
  color: var(--color-text-primary);
  padding: 0 var(--spacing-sm);
}

.og-inspector__number {
  width: 100%;
  height: 32px;
  border: var(--border-width) solid var(--color-stroke);
  border-radius: var(--radius-sm);
  background: var(--color-content-background);
  color: var(--color-text-primary);
  padding: 0 var(--spacing-sm);
}

.og-inspector__stops {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.og-inspector__stop {
  display: grid;
  grid-template-columns: 32px 1fr 24px;
  align-items: center;
  gap: var(--spacing-xs);

  input[type="color"] {
    width: 32px;
    height: 24px;
    border: var(--border-width) solid var(--color-stroke);
    border-radius: 4px;
    padding: 0;
  }
}

.og-inspector__stop-remove {
  background: transparent;
  border: none;
  color: var(--color-content-default);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.og-inspector__add-stop {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: var(--color-figma-purple);
  cursor: pointer;
  font-size: var(--font-size-xs, 11px);
  padding: 4px 0;
}

.og-inspector__preview {
  height: 64px;
  border-radius: var(--radius-sm);
  border: var(--border-width) solid var(--color-stroke);
}
</style>
