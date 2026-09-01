import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { useGridController } from "@/controllers/useGridController";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useToastStore } from "@/stores/toast";
import { useFeatureFlags } from "@/composables/useFeatureFlags";
import type { Grid, GridStatus } from "@grids/contracts/types";

/**
 * usePublish — orchestration for the Draft/Publish surfaces (the app-bar
 * Publish button and PublishPopover).
 *
 * Everything here is gated behind the EDITOR_DRAFT_PUBLISH flag via `isEnabled`;
 * when the flag is off the session never enters draft-editing, so `status`
 * reports "published", `hasUnpublishedChanges` is false, and the actions no-op.
 *
 * The session's `currentGrid` is the DRAFT while editing; the public identity
 * (URL, default-grid, status) comes from the original via the session's
 * `publishedGrid` / `publicGridId`.
 */
export const usePublish = () => {
  const router = useRouter();
  const session = useGridSessionStore();
  const controller = useGridController();
  const toastStore = useToastStore();
  const authProvider = getAuthProvider();
  const userService = getServiceFactory().getUserService();
  const { isEnabled, FEATURE_FLAGS } = useFeatureFlags();

  const isFeatureEnabled = computed(() =>
    isEnabled(FEATURE_FLAGS.EDITOR_DRAFT_PUBLISH),
  );

  const isOwner = computed(() => session.isOwner);
  const isDraftEditing = computed(() => session.isDraftEditing);

  // The public grid backing the current editing session: the original snapshot
  // while editing a draft, otherwise the open grid itself.
  const publicGrid = computed<Grid | null>(() =>
    session.isDraftEditing ? session.publishedGrid : session.currentGrid,
  );

  const status = computed<GridStatus>(
    () => publicGrid.value?.status ?? "published",
  );
  const isPublished = computed(() => status.value === "published");

  const publishedAt = computed(() => publicGrid.value?.publishedAt ?? null);

  const hasUnpublishedChanges = computed(() => session.hasUnpublishedChanges);

  // In-flight guards so the UI can disable buttons and we never double-fire.
  const isPublishing = ref(false);
  const isUnpublishing = ref(false);

  // ── Public URL (slug page when this is the default grid, else /grid/:id) ────
  const slug = ref<string | null>(null);
  const defaultGridId = ref<string | null>(null);
  const isDefaultGrid = computed(
    () => !!session.publicGridId && defaultGridId.value === session.publicGridId,
  );

  const origin = (): string =>
    typeof window !== "undefined" ? window.location.origin : "";

  const publicUrl = computed(() => {
    const id = session.publicGridId;
    if (!id) return "";
    if (slug.value && defaultGridId.value === id) {
      return `${origin()}/${slug.value}`;
    }
    return `${origin()}/grid/${id}`;
  });

  const refreshPublicIdentity = async (): Promise<void> => {
    const userId = authProvider.getCurrentUserId();
    if (!userId) {
      slug.value = null;
      defaultGridId.value = null;
      return;
    }
    try {
      const profile = await userService.getUserProfile(userId);
      slug.value = profile?.slug ?? null;
      defaultGridId.value = profile?.defaultGridId ?? null;
    } catch {
      slug.value = null;
      defaultGridId.value = null;
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────────
  const publish = async (): Promise<void> => {
    if (!isFeatureEnabled.value || !isDraftEditing.value) return;
    if (isPublishing.value) return;
    isPublishing.value = true;
    try {
      await controller.publish();
      toastStore.addToast("Changes published", "success");
    } catch (error) {
      toastStore.addToast(
        error instanceof Error ? error.message : "Failed to publish.",
        "error",
      );
    } finally {
      isPublishing.value = false;
    }
  };

  const publishAsCopy = async (name?: string): Promise<void> => {
    if (!isFeatureEnabled.value || !isDraftEditing.value) return;
    if (isPublishing.value) return;
    isPublishing.value = true;
    try {
      const newId = await controller.publishAsCopy(name);
      if (newId) {
        toastStore.addToast("Published as a new grid", "success");
        router.push(`/grid/${newId}`);
      }
    } catch (error) {
      toastStore.addToast(
        error instanceof Error ? error.message : "Failed to publish a copy.",
        "error",
      );
    } finally {
      isPublishing.value = false;
    }
  };

  const unpublish = async (): Promise<void> => {
    if (!isFeatureEnabled.value) return;
    if (isUnpublishing.value) return;
    isUnpublishing.value = true;
    try {
      await controller.unpublish();
      toastStore.addToast("Grid unpublished — it's now private", "info");
    } catch (error) {
      toastStore.addToast(
        error instanceof Error ? error.message : "Failed to unpublish.",
        "error",
      );
    } finally {
      isUnpublishing.value = false;
    }
  };

  const copyPublicUrl = async (): Promise<void> => {
    const url = publicUrl.value;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toastStore.addToast("Public link copied to the clipboard", "success");
    } catch {
      toastStore.addToast("Failed to copy link", "error");
    }
  };

  const openPublicUrl = (): void => {
    const url = publicUrl.value;
    if (url) window.open(url, "_blank", "noopener");
  };

  const setAsDefaultGrid = async (): Promise<void> => {
    const userId = authProvider.getCurrentUserId();
    const gridId = session.publicGridId;
    if (!userId || !gridId) return;
    try {
      await userService.setDefaultGrid(userId, gridId);
      defaultGridId.value = gridId;
      toastStore.addToast("Set as your grids.so page", "success");
    } catch {
      toastStore.addToast("Couldn't set the default grid", "error");
    }
  };

  return {
    // state
    isFeatureEnabled,
    isOwner,
    isDraftEditing,
    status,
    isPublished,
    publishedAt,
    hasUnpublishedChanges,
    isPublishing,
    isUnpublishing,
    publicUrl,
    isDefaultGrid,
    // lifecycle
    refreshPublicIdentity,
    // actions
    publish,
    publishAsCopy,
    unpublish,
    copyPublicUrl,
    openPublicUrl,
    setAsDefaultGrid,
  };
};
