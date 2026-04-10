import { ref, readonly } from "vue";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase";
import { useLayoutStore } from "@/stores/layout";
import { useToastStore } from "@/stores/toast";
import {
  buildGridFromScrapedItems,
  type ScrapedPageResult,
} from "@/utils/GridGenerator";

const isGenerating = ref(false);
const generationProgress = ref("");
const generationError = ref<string | null>(null);

export function useGridGeneration() {
  const layoutStore = useLayoutStore();
  const toastStore = useToastStore();

  async function generateGridFromUrl(url: string): Promise<void> {
    isGenerating.value = true;
    generationProgress.value = `Scraping ${new URL(url).hostname}...`;
    generationError.value = null;

    try {
      const scrapePageForGrid = httpsCallable<
        { url: string },
        ScrapedPageResult
      >(functions, "scrapePageForGrid");

      const result = await scrapePageForGrid({ url });
      const { pageMeta, items } = result.data;

      // Update grid name if we scraped a page title
      if (pageMeta.title && layoutStore.currentLayout) {
        layoutStore.currentLayout.name = pageMeta.title;
      }

      if (items.length === 0) {
        toastStore.addToast(
          "No content could be extracted from that page",
          "error",
        );
        return;
      }

      generationProgress.value = `Adding ${items.length} tiles...`;

      // Clear starter tiles before populating
      if (layoutStore.currentLayout) {
        layoutStore.currentLayout.tiles = [];
      }

      await buildGridFromScrapedItems(
        items,
        (content, w, h) => layoutStore.addTileWithSize(content, w, h),
      );

      // Final save
      await layoutStore.saveLayout();

      toastStore.addToast(
        `Grid created with ${items.length} tiles`,
        "success",
      );
    } catch (err: any) {
      const message =
        err?.message || err?.details || "Failed to generate grid from URL";
      generationError.value = message;
      toastStore.addToast(message, "error");

      // Ensure the grid has starter tiles so it's not empty
      layoutStore.ensureSuggestionTiles();
    } finally {
      isGenerating.value = false;
      generationProgress.value = "";
      layoutStore.pendingUrlGeneration = null;
    }
  }

  return {
    isGenerating: readonly(isGenerating),
    generationProgress: readonly(generationProgress),
    generationError: readonly(generationError),
    generateGridFromUrl,
  };
}
