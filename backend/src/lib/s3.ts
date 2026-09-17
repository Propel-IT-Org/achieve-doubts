import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../env";

export function createS3(): S3Client {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3 is not configured!");
  }
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    // By default the SDK adds CRC32 checksum parameters to presigned URLs,
    // which a browser PUT never satisfies — R2 and B2 then reject the upload.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
