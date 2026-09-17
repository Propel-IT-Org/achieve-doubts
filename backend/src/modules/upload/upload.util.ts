import { env } from "../../env";

const MB = 1024 * 1024;

/**
 * What the presign endpoint issues URLs for, with each type's size cap. The
 * browser re-encodes every image first — to WebP, or to JPEG on Safari, which
 * can't encode WebP from a canvas.
 */
export const UPLOAD_TYPES = {
  "image/webp": { extension: "webp", maxBytes: 3 * MB },
  "image/jpeg": { extension: "jpg", maxBytes: 3 * MB },
  "audio/webm": { extension: "webm", maxBytes: 20 * MB },
  "audio/mp4": { extension: "m4a", maxBytes: 20 * MB },
} as const;

export type UploadType = keyof typeof UPLOAD_TYPES;

export const UPLOAD_TYPE_NAMES = Object.keys(UPLOAD_TYPES) as [
  UploadType,
  ...UploadType[],
];

/** `uploads/<owner>/<timestamp>-<uuid>.<ext>`, as issued by UploadService. */
const KEY_PATTERN =
  /^uploads\/([\w-]+)\/\d+-[0-9a-f-]{36}\.(webp|jpg|webm|m4a)$/;

const KIND_BY_EXTENSION: Record<string, "image" | "audio"> = {
  webp: "image",
  jpg: "image",
  webm: "audio",
  m4a: "audio",
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
