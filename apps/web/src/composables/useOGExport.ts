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
function sanitizeClonedDocForHtml2Canvas(clonedDoc: Document) {
  const elements = clonedDoc.querySelectorAll<HTMLElement>("*");
  const colorProps = ["color", "backgroundColor", "borderColor", "outlineColor"] as const;
  elements.forEach((el) => {
    if (el.tagName === "IFRAME") {
      el.remove();
      return;
    }
    if (el.tagName === "HR") {
      el.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
      el.style.borderColor = "transparent";
      return;
    }
    try {
      const style = window.getComputedStyle(el);
      for (const p of colorProps) {
        const val = (style as any)[p];
        if (val && typeof val === "string" && val.includes("color(")) {
          const match = val.match(/color\([^ ]+\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
          if (match) {
            const r = Math.round(parseFloat(match[1]) * 255);
            const g = Math.round(parseFloat(match[2]) * 255);
            const b = Math.round(parseFloat(match[3]) * 255);
            const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
            (el.style as any)[p] = `rgba(${r}, ${g}, ${b}, ${a})`;
          } else {
            (el.style as any)[p] = "rgba(255, 255, 255, 0.2)";
          }
        }
      }
    } catch {
      // ignore
    }
  });
}

export function useOGExport(canvasEl: Ref<HTMLElement | null>) {
  async function exportPNG(): Promise<void> {
    const el = canvasEl.value;
    if (!el) return;
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(el, {
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
      ignoreElements: (element) => element.tagName === "IFRAME",
      onclone: sanitizeClonedDocForHtml2Canvas,
      logging: false,
    });
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
          void html2canvas(el, {
            backgroundColor: null,
            useCORS: true,
            allowTaint: true,
            ignoreElements: (element) => element.tagName === "IFRAME",
            onclone: sanitizeClonedDocForHtml2Canvas,
            logging: false,
          }).then((frame) => {
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
