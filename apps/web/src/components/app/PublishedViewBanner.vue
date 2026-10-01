<!--
  PublishedViewBanner.vue

  Shown while an owner is looking at their own grid in the published view
  (`?view=published`): the live version, read-only, exactly as visitors see
  it. Offers the way back to the editor by dropping the query, which makes
  GridPage reload the route into normal (draft) editing.
-->
<template>
  <Banner severity="info" :dismissible="false">
    <template #icon>
      <EyeIcon :size="18" />
    </template>

    <span class="published-view-banner__text">
      You're viewing the published version — this is what visitors see.
      Unpublished changes are not shown.
    </span>
    <button
      type="button"
      class="published-view-banner__action"
      @click="backToEditing"
    >
      Back to editing
    </button>
  </Banner>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import EyeIcon from "@/components/icons/EyeIcon.vue";
import Banner from "@/components/ui-elements/Banner.vue";
import { withoutPublishedView } from "@/constants/publishedView";

const route = useRoute();
const router = useRouter();

const backToEditing = () => {
  void router.replace({ query: withoutPublishedView(route.query) });
};
</script>

<style lang="scss" scoped>
.published-view-banner__text {
  margin-right: var(--spacing-sm);
}

.published-view-banner__action {
  padding: 2px var(--spacing-sm);
  border: var(--border-width) solid
    color-mix(in srgb, var(--color-figma-purple, #a259ff) 50%, transparent);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background: color-mix(
      in srgb,
      var(--color-figma-purple, #a259ff) 18%,
      transparent
    );
  }
}
</style>
