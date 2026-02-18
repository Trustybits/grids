/**
 * Detects whether the current browser is running on a real mobile or tablet
 * device (as opposed to a desktop browser simulating a narrow viewport).
 *
 * Used to suppress the PhonePreviewOverlay on actual devices — the frame is
 * only meaningful when previewing from a desktop browser.
 */
export function useDeviceType() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  // Matches phones and tablets via UA string
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  // iPad on iOS 13+ reports as "Macintosh" but has touch support
  const isIPadOS =
    typeof navigator !== 'undefined' &&
    navigator.platform === 'MacIntel' &&
    navigator.maxTouchPoints > 1;

  const isRealDevice = isMobileUA || isIPadOS;

  return { isRealDevice };
}
