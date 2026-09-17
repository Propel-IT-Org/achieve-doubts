import { env } from "../../env";

/**
 * The only two formats accepted, each the most efficient choice the browser
 * can produce, with its size cap:
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

/** `uploads/<owner>/<timestamp>-<uuid>.<ext>`, as issued by UploadService. */
const KEY_PATTERN = /^uploads\/([\w-]+)\/\d+-[0-9a-f-]{36}\.(webp|webm)$/;

const KIND_BY_EXTENSION: Record<string, "image" | "audio"> = {
  webp: "image",
  webm: "audio",
};

/**
 * True if `url` is an upload this API issued to `ownerId`, of the given kind.
 *
 * Posts only store attachment URLs that pass this. Otherwise a post could
 * embed any external address, and every viewer's browser would request it —
 * leaking their IP to whoever runs that server.
 */
export function isOwnUpload(
  url: string,
  ownerId: string,
  kind: "image" | "audio",
): boolean {
  const base = `${env.S3_PUBLIC_URL.replace(/\/+$/, "")}/`;
  const match = url.startsWith(base)
    ? url.slice(base.length).match(KEY_PATTERN)
    : null;
  return match?.[1] === ownerId && KIND_BY_EXTENSION[match[2] ?? ""] === kind;
}
