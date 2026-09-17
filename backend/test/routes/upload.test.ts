import { afterAll, describe, expect, it } from "bun:test";
import { Image } from "bun";
import { createApp } from "../../src/index";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestClient } from "../helpers/test-client";

const PNG_1PX = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
);

// Uploads land on local disk in tests (no S3 configured); remove them after.
const storedKeys: string[] = [];
afterAll(async () => {
  for (const key of storedKeys) {
    await Bun.file(`${process.cwd()}/.uploads/${key}`)
      .delete()
      .catch(() => {});
  }
});

const asStudent = () =>
  createTestClient({
    auth: createMockAuth({ id: "student-u1", role: "student" }),
  });

type Uploaded = {
  url: string;
  key: string;
  contentType: string;
  width: number | null;
  height: number | null;
};

describe("API Route: POST /api/upload", () => {
  it("returns 401 when unauthenticated", async () => {
    const client = createTestClient({ auth: createMockAuth(null) });
    const res = await client.api.upload.$post({
      form: { file: new File([PNG_1PX], "a.png", { type: "image/png" }) },
    });
    // requireAuth's 401 comes from middleware, which RPC types don't list.
    expect(res.status as number).toBe(401);
  });

  it("stores an image as a bounded WebP under the uploader's prefix", async () => {
    const jpeg = await new Image(PNG_1PX).resize(3000, 1500).jpeg().bytes();
    const res = await asStudent().api.upload.$post({
      form: {
        file: new File([jpeg as Uint8Array<ArrayBuffer>], "photo.jpg", {
          type: "image/jpeg",
        }),
      },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as Uploaded;
    storedKeys.push(body.key);

    expect(body.contentType).toBe("image/webp");
    expect([body.width, body.height]).toEqual([2048, 1024]);
    expect(body.key).toStartWith("uploads/student-u1/");
    expect(body.key).toEndWith(".webp");

    // And it is served back, with the right type, in development.
    const served = await createApp().request(new URL(body.url).pathname);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");
    const metadata = await new Image(await served.bytes()).metadata();
    expect(metadata.format).toBe("webp");
  });

  it("rejects a file that claims to be an image but isn't", async () => {
    const res = await asStudent().api.upload.$post({
      form: {
        file: new File(["<html>not a picture</html>"], "x.png", {
          type: "image/png",
        }),
      },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("stores a WebM voice note as-is", async () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);
    const res = await asStudent().api.upload.$post({
      form: { file: new File([webm], "note.webm", { type: "audio/webm" }) },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as Uploaded;
    storedKeys.push(body.key);
    expect(body.contentType).toBe("audio/webm");
    expect(body.key).toEndWith(".webm");
  });

  it("rejects an image over the input limit", async () => {
    const huge = new File([new Uint8Array(16 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    const res = await asStudent().api.upload.$post({ form: { file: huge } });
    expect(res.status).toBe(413);
  });
});

describe("API Route: GET /api/upload/local/*", () => {
  it("refuses paths the upload service could not have produced", async () => {
    const res = await createApp().request(
      "/api/upload/local/uploads%2F..%2F..%2Fpackage.json",
    );
    expect(res.status).toBe(404);
  });
});
