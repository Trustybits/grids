import { watch, onUnmounted } from 'vue';
import type { Ref } from 'vue';

export type TitleSeparator = '-' | '|';

/**
 * Composable for managing dynamic page titles
 * Format: [DEV] Grids <separator> Page Name
 * 
 * @param titleRef - Reactive reference to the page/grid title
 * @param separator - Either '-' for regular pages or '|' for specific grids
 */
export function usePageTitle(
  titleRef: Ref<string | undefined>,
  separator: TitleSeparator = '-'
) {
  const isDev = import.meta.env.MODE === 'development';
  const devPrefix = isDev ? 'DEV ' : '';
  
  const updateTitle = (title?: string) => {
    if (title) {
      document.title = `${devPrefix}Grids ${separator} ${title}`;
    } else {
      document.title = `${devPrefix}Grids`;
    }
  };

  watch(titleRef, updateTitle, { immediate: true });

  // Cleanup: restore default title when component unmounts
  onUnmounted(() => {
    document.title = `${devPrefix}Grids`;
  });
}
