import { ref, nextTick, onUnmounted, type Ref } from "vue";

/**
 * Limits the number of times a GIF image loops by rendering it onto a
 * <canvas> via the WebCodecs ImageDecoder API.  After `maxLoops` complete
 * cycles the canvas freezes on the final frame, saving CPU/GPU work that
 * an endlessly-looping <img> tag would otherwise consume.
 *
 * Falls back gracefully: if the browser lacks ImageDecoder support (Safari,
 * Firefox as of early 2025) or the src isn't a GIF, `isActive` stays false
 * and the caller should show a normal <img> tag instead.
 *
 * Usage:
 *   const { canvasRef, isActive, frozen } = useGifLoopLimit(src, 3);
 *   // In template: show <canvas ref="canvasRef"> when isActive, else <img>
 */
export function useGifLoopLimit(
  src: Ref<string>,
  maxLoops = 5,
) {
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  /** True once the composable has taken over rendering (ImageDecoder available + GIF detected). */
  const isActive = ref(false);
  /** True after the GIF has completed its allowed loops and is frozen on the last frame. */
  const frozen = ref(false);

  let decoder: ImageDecoder | null = null;
  let animationFrameId: number | null = null;
  let stopped = false;

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

  const supportsImageDecoder = (): boolean =>
    typeof ImageDecoder !== "undefined";

  // ── Core playback loop ───────────────────────────────────────────────

  async function startDecoding() {
    const url = src.value;
    if (!url || !isGifUrl(url) || !supportsImageDecoder()) return;

    try {
      const response = await fetch(url);
      if (!response.ok || !response.body) return;

      decoder = new ImageDecoder({
        data: response.body,
        type: "image/gif",
      });

      // Wait for the decoder to determine frame count and dimensions.
      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      if (!track || track.frameCount <= 1) {
        // Static image or single-frame GIF — no looping to limit.
        cleanup();
        return;
      }

      // Set isActive first so the v-if="gifLoopActive" canvas mounts,
      // then wait a tick for Vue to render it before we start drawing.
      isActive.value = true;
      await nextTick();
      await playFrames(track.frameCount);
    } catch {
      // Any failure (CORS, network, codec) — fall back to <img>.
      cleanup();
    }
  }

  async function playFrames(frameCount: number) {
    if (!decoder || stopped) return;

    const canvas = canvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let currentFrame = 0;
    let loopsCompleted = 0;

    const drawNextFrame = async () => {
      if (stopped || !decoder) return;

      try {
        const result = await decoder.decode({ frameIndex: currentFrame });
        const frame = result.image;

        // Size the canvas to match the GIF dimensions on first frame.
        if (currentFrame === 0 && loopsCompleted === 0) {
          canvas.width = frame.displayWidth;
          canvas.height = frame.displayHeight;
        }

        ctx.drawImage(frame, 0, 0);

        // Determine how long to show this frame before advancing.
        // ImageDecoder reports duration in microseconds; fall back to
        // a standard 100 ms if the value is missing or zero.
        const durationMs =
          frame.duration && frame.duration > 0
            ? frame.duration / 1000
            : 100;

        frame.close();

        currentFrame++;

        if (currentFrame >= frameCount) {
          // One full loop completed.
          loopsCompleted++;
          currentFrame = 0;

          if (loopsCompleted >= maxLoops) {
            // We've reached the loop limit — freeze on this frame.
            frozen.value = true;
            return;
          }
        }

        // Schedule the next frame after the GIF-specified delay.
        await new Promise<void>((resolve) => {
          animationFrameId = window.setTimeout(() => {
            resolve();
          }, durationMs) as unknown as number;
        });

        drawNextFrame();
      } catch {
        // Decode error on a specific frame — just stop gracefully.
        frozen.value = true;
      }
    };

    drawNextFrame();
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  /**
   * Call after the canvas ref is mounted (e.g. in onMounted or a watcher
   * on canvasRef).  Starts decoding only if conditions are met.
   */
  function start() {
    if (!supportsImageDecoder() || !isGifUrl(src.value)) return;
    startDecoding();
  }

  function cleanup() {
    stopped = true;
    if (animationFrameId !== null) {
      clearTimeout(animationFrameId);
      animationFrameId = null;
    }
    if (decoder) {
      try {
        decoder.close();
      } catch {
        // Decoder may already be closed.
      }
      decoder = null;
    }
  }

  /** Restart the GIF from the beginning (e.g. when it scrolls back into view). */
  function replay() {
    cleanup();
    stopped = false;
    frozen.value = false;
    isActive.value = false;
    startDecoding();
  }

  onUnmounted(cleanup);

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
