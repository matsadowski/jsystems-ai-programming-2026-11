import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationError } from "./errors";
import { parseJson } from "./parse-json";

const schema = z.object({ message: z.string().min(1, "Wpisz wiadomość") });
const req = (body: string) => new Request("http://x/api", { method: "POST", body });

describe("parseJson", () => {
  it("returns parsed value", async () => {
    expect(await parseJson(req('{"message":"hi"}'), schema)).toEqual({ message: "hi" });
  });
  it("rejects invalid JSON", async () => {
    await expect(parseJson(req("{nope"), schema)).rejects.toBeInstanceOf(ValidationError);
  });
  it("returns fieldErrors on schema failure", async () => {
    const err = await parseJson(req('{"message":""}'), schema).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.fieldErrors).toEqual({ message: "Wpisz wiadomość" });
  });
});
