<!--
  ProfileShapePopover.vue — Shape (profile): Circle · Square · Polygon, the
  corner radius (square, polygon) and the side count (polygon). Replaces the
  tiny drag knobs on the avatar, which are hard to hit with a finger.
-->
<template>
  <p v-if="compact" class="pp-note">
    A tile this small shows a square photo. Make it bigger to pick a shape.
  </p>
  <div v-else class="pp-stack">
    <PopoverChoices
      label="Photo shape"
      :options="SHAPES"
      :model-value="shape"
      @select="(value) => visit.write(SHAPE, value as AvatarShape)"
    />

    <label v-if="shape !== 'circle'" class="pp-slider">
      <span class="pp-slider__label">Corners</span>
      <input
        type="range"
        min="0"
        max="40"
        step="1"
        :value="radius"
        aria-label="Corner radius"
        @input="onRadius"
        @change="visit.commit()"
      />
      <span class="pp-slider__value">{{ radius }}</span>
    </label>

    <label v-if="shape === 'polygon'" class="pp-slider">
      <span class="pp-slider__label">Sides</span>
      <input
        type="range"
        min="3"
        max="8"
        step="1"
        :value="sides"
        aria-label="Number of sides"
        @input="onSides"
        @change="visit.commit()"
      />
      <span class="pp-slider__value">{{ sides }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type {
  AvatarShape,
  ProfileBioContent,
  Tile,
} from "@grids/contracts/types";
import PopoverChoices, { type PopoverChoice } from "./PopoverChoices.vue";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { useMobileTileEdit } from "@/composables/useMobileTileEdit";
import type { ToolWriter } from "@/registries/tileToolbar/mobileTools";

const SHAPES: PopoverChoice[] = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "polygon", label: "Polygon" },
];

const profileOf = (tile: Tile) => tile.content as ProfileBioContent;

/**
 * Shape writers stay local: they're pure, but Shape is a one-profile tool
 * (plan §6), so they aren't the tool's bulk `writers`.
 */
const field = <K extends "avatarShape" | "avatarRadius" | "avatarSides">(
  key: K,
  fallback: NonNullable<ProfileBioContent[K]>,
): ToolWriter<NonNullable<ProfileBioContent[K]>> => ({
  read: (tile) => profileOf(tile)[key] ?? fallback,
  patch: (tile, value) =>
    (profileOf(tile)[key] ?? fallback) === value
      ? null
      : { content: { [key]: value } as Partial<ProfileBioContent> },
});

const SHAPE = field("avatarShape", "square");
const RADIUS = field("avatarRadius", 12);
const SIDES = field("avatarSides", 6);

const visit = useToolPopoverVisit();
const { handle } = useMobileTileEdit();

const compact = computed(
  () =>
    !!(handle.value?.childComponent.value as
      | { isCompactProfileLayout?: boolean }
      | null
      | undefined)?.isCompactProfileLayout,
);

const shape = computed(() => visit.read(SHAPE));
const radius = computed(() => visit.read(RADIUS));
const sides = computed(() => visit.read(SIDES));

const onRadius = (event: Event) =>
  visit.write(RADIUS, Number((event.target as HTMLInputElement).value));

const onSides = (event: Event) =>
  visit.write(SIDES, Number((event.target as HTMLInputElement).value));
</script>
