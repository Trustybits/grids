import { watch, onUnmounted } from 'vue';
import type { Ref } from 'vue';

const DEFAULT_FAVICON = '/favicon.ico';

function getFaviconEl(): HTMLLinkElement {
  let el = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'icon';
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Composable that dynamically swaps the page favicon.
 * Restores the default favicon on unmount.
 *
 * @param srcRef - Reactive URL for the favicon image. Falsy value restores the default.
 */
export function useDynamicFavicon(srcRef: Ref<string | undefined | null>) {
  let originalHref: string | null = null;

  const applyFavicon = (src?: string | null) => {
    const el = getFaviconEl();
    if (originalHref === null) {
      originalHref = el.href || DEFAULT_FAVICON;
    }
    el.href = src || DEFAULT_FAVICON;
  };

  watch(srcRef, applyFavicon, { immediate: true });

  onUnmounted(() => {
    const el = getFaviconEl();
    el.href = originalHref ?? DEFAULT_FAVICON;
  });
}
