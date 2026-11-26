import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES } from "@/lib/shared/limits";
import {
  FileTooLargeError,
  ImageTooSmallError,
  UnsupportedMediaTypeError,
} from "@/server/http/errors";
import { exampleImage, exampleImageNames } from "../../../tests/helpers/example-images";
import { processPhoto } from "./process-photo";

const ONE_MB = 1024 * 1024;

describe("processPhoto", () => {
  describe("format detection from bytes", () => {
    it.each([
      ["laptop-1.png", "jpeg"],
      ["laptop-2.webp", "webp"],
      ["phone-1.jpg", "jpeg"],
      ["phone-2.jpeg", "jpeg"],
      ["phone-3.jpeg", "jpeg"],
    ])("%s -> %s", async (name, format) => {
      const bytes = exampleImage(name);
      const result = await processPhoto({ bytes });
      expect(result.originalFormat).toBe(format);
      expect(result.originalByteSize).toBe(bytes.length);
    });
  });

  it("reduces laptop-1.png to a 1600 px JPEG <= 1 MB without metadata", async () => {
    const result = await processPhoto({ bytes: exampleImage("laptop-1.png") });
    expect(result.originalWidth).toBe(3024);
    expect(result.originalHeight).toBe(3135);
    expect(Math.max(result.width, result.height)).toBe(1600);
    expect(result.format).toBe("jpeg");
    expect(result.bytes[0]).toBe(0xff);
    expect(result.bytes[1]).toBe(0xd8);
    expect(result.bytes[2]).toBe(0xff);
    expect(result.byteSize).toBe(result.bytes.length);
    expect(result.byteSize).toBeLessThanOrEqual(ONE_MB);
    const meta = await sharp(result.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(meta.width).toBe(result.width);
    expect(meta.height).toBe(result.height);
  });

  it("does not enlarge phone-2.jpeg (387x516)", async () => {
    const result = await processPhoto({ bytes: exampleImage("phone-2.jpeg") });
    expect(result.width).toBe(387);
    expect(result.height).toBe(516);
  });

  it("accepts every example image (TAC-001-01)", async () => {
    for (const name of exampleImageNames()) {
      const result = await processPhoto({ bytes: exampleImage(name) });
      expect(result.format, name).toBe("jpeg");
      expect(result.byteSize, name).toBeLessThanOrEqual(ONE_MB);
    }
  });

  it("rejects a non-image with 415 (TAC-001-02)", async () => {
    const err = await processPhoto({ bytes: Buffer.from("not an image") }).catch((e) => e);
    expect(err).toBeInstanceOf(UnsupportedMediaTypeError);
    expect(err.status).toBe(415);
  });

  it("rejects 10 MB + 1 byte with 413", async () => {
    const err = await processPhoto({ bytes: Buffer.alloc(MAX_PHOTO_BYTES + 1) }).catch((e) => e);
    expect(err).toBeInstanceOf(FileTooLargeError);
    expect(err.status).toBe(413);
  });

  it("rejects when declaredByteSize exceeds the limit", async () => {
    await expect(
      processPhoto({ bytes: exampleImage("phone-2.jpeg"), declaredByteSize: MAX_PHOTO_BYTES + 1 }),
    ).rejects.toBeInstanceOf(FileTooLargeError);
  });

  it("lets exactly 10 MB pass the size check and fail with 415", async () => {
    await expect(processPhoto({ bytes: Buffer.alloc(MAX_PHOTO_BYTES) })).rejects.toBeInstanceOf(
      UnsupportedMediaTypeError,
    );
  });

  it("rejects an image with a side < 200 px with 422", async () => {
    const small = await sharp(exampleImage("phone-2.jpeg")).resize({ width: 150 }).jpeg().toBuffer();
    const err = await processPhoto({ bytes: small }).catch((e) => e);
    expect(err).toBeInstanceOf(ImageTooSmallError);
    expect(err.status).toBe(422);
  });
});
