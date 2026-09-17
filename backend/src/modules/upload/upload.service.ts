import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../env";
import { UPLOAD_TYPES, type UploadType } from "./upload.util";

const PRESIGN_TTL_SECONDS = 120;

/**
 * Issues presigned PUT URLs so browsers upload straight to the bucket; files
 * never pass through the API.
 *
 * Content-Type and Content-Length are part of the signature, so the bucket
 * itself rejects any upload whose type or size differs from what was
 * declared — and the declared size was already checked against the cap.
 */
export class UploadService {
  constructor(private s3: S3Client) {}

  async presign(type: UploadType, size: number, ownerId: string) {
    // The key — and so the extension — is chosen here, never by the client.
    const key = `uploads/${ownerId}/${Date.now()}-${crypto.randomUUID()}.${UPLOAD_TYPES[type].extension}`;

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: key,
        ContentType: type,
        ContentLength: size,
      }),
      {
        expiresIn: PRESIGN_TTL_SECONDS,
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    );

    return {
      uploadUrl,
      publicUrl: `${env.S3_PUBLIC_URL.replace(/\/+$/, "")}/${key}`,
      // Must be sent exactly. The browser sets Content-Length from the body,
      // which is why the declared size has to be the file's real size.
      headers: { "content-type": type },
    };
  }
}
