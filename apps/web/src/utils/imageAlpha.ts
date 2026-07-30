/**
 * Detecting whether an image file actually contains transparent pixels.
 *
 * Image tiles default to an opaque fill, so a PNG with a transparent
 * background rendered as artwork floating on a solid card rather than on the
 * grid behind it — the tile was discarding transparency the file carried. The
 * rendering path itself supports it fine (a no-fill tile is transparent all the
 * way down); it simply was never selected.
 *
 * The test is "are any pixels actually see-through", not "does the format
 * support alpha". Plenty of PNGs are RGBA yet fully opaque, and flipping those
 * to a transparent tile would change how existing artwork reads for no reason.
 */

/** Longest edge, in px, that the alpha probe downscales to before sampling. */
const PROBE_SIZE = 64;

/**
 * Alpha below this counts as transparent. Not 255: some encoders round the
 * fully-opaque value down by a step, and a single stray 254 shouldn't flip a
 * solid image to a transparent tile.
 */
const OPAQUE_THRESHOLD = 250;

/**
 * True when the image contains visibly transparent pixels.
 *
 * Decodes at most PROBE_SIZE² pixels, so cost is independent of the source
 * resolution. Any failure (decode error, no canvas context, a browser that
 * cannot decode the type) resolves `false` — the caller falls back to the
 * existing opaque-fill default, which is the pre-existing behaviour.
 */
export const hasTransparentPixels = async (file: File): Promise<boolean> => {
  if (!file.type.startsWith("image/")) return false;

  // JPEG has no alpha channel in the format at all — skip the decode.
  if (file.type === "image/jpeg" || file.type === "image/jpg") return false;

  // SVG is markup, not a raster: `createImageBitmap` rejects it in several
  // browsers, and an SVG without an explicit background is transparent by
  // default, so treat it as transparent rather than probing.
  if (file.type === "image/svg+xml") return true;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);

    const scale = Math.min(
      1,
      PROBE_SIZE / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    // `willReadFrequently` keeps this on a CPU-backed surface; without it
    // Chrome warns about the readback on a GPU canvas.
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return false;

    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < OPAQUE_THRESHOLD) return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    bitmap?.close();
  }
};
