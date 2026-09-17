import { describe, expect, it } from "bun:test";
import { S3Client } from "bun";
import { UploadService } from "../../src/modules/upload/upload.service";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestClient } from "../helpers/test-client";

const student = createMockAuth({ id: "student-u1", role: "student" });

// Presigning needs credentials but no network, so a fake bucket will do.
const upload = new UploadService(
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
    const client = createTestClient({ auth: createMockAuth(null), upload });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "image/webp", size: 120_000 },
    });
    // requireAuth's 401 comes from middleware, which RPC types don't list.
    expect(res.status as number).toBe(401);
  });

  it("issues an upload URL under the caller's own prefix", async () => {
    const client = createTestClient({ auth: student, upload });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "image/webp", size: 150_000 },
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

  it("refuses any format other than WebP and WebM", async () => {
    const client = createTestClient({ auth: student, upload });
    for (const contentType of ["image/jpeg", "image/png", "audio/mp4"]) {
      const res = await client.api.upload.presign.$post({
        json: { contentType: contentType as never, size: 1000 },
      });
      expect(res.status as number).toBe(400);
    }
  });

  it("refuses an image over 200 KB", async () => {
    const client = createTestClient({ auth: student, upload });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "image/webp", size: 200 * 1024 + 1 },
    });
    expect(res.status as number).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("accepts a voice note up to 3 MB", async () => {
    const client = createTestClient({ auth: student, upload });
    const res = await client.api.upload.presign.$post({
      json: { contentType: "audio/webm", size: 3 * 1024 * 1024 },
    });
    expect(res.status).toBe(200);
  });
});
