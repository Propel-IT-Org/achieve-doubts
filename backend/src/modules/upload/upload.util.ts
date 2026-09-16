import { env } from "../../env";

/**
 * Content types the presign endpoint will issue a URL for. Anything else is
 * rejected outright rather than handed a signed URL.
 */
export const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/webm",
  "audio/mp4",
] as const;

/**
 * Confirms a client-submitted media URL actually came from our own presign
 * flow rather than being an arbitrary attacker-supplied address. Every
 * create endpoint that accepts an imageUrl/audioUrl/photoUrl runs this
 * before persisting it.
 *
 * Note this only proves the URL points at our storage origin — it does not
 * prove the object exists. That is the intended trade-off: the alternative
 * (a HEAD request per attachment) costs a network round trip on every write
 * for a guarantee the client gains nothing by faking.
 */
export function isOwnUploadUrl(url: string): boolean {
  if (!url) return false;
  const publicPrefix = env.S3_PUBLIC_URL.replace(/\/+$/, "");
  if (url.startsWith(`${publicPrefix}/`)) return true;

  // Dev fallback: when S3 isn't configured the presign flow hands back a
  // mock upload URL on our own origin.
  const mockPrefix = `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}/api/upload/mock`;
  return url.startsWith(mockPrefix);
}
