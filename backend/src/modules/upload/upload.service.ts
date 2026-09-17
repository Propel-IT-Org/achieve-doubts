import type { S3Client } from "bun";
import { env } from "../../env";
import { UPLOAD_TYPES, type UploadType } from "./upload.util";

const PRESIGN_TTL_SECONDS = 120;

/**
 * Issues presigned PUT URLs so browsers upload straight to the bucket; files
 * never pass through the API.
 *
 * Known limit: Bun's presign() signs only `host`, so for its two-minute
 * lifetime a URL accepts a body of any size and content type. The declared
 * size is checked before a URL is issued, which stops the site's own client
 * but not a hostile one. Serve the bucket with `X-Content-Type-Options:
 * nosniff` and `Content-Security-Policy: sandbox` so a mislabelled file can't
 * run as a page.
 */
export class UploadService {
  constructor(private s3: S3Client) {}

  presign(type: UploadType, ownerId: string) {
    // The key — and so the extension — is chosen here, never by the client.
    const key = `uploads/${ownerId}/${Date.now()}-${crypto.randomUUID()}.${UPLOAD_TYPES[type].extension}`;

    return {
      uploadUrl: this.s3.presign(key, {
        method: "PUT",
        expiresIn: PRESIGN_TTL_SECONDS,
        type,
      }),
      publicUrl: `${env.S3_PUBLIC_URL.replace(/\/+$/, "")}/${key}`,
      // Sent with the PUT so the object is stored with the right type.
      headers: { "content-type": type },
    };
  }
}
