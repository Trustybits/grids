import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridViewportStore } from "@/stores/grid/gridViewport";
import { useGridUiStore } from "@/stores/grid/gridUi";
import { useGridController } from "@/controllers/useGridController";
import { useThemeStore } from "@/stores/theme";
import { useToastStore } from "@/stores/toast";
import { usePixelRacersStore } from "@/stores/pixelRacers";
import { useGridTransfers } from "@/composables/useGridTransfers";
import { useGridDuplicateStorage } from "@/composables/useGridDuplicateStorage";
import { describeCallableError } from "@/utils/CallableError";
import type { CopyDepth } from "@grids/contracts/types";

/**
 * Shared orchestration for the Grid Settings surfaces — the desktop
 * `GridSettings` dropdown and the Mobile 2.0 `MobileGridSettingsSheet`. It owns
 * the reactive grid-settings state and the (toast/navigation-complete) actions;
 * each surface renders its own chrome and the shared modals (delete / transfer /
 * OG image) bound to the visibility refs here.
 *
 * This mirrors the `useTileCreation` pattern: keep the behavior in one place so
 * the two presentations can never drift.
 */
export const useGridSettings = () => {
  const router = useRouter();
  const sessionStore = useGridSessionStore();
  const viewportStore = useGridViewportStore();
  const uiStore = useGridUiStore();
  const controller = useGridController();
  const themeStore = useThemeStore();
  const toastStore = useToastStore();
  const gameStore = usePixelRacersStore();
  const authProvider = getAuthProvider();
  const userService = getServiceFactory().getUserService();
  const { resolveStoragePlan } = useGridDuplicateStorage();
  // Sender-side transfers: watch this grid's outgoing invitations so a surface
  // can flip to a "cancel pending transfer" affordance.
  const transfers = useGridTransfers({ incoming: false });

  // ── Shared modal visibility (surfaces render the modals) ───────────────────
  const showDeleteModal = ref(false);
  const showTransferModal = ref(false);
  const showOgImageModal = ref(false);
  const isCancellingTransfer = ref(false);

  const isOwner = computed(() => {
    const userId = authProvider.getCurrentUserId();
    const grid = sessionStore.currentGrid;
    return !!(userId && grid && userId === grid.userId);
  });

  // Internal Trustybits staff — gates the developer debug tooling (Metadata /
  // Verbose Metadata). Pixel Racers stays open to everyone.
  const isStaff = computed(() => {
    const email = authProvider.getCurrentUser()?.email ?? "";
    return email.toLowerCase().endsWith("@trustybits.com");
  });

  const gridPageId = computed(() => sessionStore.currentGrid?.id || "");

  const currentGridName = computed(
    () => sessionStore.currentGrid?.name?.trim() || "Untitled Grid",
  );

  const hasBackgroundImage = computed(
    () => !!sessionStore.currentGrid?.backgroundImageSrc,
  );
  const hasBackgroundColor = computed(
    () => !!sessionStore.currentGrid?.backgroundColor,
  );

  const pendingTransfer = computed(() => {
    const gridId = sessionStore.currentGrid?.id;
    return gridId ? transfers.pendingOutgoingForGrid(gridId) : undefined;
  });

  // ── Toggles ────────────────────────────────────────────────────────────────
  const verticalCompact = computed({
    get: () => sessionStore.verticalCompact,
    set: (value: boolean) => controller.setVerticalCompact(value),
  });

  const isDarkMode = computed({
    get: () => themeStore.isDarkMode,
    set: (value: boolean) => {
      const newThemeId = value ? "dark" : "light";
      themeStore.setTheme(newThemeId);
      controller.setGridTheme(newThemeId);
    },
  });

  const duplicatable = computed({
    get: () => sessionStore.currentGrid?.duplicatable ?? false,
    set: (value: boolean) => controller.setDuplicatable(value),
  });

  const showMetaData = computed({
    get: () => uiStore.showMetaData,
    set: (value: boolean) => controller.setShowMetaData(value),
  });

  const showMetaDataVerbose = computed({
    get: () => uiStore.showMetaDataVerbose,
    set: (value: boolean) => controller.setShowMetaDataVerbose(value),
  });

  // ── Default grid (per-user profile preference) ─────────────────────────────
  const isDefaultGrid = ref(false);

  const refreshDefaultGrid = async (): Promise<void> => {
    const userId = authProvider.getCurrentUserId();
    const gridId = sessionStore.currentGrid?.id;
    if (!userId || !gridId) {
      isDefaultGrid.value = false;
      return;
    }
    try {
      const profile = await userService.getUserProfile(userId);
      isDefaultGrid.value = profile?.defaultGridId === gridId;
    } catch {
      isDefaultGrid.value = false;
    }
  };

  const toggleDefaultGrid = async (): Promise<void> => {
    const userId = authProvider.getCurrentUserId();
    const gridId = sessionStore.currentGrid?.id;
    if (!userId || !gridId) return;
    const nextDefaultId = isDefaultGrid.value ? null : gridId;
    try {
      await userService.setDefaultGrid(userId, nextDefaultId);
      isDefaultGrid.value = nextDefaultId !== null;
    } catch {
      toastStore.addToast("Couldn't update the default grid", "error");
    }
  };

  // ── Breakpoint (mobile/tablet) layout ──────────────────────────────────────
  const hasOverride = computed(() =>
    controller.hasBreakpointOverride(
      sessionStore.currentGrid,
      viewportStore.activeBreakpoint,
    ),
  );

  const breakpointLabel = computed(() =>
    viewportStore.activeBreakpoint === "sm" ? "Mobile" : "Tablet",
  );

  const saveBreakpoint = (): void => {
    const bp = viewportStore.activeBreakpoint;
    if (bp === "lg") return;
    const positions = viewportStore.displayPositions;
    if (!positions.length) return;
    controller.saveBreakpointPositions(bp, positions);
    toastStore.addToast(`${breakpointLabel.value} layout saved`, "success");
  };

  const resetBreakpoint = (): void => {
    const bp = viewportStore.activeBreakpoint;
    if (bp === "lg") return;
    controller.resetBreakpoint(bp);
    toastStore.addToast(`${breakpointLabel.value} layout reset to auto`, "success");
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const copyGridLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toastStore.addToast("Link to Grid copied to the clipboard", "success");
    } catch {
      toastStore.addToast("Failed to copy link", "error");
    }
  };

  /**
   * Duplicate the current grid and navigate to the copy. Returns the new grid
   * id, or null when the duplication was cancelled (storage plan declined) or
   * failed.
   */
  const duplicateGrid = async (
    copyDepth: CopyDepth = "full",
  ): Promise<string | null> => {
    const grid = sessionStore.currentGrid;
    if (!grid) return null;
    try {
      const storagePlan = await resolveStoragePlan(grid, copyDepth);
      if (storagePlan === null) return null;
      const newId = await controller.duplicateGrid(grid, copyDepth, storagePlan);
      if (newId) router.push(`/grid/${newId}`);
      return newId ?? null;
    } catch (error) {
      toastStore.addToast(
        error instanceof Error ? error.message : "Failed to duplicate grid.",
        "error",
      );
      return null;
    }
  };

  const requestDelete = (): void => {
    if (!sessionStore.isOwner || !sessionStore.currentGrid) return;
    showDeleteModal.value = true;
  };

  const performDelete = async (): Promise<void> => {
    if (!sessionStore.isOwner || !sessionStore.currentGrid) return;
    await controller.deleteGrid(sessionStore.currentGrid.id);
    showDeleteModal.value = false;
    router.push("/dashboard");
  };

  const openOgImageModal = (): void => {
    showOgImageModal.value = true;
  };

  const openTransferModal = (): void => {
    showTransferModal.value = true;
  };

  const cancelPendingTransfer = async (): Promise<void> => {
    const transfer = pendingTransfer.value;
    if (!transfer || isCancellingTransfer.value) return;
    isCancellingTransfer.value = true;
    try {
      await transfers.cancelTransfer(transfer.id);
      toastStore.addToast("Transfer cancelled", "success");
    } catch (error) {
      toastStore.addToast(
        describeCallableError(
          error,
          "Couldn't cancel the transfer. Please try again.",
        ),
        "error",
      );
    } finally {
      isCancellingTransfer.value = false;
    }
  };

  const launchPixelRacers = (): void => {
    gameStore.startGame();
  };

  return {
    // state
    isOwner,
    isStaff,
    gridPageId,
    currentGridName,
    hasBackgroundImage,
    hasBackgroundColor,
    pendingTransfer,
    isCancellingTransfer,
    // toggles
    verticalCompact,
    isDarkMode,
    duplicatable,
    showMetaData,
    showMetaDataVerbose,
    // default grid
    isDefaultGrid,
    refreshDefaultGrid,
    toggleDefaultGrid,
    // breakpoint
    hasOverride,
    breakpointLabel,
    saveBreakpoint,
    resetBreakpoint,
    // modal visibility
    showDeleteModal,
    showTransferModal,
    showOgImageModal,
    // actions
    copyGridLink,
    duplicateGrid,
    requestDelete,
    performDelete,
    openOgImageModal,
    openTransferModal,
    cancelPendingTransfer,
    launchPixelRacers,
  };
};
