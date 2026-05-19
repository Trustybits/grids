import { watch, onUnmounted } from 'vue';
import type { Ref } from 'vue';

export type TitleSeparator = '-' | '|' | '—';

/**
 * Composable for managing dynamic page titles
 * Format: [DEV] Grids <separator> Page Name
 * 
 * @param titleRef - Reactive reference to the page/grid title
 * @param separator - '-' for regular pages, '|' for owned grids, '—' for slug/handle pages
 */
export function usePageTitle(
  titleRef: Ref<string | undefined>,
  separator: TitleSeparator = '-'
) {
  const isDev = import.meta.env.MODE === 'development';
  const devPrefix = isDev ? 'DEV ' : '';
  let lastTitleSetByThisComposable: string | null = null;
  const updateTitle = (title?: string) => {
    const nextTitle = title
      ? `${devPrefix}Grids ${separator} ${title}`
      : `${devPrefix}Grids`;
    lastTitleSetByThisComposable = nextTitle;
    document.title = nextTitle;
  };
  watch(titleRef, updateTitle, { immediate: true });
  onUnmounted(() => {
    // Avoid overwriting the next route's title if it already updated it.
    if (
      lastTitleSetByThisComposable &&
      document.title === lastTitleSetByThisComposable
    ) {
      document.title = `${devPrefix}Grids`;
    }
  });
}
