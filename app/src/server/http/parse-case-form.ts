// Multipart parsing for POST /api/cases (ADR 001 §3.3, §5.1). Pure request handling: no validation
// of the field values (the shared schema does that in the service).
import { CASE_INPUT_FIELDS, VALIDATION_MESSAGES } from "@/lib/shared/case-input";
import { MAX_PHOTO_BYTES } from "@/lib/shared/limits";
import { FileTooLargeError, ValidationError } from "./errors";

/** Photo limit plus multipart framing overhead. */
export const MAX_MULTIPART_BYTES = Math.floor(MAX_PHOTO_BYTES + 0.5 * 1024 * 1024);

export interface ParsedCaseForm {
  fields: Record<string, string>;
  photo: File;
}

/** Buffers the body, cancelling the stream as soon as more than the limit has arrived. */
async function readBodyLimited(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) return new Uint8Array(new ArrayBuffer(0));
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MULTIPART_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new FileTooLargeError({ detail: `body exceeded ${MAX_MULTIPART_BYTES} bytes while streaming` });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function parseCaseForm(request: Request): Promise<ParsedCaseForm> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new ValidationError({ form: "Nieprawidłowy format danych" }, { detail: "not multipart" });
  }
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_MULTIPART_BYTES) {
    throw new FileTooLargeError({ detail: `declared content-length=${declared}` });
  }

  // A missing or understated content-length cannot bypass the limit: count the bytes as they arrive.
  const bytes = await readBodyLimited(request);
  let form: FormData;
  try {
    form = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
  } catch (cause) {
    throw new ValidationError({ form: "Nieprawidłowy format danych" }, { detail: "invalid multipart", cause });
  }

  const photos = form.getAll("photo");
  if (photos.length > 1) {
    throw new ValidationError({ photo: "Dodaj tylko jedno zdjęcie" }, { detail: `photo entries=${photos.length}` });
  }
  const photo = photos[0];
  if (!(photo instanceof File) || photo.size === 0) {
    throw new ValidationError({ photo: VALIDATION_MESSAGES.photoRequired });
  }

  const fields: Record<string, string> = {};
  for (const key of CASE_INPUT_FIELDS) {
    const value = form.get(key);
    if (typeof value === "string") fields[key] = value; // extra fields are ignored
  }
  return { fields, photo };
}
