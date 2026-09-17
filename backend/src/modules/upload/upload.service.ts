import { S3Client } from "bun";
import { env } from "../../env";
import { UPLOAD_TYPES, type UploadType } from "./upload.util";

const PRESIGN_TTL_SECONDS = 120;

function clientFromEnv(): S3Client | null {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    return null;
  }
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET_NAME,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  });
}

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
  constructor(private s3: S3Client | null = clientFromEnv()) {}

  /** Null when no bucket is configured (local development without S3). */
  presign(type: UploadType, ownerId: string) {
    if (!this.s3) return null;

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
