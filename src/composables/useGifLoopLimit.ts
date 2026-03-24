import { ref, nextTick, onUnmounted, type Ref } from "vue";
import { parseGIF, decompressFrames, type ParsedFrame } from "gifuct-js";

/**
 * Limits the number of times a GIF image loops by parsing it with gifuct-js
 * and rendering frames onto a <canvas>.  After `maxLoops` complete cycles the
 * canvas freezes on the final frame, saving CPU/GPU work that an endlessly-
 * looping <img> tag would otherwise consume.
 *
 * Works in **all modern browsers** (Chrome, Firefox, Safari, Edge) because it
 * uses a pure-JS GIF decoder rather than the Chromium-only ImageDecoder API.
 *
 * Properly handles:
 *   - Per-frame delays (including the common 0 ms → 100 ms browser default)
 *   - Partial-frame positioning (top/left offsets)
 *   - GIF disposal methods (keep, restore-to-background, restore-to-previous)
 *   - Transparency via transparentIndex
 *
 * Usage:
 *   const { canvasRef, isActive, frozen } = useGifLoopLimit(src, 5);
 *   // In template: show <canvas ref="canvasRef"> when isActive, else <img>
 */
export function useGifLoopLimit(
  src: Ref<string>,
  maxLoops = 5,
) {
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  /** True once the composable has taken over rendering (GIF detected + parsed). */
  const isActive = ref(false);
  /** True after the GIF has completed its allowed loops and is frozen on the last frame. */
  const frozen = ref(false);

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  /** Decompressed frame data — kept in memory so replays don't re-fetch. */
  let parsedFrames: ParsedFrame[] | null = null;

  // ── Helpers ──────────────────────────────────────────────────────────

  const isGifUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      const pathname = new URL(url, window.location.href).pathname.toLowerCase();
      return pathname.endsWith(".gif");
    } catch {
      return url.toLowerCase().includes(".gif");
    }
  };

  // ── Core playback ────────────────────────────────────────────────────

  async function startDecoding() {
    const url = src.value;
    if (!url || !isGifUrl(url)) return;

    try {
      // Fetch the GIF binary and parse it into frames.
      const response = await fetch(url);
      if (!response.ok) return;
      const buffer = await response.arrayBuffer();
      const gif = parseGIF(buffer);
      const frames = decompressFrames(gif, true);

      if (!frames || frames.length <= 1) {
        // Static image or single-frame GIF — nothing to limit.
        return;
      }

      parsedFrames = frames;

      // Set isActive so the v-if canvas mounts, then wait a tick for Vue
      // to render it before we start drawing.
      isActive.value = true;
      await nextTick();

      playFrames();
    } catch (err) {
      // Any failure (CORS, network, parse) — fall back to <img>.
      console.warn("[GifLoopLimit] Failed to parse GIF, falling back to <img>:", err);
      cleanup();
    }
  }

  function playFrames() {
    if (!parsedFrames || stopped) return;

    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frames = parsedFrames;
    const frameCount = frames.length;

    // Use the first frame to determine the full GIF dimensions.
    // Note: individual frames may be smaller (partial updates).
    const gifWidth = frames[0].dims.width;
    const gifHeight = frames[0].dims.height;
    canvas.width = gifWidth;
    canvas.height = gifHeight;

    // Temporary canvas for compositing individual frame patches.
    // Each frame's `patch` is raw RGBA for just that frame's sub-rect,
    // so we draw it to a scratch ImageData first, then blit onto main canvas.
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = gifWidth;
    tempCanvas.height = gifHeight;
    const tempCtx = tempCanvas.getContext("2d")!;

    let currentFrame = 0;
    let loopsCompleted = 0;
    // Saved canvas state for disposal method 3 ("restore to previous").
    let previousImageData: ImageData | null = null;

    const drawNextFrame = () => {
      if (stopped) return;

      const frame = frames[currentFrame];
      const { dims, patch, delay, disposalType } = frame;

      // Save the current canvas state before drawing this frame, in case
      // the next frame's disposal method is "restore to previous" (3).
      if (disposalType === 3) {
        previousImageData = ctx.getImageData(0, 0, gifWidth, gifHeight);
      }

      // Build an ImageData from the frame's raw RGBA patch, then draw it
      // at the frame's specified position (partial frames are common).
      const imageData = new ImageData(
        new Uint8ClampedArray(patch),
        dims.width,
        dims.height,
      );
      tempCtx.clearRect(0, 0, gifWidth, gifHeight);
      tempCtx.putImageData(imageData, dims.left, dims.top);
      ctx.drawImage(tempCanvas, 0, 0);

      // GIF delay is in centiseconds (1/100 s).  A delay of 0 is treated
      // as 100 ms by most browsers (the "minimum GIF delay" convention).
      const delayMs = delay <= 0 ? 100 : delay * 10;

      currentFrame++;

      if (currentFrame >= frameCount) {
        loopsCompleted++;
        currentFrame = 0;

        if (loopsCompleted >= maxLoops) {
          // We've reached the loop limit — freeze on the last drawn frame.
          frozen.value = true;
          return;
        }
      }

      // Apply the disposal method for the frame we just drew.  This
      // determines what the canvas looks like *before* the next frame
      // is composited on top.
      //   0 / 1 — no disposal / do not dispose (leave as-is)
      //   2     — restore to background (clear the frame's sub-rect)
      //   3     — restore to previous (revert to saved snapshot)
      if (disposalType === 2) {
        ctx.clearRect(dims.left, dims.top, dims.width, dims.height);
      } else if (disposalType === 3 && previousImageData) {
        ctx.putImageData(previousImageData, 0, 0);
      }

      timerId = setTimeout(drawNextFrame, delayMs);
    };

    drawNextFrame();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  /**
   * Call after the canvas ref is mounted (e.g. in onMounted).
   * No-ops for non-GIFs.
   */
  function start() {
    if (!isGifUrl(src.value)) return;
    startDecoding();
  }

  function cleanup() {
    stopped = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  /** Restart the GIF from the beginning (e.g. when it scrolls back into view). */
  function replay() {
    cleanup();
    stopped = false;
    frozen.value = false;
    // Re-use already-parsed frames if available, avoiding a re-fetch.
    if (parsedFrames) {
      playFrames();
    } else {
      isActive.value = false;
      startDecoding();
    }
  }

  onUnmounted(() => {
    cleanup();
    parsedFrames = null;
  });

  return {
    canvasRef,
    /** True when the composable has taken over rendering (show canvas, hide img). */
    isActive,
    /** True after all allowed loops have played — the canvas shows the last frame. */
    frozen,
    /** Call once the canvas element is mounted. */
    start,
    /** Restart playback from loop 0 (useful when tile re-enters viewport). */
    replay,
    /** Clean up decoder resources. */
    cleanup,
  };
}
