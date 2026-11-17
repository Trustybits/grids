<!--
  CaptionPopover.vue — Caption (Figma 164:17302): the line under an image,
  video or map tile. Saved as you type; the whole visit is one undo step.
-->
<template>
  <div class="pp-stack">
    <label class="pp-field">
      <input
        :value="draft"
        class="pp-field__input"
        type="text"
        enterkeyhint="done"
        maxlength="200"
        placeholder="Add a caption"
        aria-label="Caption"
        @input="onInput"
        @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
      />
      <button
        v-if="draft"
        type="button"
        class="pp-pill"
        aria-label="Clear caption"
        @click="clear"
      >
        Clear
      </button>
    </label>
    <p v-if="mixed" class="pp-note">These tiles have different captions.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";
import { MIXED } from "@/utils/richText/docTransforms";

const visit = useToolPopoverVisit();

const value = computed(() => visit.read(WRITERS.caption));
const mixed = computed(() => value.value === MIXED);

const draft = ref(typeof value.value === "string" ? value.value : "");

const onInput = (event: Event) => {
  draft.value = (event.target as HTMLInputElement).value;
  visit.write(WRITERS.caption, draft.value);
};

const clear = () => {
  draft.value = "";
  visit.write(WRITERS.caption, "");
};
</script>
