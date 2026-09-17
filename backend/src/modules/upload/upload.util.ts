import { env } from "../../env";

const MB = 1024 * 1024;

/**
 * What the presign endpoint issues URLs for. The browser re-encodes every
 * image before upload — WebP, or JPEG on Safari, which cannot encode WebP from
 * a canvas — so no other image type is needed.
 */
export const ALLOWED_CONTENT_TYPES = [
  "image/webp",
  "image/jpeg",
  "audio/webm",
  "audio/mp4",
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];
export type UploadKind = "image" | "audio";

export const UPLOAD_RULES: Record<
  AllowedContentType,
  { extension: string; kind: UploadKind; maxBytes: number }
> = {
  // A browser-compressed image (≤2048px) is usually well under 1 MB; 3 MB
  // leaves room for dense diagrams while refusing camera originals.
  "image/webp": { extension: "webp", kind: "image", maxBytes: 3 * MB },
  "image/jpeg": { extension: "jpg", kind: "image", maxBytes: 3 * MB },
  "audio/webm": { extension: "webm", kind: "audio", maxBytes: 20 * MB },
  "audio/mp4": { extension: "m4a", kind: "audio", maxBytes: 20 * MB },
};

export const TYPE_BY_EXTENSION = Object.fromEntries(
  Object.entries(UPLOAD_RULES).map(([type, rule]) => [rule.extension, type]),
) as Record<string, AllowedContentType>;

export const LARGEST_UPLOAD_BYTES = Math.max(
  ...Object.values(UPLOAD_RULES).map((rule) => rule.maxBytes),
);

/** Long enough to compress-then-upload on a slow connection; short enough to be useless if leaked. */
export const PRESIGN_TTL_SECONDS = 120;

/**
 * Local-development storage, used only when S3 isn't configured (env.ts
 * refuses to boot in production without it).
 */
export const LOCAL_UPLOAD_DIR = ".uploads";
export const LOCAL_UPLOAD_ROUTE = "/api/upload/local";

/**
 * `uploads/<owner id>/<timestamp>-<uuid>.<ext>` — the only key shape the
 * service creates. Group 1 is the uploader, group 2 the extension. Anything
 * else is refused before it can reach storage or the filesystem, which is
 * also what keeps `../` out of local paths.
 */
export const UPLOAD_KEY_PATTERN =
  /^uploads\/([A-Za-z0-9_-]+)\/\d+-[0-9a-f-]{36}\.(webp|jpg|webm|m4a)$/;

export function formatMegabytes(bytes: number): string {
  return `${Math.floor(bytes / MB)} MB`;
}

const trimSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * The object key behind a URL this API handed out, or null for anything else
 * — another host, a lookalike prefix, or a key the service never creates.
 */
export function uploadKeyFromUrl(url: string): string | null {
  const bases = [trimSlash(env.S3_PUBLIC_URL)];
  if (env.NODE_ENV !== "production") {
    bases.push(`${trimSlash(env.BETTER_AUTH_URL)}${LOCAL_UPLOAD_ROUTE}`);
  }

  for (const base of bases) {
    if (url.startsWith(`${base}/`)) {
      const key = url.slice(base.length + 1);
      return UPLOAD_KEY_PATTERN.test(key) ? key : null;
    }
  }
  return null;
}

/**
 * Checks an attachment URL before it is stored on a post. Returns a message
 * to show the user, or null.
 *
 * Deliberately cheap — no storage calls. What matters is that the URL is one
 * of ours: otherwise any post could embed an external address, and every
 * viewer's browser would request it (leaking their IP to whoever runs it).
 * The key also names its uploader and type, so those checks are free.
 *
 * It does not prove what the stored bytes are: a presigned URL can't restrict
 * that, and a misused upload can be shared without ever being attached.
 * That is handled where the bucket is served — see the deployment notes.
 */
export function checkAttachmentUrl(
  url: string,
  ownerId: string,
  kind: UploadKind,
): string | null {
  const match = uploadKeyFromUrl(url)?.match(UPLOAD_KEY_PATTERN);
  if (!match) return "Attachments must be files uploaded through this site";

  const [, owner, extension = ""] = match;
  if (owner !== ownerId) {
    return "You can only attach files you uploaded yourself";
  }

  const type = TYPE_BY_EXTENSION[extension];
  if (!type || UPLOAD_RULES[type].kind !== kind) {
    return kind === "image"
      ? "That attachment isn't an image"
      : "That attachment isn't an audio recording";
  }
  return null;
}
