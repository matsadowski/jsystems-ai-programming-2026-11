import { describe, expect, it } from "vitest";
import type { DecisionDTO } from "@/lib/shared";
import { deriveDecision } from "./chat-decision";
import type { ChatMessage } from "./MessageList";

const initial: DecisionDTO = {
  value: "REJECT",
  label: "Zwrot odrzucony",
  tone: "negative",
  daysSincePurchase: 3,
  citedClauses: ["R1.3"],
  decisionPath: "LLM",
};

const toolMsg = (ok: boolean): ChatMessage => ({
  id: "a",
  role: "assistant",
  parts: [
    {
      type: "tool-reviseDecision",
      toolCallId: "t",
      state: "output-available",
      input: { newDecision: "ACCEPT", reason: "powód powód", citedClauses: ["R1.1"] },
      output: ok
        ? { ok: true, from: "REJECT", to: "ACCEPT", fromLabel: "Zwrot odrzucony", toLabel: "Zwrot zaakceptowany" }
        : { ok: false, error: "SAME_DECISION" },
    } as ChatMessage["parts"][number],
  ],
});

describe("deriveDecision", () => {
  it("keeps the initial decision without tool parts", () => {
    expect(deriveDecision(initial, "RETURN", [])).toEqual(initial);
  });

  it("updates immediately from an ok:true tool part", () => {
    const d = deriveDecision(initial, "RETURN", [toolMsg(true)]);
    expect(d.value).toBe("ACCEPT");
    expect(d.label).toBe("Zwrot zaakceptowany");
    expect(d.tone).toBe("positive");
    expect(d.daysSincePurchase).toBe(3);
    expect(d.decisionPath).toBe("LLM");
  });

  it("ignores ok:false", () => {
    expect(deriveDecision(initial, "RETURN", [toolMsg(false)])).toEqual(initial);
  });

  it("finish metadata wins", () => {
    const fromMeta: DecisionDTO = { ...initial, value: "NEEDS_MANUAL_REVIEW", label: "Wymaga weryfikacji", tone: "warning" };
    const msg = { ...toolMsg(true), metadata: { decision: fromMeta } };
    expect(deriveDecision(initial, "RETURN", [msg])).toEqual(fromMeta);
  });
});
