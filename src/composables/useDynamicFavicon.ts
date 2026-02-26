import { watch, onUnmounted } from 'vue';
import type { Ref } from 'vue';

function getDefaultFavicon(): string {
  const isLocalhost =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname === '::1';
  return isLocalhost ? '/dev_favicon.png' : '/favicon.png';
}

function getFaviconEl(): HTMLLinkElement {
  const byId = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (byId) return byId;
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
 * Restores the default Grids favicon on unmount.
 *
 * @param srcRef - Reactive URL for the favicon image. Falsy value restores the default.
 */
export function useDynamicFavicon(srcRef: Ref<string | undefined | null>) {
  const applyFavicon = (src?: string | null) => {
    getFaviconEl().href = src || getDefaultFavicon();
  };

  watch(srcRef, applyFavicon, { immediate: true });

  onUnmounted(() => {
    getFaviconEl().href = getDefaultFavicon();
  });
}
