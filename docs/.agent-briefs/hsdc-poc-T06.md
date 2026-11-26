# Brief hsdc-poc-T06 — Image validation and reduction (`processPhoto`)

Read `docs/.agent-briefs/hsdc-poc-common.md` first.

**Goal.** `processPhoto` per ADR 001 §3.3, §6.1–6.2 and TAC-001-01/02 (`docs/ADR/001-backend-api.md`);
PRD AC-08, AC-09, AC-13; ADR 000 §8.5 (photo never stored). Verify sharp 0.35 APIs with Context7
`/lovell/sharp` (version `v0.35.5`).

**Editable files (only):** `app/src/server/image/**` (e.g. `process-photo.ts`, `index.ts`, and
`process-photo.test.ts`).

**Concurrent tasks (do not touch):** T07 `app/src/server/store/**`; T10
`app/src/server/decisions/{questions,certainty,fast-path,eligibility}.ts`; T16
`app/src/components/{case-app-reducer.ts,form/**,ProcessingPanel*,ErrorBanner*,api/**}`.

**Contract**
```ts
export async function processPhoto(input: { bytes: Uint8Array | Buffer; declaredByteSize?: number }): Promise<ProcessedImage>
```
(`ProcessedImage` from `@/server/domain/case`.) The route (T14) passes the bytes of the uploaded
`File`. Errors are the AppError classes from `@/server/http/errors`: `FileTooLargeError` (413),
`UnsupportedMediaTypeError` (415), `ImageTooSmallError` (422).
- Size check first: `> MAX_PHOTO_BYTES` (10 MB, `@/lib/shared/limits`) → 413; exactly 10 MB passes
  the size check.
- Detect the format **from bytes** (sharp metadata / magic bytes), never from name or MIME: only
  jpeg, png, webp accepted, else 415. A non-image → 415 (sharp throws → map to 415).
- Either side < 200 px (`MIN_IMAGE_SIDE_PX`) after auto-orient → 422.
- Auto-orient (EXIF), resize to fit inside 1600×1600 **without enlargement**, encode JPEG q80; if
  the result is > 1 MB, step quality down (e.g. 70, 60, 50) until ≤ 1 MB (ADR 001 §6.2 has the exact
  steps; follow it). Strip all metadata (no EXIF in output).
- Return `ProcessedImage` with original format/size/dimensions and the output values.

**Failing tests first (real sharp, real images from `exampleImage()`; never generate or copy images):**
1. Format detection: `laptop-1.png` (JPEG bytes named .png) → originalFormat `jpeg`;
   `laptop-2.webp` → `webp`; `phone-*.jp(e)g` → `jpeg`.
2. Reduction: `laptop-1.png` (3024×3135) → longest side 1600, output is JPEG (check magic bytes),
   ≤ 1 MB, `sharp(output).metadata()` has no `exif`.
3. `phone-2.jpeg` 387×516 stays 387×516 (no enlargement).
4. Every example image is accepted (TAC-001-01).
5. A text buffer (`Buffer.from("not an image")`) → `UnsupportedMediaTypeError` (TAC-001-02).
6. Size: a buffer of 10 MB + 1 byte → `FileTooLargeError` (no image decode needed); a buffer of
   exactly 10 MB of non-image bytes passes the size check and fails with 415 instead.
7. Too small: produce a < 200 px input by resizing a **real** example image in the test with sharp
   (e.g. `phone-2.jpeg` → width 150) and assert `ImageTooSmallError`. This is a derived input from a
   real photo, which is allowed; do not synthesize blank images.

Do not commit. Report per the common rules.
