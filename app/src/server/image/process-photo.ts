import "server-only";
import sharp, { type Metadata } from "sharp";
import { MAX_PHOTO_BYTES, MIN_IMAGE_SIDE_PX } from "@/lib/shared/limits";
import type { ProcessedImage } from "@/server/domain/case";
import {
  FileTooLargeError,
  ImageTooSmallError,
  UnsupportedMediaTypeError,
} from "@/server/http/errors";

const BOX_PX = 1600;
const FALLBACK_BOX_PX = 1280;
const TARGET_BYTES = 1024 * 1024;
const MAX_PIXELS = 50_000_000;
const ACCEPTED = new Set(["jpeg", "png", "webp"]);

export interface ProcessPhotoInput {
  bytes: Uint8Array | Buffer;
  declaredByteSize?: number;
}

async function encode(input: Buffer, box: number, quality: number) {
  const { data, info } = await sharp(input)
    .autoOrient()
    .resize(box, box, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Validates (ADR 001 §3.3, §6.1) and reduces an uploaded photo for the analysis call. */
export async function processPhoto(input: ProcessPhotoInput): Promise<ProcessedImage> {
  const originalByteSize = input.bytes.byteLength;
  if (Math.max(originalByteSize, input.declaredByteSize ?? 0) > MAX_PHOTO_BYTES) {
    throw new FileTooLargeError();
  }
  const buffer = Buffer.isBuffer(input.bytes)
    ? input.bytes
    : Buffer.from(input.bytes.buffer, input.bytes.byteOffset, input.bytes.byteLength);

  let meta: Metadata;
  try {
    meta = await sharp(buffer, { limitInputPixels: MAX_PIXELS }).metadata();
  } catch (cause) {
    throw new UnsupportedMediaTypeError({ cause });
  }
  const format = meta.format;
  if (!format || !ACCEPTED.has(format) || !meta.width || !meta.height) {
    throw new UnsupportedMediaTypeError({ detail: `format=${String(format)}` });
  }

  // EXIF orientations 5-8 swap the sides.
  const swap = (meta.orientation ?? 1) >= 5;
  const originalWidth = swap ? meta.height : meta.width;
  const originalHeight = swap ? meta.width : meta.height;
  if (Math.min(originalWidth, originalHeight) < MIN_IMAGE_SIDE_PX) {
    throw new ImageTooSmallError();
  }

  try {
    let out = await encode(buffer, BOX_PX, 80);
    for (const quality of [70, 60]) {
      if (out.data.length <= TARGET_BYTES) break;
      out = await encode(buffer, BOX_PX, quality);
    }
    if (out.data.length > TARGET_BYTES) {
      out = await encode(buffer, FALLBACK_BOX_PX, 70);
    }
    return {
      bytes: out.data,
      format: "jpeg",
      width: out.width,
      height: out.height,
      byteSize: out.data.length,
      originalFormat: format as ProcessedImage["originalFormat"],
      originalWidth,
      originalHeight,
      originalByteSize,
    };
  } catch (cause) {
    throw new UnsupportedMediaTypeError({ cause });
  }
}
