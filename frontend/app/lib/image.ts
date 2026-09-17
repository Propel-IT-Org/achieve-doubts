/**
 * Client-side image compression, run before every image upload.
 *
 * Uploads go straight from the browser to object storage, so the server never
 * A phone photo of a question is typically 3–12 MB; resized to at most 2048px
 * on the long edge and re-encoded as WebP at quality 0.82, it is usually a few
 * hundred KB, with no visible loss for handwriting, printed text or diagrams —
 * and that is what a student on mobile data actually sends.
 *
 * Uploads go straight from the browser to object storage through a presigned
 * URL, so this is the only place an image is compressed. The server checks
 * the stored file's size and type when it is attached to a post.
 *
 * Re-encoding also discards EXIF metadata, which on phone photos often
 * includes the GPS position where the picture was taken.
 */

const MAX_DIMENSION = 2048;
const QUALITY = 0.82;

type OutputType = "image/webp" | "image/jpeg";

export async function compressImage(file: File): Promise<File> {
  const bitmap = await decode(file);

  try {
    const scale = Math.min(
      1,
      MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    // Safari has never encoded WebP from a canvas: asked for one, it silently
    // returns a PNG (usually larger than the original photo). So check what
    // actually came back, and fall back to JPEG, which every browser encodes.
    let blob = await encode(bitmap, width, height, "image/webp");
    if (blob.type !== "image/webp") {
      blob = await encode(bitmap, width, height, "image/jpeg");
    }

    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${extension}`, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
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

function encode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  type: OutputType,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("Image processing isn't available here"));
  }

  if (type === "image/jpeg") {
    // JPEG has no alpha channel: without a fill, transparent areas (common in
    // screenshots of diagrams) come out black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Couldn't process the image")),
      type,
      QUALITY,
    );
  });
}
