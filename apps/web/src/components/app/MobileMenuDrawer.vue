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

          <div v-if="isOwner" class="mmd-divider" />

          <div v-if="isOwner" class="mmd-analytics">
            <GridStats />
          </div>

          <div class="mmd-divider" />

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
              <span class="mmd-row__label">{{ g.name || "Untitled Grid" }}</span>
            </router-link>
          </template>

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

          <div class="mmd-divider" />

          <div v-if="canUseMobile2" class="mmd-account-toggle">
            <Toggle
              label="Mobile 2.0"
              :modelValue="isMobile2Enabled"
              @update:modelValue="onMobile2Toggle"
              tooltip="Try the redesigned mobile experience. You can switch back anytime."
            />
          </div>

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
import { computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { useGridCollectionStore } from "@/stores/grid/gridCollection";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridController } from "@/controllers/useGridController";
import { useMobileExperience } from "@/composables/useMobileExperience";
import { useToastStore } from "@/stores/toast";
import { valueToMillis } from "@/utils/TimeConversion";
import type { Grid } from "@grids/contracts/types";
import GridStats from "@/components/grid/GridStats.vue";
import Toggle from "@/components/ui-controls/Toggle.vue";
import HomeIcon from "@/components/icons/HomeIcon.vue";
import GridSquaresIcon from "@/components/icons/GridSquaresIcon.vue";
import DiscordIcon from "@/components/icons/DiscordIcon.vue";
import ProfileIcon from "@/components/icons/ProfileIcon.vue";

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

// Load the recent-grid list lazily the first time the drawer opens.
watch(
  () => props.open,
  (open) => {
    if (open) controller.fetchGrids();
  },
);

// Close when navigating away so the drawer never lingers over a new route.
watch(
  () => route.path,
  () => emit("close"),
);

onMounted(() => {
  if (props.open) controller.fetchGrids();
});

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
  background: color-mix(in srgb, var(--color-content-background) 40%, transparent);
  backdrop-filter: blur(2px);
}

.mmd-panel {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(280px, 82vw);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-md) var(--spacing-sm);
  overflow-y: auto;
  background-color: var(--color-toolbar-background);
  border-right: var(--border-width) solid var(--color-stroke);
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

.mmd-analytics {
  padding: var(--spacing-xs) var(--spacing-sm);
}

.mmd-account-toggle {
  padding: var(--spacing-xs) var(--spacing-sm);
}

.mmd-divider {
  height: var(--border-width);
  margin: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-stroke);
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
