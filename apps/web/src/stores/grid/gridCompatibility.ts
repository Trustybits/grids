import { defineStore } from "pinia";

/**
 * Temporary owner of compatibility-only facade state.
 *
 * The focused stores retain their domain-specific errors. GridController
 * writes this shared channel at the same operation boundaries as the legacy
 * store so facade and direct-controller callers observe identical sequencing.
 */
export const useGridCompatibilityStore = defineStore(
  "gridCompatibility",
  {
    state: () => ({
      error: null as string | null,
    }),

    actions: {
      setError(error: string | null) {
        this.error = error;
      },

      reset() {
        this.$reset();
      },
    },
  },
);
