import { describe, expect, it } from "bun:test";
import { Image } from "bun";
import {
  MediaError,
  processAudio,
  processImage,
} from "../src/modules/upload/upload.media";

const PNG_1PX = Uint8Array.fromBase64(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
);

const render = (width: number, height: number) =>
  new Image(PNG_1PX).resize(width, height);

/** JPEG with an EXIF APP1 segment carrying the given Orientation value. */
async function jpegWithOrientation(
  width: number,
  height: number,
  orientation: number,
) {
  const jpeg = await render(width, height).jpeg({ quality: 90 }).bytes();
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01,
    0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00,
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = payload.length + 2;
  return new Uint8Array([
    ...jpeg.subarray(0, 2),
    0xff,
    0xe1,
    (length >> 8) & 0xff,
    length & 0xff,
    ...payload,
    ...jpeg.subarray(2),
  ]);
}

describe("processImage", () => {
  it("re-encodes other formats as WebP and fits them inside 2048px", async () => {
    const input = await render(3000, 1500).png().bytes();
    const result = await processImage(input);

    expect(result.contentType).toBe("image/webp");
    expect(result.extension).toBe("webp");
    expect([result.width, result.height]).toEqual([2048, 1024]);
    const stored = await new Image(result.bytes).metadata();
    expect(stored).toEqual({ width: 2048, height: 1024, format: "webp" });
  });

  it("never enlarges a small image", async () => {
    const result = await processImage(await render(320, 200).jpeg().bytes());
    expect([result.width, result.height]).toEqual([320, 200]);
  });

  it("applies EXIF orientation before the metadata is dropped", async () => {
    // Orientation 6 = rotate 90° clockwise: a 64x32 sensor image is portrait.
    const result = await processImage(await jpegWithOrientation(64, 32, 6));
    expect([result.width, result.height]).toEqual([32, 64]);
  });

  it("stores an already-compressed, in-bounds WebP untouched", async () => {
    const input = await render(800, 600).webp({ quality: 82 }).bytes();
    const result = await processImage(input);
    expect(result.bytes).toBe(input);
  });

  it("re-encodes a WebP that is too large", async () => {
    const input = await render(4000, 1000).webp().bytes();
    const result = await processImage(input);
    expect(result.bytes).not.toBe(input);
    expect([result.width, result.height]).toEqual([2048, 512]);
  });

  it("rejects bytes that are not an image, whatever they're called", async () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    await expect(processImage(html)).rejects.toBeInstanceOf(MediaError);
  });
});

describe("processAudio", () => {
  it("recognises WebM by its EBML signature", () => {
    const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86]);
    expect(processAudio(webm).contentType).toBe("audio/webm");
  });

  it("recognises MP4/M4A by its ftyp box", () => {
    const m4a = new Uint8Array([
      0x00, 0x00, 0x00, 0x20, ...new TextEncoder().encode("ftypM4A "),
    ]);
    const result = processAudio(m4a);
    expect(result.contentType).toBe("audio/mp4");
    expect(result.extension).toBe("m4a");
  });

  it("rejects anything else", () => {
    const text = new TextEncoder().encode("definitely not audio");
    expect(() => processAudio(text)).toThrow(MediaError);
  });
});
