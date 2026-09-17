/**
 * Client-side image compression, run before every image upload.
 *
 * Uploads go straight from the browser to object storage, so this is the only
 * place an image is shrunk. The server accepts WebP of at most 200 KB
 * (backend upload.util.ts), so this looks for the largest size and highest
 * quality that fit: long edge 1600 → 1280 → 1024 → 800 px, trying quality
 * 0.8 → 0.7 → 0.6 at each. 1600 px keeps handwriting and printed text
 * legible, and a phone photo of a question usually fits there.
 *
 * Re-encoding also drops EXIF metadata, which on phone photos often includes
 * the GPS position where the picture was taken.
 */

/** Keep in step with UPLOAD_TYPES in the backend's upload.util.ts. */
export const MAX_IMAGE_BYTES = 200 * 1024;

const LONG_EDGES = [1600, 1280, 1024, 800];
const QUALITIES = [0.8, 0.7, 0.6];

export async function compressImage(file: File): Promise<File> {
  const bitmap = await decode(file);

  try {
    const encodeWebp = await webpEncoder();
    const longest = Math.max(bitmap.width, bitmap.height);
    // Never upscale, and don't retry sizes that would all be the original.
    const edges = [
      ...new Set([Math.min(longest, LONG_EDGES[0]), ...LONG_EDGES.filter((edge) => edge < longest)]),
    ];

    for (const edge of edges) {
      const canvas = draw(bitmap, edge / longest);
      for (const quality of QUALITIES) {
        const blob = await encodeWebp(canvas, quality);
        if (blob.size <= MAX_IMAGE_BYTES) {
          const name = `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`;
          return new File([blob], name, { type: "image/webp" });
        }
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error(
    "This image is too detailed to upload. Try cropping it closer to the question.",
  );
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // Apply EXIF orientation while decoding — the metadata is gone once the
    // image is re-encoded, and portrait phone photos would come out sideways.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older engines reject the option; their default already honours EXIF.
    return createImageBitmap(file);
  }
}

function draw(bitmap: ImageBitmap, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing isn't available here");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

type WebpEncoder = (canvas: HTMLCanvasElement, quality: number) => Promise<Blob>;

let encoder: Promise<WebpEncoder> | undefined;

/**
 * The browser's own WebP encoder where it has one. Safari doesn't — asked for
 * WebP, its canvas silently returns PNG — so there libwebp compiled to
 * WebAssembly is loaded instead. That module is fetched only on Safari, and
 * only on the first image upload.
 */
function webpEncoder(): Promise<WebpEncoder> {
  encoder ??= (async (): Promise<WebpEncoder> => {
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    if ((await canvasBlob(probe, 0.8)).type === "image/webp") {
      return canvasBlob;
    }

    const { default: encode } = await import("@jsquash/webp/encode");
    const pixels = new WeakMap<HTMLCanvasElement, ImageData>();
    return async (canvas, quality) => {
      let data = pixels.get(canvas);
      if (!data) {
        data = canvas
          .getContext("2d")
          ?.getImageData(0, 0, canvas.width, canvas.height);
        if (!data) throw new Error("Image processing isn't available here");
        pixels.set(canvas, data);
      }
      const buffer = await encode(data, { quality: Math.round(quality * 100) });
      return new Blob([buffer], { type: "image/webp" });
    };
  })().catch((err: unknown) => {
    encoder = undefined;
    throw err;
  });
  return encoder;
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't process the image")),
      "image/webp",
      quality,
    );
  });
}
