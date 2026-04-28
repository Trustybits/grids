# Video tile thumbnails & OG image (backlog)

Planned enhancements for grids that rely heavily on `<video>` tiles. The OG screenshot pipeline historically captured black rectangles when video decoding lagged behind the puppeteer shutter; **`functions/src/ogImage.ts` now waits for decoded frames** and no longer aborts `media` network requests. Below is longer-term product work.

## Problem

- **Runtime:** OG capture loads the real grid page and screenshots tile DOM. Videos need **network fetch + decoder** before a non-black frame appears.
- **Upload-time thumbnail:** Separately, the app could expose a persistent preview image independent of OG timing.

## Epic A — Generate thumbnail on upload (server or client)

1. When a video file finishes upload to Storage (or on first processing job), derive a PNG/JPEG thumbnail:
   - **Option A:** Client-side `<video>` capture to canvas (`seek` → `canvas.drawImage(video)` → blob) upload alongside the asset.
   - **Option B:** Cloud Function triggered on finalize with **ffmpeg**/sharp frame extract (heavy but consistent).
2. Persist `thumbnailUrl` (or derivative path) on the tile content document next to `src`.

## Epic B — User-provided thumbnail (override)

1. In the video tile editor, add “Custom poster image” upload (reuse existing asset upload patterns).
2. Storage rules + layout schema: optional `posterUrl` / `thumbnailUrl` override.
3. **Render order:** `posterUrl` → generated thumbnail → decoded video poster frame (whatever the product prefers).

## Epic C — Use thumbnail in OG without full decode

Once Epics A/B exist, `captureGridTiles` can prefer **`posterUrl`/thumbnail `<img>`** inside the tile if present so OG is stable even under slow CDN or codec variance.

## Related files (current)

- `functions/src/ogImage.ts` — Puppeteer waits, readiness gates.
- `src/components/tilecontent/VideoContent.vue` — `<video>` UI; eventual poster slot / upload UI wires here.

## Notes

- **Cost:** Per-grid OG avoiding full MP4 downloads is ideal for Firebase bandwidth; thumbnails at upload satisfy that once trusted.
- **Privacy/security:** Generated thumbnails inherit the same access model as parent video URLs.
