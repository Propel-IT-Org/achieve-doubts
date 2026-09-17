import { afterAll, describe, expect, it } from "bun:test";
import { createApp } from "../../src/index";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestClient } from "../helpers/test-client";

// No S3 is configured in tests, so presigned URLs point at the local
// development stand-in and files land on disk. Remove them afterwards.
const storedKeys: string[] = [];
afterAll(async () => {
  for (const key of storedKeys) {
    await Bun.file(`${process.cwd()}/.uploads/${key}`)
      .delete()
      .catch(() => {});
  }
});

const WEBP = new Uint8Array([
  ...new TextEncoder().encode("RIFF"),
  0x24, 0x00, 0x00, 0x00,
  ...new TextEncoder().encode("WEBPVP8 "),
]);

const asStudent = () =>
  createTestClient({
    auth: createMockAuth({ id: "student-u1", role: "student" }),
  });

type Presigned = {
  key: string;
  uploadUrl: string;
  publicUrl: string;
  method: string;
  headers: Record<string, string>;
  expiresIn: number;
};

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
    const res = await asStudent().api.upload.presign.$post({
      json: { contentType: "image/webp", size: 240_000 },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Presigned;
    expect(body.key).toStartWith("uploads/student-u1/");
    expect(body.key).toEndWith(".webp");
    expect(body.method).toBe("PUT");
    expect(body.headers["content-type"]).toBe("image/webp");
    expect(body.expiresIn).toBe(120);
  });

  it("refuses types the browser never produces", async () => {
    const res = await asStudent().api.upload.presign.$post({
      json: { contentType: "image/png" as never, size: 1000 },
    });
    expect(res.status).toBe(400);
  });

  it("refuses a declared size over the cap", async () => {
    const res = await asStudent().api.upload.presign.$post({
      json: { contentType: "image/webp", size: 4 * 1024 * 1024 },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; error: string };
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.error).toContain("3 MB");
  });
});

describe("API Route: local upload stand-in", () => {
  it("accepts a PUT to an issued URL and serves it back safely", async () => {
    const presign = await asStudent().api.upload.presign.$post({
      json: { contentType: "image/webp", size: WEBP.byteLength },
    });
    const issued = (await presign.json()) as Presigned;
    storedKeys.push(issued.key);
    const app = createApp();

    const put = await app.request(new URL(issued.uploadUrl).pathname, {
      method: "PUT",
      headers: issued.headers,
      body: WEBP,
    });
    expect(put.status).toBe(200);

    const served = await app.request(new URL(issued.publicUrl).pathname);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
    expect(served.headers.get("content-security-policy")).toBe("sandbox");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(WEBP);
  });

  it("refuses paths the upload service could not have produced", async () => {
    const app = createApp();
    const put = await app.request(
      "/api/upload/local/uploads%2F..%2F..%2Fescape.webp",
      { method: "PUT", body: WEBP },
    );
    expect(put.status).toBe(404);

    const get = await app.request(
      "/api/upload/local/uploads%2F..%2F..%2Fpackage.json",
    );
    expect(get.status).toBe(404);
  });
});
