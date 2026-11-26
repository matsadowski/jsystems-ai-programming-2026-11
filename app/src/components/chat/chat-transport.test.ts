import { describe, expect, it } from "vitest";
import { buildChatRequestBody, createChatTransport } from "./chat-transport";

const msg = (id: string, role: "user" | "assistant", text: string) => ({
  id,
  role,
  parts: [{ type: "text" as const, text }],
});

describe("buildChatRequestBody (TAC-003-02)", () => {
  it("returns exactly the keys caseId and message, with the last message only", () => {
    const messages = [msg("m1", "assistant", "Cześć"), msg("m2", "user", "Pytanie")];
    const body = buildChatRequestBody("case-1", messages);
    expect(Object.keys(body).sort()).toEqual(["caseId", "message"]);
    expect(body.caseId).toBe("case-1");
    expect(body.message).toEqual(messages[1]);
  });

  it("creates a transport", () => {
    expect(createChatTransport("case-1")).toBeDefined();
  });
});
