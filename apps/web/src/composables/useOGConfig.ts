import { ref, watch, type Ref } from "vue";
import { useGridSessionStore } from "@/stores/grid/gridSession";
import { useGridController } from "@/controllers/useGridController";
import { DEFAULT_OG_CONFIG, type OGConfig } from "@/types/og";

function cloneConfig(config: OGConfig): OGConfig {
  return JSON.parse(JSON.stringify(config)) as OGConfig;
}

function isOGConfig(value: unknown): value is OGConfig {
  return !!value && typeof value === "object" && (value as OGConfig).version === 1;
}

/**
 * Loads/saves the OG Image Studio layout stored on `Grid.ogConfig`. Mirrors
 * the rest of `useGridSettings`: reads the currently-loaded grid out of the
 * session store and persists through `GridController` (never touches the DAO
 * directly), so saves go through the same undo-free, debounced scheduler as
 * every other grid setting.
 */
export function useOGConfig(gridId: Ref<string>) {
  const sessionStore = useGridSessionStore();
  const controller = useGridController();

  const config = ref<OGConfig>(cloneConfig(DEFAULT_OG_CONFIG));

  function load(): void {
    const grid = sessionStore.currentGrid;
    const stored = grid && grid.id === gridId.value ? grid.ogConfig : undefined;
    config.value = isOGConfig(stored) ? cloneConfig(stored) : cloneConfig(DEFAULT_OG_CONFIG);
  }

  async function save(): Promise<void> {
    controller.setOgConfig(cloneConfig(config.value) as unknown as Record<string, unknown>);
  }

  watch(gridId, load, { immediate: true });

  return { config, load, save };
}
