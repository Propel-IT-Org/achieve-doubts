import { Image } from "bun";
import {
  IMAGE_MAX_DIMENSION,
  IMAGE_MAX_PIXELS,
  IMAGE_WEBP_QUALITY,
} from "./upload.util";

export type ProcessedMedia = {
  bytes: Uint8Array;
  contentType: "image/webp" | "audio/webm" | "audio/mp4";
  extension: "webp" | "webm" | "m4a";
  width: number | null;
  height: number | null;
};

/** A client-side problem with the file itself; safe to show to the user. */
export class MediaError extends Error {
  override name = "MediaError";
}

/**
 * A browser-compressed WebP at or under this size is stored as-is. Anything
 * larger, or in another format, is re-encoded.
 */
const PASS_THROUGH_MAX_BYTES = 2 * 1024 * 1024;

const decodeOptions = { maxPixels: IMAGE_MAX_PIXELS, autoOrient: true };

/**
 * Decodes, orients, bounds and re-encodes an image as WebP.
 *
 * Decoding doubles as validation: bytes that aren't a real image are rejected
 * here no matter what the client named or labelled them, so nothing but a
 * genuine image can end up behind an image URL.
 *
 * Bun.Image runs the pipeline on a worker thread, so this doesn't block the
 * event loop. JPEG, PNG and WebP use Bun's bundled codecs and behave the same
 * on every platform; HEIC/AVIF need OS codecs that Linux lacks.
 */
export async function processImage(input: Uint8Array): Promise<ProcessedMedia> {
  let source: Image.Metadata;
  try {
    source = await new Image(input, decodeOptions).metadata();
  } catch {
    throw new MediaError(
      "That file isn't a supported image. Use a JPEG, PNG or WebP.",
    );
  }

  // The browser already produced exactly what we would (see the frontend's
  // lib/image.ts). Re-encoding it would only stack a second lossy pass on
  // top of the first, so store it untouched.
  if (
    source.format === "webp" &&
    Math.max(source.width, source.height) <= IMAGE_MAX_DIMENSION &&
    input.byteLength <= PASS_THROUGH_MAX_BYTES
  ) {
    return {
      bytes: input,
      contentType: "image/webp",
      extension: "webp",
      width: source.width,
      height: source.height,
    };
  }

  let bytes: Uint8Array;
  try {
    bytes = await new Image(input, decodeOptions)
      .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: IMAGE_WEBP_QUALITY })
      .bytes();
  } catch {
    // The header parsed but the pixels didn't — e.g. HEIC on Linux, or a
    // truncated file.
    throw new MediaError(
      "That image couldn't be processed. Use a JPEG, PNG or WebP.",
    );
  }

  const output = await new Image(bytes).metadata();
  return {
    bytes,
    contentType: "image/webp",
    extension: "webp",
    width: output.width,
    height: output.height,
  };
}

const EBML_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];

/**
 * Accepts browser voice recordings, identified by their bytes rather than the
 * client's label: WebM (Chrome, Firefox) or MP4/M4A (Safari). Stored as-is —
 * both are already compressed.
 */
export function processAudio(input: Uint8Array): ProcessedMedia {
  const isWebm = EBML_MAGIC.every((byte, i) => input[i] === byte);
  if (isWebm) {
    return {
      bytes: input,
      contentType: "audio/webm",
      extension: "webm",
      width: null,
      height: null,
    };
  }

  // ISO BMFF: a box size, then the `ftyp` box type at offset 4.
  const isMp4 =
    input.byteLength > 8 &&
    new TextDecoder().decode(input.subarray(4, 8)) === "ftyp";
  if (isMp4) {
    return {
      bytes: input,
      contentType: "audio/mp4",
      extension: "m4a",
      width: null,
      height: null,
    };
  }

  throw new MediaError(
    "That file isn't a supported recording. Use WebM or M4A audio.",
  );
}
