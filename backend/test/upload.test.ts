import { describe, expect, it } from "bun:test";
import { S3Client } from "bun";
import { env } from "../src/env";
import { UploadService } from "../src/modules/upload/upload.service";
import { isOwnUpload } from "../src/modules/upload/upload.util";

const base = env.S3_PUBLIC_URL.replace(/\/+$/, "");
const urlFor = (owner: string, extension: string) =>
  `${base}/uploads/${owner}/1700000000000-${crypto.randomUUID()}.${extension}`;

// Presigning is a local computation, so no real bucket is needed.
const service = new UploadService(
  new S3Client({
    endpoint: "https://acct.r2.cloudflarestorage.com",
    region: "auto",
    bucket: "media",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
  }),
);

describe("UploadService.presign", () => {
  it("issues a two-minute PUT URL for a server-chosen key", () => {
    const upload = service.presign("image/webp", "u1");
    const url = new URL(upload.uploadUrl);

    expect(url.host).toBe("acct.r2.cloudflarestorage.com");
    expect(url.pathname).toMatch(/^\/media\/uploads\/u1\/\d+-[0-9a-f-]{36}\.webp$/);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(upload.headers["content-type"]).toBe("image/webp");
    expect(upload.publicUrl).toStartWith(`${base}/uploads/u1/`);
  });

  it("names voice notes .webm", () => {
    expect(service.presign("audio/webm", "u1").publicUrl).toEndWith(".webm");
  });

  it("adds no checksum parameters a browser PUT couldn't satisfy", () => {
    const url = new URL(service.presign("image/webp", "u1").uploadUrl);
    const checksums = [...url.searchParams.keys()].filter((name) =>
      name.toLowerCase().startsWith("x-amz-checksum"),
    );
    expect(checksums).toEqual([]);
  });
});

describe("isOwnUpload", () => {
  it("accepts the owner's upload of the right kind", () => {
    expect(isOwnUpload(service.presign("image/webp", "u1").publicUrl, "u1", "image")).toBe(true);
    expect(isOwnUpload(service.presign("audio/webm", "u1").publicUrl, "u1", "audio")).toBe(true);
  });

  it("rejects external URLs, which every viewer's browser would request", () => {
    expect(isOwnUpload("https://tracker.example/pixel.webp", "u1", "image")).toBe(false);
    expect(isOwnUpload(`${base}.evil.example/uploads/u1/x.webp`, "u1", "image")).toBe(false);
  });

  it("rejects someone else's upload, the wrong kind, other formats and crafted keys", () => {
    expect(isOwnUpload(urlFor("u2", "webp"), "u1", "image")).toBe(false);
    expect(isOwnUpload(urlFor("u1", "webm"), "u1", "image")).toBe(false);
    expect(isOwnUpload(urlFor("u1", "webp"), "u1", "audio")).toBe(false);
    expect(isOwnUpload(urlFor("u1", "jpg"), "u1", "image")).toBe(false);
    expect(isOwnUpload(urlFor("u1", "m4a"), "u1", "audio")).toBe(false);
    expect(isOwnUpload(`${base}/uploads/u1/../u2/x.webp`, "u1", "image")).toBe(false);
  });
});
