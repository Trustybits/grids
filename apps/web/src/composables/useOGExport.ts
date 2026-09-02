import type { Ref } from "vue";

function downloadUrl(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Rasterizes the OG Studio canvas element to a downloadable PNG or animated
 * GIF. `html2canvas` and `gif.js` are dynamically imported so their (~200kb
 * combined) weight only loads when a user actually exports.
 */
export function useOGExport(canvasEl: Ref<HTMLElement | null>) {
  async function exportPNG(): Promise<void> {
    const el = canvasEl.value;
    if (!el) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, { backgroundColor: null, useCORS: true });
    downloadUrl(canvas.toDataURL("image/png"), "og-image.png");
  }

  async function exportGIF(durationMs = 3000, fps = 20): Promise<void> {
    const el = canvasEl.value;
    if (!el) return;
    const [{ default: html2canvas }, { default: GIF }] = await Promise.all([
      import("html2canvas"),
      import("gif.js"),
    ]);

    const frameInterval = 1000 / fps;
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: "/gif.worker.js",
    });

    // Drive frame capture off requestAnimationFrame so it tracks the CSS
    // `@keyframes` timeline the same way the browser is actually painting it.
    await new Promise<void>((resolve) => {
      const start = performance.now();
      let lastCapture = -Infinity;

      const step = (now: number) => {
        const elapsed = now - start;
        const shouldCapture = now - lastCapture >= frameInterval;
        const scheduleNext = () => {
          if (elapsed < durationMs) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };

        if (shouldCapture) {
          lastCapture = now;
          void html2canvas(el, { backgroundColor: null, useCORS: true }).then((frame) => {
            gif.addFrame(frame, { delay: frameInterval, copy: true });
            scheduleNext();
          });
        } else {
          scheduleNext();
        }
      };

      requestAnimationFrame(step);
    });

    const blob = await new Promise<Blob>((resolve) => {
      gif.on("finished", (result) => resolve(result));
      gif.render();
    });

    downloadBlob(blob, "og-image.gif");
  }

  return { exportPNG, exportGIF };
}
