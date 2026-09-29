import { onMounted, onScopeDispose, readonly, ref } from "vue";

/**
 * Smallest visual-viewport gap taken to be a keyboard. The gap is a difference
 * of fractional CSS pixel values, so it sits slightly off zero even with
 * nothing open — a fraction of a pixel on a device, a couple of whole pixels
 * under a scaled device emulator. Treating any gap at all as a keyboard let
 * that noise pull the bar down to rest "flush" on a keyboard that wasn't there.
 * No real keyboard — or even a bare keyboard accessory bar — is this short.
 */
export const MIN_KEYBOARD_INSET = 40;

/**
 * The on-screen keyboard's height from a visual viewport reading: the gap
 * between the layout viewport bottom and the (shrunken) visual viewport
 * bottom. 0 when there is no keyboard, or no visual viewport at all.
 */
export function measureKeyboardInset(
  innerHeight: number,
  visualViewport: Pick<VisualViewport, "height" | "offsetTop"> | null | undefined,
): number {
  if (!visualViewport) return 0;
  const gap = innerHeight - visualViewport.height - visualViewport.offsetTop;
  // Rounded so a fractional gap cannot end up as a `bottom: 2.99988px`.
  return gap >= MIN_KEYBOARD_INSET ? Math.round(gap) : 0;
}

/**
 * Live soft-keyboard height in px (0 when closed or on desktop), for UI that
 * rests flush on top of the keyboard.
 */
export function useKeyboardInset() {
  const inset = ref(0);

  const update = () => {
    inset.value =
      typeof window === "undefined"
        ? 0
        : measureKeyboardInset(window.innerHeight, window.visualViewport);
  };

  onMounted(() => {
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    update();
  });

  onScopeDispose(() => {
    if (typeof window === "undefined") return;
    window.visualViewport?.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("scroll", update);
  });

  return { keyboardInset: readonly(inset), update };
}
