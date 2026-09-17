import { describe, expect, it } from "bun:test";
import { S3Client } from "bun";
import { UploadService } from "../../src/modules/upload/upload.service";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestClient } from "../helpers/test-client";

const student = createMockAuth({ id: "student-u1", role: "student" });

// Presigning needs credentials but no network, so a fake bucket will do.
const withBucket = new UploadService(
  new S3Client({
    endpoint: "https://acct.r2.cloudflarestorage.com",
    region: "auto",
    bucket: "media",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
  }),
);

describe("API Route: POST /api/upload/presign", () => {
  it("returns 401 when unauthenticated", async () => {
    const client = createTestClient({ auth: createMockAuth(null) });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "image/webp", size: 120_000 },
    });
    // requireAuth's 401 comes from middleware, which RPC types don't list.
    expect(res.status as number).toBe(401);
  });

  it("issues an upload URL under the caller's own prefix", async () => {
    const client = createTestClient({ auth: student, upload: withBucket });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "image/webp", size: 240_000 },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      uploadUrl: string;
      publicUrl: string;
      headers: Record<string, string>;
    };
    expect(new URL(body.uploadUrl).pathname).toStartWith("/media/uploads/student-u1/");
    expect(body.publicUrl).toEndWith(".webp");
    expect(body.headers["content-type"]).toBe("image/webp");
  });

  it("refuses types the browser never produces", async () => {
    const client = createTestClient({ auth: student, upload: withBucket });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "image/png" as never, size: 1000 },
    });
    expect(res.status).toBe(400);
  });

  it("refuses a declared size over the cap", async () => {
    const client = createTestClient({ auth: student, upload: withBucket });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "image/webp", size: 4 * 1024 * 1024 },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("answers 503 when no bucket is configured", async () => {
    const client = createTestClient({
      auth: student,
      upload: new UploadService(null),
    });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "image/webp", size: 1000 },
    });
    expect(res.status).toBe(503);
  });
});
