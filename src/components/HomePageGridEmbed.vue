<!--
  HomePageGridEmbed.vue

  Marketing-homepage wrapper around the real <Grid> component. Renders an
  in-memory demo layout so visitors can see (and lightly poke at) actual
  grid tiles instead of CSS mock-ups — without any Firestore round-trip,
  auth state, or navigation chrome.

  Design decisions:
    1. No <GridPage> / <UserSlugPage> wrapper → no toolbar, no breakpoint
       switcher, no background iframe, no drag/drop overlay.
    2. Non-owner by default (layout store sets isOwner=false on load) →
       every owner-only UI element inside <GridTile> is gated off.
    3. Force the "sm" (4-col) breakpoint. The landing page can be viewed
       at any viewport, but the embed always renders in the mobile layout
       so it never looks cramped, scaled, or overflowed.
    4. Clicks into tiles naturally open external links in new tabs
       (LinkContent, MusicContent, YouTubeContent, markdown <a>, and
       useTileLink all hard-code target="_blank"). We add a defensive
       click-interceptor anyway so any future tile type that forgets to
       do this still can't accidentally navigate the visitor away from /.
    5. Intentionally does NOT watch currentLayout.themeId or call
       themeStore.applyGridTheme — the demo grid's theme must not leak
       onto the landing page's document root.
-->
<template>
  <div
    ref="embedRoot"
    class="home-grid-embed"
    @click.capture="interceptOutboundClick"
    @auxclick.capture="interceptOutboundClick"
  >
    <Grid :row-height="rowHeight" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import Grid from '@/components/Grid.vue';
import { useLayoutStore } from '@/stores/layout';
import { createDemoLayout } from '@/data/demoLayout';
import type { Breakpoint } from '@/types/Tile';

const props = withDefaults(
  defineProps<{
    rowHeight?: number;
    forceBreakpoint?: Breakpoint;
  }>(),
  {
    rowHeight: 75,
    forceBreakpoint: 'sm',
  },
);

const layoutStore = useLayoutStore();

// Remember the pre-existing store state so we can restore it on unmount.
// The homepage is only ever shown to logged-out users (the router redirects
// authenticated users to /dashboard), so in practice there's nothing to
// clobber — but this keeps us honest if that ever changes.
let prevLayout: typeof layoutStore.currentLayout = null;
let prevIsOwner = false;
let prevForcedBreakpoint: Breakpoint | null = null;

onMounted(() => {
  prevLayout = layoutStore.currentLayout;
  prevIsOwner = layoutStore.isOwner;
  prevForcedBreakpoint = layoutStore.forcedBreakpoint;

  layoutStore.loadDemoLayout(createDemoLayout());
  layoutStore.setForcedBreakpoint(props.forceBreakpoint);
});

onBeforeUnmount(() => {
  layoutStore.setForcedBreakpoint(prevForcedBreakpoint);
  layoutStore.currentLayout = prevLayout;
  layoutStore.isOwner = prevIsOwner;
});

// Defense in depth: if anything inside the embed tries to navigate via a
// plain <a href> without target="_blank", rewrite it on the fly so the
// visitor never loses the landing page.
const interceptOutboundClick = (event: MouseEvent) => {
  const anchor = (event.target as HTMLElement | null)?.closest?.('a');
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!href) return;
  // Allow in-page hash links to behave normally.
  if (href.startsWith('#')) return;
  if (anchor.target !== '_blank') {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
};
</script>

<style scoped>
.home-grid-embed {
  position: relative;
  width: 100%;
  max-width: 520px;
  margin: 0 auto 44px;
  /*
    <Grid> renders absolutely-positioned tile children inside its own
    wrapper, so it finds its own width. We just give it breathing room
    and keep it from butting up against the hero copy on very short
    viewports.
  */
  pointer-events: auto;
}

/*
  vue3-grid-layout inserts its own container; make sure it doesn't pick up
  the landing page's section padding (our wrapper already centers it) and
  that the grid wrapper's internal "p: No tiles yet." fallback doesn't
  render with weird default margins.
*/
.home-grid-embed :deep(.grid-scale-wrapper),
.home-grid-embed :deep(.grid-container) {
  margin: 0 auto;
}
</style>
