import { ref, onMounted, onUnmounted } from "vue";

/**
 * Reactive composable that tracks whether the device supports touch input
 * and whether the viewport is at a "mobile" width (≤ 768px).
 *
 * `isTouchDevice` is set once on mount (capacitive check).
 * `isMobileViewport` updates on window resize.
 * `isMobile` is true when BOTH conditions are met — a touch-capable device
 * at a mobile viewport width. This avoids false-positives on laptops with
 * touch screens viewed at desktop widths.
 */
export function useMobile(breakpoint = 768) {
  const isTouchDevice = ref(false);
  const isMobileViewport = ref(false);
  const isMobile = ref(false);

  const update = () => {
    isMobileViewport.value = window.innerWidth <= breakpoint;
    isMobile.value = isTouchDevice.value && isMobileViewport.value;
  };

  onMounted(() => {
    isTouchDevice.value =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0;
    update();
    window.addEventListener("resize", update);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", update);
  });

  return { isTouchDevice, isMobileViewport, isMobile };
}
