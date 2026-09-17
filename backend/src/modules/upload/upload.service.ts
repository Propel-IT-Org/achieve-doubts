import { type BunFile, S3Client } from "bun";
import { env } from "../../env";
import type { ProcessedMedia } from "./upload.media";
import {
  LOCAL_UPLOAD_DIR,
  LOCAL_UPLOAD_ROUTE,
  UPLOAD_KEY_PATTERN,
} from "./upload.util";

/**
 * Stores processed media. Uses Bun's built-in S3 client for R2 or B2 when
 * configured, and the local filesystem otherwise (development only — env.ts
 * refuses to boot in production without S3).
 *
 * Uploads come through the API rather than straight to the bucket, so the
 * server decodes and normalises every file before it is stored (see
 * upload.media.ts). That leaves nothing to trust in a client-held URL, and
 * removes the AWS SDK entirely.
 */
export class UploadService {
  private s3: S3Client | null;

  constructor() {
    const configured = Boolean(
      env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
    );
    this.s3 = configured
      ? new S3Client({
          endpoint: env.S3_ENDPOINT,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET_NAME,
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        })
      : null;
  }

  get isConfigured(): boolean {
    return this.s3 !== null;
  }

  async store(userId: string, media: ProcessedMedia) {
    // The extension comes from the processed type, never from the client.
    const key = `uploads/${userId}/${Date.now()}-${crypto.randomUUID()}.${media.extension}`;

    if (this.s3) {
      await this.s3.write(key, media.bytes, { type: media.contentType });
      const base = env.S3_PUBLIC_URL.replace(/\/+$/, "");
      return { key, url: `${base}/${key}` };
    }

    await Bun.write(this.localPath(key), media.bytes);
    const base = env.BETTER_AUTH_URL.replace(/\/+$/, "");
    return { key, url: `${base}${LOCAL_UPLOAD_ROUTE}/${key}` };
  }

  /**
   * Development only. Returns null for any key the service could not have
   * produced, so a crafted path can never escape the upload directory.
   */
  readLocal(key: string): BunFile | null {
    if (!UPLOAD_KEY_PATTERN.test(key)) return null;
    return Bun.file(this.localPath(key));
  }

  private localPath(key: string): string {
    return `${process.cwd()}/${LOCAL_UPLOAD_DIR}/${key}`;
  }
}
