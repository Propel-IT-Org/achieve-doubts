import { z } from "zod";
import { env } from "../../env";

/**
 * The only two formats accepted, each the most efficient choice the browser
 * can produce, with its size cap. Both are signed into the presigned URL, so
 * the bucket enforces them.
 *
 * - WebP images. The browser resizes and re-encodes every image to fit 200 KB
 *   (frontend lib/image.ts) — plenty for a legible photo of a question.
 * - Opus voice notes in WebM, recorded at 24 kbps (frontend lib/audio.ts):
 *   3 MB is about 16 minutes, above the 15-minute limit on a note.
 */
export const UPLOAD_TYPES = {
  "image/webp": { extension: "webp", maxBytes: 200 * 1024 },
  "audio/webm": { extension: "webm", maxBytes: 3 * 1024 * 1024 },
} as const;

export type UploadType = keyof typeof UPLOAD_TYPES;

export const UPLOAD_TYPE_NAMES = Object.keys(UPLOAD_TYPES) as [
  UploadType,
  ...UploadType[],
];

const escapeRegExp = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Request-schema type for an attachment URL: it must be one of our own
 * uploads of the given kind. Without this a post could embed any external
 * address, and every viewer's browser would request it — leaking their IP to
 * whoever runs that server.
 */
export function uploadUrl(kind: "image" | "audio") {
  const extension = kind === "image" ? "webp" : "webm";
  const base = escapeRegExp(env.S3_PUBLIC_URL.replace(/\/+$/, ""));
  const pattern = new RegExp(
    `^${base}/uploads/[\\w-]+/\\d+-[0-9a-f-]{36}\\.${extension}$`,
  );
  return z
    .url()
    .refine((url) => pattern.test(url), {
      message: `Attach a ${kind === "image" ? "photo" : "voice note"} uploaded here`,
    });
}
