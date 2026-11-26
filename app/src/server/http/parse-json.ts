import type { z } from "zod";
import { toFieldErrors } from "@/lib/shared/case-input";
import { ValidationError } from "./errors";

export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (cause) {
    throw new ValidationError({ form: "Nieprawidłowy format danych" }, { detail: "invalid JSON", cause });
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fieldErrors = Object.fromEntries(
      Object.entries(toFieldErrors(result.error)).filter((e): e is [string, string] => e[1] !== undefined),
    );
    throw new ValidationError(fieldErrors);
  }
  return result.data;
}
