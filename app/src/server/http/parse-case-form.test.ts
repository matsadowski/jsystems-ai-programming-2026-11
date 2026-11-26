import { describe, expect, it } from "vitest";
import { exampleImage } from "../../../tests/helpers/example-images";
import { FileTooLargeError, ValidationError } from "./errors";
import { parseCaseForm } from "./parse-case-form";

function photo(name = "phone-1.jpg"): File {
  return new File([new Uint8Array(exampleImage(name))], name, { type: "image/jpeg" });
}

function formRequest(build: (f: FormData) => void, headers: Record<string, string> = {}): Request {
  const form = new FormData();
  build(form);
  return new Request("http://localhost/api/cases", { method: "POST", body: form, headers });
}

describe("parseCaseForm", () => {
  it("returns string fields and the single photo, ignoring extra fields", async () => {
    const request = formRequest((f) => {
      f.set("caseType", "RETURN");
      f.set("model", "Phone X");
      f.set("surprise", "ignored");
      f.set("photo", photo());
    });
    const { fields, photo: file } = await parseCaseForm(request);
    expect(fields).toMatchObject({ caseType: "RETURN", model: "Phone X" });
    expect(fields).not.toHaveProperty("surprise");
    expect(fields).not.toHaveProperty("photo");
    expect(file).toBeInstanceOf(File);
    expect(file.size).toBeGreaterThan(0);
  });

  it("rejects a non-multipart request with 400 VALIDATION_ERROR", async () => {
    const request = new Request("http://localhost/api/cases", {
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      headers: { "content-type": "application/json" },
    });
    const error = await parseCaseForm(request).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).status).toBe(400);
  });

  it("rejects a declared Content-Length above 10.5 MB before parsing", async () => {
    const request = formRequest((f) => f.set("photo", photo()), { "content-length": String(11 * 1024 * 1024) });
    let parsed = false;
    request.formData = async () => {
      parsed = true;
      return new FormData();
    };
    await expect(parseCaseForm(request)).rejects.toBeInstanceOf(FileTooLargeError);
    expect(parsed).toBe(false);
  });

  it("reports a missing photo as a field error", async () => {
    const error = await parseCaseForm(formRequest((f) => f.set("model", "x"))).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors).toEqual({ photo: "Dodaj zdjęcie sprzętu" });
  });

  it("treats a text value or an empty file under `photo` as missing", async () => {
    const asText = await parseCaseForm(formRequest((f) => f.set("photo", "nope"))).catch((e: unknown) => e);
    expect((asText as ValidationError).fieldErrors).toEqual({ photo: "Dodaj zdjęcie sprzętu" });
    const empty = await parseCaseForm(
      formRequest((f) => f.set("photo", new File([], "e.jpg", { type: "image/jpeg" }))),
    ).catch((e: unknown) => e);
    expect((empty as ValidationError).fieldErrors).toEqual({ photo: "Dodaj zdjęcie sprzętu" });
  });

  it("rejects two photos with 400", async () => {
    const error = await parseCaseForm(
      formRequest((f) => {
        f.append("photo", photo("phone-1.jpg"));
        f.append("photo", photo("phone-2.jpeg"));
      }),
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).status).toBe(400);
  });
});
