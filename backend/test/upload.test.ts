import { describe, expect, it } from "bun:test";
import { S3Client } from "@aws-sdk/client-s3";
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
    credentials: { accessKeyId: "test-key", secretAccessKey: "test-secret" },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  }),
);

describe("UploadService.presign", () => {
  it("issues a two-minute PUT URL for a server-chosen key", async () => {
    const upload = await service.presign("image/webp", 150_000, "u1");
    const url = new URL(upload.uploadUrl);

    expect(url.host).toContain("acct.r2.cloudflarestorage.com");
    expect(url.pathname).toMatch(/\/uploads\/u1\/\d+-[0-9a-f-]{36}\.webp$/);
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(upload.headers["content-type"]).toBe("image/webp");
    expect(upload.publicUrl).toStartWith(`${base}/uploads/u1/`);
  });

  it("signs the content type and length, so the bucket enforces both", async () => {
    const url = new URL((await service.presign("audio/webm", 900_000, "u1")).uploadUrl);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-length;content-type;host",
    );
  });

  it("adds no checksum parameters a browser PUT couldn't satisfy", async () => {
    const url = new URL((await service.presign("image/webp", 1000, "u1")).uploadUrl);
    const checksums = [...url.searchParams.keys()].filter((name) =>
      name.toLowerCase().startsWith("x-amz-checksum"),
    );
    expect(checksums).toEqual([]);
  });
});

describe("isOwnUpload", () => {
  it("accepts the owner's upload of the right kind", async () => {
    const image = (await service.presign("image/webp", 1000, "u1")).publicUrl;
    const audio = (await service.presign("audio/webm", 1000, "u1")).publicUrl;
    expect(isOwnUpload(image, "u1", "image")).toBe(true);
    expect(isOwnUpload(audio, "u1", "audio")).toBe(true);
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
    expect(isOwnUpload(`${base}/uploads/u1/../u2/x.webp`, "u1", "image")).toBe(false);
  });
});
