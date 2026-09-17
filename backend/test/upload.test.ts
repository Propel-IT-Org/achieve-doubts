import { describe, expect, it } from "bun:test";
import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../src/env";
import { UploadService } from "../src/modules/upload/upload.service";
import { uploadUrl } from "../src/modules/upload/upload.util";

const base = env.S3_PUBLIC_URL.replace(/\/+$/, "");

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

describe("uploadUrl", () => {
  const image = uploadUrl("image");
  const audio = uploadUrl("audio");
  const key = (extension: string) =>
    `uploads/u1/1700000000000-${crypto.randomUUID()}.${extension}`;

  it("accepts URLs the upload flow hands out", async () => {
    const photo = (await service.presign("image/webp", 1000, "u1")).publicUrl;
    const note = (await service.presign("audio/webm", 1000, "u1")).publicUrl;
    expect(image.safeParse(photo).success).toBe(true);
    expect(audio.safeParse(note).success).toBe(true);
  });

  it("rejects external URLs, which every viewer's browser would request", () => {
    expect(image.safeParse(`https://tracker.example/${key("webp")}`).success).toBe(false);
    expect(image.safeParse(`${base}.evil.example/${key("webp")}`).success).toBe(false);
  });

  it("rejects the wrong kind, other formats and crafted paths", () => {
    expect(image.safeParse(`${base}/${key("webm")}`).success).toBe(false);
    expect(audio.safeParse(`${base}/${key("webp")}`).success).toBe(false);
    expect(image.safeParse(`${base}/${key("jpg")}`).success).toBe(false);
    expect(image.safeParse(`${base}/uploads/u1/../u2/x.webp`).success).toBe(false);
  });
});
