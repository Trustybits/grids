import { readonly, ref } from "vue";
import { getAuthProvider } from "@/auth/AuthProviderSingleton";
import { getServiceFactory } from "@/services/ServiceFactorySingleton";
import { normalizeHex } from "@/utils/color";

/**
 * Per-user saved swatches for the color picker.
 *
 * "Add color" (+) in the mobile picker appends the working color to the signed
 * -in user's profile (`UserProfile.savedColors`), so it's available across all
 * of their grids and syncs between devices. Colors are stored newest-first as
 * `#RRGGBB` hex and de-duplicated case-insensitively; the list is capped so the
 * horizontally-scrolling swatch row can't grow without bound.
 *
 * The built-in preset palette is intentionally NOT stored here — the picker
 * shows the presets first, then these saved customs after them.
 */
const MAX_SAVED_COLORS = 24;

// Module-level so every caller (the bar's Add button + the picker's swatch row)
// shares one reactive list and a single load, rather than re-fetching per mount.
const savedColors = ref<string[]>([]);
let loadedForUserId: string | null = null;

export const useSavedColors = () => {
  const authProvider = getAuthProvider();
  const userService = getServiceFactory().getUserService();

  const load = async (): Promise<void> => {
    const userId = authProvider.getCurrentUserId();
    if (!userId) {
      savedColors.value = [];
      loadedForUserId = null;
      return;
    }
    // Already loaded for this user — the reactive list is the source of truth.
    if (loadedForUserId === userId && savedColors.value.length > 0) return;
    try {
      const profile = await userService.getUserProfile(userId);
      savedColors.value = (profile?.savedColors ?? [])
        .map(normalizeHex)
        .filter(Boolean);
      loadedForUserId = userId;
    } catch {
      savedColors.value = [];
    }
  };

  const addColor = async (input: string): Promise<void> => {
    const hex = normalizeHex(input);
    if (!hex) return;

    const next = [
      hex,
      ...savedColors.value.filter((c) => c.toUpperCase() !== hex),
    ].slice(0, MAX_SAVED_COLORS);

    // Optimistic: reflect immediately, then persist. On failure, roll back.
    const previous = savedColors.value;
    savedColors.value = next;

    const userId = authProvider.getCurrentUserId();
    if (!userId) return;
    try {
      await userService.updateUserProfile(userId, { savedColors: next });
      loadedForUserId = userId;
    } catch {
      savedColors.value = previous;
    }
  };

  return {
    savedColors: readonly(savedColors),
    load,
    addColor,
  };
};
