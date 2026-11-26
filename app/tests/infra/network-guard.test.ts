import http from "node:http";
import { describe, expect, it } from "vitest";

describe("network guard (ADR 002 TAC-002-02)", () => {
  it("fails any fetch made from a test", async () => {
    await expect(fetch("https://openrouter.ai/api/v1/models")).rejects.toThrow(
      "network disabled in tests",
    );
  });

  it("fails any node:http request made from a test", () => {
    expect(() => http.request("http://example.com")).toThrow("network disabled in tests");
  });
});
