<template>
  <template v-if="showSettings">
    <Divider />
    <MenuSection>
      <div class="responsive-layout-section" data-testid="responsive-layout-settings">
        <span class="responsive-layout-label">Responsive Layout</span>
        <p class="responsive-layout-description">
          Preview the Griddle projection before permanently switching automatic layouts.
        </p>
        <MenuItem
          data-testid="responsive-layout-preview-toggle"
          @click="togglePreview"
        >
          {{ isPreviewActive ? "Stop preview" : "Preview Griddle layout" }}
        </MenuItem>
        <MenuItem
          data-testid="responsive-layout-upgrade"
          :disabled="isUpgrading"
          @click="openUpgradeModal"
        >
          Switch to Griddle layout
        </MenuItem>
      </div>
    </MenuSection>
    <Divider />
  </template>

  <BaseModal
    :show="showSettings && showUpgradeModal"
    :close-on-backdrop="!isUpgrading"
    mobile-sheet
    @close="closeUpgradeModal"
  >
    <div class="responsive-layout-confirmation" data-testid="responsive-layout-confirmation">
      <h3>Switch to Griddle layout?</h3>
      <p>Existing saved mobile and tablet overrides will be retained.</p>
      <p>Automatic layouts will use <code>griddle-v1</code> afterward.</p>
      <p>This switch cannot be reverted through the UI or undo.</p>
      <div class="responsive-layout-confirmation__actions">
        <Button
          variant="secondary"
          :disabled="isUpgrading"
          @click="closeUpgradeModal"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          :loading="isUpgrading"
          data-testid="responsive-layout-confirm-upgrade"
          @click="confirmUpgrade"
        >
          Switch layout
        </Button>
      </div>
    </div>
  </BaseModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { isResponsiveLayoutUpgradeEligible } from "@grids/contracts/types";
import { useGridController } from "@/controllers/useGridController";
import { useGridPreviewStore } from "@/stores/grid/gridPreview";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useToastStore } from "@/stores/toast";
import BaseModal from "@/components/modal/BaseModal.vue";
import MenuSection from "@/components/ui-collections/MenuSection.vue";
import MenuItem from "@/components/ui-controls/MenuItem.vue";
import Button from "@/components/ui-elements/Button.vue";
import Divider from "@/components/ui-elements/Divider.vue";

const controller = useGridController();
const previewStore = useGridPreviewStore();
const sessionStore = useGridSessionStore();
const toastStore = useToastStore();

const showUpgradeModal = ref(false);
const isUpgrading = ref(false);

const showSettings = computed(() => {
  const grid = sessionStore.currentGrid;
  return (
    !import.meta.env.PROD &&
    sessionStore.isOwner &&
    !!grid &&
    isResponsiveLayoutUpgradeEligible(
      grid.responsiveLayoutVersion,
      grid.responsiveLayoutVersionStatus,
    )
  );
});

const isPreviewActive = computed(() =>
  previewStore.isActive(sessionStore.currentGrid?.id),
);

const togglePreview = () => {
  if (isPreviewActive.value) {
    controller.stopPreview();
  } else {
    controller.startResponsiveLayoutPreview();
  }
};

const openUpgradeModal = () => {
  if (!showSettings.value || isUpgrading.value) return;
  showUpgradeModal.value = true;
};

const closeUpgradeModal = () => {
  if (isUpgrading.value) return;
  showUpgradeModal.value = false;
};

const confirmUpgrade = async () => {
  if (!showSettings.value || isUpgrading.value) return;
  isUpgrading.value = true;
  try {
    const upgraded = await controller.upgradeResponsiveLayout();
    if (!upgraded) return;
    showUpgradeModal.value = false;
    toastStore.addToast(
      "Responsive layout switched to Griddle",
      "success",
    );
  } finally {
    isUpgrading.value = false;
  }
};

watch(showSettings, (visible) => {
  if (!visible && !isUpgrading.value) showUpgradeModal.value = false;
});
</script>

<style scoped>
.responsive-layout-section {
  display: flex;
  flex-direction: column;
}

.responsive-layout-label {
  padding: 0 var(--spacing-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.responsive-layout-description {
  margin: var(--spacing-xs) var(--spacing-sm);
  color: var(--color-content-default);
  font-size: var(--font-size-xs);
  line-height: 1.4;
}

.responsive-layout-confirmation h3 {
  margin: 0 0 var(--spacing-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-xl);
}

.responsive-layout-confirmation p {
  margin: 0 0 var(--spacing-sm);
  color: var(--color-content-default);
  line-height: 1.5;
}

.responsive-layout-confirmation code {
  color: var(--color-text-primary);
}

.responsive-layout-confirmation__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-lg);
}
</style>
