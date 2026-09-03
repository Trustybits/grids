<template>
  <div class="og-inspector">
    <div class="og-inspector__scroll">
      <!-- ── DEDICATED SELECTED TILE CARD (Separate Standalone Card) ──── -->
      <div v-if="selectedPlacement" class="og-card-panel">
        <div class="og-card-panel__header">
          <div class="og-card-panel__title-group">
            <div class="og-card-panel__icon-box">
              <component
                :is="selectedTileDef?.icon"
                v-if="selectedTileDef?.icon"
                class="og-card-panel__icon"
              />
              <span v-else class="og-card-panel__type-char">{{ selectedTileType.slice(0, 1) }}</span>
            </div>
            <div class="og-card-panel__title-meta">
              <span class="og-card-panel__tag">SELECTED TILE</span>
              <h4 class="og-card-panel__title">{{ selectedTileTitle }}</h4>
            </div>
          </div>
          <button
            type="button"
            class="og-card-panel__close-btn"
            title="Deselect tile"
            @click="$emit('select-tile', null)"
          >
            <CloseXIcon :size="14" />
          </button>
        </div>

        <Divider class="og-card-panel__divider" />

        <div class="og-card-panel__body">
          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">SCALE</span>
              <span class="og-val-text">{{ Math.round((selectedPlacement.scale ?? 1) * 100) }}%</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="50"
              max="200"
              :value="Math.round((selectedPlacement.scale ?? 1) * 100)"
              @input="(e) => updateSelectedPlacement({ scale: Number((e.target as HTMLInputElement).value) / 100 })"
            />
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">OPACITY</span>
              <span class="og-val-text">{{ Math.round(selectedPlacement.opacity * 100) }}%</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="0"
              max="100"
              :value="Math.round(selectedPlacement.opacity * 100)"
              @input="onOpacityInput"
            />
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">ROTATION</span>
              <span class="og-val-text">{{ selectedPlacement.rotation }}°</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="-180"
              max="180"
              :value="selectedPlacement.rotation"
              @input="onRotationInput"
            />
          </div>

          <div class="og-field">
            <span class="mgs-section__label">MOTION OVERRIDE</span>
            <div class="og-custom-dropdown" @click.stop>
              <button
                type="button"
                class="og-custom-dropdown__trigger"
                :class="{ 'is-open': activeDropdown === 'tile-anim' }"
                @click="toggleDropdown('tile-anim')"
              >
                <span>{{ getMotionLabel(selectedPlacement.animation) }}</span>
                <Chevron :size="14" class="og-custom-dropdown__chevron" :class="{ 'is-open': activeDropdown === 'tile-anim' }" />
              </button>
              <div v-if="activeDropdown === 'tile-anim'" class="og-custom-dropdown__menu">
                <button
                  v-for="opt in MOTION_OPTIONS"
                  :key="opt.value"
                  type="button"
                  class="og-custom-dropdown__item"
                  :class="{ 'is-active': (selectedPlacement.animation ?? '') === opt.value }"
                  @click="updateSelectedPlacement({ animation: opt.value as any }); activeDropdown = null;"
                >
                  <span>{{ opt.label }}</span>
                  <CheckIcon v-if="(selectedPlacement.animation ?? '') === opt.value" :size="14" class="og-custom-dropdown__check" />
                </button>
              </div>
            </div>
          </div>

          <Button variant="danger" size="sm" class="og-remove-tile-btn" @click="removeSelectedTile">
            Remove from Canvas
          </Button>
        </div>
      </div>

      <!-- ── INFO SAFE ZONE ─────────────────────────────────────────── -->
      <section class="mgs-section">
        <span class="mgs-section__label">INFO SAFE ZONE</span>
        <div class="og-toggles-group">
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
        </div>
      </section>

      <Divider />

      <!-- ── GRID BACKGROUND ────────────────────────────────────────── -->
      <section class="mgs-section">
        <span class="mgs-section__label">GRID BACKGROUND</span>

        <!-- Background Type Dropdown -->
        <div class="og-custom-dropdown" @click.stop>
          <button
            type="button"
            class="og-custom-dropdown__trigger"
            :class="{ 'is-open': activeDropdown === 'background' }"
            @click="toggleDropdown('background')"
          >
            <div class="og-custom-dropdown__trigger-content">
              <span
                v-if="activeCategory === 'solid'"
                class="og-segment__dot"
                :style="{ background: config.background.color }"
              />
              <span
                v-else-if="activeCategory === 'gradient'"
                class="og-segment__dot og-segment__dot--rainbow"
              />
              <span
                v-else-if="activeCategory === 'image'"
                class="og-segment__dot og-segment__dot--image"
              />
              <span
                v-else-if="activeCategory === 'animated'"
                class="og-segment__dot og-segment__dot--anim"
              />
              <span
                v-else-if="activeCategory === 'pattern'"
                class="og-segment__dot og-segment__dot--pattern"
              />
              <span class="og-custom-dropdown__trigger-label">{{ categoryLabel(activeCategory) }}</span>
            </div>
            <Chevron :size="14" class="og-custom-dropdown__chevron" :class="{ 'is-open': activeDropdown === 'background' }" />
          </button>

          <div v-if="activeDropdown === 'background'" class="og-custom-dropdown__menu">
            <button
              v-for="cat in categories"
              :key="cat"
              type="button"
              class="og-custom-dropdown__item"
              :class="{ 'is-active': activeCategory === cat }"
              @click="setCategory(cat); activeDropdown = null;"
            >
              <div class="og-custom-dropdown__item-left">
                <span
                  v-if="cat === 'solid'"
                  class="og-segment__dot"
                  :style="{ background: config.background.color }"
                />
                <span
                  v-else-if="cat === 'gradient'"
                  class="og-segment__dot og-segment__dot--rainbow"
                />
                <span
                  v-else-if="cat === 'image'"
                  class="og-segment__dot og-segment__dot--image"
                />
                <span
                  v-else-if="cat === 'animated'"
                  class="og-segment__dot og-segment__dot--anim"
                />
                <span
                  v-else-if="cat === 'pattern'"
                  class="og-segment__dot og-segment__dot--pattern"
                />
                <span>{{ categoryLabel(cat) }}</span>
              </div>
              <CheckIcon v-if="activeCategory === cat" :size="14" class="og-custom-dropdown__check" />
            </button>
          </div>
        </div>

        <!-- ── Solid Controls ──────────────────────────────────────── -->
        <template v-if="activeCategory === 'solid'">
          <div class="og-control-row">
            <span class="mgs-section__label">COLOR</span>
            <span class="og-val-text">{{ config.background.color }}</span>
          </div>

          <div class="og-color-picker-row">
            <!-- Fully Circular Color Swatch Button -->
            <div
              class="og-circle-color-picker"
              :style="{ backgroundColor: config.background.color }"
              title="Click to change color"
            >
              <input
                type="color"
                class="og-circle-color-picker__input"
                :value="config.background.color"
                @input="onColorInput"
              />
            </div>

            <input
              type="text"
              class="og-hex-input"
              :value="config.background.color"
              @input="onColorInput"
            />
          </div>

          <!-- Quick Palette Circles: STRICTLY 100% CIRCULAR -->
          <div class="og-swatches-grid">
            <button
              v-for="swatch in SOLID_SWATCHES"
              :key="swatch"
              type="button"
              class="og-swatch-circle"
              :style="{ background: swatch }"
              :class="{ 'is-selected': config.background.color.toLowerCase() === swatch.toLowerCase() }"
              :title="swatch"
              @click="updateBackground({ color: swatch, presetId: 'solid' })"
            />
          </div>
        </template>

        <!-- ── Gradient Controls ───────────────────────────────────── -->
        <template v-if="activeCategory === 'gradient'">
          <!-- Gradient Preset Pills -->
          <div v-if="presetsInCategory.length > 1" class="mgs-segment">
            <button
              v-for="preset in presetsInCategory"
              :key="preset.id"
              type="button"
              class="mgs-segment__btn"
              :class="{ 'is-active': config.background.presetId === preset.id }"
              @click="selectPreset(preset.id)"
            >
              {{ preset.label }}
            </button>
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">ANGLE</span>
              <span class="og-val-text">{{ config.background.angle ?? 135 }}°</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="0"
              max="360"
              :value="config.background.angle ?? 135"
              @input="onAngleInput"
            />
          </div>

          <div v-if="config.background.presetId !== 'linear-gradient'" class="og-row-duo">
            <div class="og-field">
              <span class="mgs-section__label">CENTER X</span>
              <input
                type="range"
                class="og-range-slider"
                min="0"
                max="100"
                :value="config.background.centerX ?? 50"
                @input="(e) => updateBackground({ centerX: Number((e.target as HTMLInputElement).value) })"
              />
            </div>
            <div class="og-field">
              <span class="mgs-section__label">CENTER Y</span>
              <input
                type="range"
                class="og-range-slider"
                min="0"
                max="100"
                :value="config.background.centerY ?? 50"
                @input="(e) => updateBackground({ centerY: Number((e.target as HTMLInputElement).value) })"
              />
            </div>
          </div>

          <div class="og-stops-section">
            <span class="mgs-section__label">COLOR STOPS</span>
            <div
              v-for="(stop, i) in config.background.stops ?? []"
              :key="i"
              class="og-stop-row"
            >
              <div class="og-circle-color-picker og-circle-color-picker--sm" :style="{ backgroundColor: stop.color }">
                <input
                  type="color"
                  class="og-circle-color-picker__input"
                  :value="stop.color"
                  @input="(e) => updateStop(i, { color: (e.target as HTMLInputElement).value })"
                />
              </div>
              <input
                type="range"
                class="og-range-slider"
                min="0"
                max="100"
                :value="stop.offset"
                @input="(e) => updateStop(i, { offset: Number((e.target as HTMLInputElement).value) })"
              />
              <span class="og-stop-percent">{{ stop.offset }}%</span>
              <button
                type="button"
                class="og-stop-del-btn"
                :disabled="(config.background.stops ?? []).length <= 2"
                @click="removeStop(i)"
              >
                &times;
              </button>
            </div>
            <button type="button" class="og-add-stop-btn" @click="addStop">
              + Add color stop
            </button>
          </div>

          <Toggle
            label="Animate Rotation"
            :model-value="!!config.background.animated"
            @update:model-value="(v) => updateBackground({ animated: v })"
          />
        </template>

        <!-- ── Image Controls ──────────────────────────────────────── -->
        <template v-if="activeCategory === 'image'">
          <div class="og-field">
            <span class="mgs-section__label">IMAGE SOURCE</span>
            <div class="og-btn-duo">
              <Button variant="secondary" size="sm" @click="triggerImageFileInput">
                Upload Image
              </Button>
              <Button
                v-if="gridBgImage"
                variant="secondary"
                size="sm"
                @click="useGridBackground"
              >
                Use Grid Image
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

          <div v-if="config.background.imageUrl" class="og-field">
            <span class="mgs-section__label">IMAGE PATH / URL</span>
            <input
              type="text"
              class="og-hex-input og-hex-input--full"
              :value="config.background.imageUrl"
              placeholder="https://... or data:..."
              @input="(e) => updateBackground({ imageUrl: (e.target as HTMLInputElement).value, presetId: 'image-background' })"
            />
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">BLUR</span>
              <span class="og-val-text">{{ config.background.imageBlur ?? 0 }}px</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="0"
              max="24"
              :value="config.background.imageBlur ?? 0"
              @input="(e) => updateBackground({ imageBlur: Number((e.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">OVERLAY DARKNESS</span>
              <span class="og-val-text">
                {{ Math.round((config.background.imageOverlayOpacity ?? 0.35) * 100) }}%
              </span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="0"
              max="100"
              :value="Math.round((config.background.imageOverlayOpacity ?? 0.35) * 100)"
              @input="(e) => updateBackground({ imageOverlayOpacity: Number((e.target as HTMLInputElement).value) / 100 })"
            />
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">TINT COLOR</span>
              <span class="og-val-text">{{ config.background.imageOverlayColor ?? '#000000' }}</span>
            </div>
            <div class="og-color-picker-row">
              <div
                class="og-circle-color-picker og-circle-color-picker--sm"
                :style="{ backgroundColor: config.background.imageOverlayColor ?? '#000000' }"
              >
                <input
                  type="color"
                  class="og-circle-color-picker__input"
                  :value="config.background.imageOverlayColor ?? '#000000'"
                  @input="(e) => updateBackground({ imageOverlayColor: (e.target as HTMLInputElement).value })"
                />
              </div>
              <span class="og-val-desc">Color wash applied over the photo</span>
            </div>
          </div>
        </template>

        <!-- ── Animated Background Controls ────────────────────────── -->
        <template v-if="activeCategory === 'animated'">
          <div class="og-field">
            <span class="mgs-section__label">ANIMATION PRESET</span>
            <div class="og-custom-dropdown" @click.stop>
              <button
                type="button"
                class="og-custom-dropdown__trigger"
                :class="{ 'is-open': activeDropdown === 'animated-preset' }"
                @click="toggleDropdown('animated-preset')"
              >
                <span>{{ currentPresetLabel }}</span>
                <Chevron :size="14" class="og-custom-dropdown__chevron" :class="{ 'is-open': activeDropdown === 'animated-preset' }" />
              </button>
              <div v-if="activeDropdown === 'animated-preset'" class="og-custom-dropdown__menu">
                <button
                  v-for="preset in presetsInCategory"
                  :key="preset.id"
                  type="button"
                  class="og-custom-dropdown__item"
                  :class="{ 'is-active': config.background.presetId === preset.id }"
                  @click="selectPreset(preset.id); activeDropdown = null;"
                >
                  <span>{{ preset.label }}</span>
                  <CheckIcon v-if="config.background.presetId === preset.id" :size="14" class="og-custom-dropdown__check" />
                </button>
              </div>
            </div>
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">SPEED</span>
              <span class="og-val-text">{{ config.background.speed ?? 12 }}s</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="2"
              max="30"
              :value="config.background.speed ?? 12"
              @input="(e) => updateBackground({ speed: Number((e.target as HTMLInputElement).value) })"
            />
          </div>
        </template>

        <!-- ── Pattern / Texture Controls ──────────────────────────── -->
        <template v-if="activeCategory === 'pattern'">
          <div class="og-field">
            <span class="mgs-section__label">TEXTURE STYLE</span>
            <!-- Custom Dropdown: NO white-on-white text bug! -->
            <div class="og-custom-dropdown" @click.stop>
              <button
                type="button"
                class="og-custom-dropdown__trigger"
                :class="{ 'is-open': activeDropdown === 'texture-style' }"
                @click="toggleDropdown('texture-style')"
              >
                <span>{{ currentPresetLabel }}</span>
                <Chevron :size="14" class="og-custom-dropdown__chevron" :class="{ 'is-open': activeDropdown === 'texture-style' }" />
              </button>
              <div v-if="activeDropdown === 'texture-style'" class="og-custom-dropdown__menu">
                <button
                  v-for="preset in presetsInCategory"
                  :key="preset.id"
                  type="button"
                  class="og-custom-dropdown__item"
                  :class="{ 'is-active': config.background.presetId === preset.id }"
                  @click="selectPreset(preset.id); activeDropdown = null;"
                >
                  <span>{{ preset.label }}</span>
                  <CheckIcon v-if="config.background.presetId === preset.id" :size="14" class="og-custom-dropdown__check" />
                </button>
              </div>
            </div>
          </div>

          <!-- Background Fill Color (Fully Circular) -->
          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">BACKGROUND FILL COLOR</span>
              <span class="og-val-text">{{ config.background.patternBackground ?? '#18181b' }}</span>
            </div>
            <div class="og-color-picker-row">
              <div
                class="og-circle-color-picker"
                :style="{ backgroundColor: config.background.patternBackground ?? '#18181b' }"
                title="Change background fill"
              >
                <input
                  type="color"
                  class="og-circle-color-picker__input"
                  :value="config.background.patternBackground ?? '#18181b'"
                  @input="(e) => updateBackground({ patternBackground: (e.target as HTMLInputElement).value })"
                />
              </div>
              <input
                type="text"
                class="og-hex-input"
                :value="config.background.patternBackground ?? '#18181b'"
                @input="(e) => updateBackground({ patternBackground: (e.target as HTMLInputElement).value })"
              />
            </div>
          </div>

          <!-- Texture / Line Color (Fully Circular) -->
          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">TEXTURE / LINE COLOR</span>
              <span class="og-val-text">{{ patternColorHex }}</span>
            </div>
            <div class="og-color-picker-row">
              <div
                class="og-circle-color-picker"
                :style="{ backgroundColor: patternColorHex }"
                title="Change line color"
              >
                <input
                  type="color"
                  class="og-circle-color-picker__input"
                  :value="patternColorHex"
                  @input="onPatternColorInput"
                />
              </div>
              <input
                type="text"
                class="og-hex-input"
                :value="patternColorHex"
                @input="onPatternColorInput"
              />
            </div>
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">PATTERN OPACITY</span>
              <span class="og-val-text">{{ patternOpacityPercent }}%</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="0"
              max="100"
              :value="patternOpacityPercent"
              @input="onPatternOpacityInput"
            />
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">STROKE THICKNESS</span>
              <span class="og-val-text">{{ config.background.patternStrokeWidth ?? 1 }}px</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="1"
              max="8"
              :value="config.background.patternStrokeWidth ?? 1"
              @input="(e) => updateBackground({ patternStrokeWidth: Number((e.target as HTMLInputElement).value) })"
            />
          </div>

          <div class="og-field">
            <div class="og-control-row">
              <span class="mgs-section__label">SPACING & DENSITY</span>
              <span class="og-val-text">{{ config.background.patternSize ?? 28 }}px</span>
            </div>
            <input
              type="range"
              class="og-range-slider"
              min="8"
              max="80"
              :value="config.background.patternSize ?? 28"
              @input="(e) => updateBackground({ patternSize: Number((e.target as HTMLInputElement).value) })"
            />
          </div>

          <Toggle
            label="Animate Texture Movement"
            :model-value="!!config.background.animated"
            @update:model-value="(v) => updateBackground({ animated: v })"
          />
        </template>
      </section>

      <!-- ── MOTION & PHYSICS ───────────────────────────────────────── -->
      <Divider />
      <section class="mgs-section">
        <Accordion title="Motion & Animations">
          <div class="og-accordion-inner">
            <div class="og-field">
              <span class="mgs-section__label">GLOBAL TILE MOTION</span>
              <div class="og-custom-dropdown" @click.stop>
                <button
                  type="button"
                  class="og-custom-dropdown__trigger"
                  :class="{ 'is-open': activeDropdown === 'global-anim' }"
                  @click="toggleDropdown('global-anim')"
                >
                  <span>{{ getGlobalMotionLabel(config.animation?.tileAnimation) }}</span>
                  <Chevron :size="14" class="og-custom-dropdown__chevron" :class="{ 'is-open': activeDropdown === 'global-anim' }" />
                </button>
                <div v-if="activeDropdown === 'global-anim'" class="og-custom-dropdown__menu">
                  <button
                    v-for="opt in GLOBAL_MOTION_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="og-custom-dropdown__item"
                    :class="{ 'is-active': (config.animation?.tileAnimation ?? 'none') === opt.value }"
                    @click="updateAnimation({ tileAnimation: opt.value as any }); activeDropdown = null;"
                  >
                    <span>{{ opt.label }}</span>
                    <CheckIcon v-if="(config.animation?.tileAnimation ?? 'none') === opt.value" :size="14" class="og-custom-dropdown__check" />
                  </button>
                </div>
              </div>
            </div>

            <div v-if="(config.animation?.tileAnimation ?? 'none') !== 'none'" class="og-field">
              <div class="og-control-row">
                <span class="mgs-section__label">CYCLE SPEED</span>
                <span class="og-val-text">{{ config.animation?.tileSpeed ?? 3 }}s</span>
              </div>
              <input
                type="range"
                class="og-range-slider"
                min="1"
                max="6"
                step="0.5"
                :value="config.animation?.tileSpeed ?? 3"
                @input="(e) => updateAnimation({ tileSpeed: Number((e.target as HTMLInputElement).value) })"
              />
            </div>
          </div>
        </Accordion>
      </section>
    </div>

    <!-- ── DEDICATED APPLY BUTTON FOOTER ──────────────────────────── -->
    <div class="og-footer">
      <Button
        variant="primary"
        size="md"
        class="og-apply-btn"
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Toggle from "@/components/ui-controls/Toggle.vue";
import Divider from "@/components/ui-elements/Divider.vue";
import Button from "@/components/ui-elements/Button.vue";
import Accordion from "@/components/ui-controls/Accordion.vue";
import CheckIcon from "@/components/icons/CheckIcon.vue";
import SpinnerIcon from "@/components/icons/SpinnerIcon.vue";
import Chevron from "@/components/icons/Chevron.vue";
import CloseXIcon from "@/components/icons/CloseXIcon.vue";
import { getTileDefinition } from "@/registries/tileRegistry";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import {
  getAllBackgroundPresets,
  getBackgroundPresetsByCategory,
  type BackgroundCategory,
  type BackgroundConfig,
  type GradientStop,
} from "@/lib/animate";
import type { OGConfig, OGVisibility, OGTilePlacement } from "@/types/og";

const props = defineProps<{
  config: OGConfig;
  gridTiles?: Array<any>;
  selectedTileId?: string | null;
  isApplying?: boolean;
}>();

const emit = defineEmits<{
  "update:config": [config: OGConfig];
  "select-tile": [tileId: string | null];
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

const MOTION_OPTIONS = [
  { value: "", label: "Use Global Motion" },
  { value: "none", label: "None (Static)" },
  { value: "float", label: "Float & Bob" },
  { value: "pulse", label: "Breathing Pulse" },
  { value: "shimmer", label: "Neon Shimmer" },
  { value: "tilt", label: "Dynamic Tilt" },
];

const GLOBAL_MOTION_OPTIONS = [
  { value: "none", label: "None (Static)" },
  { value: "float", label: "Float & Bob" },
  { value: "pulse", label: "Breathing Pulse" },
  { value: "shimmer", label: "Neon Shimmer" },
  { value: "tilt", label: "Dynamic Tilt" },
];

const getMotionLabel = (val?: string) =>
  MOTION_OPTIONS.find((o) => o.value === (val ?? ""))?.label ?? "Use Global Motion";

const getGlobalMotionLabel = (val?: string) =>
  GLOBAL_MOTION_OPTIONS.find((o) => o.value === (val ?? "none"))?.label ?? "None (Static)";

const categoryLabel = (cat: BackgroundCategory) => {
  switch (cat) {
    case "solid": return "Solid Color";
    case "gradient": return "Gradient";
    case "image": return "Image";
    case "animated": return "Animated";
    case "pattern": return "Pattern / Texture";
    default: return cat;
  }
};

const categoryForPreset = (presetId: string): BackgroundCategory =>
  getAllBackgroundPresets().find((p) => p.id === presetId)?.category ?? "solid";

const activeCategory = ref<BackgroundCategory>(categoryForPreset(props.config.background.presetId));

// Dropdown State Management (Click outside auto-dismisses)
const activeDropdown = ref<string | null>(null);

const toggleDropdown = (name: string) => {
  activeDropdown.value = activeDropdown.value === name ? null : name;
};

const handleDocumentClick = () => {
  activeDropdown.value = null;
};

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
});

watch(
  () => props.config.background.presetId,
  (id) => {
    activeCategory.value = categoryForPreset(id);
  },
);

const presetsInCategory = computed(() => getBackgroundPresetsByCategory(activeCategory.value));

const currentPresetLabel = computed(() => {
  const match = getAllBackgroundPresets().find((p) => p.id === props.config.background.presetId);
  return match?.label ?? "Select Preset";
});

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

// Image Background Handling
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

const selectedTileData = computed(() => {
  if (!props.selectedTileId) return null;
  return props.gridTiles?.find((t: any) => (t.i ?? t.id) === props.selectedTileId) ?? null;
});

const selectedTileDef = computed(() => {
  const type = selectedTileData.value?.content?.type;
  if (!type) return null;
  return getTileDefinition(type);
});

const selectedTileTitle = computed(() => {
  const t = selectedTileData.value;
  if (!t) return `Card ${props.selectedTileId?.slice(0, 8)}`;
  const c = t.content;
  return (
    t.caption?.trim() ||
    c?.title ||
    c?.label ||
    c?.name ||
    selectedTileDef.value?.label ||
    "Tile"
  );
});

const selectedTileType = computed(() => {
  const type = selectedTileData.value?.content?.type || "Tile";
  return type.replace(/_/g, " ").toUpperCase();
});

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
  const tileId = props.selectedTileId;
  emit("select-tile", null);
  emit("update:config", {
    ...props.config,
    tiles: props.config.tiles.filter((t) => t.tileId !== tileId),
  });
};
</script>

<style lang="scss" scoped>
.og-inspector {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #000000;
  color: #ffffff;
  overflow: hidden;
  user-select: none;
}

.og-inspector__scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── MGS Section Style (Matching MobileGridSettingsSheet.vue) ───────────── */
.mgs-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mgs-section__label {
  color: #71717a;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.og-control-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.og-val-text {
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
}

.og-val-desc {
  font-size: 11px;
  color: #71717a;
}

.og-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.og-row-duo {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.og-btn-duo {
  display: flex;
  gap: 8px;
}

.og-toggles-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* ── Custom Dark Dropdown (No white-on-white text bug!) ────────────────── */
.og-custom-dropdown {
  position: relative;
  width: 100%;
}

.og-custom-dropdown__trigger {
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover,
  &.is-open {
    border-color: var(--color-figma-purple, #a855f7);
    background: #202024;
  }
}

.og-custom-dropdown__trigger-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.og-custom-dropdown__chevron {
  color: #71717a;
  transition: transform 0.2s ease;

  &.is-open {
    transform: rotate(180deg);
    color: #ffffff;
  }
}

.og-custom-dropdown__menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
  z-index: 50;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 240px;
  overflow-y: auto;
}

.og-custom-dropdown__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #ffffff !important;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: rgba(168, 85, 247, 0.2);
    color: #ffffff !important;
  }

  &.is-active {
    background: rgba(168, 85, 247, 0.15);
    color: var(--color-figma-purple, #a855f7) !important;
    font-weight: 600;
  }
}

.og-custom-dropdown__item-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.og-custom-dropdown__check {
  color: var(--color-figma-purple, #a855f7);
}

/* ── Segmented Control (Matching Image 2) ───────────────────────────────── */
.mgs-segment {
  display: flex;
  gap: 3px;
  padding: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 12px;
}

.mgs-segment__btn {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: #71717a;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(.is-active) {
    color: #ffffff;
  }

  &.is-active {
    background: rgba(255, 255, 255, 0.16);
    color: #ffffff;
  }
}

.og-segment__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;

  &--rainbow {
    background: conic-gradient(
      from 90deg,
      #ef4444,
      #eab308,
      #22c55e,
      #06b6d4,
      #3b82f6,
      #a855f7,
      #ef4444
    );
  }

  &--image {
    background: #3b82f6;
  }

  &--anim {
    background: #ec4899;
  }

  &--pattern {
    background: #eab308;
  }
}

/* ── Truly Circular Color Picker (36x36 Perfect Circle) ─────────────────── */
.og-color-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.og-circle-color-picker {
  position: relative;
  width: 36px !important;
  height: 36px !important;
  min-width: 36px !important;
  max-width: 36px !important;
  min-height: 36px !important;
  max-height: 36px !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 50% !important;
  aspect-ratio: 1 / 1 !important;
  box-sizing: border-box !important;
  flex: 0 0 36px !important;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  display: flex !important;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease, border-color 0.15s ease;

  &:hover {
    transform: scale(1.08);
    border-color: #ffffff;
  }

  &--sm {
    width: 28px !important;
    height: 28px !important;
    min-width: 28px !important;
    max-width: 28px !important;
    min-height: 28px !important;
    max-height: 28px !important;
    flex: 0 0 28px !important;
  }

  &__input {
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    cursor: pointer;
    opacity: 0;
    margin: 0;
    padding: 0;
    border: none;
  }
}

.og-hex-input {
  flex: 1;
  height: 36px;
  padding: 0 12px;
  background: #18181b;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #ffffff;
  font-family: monospace;
  font-size: 13px;

  &:focus {
    outline: none;
    border-color: var(--color-figma-purple, #a855f7);
  }

  &--full {
    width: 100%;
  }
}

/* ── Truly Circular Swatches (Strictly 28x28 Geometric Circles) ─────────── */
.og-swatches-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
}

.og-swatch-circle {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  max-width: 28px !important;
  min-height: 28px !important;
  max-height: 28px !important;
  padding: 0 !important;
  margin: 0 !important;
  border: 2px solid transparent !important;
  border-radius: 50% !important;
  aspect-ratio: 1 / 1 !important;
  box-sizing: border-box !important;
  display: inline-block !important;
  flex: 0 0 28px !important;
  cursor: pointer;
  outline: none;
  transition: transform 0.15s ease;

  &:hover {
    transform: scale(1.15);
  }

  &.is-selected {
    border: 2px solid #ffffff !important;
    outline: 2px solid var(--color-figma-purple, #a855f7) !important;
    outline-offset: 2px !important;
  }
}

/* ── Sleek Range Slider (Dark Grids style) ──────────────────────────────── */
.og-range-slider {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ffffff;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
    transition: transform 0.1s ease;

    &:hover {
      transform: scale(1.2);
    }
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ffffff;
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  }
}

/* ── Stops Controls ─────────────────────────────────────────────────────── */
.og-stops-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.og-stop-row {
  display: flex;
  align-items: center;
  gap: 10px;

  .og-range-slider {
    flex: 1;
  }
}

.og-stop-percent {
  font-size: 11px;
  font-weight: 600;
  color: #71717a;
  width: 32px;
  text-align: right;
}

.og-stop-del-btn {
  background: transparent;
  border: none;
  color: #71717a;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;

  &:hover:not(:disabled) {
    color: #ef4444;
  }

  &:disabled {
    opacity: 0.2;
    cursor: default;
  }
}

.og-add-stop-btn {
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
}

/* ── Standalone Card Panel for Selected Tile (No Purple Highlight Box) ───── */
.og-card-panel {
  background: #141416;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.og-card-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.og-card-panel__title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.og-card-panel__icon-box {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.og-card-panel__icon {
  width: 18px;
  height: 18px;
  color: #ffffff;
}

.og-card-panel__type-char {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
}

.og-card-panel__title-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.og-card-panel__tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #71717a;
  text-transform: uppercase;
}

.og-card-panel__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.og-card-panel__close-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #71717a;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
}

.og-card-panel__divider {
  margin: 2px 0 0 0;
  opacity: 0.6;
}

.og-card-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.og-remove-tile-btn {
  width: 100%;
  justify-content: center;
  min-height: 36px;
  font-weight: 600;
  margin-top: 4px;
}

.og-accordion-inner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 8px;
}

/* ── Footer / Apply Button ──────────────────────────────────────────────── */
.og-footer {
  padding: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #000000;
}

.og-apply-btn {
  width: 100%;
  font-weight: 700;
  justify-content: center;
  min-height: 42px;
}
</style>
