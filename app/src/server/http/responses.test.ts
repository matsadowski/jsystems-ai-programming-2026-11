import { afterEach, describe, expect, it } from "vitest";
import { captureLogs, type CapturedLogs } from "../../../tests/helpers/log-capture";
import { AppError, ERROR_DEFINITIONS, errorBody, ValidationError } from "./errors";
import { jsonResponse, toErrorResponse } from "./responses";
import { newRequestId } from "./request-id";

let logs: CapturedLogs | undefined;
afterEach(() => logs?.restore());

describe("toErrorResponse", () => {
  it.each(Object.entries(ERROR_DEFINITIONS))("maps %s", async (code, def) => {
    const err = new AppError(code as keyof typeof ERROR_DEFINITIONS);
    const res = toErrorResponse(err, "req-1");
    expect(res.status).toBe(def.status);
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual(errorBody(err));
  });

  it("includes fieldErrors", async () => {
    const res = toErrorResponse(new ValidationError({ model: "x" }), "r");
    expect((await res.json()).error.fieldErrors).toEqual({ model: "x" });
  });

  it("hides unknown errors", async () => {
    logs = captureLogs();
    const res = toErrorResponse(new Error("secret stack sk-or-v1-leak1"), "r2");
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(JSON.parse(text).error.code).toBe("INTERNAL_ERROR");
    expect(text).not.toContain("secret stack");
    expect(logs.text()).toContain("r2");
    expect(logs.text()).toContain("secret stack");
    expect(logs.text()).not.toContain("leak1");
  });
});

describe("jsonResponse / newRequestId", () => {
  it("sets status and header", async () => {
    const res = jsonResponse({ a: 1 }, 201, "rid");
    expect(res.status).toBe(201);
    expect(res.headers.get("x-request-id")).toBe("rid");
    expect(await res.json()).toEqual({ a: 1 });
  });
  it("generates UUIDs", () => {
    expect(newRequestId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
