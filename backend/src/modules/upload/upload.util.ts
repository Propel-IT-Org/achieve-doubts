import { env } from "../../env";

const MB = 1024 * 1024;

/** Images are resized to fit inside this box, then stored as WebP. */
export const IMAGE_MAX_DIMENSION = 2048;
export const IMAGE_WEBP_QUALITY = 82;

/**
 * Largest image accepted before processing. The browser compresses first,
 * so this only needs to admit the occasional unprocessed original.
 */
export const IMAGE_MAX_INPUT_BYTES = 15 * MB;

/**
 * Decompression-bomb guard: a small file can declare billions of pixels and
 * exhaust memory once decoded. 50 MP comfortably covers any phone camera.
 */
export const IMAGE_MAX_PIXELS = 50_000_000;

export const AUDIO_MAX_BYTES = 20 * MB;

/** Request-body ceiling for the upload route: largest file plus form overhead. */
export const UPLOAD_BODY_LIMIT =
  Math.max(IMAGE_MAX_INPUT_BYTES, AUDIO_MAX_BYTES) + MB;

/**
 * Local-development storage, used only when S3 isn't configured. Files are
 * written under LOCAL_UPLOAD_DIR and served back from LOCAL_UPLOAD_ROUTE.
 */
export const LOCAL_UPLOAD_DIR = ".uploads";
export const LOCAL_UPLOAD_ROUTE = "/api/upload/local";

/**
 * The only key shape the service ever creates. Anything else is refused
 * before it can touch the filesystem, which is what keeps `../` out.
 */
export const UPLOAD_KEY_PATTERN =
  /^uploads\/[A-Za-z0-9_-]+\/\d+-[0-9a-f-]{36}\.(webp|webm|m4a)$/;

export const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  webp: "image/webp",
  webm: "audio/webm",
  m4a: "audio/mp4",
};

export function formatMegabytes(bytes: number): string {
  return `${Math.floor(bytes / MB)} MB`;
}

/**
 * Confirms a client-submitted media URL actually came from our own upload
 * endpoint rather than being an arbitrary attacker-supplied address. Every
 * create endpoint that accepts an imageUrl/audioUrl/photoUrl runs this
 * before persisting it.
 *
 * This only proves the URL points at our storage — not that the object
 * exists. That is the intended trade-off: a HEAD request per attachment
 * would cost a round trip on every write for a guarantee the client gains
 * nothing by faking.
 */
export function isOwnUploadUrl(url: string): boolean {
  if (!url) return false;
  const publicPrefix = env.S3_PUBLIC_URL.replace(/\/+$/, "");
  if (url.startsWith(`${publicPrefix}/`)) return true;

  const localPrefix = `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}${LOCAL_UPLOAD_ROUTE}/`;
  return env.NODE_ENV !== "production" && url.startsWith(localPrefix);
}
