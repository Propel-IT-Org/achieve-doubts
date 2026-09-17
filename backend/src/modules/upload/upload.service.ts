import { type BunFile, S3Client } from "bun";
import { env } from "../../env";
import {
  type AllowedContentType,
  LOCAL_UPLOAD_DIR,
  LOCAL_UPLOAD_ROUTE,
  PRESIGN_TTL_SECONDS,
  UPLOAD_KEY_PATTERN,
  UPLOAD_RULES,
} from "./upload.util";

function defaultClient(): S3Client | null {
  const configured = Boolean(
    env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
  );
  return configured
    ? new S3Client({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET_NAME,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      })
    : null;
}

const trimSlash = (value: string) => value.replace(/\/+$/, "");

/**
 * Direct-to-bucket uploads through Bun's S3 client. Files never pass through
 * the API; the browser compresses images and PUTs them to a presigned URL.
 *
 * Bun's presign() signs only the `host` header, so the URL cannot limit what
 * is uploaded to it: for its two-minute lifetime, whoever holds it can PUT any
 * bytes of any size. Keep that in mind when serving the bucket — see the
 * deployment notes.
 */
export class UploadService {
  constructor(private s3: S3Client | null = defaultClient()) {}

  get isConfigured(): boolean {
    return this.s3 !== null;
  }

  createPresignedUpload(contentType: AllowedContentType, ownerId: string) {
    const { extension } = UPLOAD_RULES[contentType];
    // The extension comes from the validated type, never from a filename.
    const key = `uploads/${ownerId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const uploadUrl = this.s3
      ? this.s3.presign(key, {
          method: "PUT",
          expiresIn: PRESIGN_TTL_SECONDS,
          type: contentType,
        })
      : `${trimSlash(env.BETTER_AUTH_URL)}${LOCAL_UPLOAD_ROUTE}/${key}`;

    return {
      key,
      uploadUrl,
      publicUrl: this.publicUrl(key),
      method: "PUT" as const,
      // Not enforced by the signature, but sent so the object is stored —
      // and later served — with the right type.
      headers: { "content-type": contentType },
      expiresIn: PRESIGN_TTL_SECONDS,
    };
  }

  publicUrl(key: string): string {
    return this.s3
      ? `${trimSlash(env.S3_PUBLIC_URL)}/${key}`
      : `${trimSlash(env.BETTER_AUTH_URL)}${LOCAL_UPLOAD_ROUTE}/${key}`;
  }

  /** Development only: stores a local "presigned" PUT. */
  async writeLocal(key: string, body: Blob): Promise<boolean> {
    if (!UPLOAD_KEY_PATTERN.test(key)) return false;
    await Bun.write(this.localPath(key), body);
    return true;
  }

  /**
   * Development only. Null for any key the service could not have produced,
   * so a crafted path can never escape the upload directory.
   */
  readLocal(key: string): BunFile | null {
    if (!UPLOAD_KEY_PATTERN.test(key)) return null;
    return Bun.file(this.localPath(key));
  }

  private localPath(key: string): string {
    return `${process.cwd()}/${LOCAL_UPLOAD_DIR}/${key}`;
  }
}
