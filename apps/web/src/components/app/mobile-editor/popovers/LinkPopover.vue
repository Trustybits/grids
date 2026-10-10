<!--
  LinkPopover.vue — Link: where tapping the tile goes. A URL field with Apply;
  once a link is set it shows with Open and Remove link. The keyboard only
  opens when the field is tapped (iOS won't open it otherwise anyway).
-->
<template>
  <div class="pp-stack">
    <div v-if="currentLink" class="pp-link">
      <span class="pp-link__url">{{ currentLink }}</span>
      <a
        class="pp-pill"
        :href="resolvedLink"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open
      </a>
      <button type="button" class="pp-pill pp-pill--danger" @click="remove">
        Remove link
      </button>
    </div>

    <!-- novalidate: bare hosts ("example.com") are fine; the tile link rules decide. -->
    <form class="pp-field" novalidate @submit.prevent="apply">
      <input
        v-model="draft"
        class="pp-field__input"
        type="url"
        inputmode="url"
        autocapitalize="off"
        autocomplete="off"
        spellcheck="false"
        :placeholder="currentLink ? 'Change link' : 'Paste or type a link'"
        aria-label="Tile link"
        :aria-invalid="invalid ? 'true' : undefined"
        @input="invalid = false"
      />
      <button
        type="submit"
        class="pp-pill pp-pill--primary"
        :disabled="!draft.trim()"
      >
        Apply
      </button>
    </form>
    <p v-if="invalid" class="pp-error" role="alert">That doesn't look like a link.</p>
    <p v-else-if="mixed" class="pp-note">These tiles have different links.</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useToolPopoverVisit } from "@/composables/useToolPopoverVisit";
import { WRITERS } from "@/registries/tileToolbar/mobileTools";
import { normalizeTileLink } from "@/utils/tileLink";
import { MIXED } from "@/utils/richText/docTransforms";

const visit = useToolPopoverVisit();

const value = computed(() => visit.read(WRITERS.link));
const mixed = computed(() => value.value === MIXED);
const currentLink = computed(() =>
  typeof value.value === "string" ? value.value : "",
);
const resolvedLink = computed(() => {
  const link = currentLink.value;
  return /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`;
});

const draft = ref("");
const invalid = ref(false);

const apply = () => {
  const typed = draft.value.trim();
  if (!typed) return;
  if (!normalizeTileLink(typed)) {
    invalid.value = true;
    return;
  }
  visit.write(WRITERS.link, typed);
  draft.value = "";
  // A link is one decision, not a drag: close its undo step now.
  visit.commit();
};

const remove = () => {
  visit.write(WRITERS.link, "");
  visit.commit();
};
</script>
