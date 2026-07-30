<!--
  MobileMenuDrawer.vue

  Mobile 2.0 slide-in menu drawer, opened from the MobileAppBar hamburger. It
  consolidates navigation (Home, Recent grids), grid Analytics, support, and
  account actions that previously lived in the LeftNavBar, grid-stats bar, and
  UserMenu.

  Interim notes:
    - Analytics reuses the existing <GridStats> component (owner-only data).
    - Account currently exposes the two essentials — the Mobile 2.0 opt-out and
      Logout. Full account management (handle, billing, file archive) still
      lives in the desktop UserMenu and will be reconciled in a later pass.
-->
<template>
  <transition name="mmd-fade">
    <div v-if="open" class="mmd-backdrop" @click="emit('close')">
      <transition name="mmd-slide" appear>
        <nav class="mmd-panel" @click.stop aria-label="Menu">
          <router-link to="/dashboard" class="mmd-row" @click="emit('close')">
            <span class="mmd-row__icon"><HomeIcon /></span>
            <span class="mmd-row__label">Home</span>
          </router-link>

          <Divider v-if="isOwner" />

          <!-- Analytics: inline expand/collapse that pushes the recent grids
               down when open (was a floating popover). -->
          <div v-if="isOwner" class="mmd-analytics">
            <button
              type="button"
              class="mmd-row mmd-row--button mmd-analytics__trigger"
              :aria-expanded="analyticsOpen"
              @click="analyticsOpen = !analyticsOpen"
            >
              <span class="mmd-row__icon"><AnalyticsIcon /></span>
              <span class="mmd-row__label">Analytics</span>
              <span v-if="!analyticsOpen" class="mmd-analytics__summary">
                <svg
                  class="mmd-analytics__trend"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M7 17L17 7M17 7H9M17 7V15"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                {{ yesterdayViews }} views yesterday
              </span>
              <Chevron
                class="mmd-analytics__chevron"
                :class="{ 'is-open': analyticsOpen }"
                :size="16"
              />
            </button>

            <div
              class="mmd-analytics__body"
              :class="{ 'is-open': analyticsOpen }"
            >
              <div class="mmd-analytics__body-inner">
                <div class="mmd-stat">
                  <span class="mmd-stat__label">Views yesterday</span>
                  <span class="mmd-stat__value">{{ yesterdayViews }}</span>
                </div>
                <div class="mmd-stat">
                  <span class="mmd-stat__label">Total views</span>
                  <span class="mmd-stat__value">{{ lifetimeViews }}</span>
                </div>
                <div class="mmd-stat">
                  <span class="mmd-stat__label">Unique viewers</span>
                  <span class="mmd-stat__value">{{ uniqueViewers }}</span>
                </div>
                <div class="mmd-stat">
                  <span class="mmd-stat__label">Average time spent</span>
                  <span class="mmd-stat__value">{{ averageTimeSpent }}</span>
                </div>
              </div>
            </div>
          </div>

          <Divider />

          <!-- Recent grids grow to fill the free space so the account/support
               group stays anchored to the bottom of the panel. -->
          <div class="mmd-recents">
            <template v-if="recentGrids.length">
              <span class="mmd-section-label">Recent Grid Pages</span>
              <router-link
                v-for="g in recentGrids"
                :key="g.id"
                :to="`/grid/${g.id}`"
                class="mmd-row"
                @click="emit('close')"
              >
                <span class="mmd-row__icon"><GridSquaresIcon /></span>
                <span class="mmd-row__label">{{
                  g.name || "Untitled Grid"
                }}</span>
              </router-link>
            </template>
          </div>

          <!-- Bottom-anchored group. -->
          <div v-if="canUseMobile2" class="mmd-account-toggle">
            <Toggle
              label="Mobile 2.0"
              :modelValue="isMobile2Enabled"
              @update:modelValue="onMobile2Toggle"
              tooltip="Try the redesigned mobile experience. You can switch back anytime."
            />
          </div>

          <a
            class="mmd-row"
            href="https://discord.gg/DBscN5NUN6"
            target="_blank"
            rel="noopener noreferrer"
            @click="emit('close')"
          >
            <span class="mmd-row__icon"><DiscordIcon /></span>
            <span class="mmd-row__label">Need Support?</span>
          </a>

          <Divider />

          <button type="button" class="mmd-row mmd-row--button" @click="logout">
            <span class="mmd-row__icon"><ProfileIcon :size="20" /></span>
            <span class="mmd-row__label">Logout</span>
          </button>
        </nav>
      </transition>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridController } from "@/controllers/useGridController";
import { useMobileExperience } from "@/composables/useMobileExperience";
import { useGridStats } from "@/composables/useGridStats";
import { useToastStore } from "@/stores/toast";
import { valueToMillis } from "@/utils/TimeConversion";
import type { Grid } from "@grids/contracts/types";
import Divider from "@/components/ui-elements/Divider.vue";
import Toggle from "@/components/ui-controls/Toggle.vue";
import HomeIcon from "@/components/icons/HomeIcon.vue";
import AnalyticsIcon from "@/components/icons/AnalyticsIcon.vue";
import GridSquaresIcon from "@/components/icons/GridSquaresIcon.vue";
import DiscordIcon from "@/components/icons/DiscordIcon.vue";
import ProfileIcon from "@/components/icons/ProfileIcon.vue";
import Chevron from "@/components/icons/Chevron.vue";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const route = useRoute();
const router = useRouter();
const collectionStore = useGridCollectionStore();
const sessionStore = useGridSessionStore();
const controller = useGridController();
const toastStore = useToastStore();
const { canUseMobile2, isMobile2Enabled, setMobile2Enabled } =
  useMobileExperience();

const isOwner = computed(() => sessionStore.isOwner);

const analyticsOpen = ref(false);
const { lifetimeViews, uniqueViewers, yesterdayViews, averageTimeSpent } =
  useGridStats();

const recentGrids = computed<Grid[]>(() => {
  const scored = (collectionStore.grids || []).map((g) => ({
    g,
    score:
      valueToMillis(g.lastOpenedAt) ||
      valueToMillis(g.updatedAt) ||
      valueToMillis(g.createdAt) ||
      0,
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .map((x) => x.g)
    .filter((x, idx, arr) => arr.findIndex((y) => y.id === x.id) === idx)
    .slice(0, 4);
});

// Populate the recent-grid list lazily, but only when it hasn't been loaded
// yet — refetching on every open is wasteful and would reorder the list while
// the user is looking at it.
const ensureGridsLoaded = () => {
  if (props.open && (collectionStore.grids?.length ?? 0) === 0) {
    controller.fetchGrids();
  }
};

watch(() => props.open, ensureGridsLoaded);

// Close when navigating away so the drawer never lingers over a new route.
watch(
  () => route.path,
  () => emit("close"),
);

onMounted(ensureGridsLoaded);

const onMobile2Toggle = async (value: boolean) => {
  try {
    await setMobile2Enabled(value);
    toastStore.addToast(
      value ? "Mobile 2.0 enabled" : "Mobile 2.0 disabled",
      "success",
    );
  } catch {
    toastStore.addToast("Couldn't update Mobile 2.0 setting", "error");
  }
};

const logout = async () => {
  emit("close");
  await getAuthProvider().signOut();
  router.push("/login");
};
</script>

<style lang="scss" scoped>
.mmd-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-topbar) + 10);
  /*
    Plain semi-transparent scrim only. A `backdrop-filter` here would force the
    browser to re-rasterize the entire grid painted behind it every time the
    drawer opens/closes, which reads as the tiles "redrawing". The drawer is a
    pure overlay, so it must not touch the background compositing.
  */
  background: color-mix(in srgb, var(--color-content-background) 55%, transparent);
}

.mmd-panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(320px, 88vw);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-md) var(--spacing-sm);
  overflow-y: auto;
  // Content is sized to fit the panel; clip any incidental sub-pixel overflow
  // so the drawer never shows a horizontal scrollbar.
  overflow-x: hidden;
  background-color: var(--color-toolbar-background);
  border-right: var(--border-width) solid var(--color-stroke);
  // Rounded outer (right) edge; the left edge is flush with the viewport.
  border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
  box-shadow: var(--shadow-xl);
}

.mmd-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--easing-smooth);

  &:hover {
    background: var(--color-base-8);
  }
}

.mmd-row__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  color: var(--color-content-default);
}

.mmd-row__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mmd-section-label {
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-xs);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-content-low);
}

// ── Recent grids fill the free space so the bottom group stays anchored ──────
.mmd-recents {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

// ── Analytics inline expand/collapse ─────────────────────────────────────────
.mmd-analytics {
  display: flex;
  flex-direction: column;
}

.mmd-analytics__summary {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-sm);
  color: var(--color-content-low);
  white-space: nowrap;
}

.mmd-analytics__trend {
  flex: 0 0 auto;
  color: var(--grids-brand-purple);
}

.mmd-analytics__chevron {
  flex: 0 0 auto;
  margin-left: auto;
  color: var(--color-content-low);
  transition: transform var(--duration-fast) var(--easing-smooth);

  &.is-open {
    transform: rotate(180deg);
  }
}

// Animate open/closed by transitioning the grid row track from 0fr → 1fr; the
// inner wrapper's overflow is clipped so the rows reveal without a fixed height.
.mmd-analytics__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-normal) var(--easing-gentle);

  &.is-open {
    grid-template-rows: 1fr;
  }
}

.mmd-analytics__body-inner {
  min-height: 0;
  overflow: hidden;
}

.mmd-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  // Indent the label to line up under the Analytics row label (past its icon).
  padding: var(--spacing-xs) var(--spacing-sm) var(--spacing-xs)
    calc(var(--spacing-sm) + 24px + var(--spacing-sm));
  font-size: var(--font-size-sm);
  color: var(--color-content-default);

  &__label {
    font-weight: var(--font-weight-medium);
  }

  &__value {
    color: var(--color-content-high);
    font-variant-numeric: tabular-nums;
  }
}

.mmd-account-toggle {
  padding: var(--spacing-xs) var(--spacing-sm);
}

.mmd-fade-enter-active,
.mmd-fade-leave-active {
  transition: opacity var(--duration-fast) var(--easing-smooth);
}

.mmd-fade-enter-from,
.mmd-fade-leave-to {
  opacity: 0;
}

.mmd-slide-enter-active,
.mmd-slide-leave-active {
  transition: transform var(--duration-normal) var(--easing-smooth);
}

.mmd-slide-enter-from,
.mmd-slide-leave-to {
  transform: translateX(-100%);
}
</style>
