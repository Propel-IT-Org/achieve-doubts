import { describe, expect, it } from "bun:test";
import { S3Client } from "bun";
import { env } from "../src/env";
import { UploadService } from "../src/modules/upload/upload.service";
import {
  checkAttachmentUrl,
  uploadKeyFromUrl,
} from "../src/modules/upload/upload.util";

const base = env.S3_PUBLIC_URL.replace(/\/+$/, "");
const keyFor = (owner: string, extension: string) =>
  `uploads/${owner}/1700000000000-${crypto.randomUUID()}.${extension}`;

describe("uploadKeyFromUrl", () => {
  const key = keyFor("u1", "webp");

  it("extracts a key the service could have issued", () => {
    expect(uploadKeyFromUrl(`${base}/${key}`)).toBe(key);
  });

  it("rejects other hosts, lookalike prefixes and crafted keys", () => {
    expect(uploadKeyFromUrl(`https://evil.example/${key}`)).toBeNull();
    expect(uploadKeyFromUrl(`${base}.evil.example/${key}`)).toBeNull();
    expect(uploadKeyFromUrl(`${base}/uploads/u1/../../secret.webp`)).toBeNull();
    expect(uploadKeyFromUrl(`${base}/uploads/u1/photo.html`)).toBeNull();
  });
});

describe("checkAttachmentUrl", () => {
  it("accepts the poster's own upload of the right kind", () => {
    expect(checkAttachmentUrl(`${base}/${keyFor("u1", "webp")}`, "u1", "image")).toBeNull();
    expect(checkAttachmentUrl(`${base}/${keyFor("u1", "jpg")}`, "u1", "image")).toBeNull();
    expect(checkAttachmentUrl(`${base}/${keyFor("u1", "m4a")}`, "u1", "audio")).toBeNull();
  });

  it("refuses external URLs, which every viewer's browser would request", () => {
    expect(
      checkAttachmentUrl("https://tracker.example/pixel.webp", "u1", "image"),
    ).toContain("uploaded through this site");
  });

  it("refuses someone else's upload", () => {
    expect(
      checkAttachmentUrl(`${base}/${keyFor("u2", "webp")}`, "u1", "image"),
    ).toContain("uploaded yourself");
  });

  it("refuses an upload of the wrong kind", () => {
    expect(
      checkAttachmentUrl(`${base}/${keyFor("u1", "webm")}`, "u1", "image"),
    ).toContain("isn't an image");
    expect(
      checkAttachmentUrl(`${base}/${keyFor("u1", "webp")}`, "u1", "audio"),
    ).toContain("isn't an audio recording");
  });
});

describe("presigned uploads with Bun's S3 client", () => {
  // Presigning is a local computation, so no bucket is needed.
  const service = new UploadService(
    new S3Client({
      endpoint: "https://acct.r2.cloudflarestorage.com",
      region: "auto",
      bucket: "media",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    }),
  );

  it("issues a short-lived PUT URL for a server-chosen key", () => {
    const upload = service.createPresignedUpload("image/webp", "u1");
    const url = new URL(upload.uploadUrl);

    expect(url.host).toBe("acct.r2.cloudflarestorage.com");
    expect(url.pathname).toMatch(
      /^\/media\/uploads\/u1\/\d+-[0-9a-f-]{36}\.webp$/,
    );
    expect(url.searchParams.get("X-Amz-Expires")).toBe("120");
    expect(upload.method).toBe("PUT");
    expect(upload.headers["content-type"]).toBe("image/webp");
    expect(upload.publicUrl).toBe(`${base}/${upload.key}`);
  });

  it("issues URLs that pass the attachment check for their owner", () => {
    const upload = service.createPresignedUpload("audio/mp4", "u1");
    expect(upload.key).toEndWith(".m4a");
    expect(checkAttachmentUrl(upload.publicUrl, "u1", "audio")).toBeNull();
  });

  it("adds no checksum parameters a browser PUT couldn't satisfy", () => {
    const url = new URL(service.createPresignedUpload("image/jpeg", "u1").uploadUrl);
    const checksumParams = [...url.searchParams.keys()].filter((name) =>
      name.toLowerCase().startsWith("x-amz-checksum"),
    );
    expect(checksumParams).toEqual([]);
  });
});
