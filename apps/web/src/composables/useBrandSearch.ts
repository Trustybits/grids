import { ref, readonly } from "vue";
import {
  brandSearchUrl,
  hasBrandfetchClientId,
  type BrandSearchResult,
} from "@/utils/brandLogo";

interface BrandfetchSearchEntry {
  name?: string;
  domain?: string;
  icon?: string;
  brandId?: string;
}

const DEBOUNCE_MS = 250;

/**
 * Debounced, client-side brand name search backed by the Brandfetch Brand
 * Search API. Pure client integration (no DAO/backend) — consistent with how
 * Mapbox/Spotify lookups work in apps/web. Results resolve a typed name to a
 * canonical domain, which the rest of the brand-logo subsystem renders/links.
 */
export function useBrandSearch() {
  const results = ref<BrandSearchResult[]>([]);
  const isSearching = ref(false);
  const error = ref<string | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let activeController: AbortController | null = null;

  const clear = () => {
    results.value = [];
    error.value = null;
    isSearching.value = false;
  };

  const runSearch = async (query: string) => {
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;

    isSearching.value = true;
    error.value = null;

    try {
      const res = await fetch(brandSearchUrl(query), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Brand search failed (${res.status})`);

      const data: BrandfetchSearchEntry[] = await res.json();
      results.value = (Array.isArray(data) ? data : [])
        .filter((entry): entry is BrandfetchSearchEntry & { domain: string } =>
          Boolean(entry?.domain),
        )
        .map((entry) => ({
          name: entry.name || entry.domain,
          domain: entry.domain,
          icon: entry.icon,
          brandId: entry.brandId,
        }));
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      error.value = (err as Error)?.message ?? "Brand search failed";
      results.value = [];
    } finally {
      if (activeController === controller) {
        isSearching.value = false;
        activeController = null;
      }
    }
  };

  const search = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (!query) {
      activeController?.abort();
      clear();
      return;
    }

    if (!hasBrandfetchClientId()) {
      results.value = [];
      error.value = "Brand search is not configured.";
      return;
    }

    debounceTimer = setTimeout(() => void runSearch(query), DEBOUNCE_MS);
  };

  return {
    results: readonly(results),
    isSearching: readonly(isSearching),
    error: readonly(error),
    search,
    clear,
  };
}
