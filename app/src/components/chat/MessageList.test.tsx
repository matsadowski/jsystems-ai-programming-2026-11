// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DISCLAIMER } from "./DecisionChangeNotice";
import { MessageList, type ChatMessage } from "./MessageList";

const user = (id: string, text: string): ChatMessage => ({
  id,
  role: "user",
  parts: [{ type: "text", text }],
});
const agent = (id: string, text: string): ChatMessage => ({
  id,
  role: "assistant",
  parts: text ? [{ type: "text", text }] : [],
});
const revise = (ok: boolean): ChatMessage => ({
  id: "a2",
  role: "assistant",
  parts: [
    {
      type: "tool-reviseDecision",
      toolCallId: "t1",
      state: "output-available",
      input: { newDecision: "ACCEPT", reason: "Klient dostarczył dowód zakupu", citedClauses: ["R1.1"] },
      output: ok
        ? { ok: true, from: "REJECT", to: "ACCEPT", fromLabel: "Zwrot odrzucony", toLabel: "Zwrot zaakceptowany" }
        : { ok: false, error: "SAME_DECISION" },
    } as ChatMessage["parts"][number],
    { type: "text", text: "Zmieniłem decyzję." },
  ],
});

const base = { onRetry: vi.fn(), onNewCase: vi.fn(), error: null };

describe("MessageList", () => {
  it("renders the conversation as a polite log", () => {
    render(<MessageList messages={[agent("a1", "### Decyzja\n\n**Tak**")]} status="ready" {...base} />);
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Decyzja");
  });

  it("shows the typing indicator while submitted/streaming with no assistant text (AC-28)", () => {
    const { rerender } = render(
      <MessageList messages={[agent("a1", "Hej"), user("u1", "Pytanie")]} status="submitted" {...base} />,
    );
    expect(screen.getByText("Asystent pisze…")).toBeInTheDocument();
    rerender(
      <MessageList messages={[agent("a1", "Hej"), user("u1", "Pytanie"), agent("a2", "")]} status="streaming" {...base} />,
    );
    expect(screen.getByText("Asystent pisze…")).toBeInTheDocument();
    rerender(
      <MessageList messages={[agent("a1", "Hej"), user("u1", "Pytanie"), agent("a2", "Odp")]} status="streaming" {...base} />,
    );
    expect(screen.queryByText("Asystent pisze…")).not.toBeInTheDocument();
    rerender(<MessageList messages={[agent("a1", "Hej")]} status="ready" {...base} />);
    expect(screen.queryByText("Asystent pisze…")).not.toBeInTheDocument();
  });

  it("shows the decision change notice for ok:true (AC-31)", () => {
    render(<MessageList messages={[revise(true)]} status="ready" {...base} />);
    expect(screen.getByText("Decyzja zmieniona: Zwrot odrzucony → Zwrot zaakceptowany")).toBeInTheDocument();
    expect(screen.getByText("Klient dostarczył dowód zakupu")).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
  });

  it("shows no notice for ok:false", () => {
    render(<MessageList messages={[revise(false)]} status="ready" {...base} />);
    expect(screen.queryByText(/Decyzja zmieniona/)).not.toBeInTheDocument();
    expect(screen.getByText("Zmieniłem decyzję.")).toBeInTheDocument();
  });

  it("keeps the failed user message with an inline error and Ponów", async () => {
    const onRetry = vi.fn();
    render(
      <MessageList
        messages={[agent("a1", "Hej"), user("u1", "Moje pytanie")]}
        status="error"
        error={new Error("Network")}
        onRetry={onRetry}
        onNewCase={vi.fn()}
      />,
    );
    expect(screen.getByText("Moje pytanie")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ponów" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("on CASE_NOT_FOUND shows the server message and Nowe zgłoszenie instead of Ponów", async () => {
    const onNewCase = vi.fn();
    const body = JSON.stringify({ error: { code: "CASE_NOT_FOUND", message: "Nie znaleziono zgłoszenia." } });
    render(
      <MessageList
        messages={[agent("a1", "Hej"), user("u1", "Pytanie")]}
        status="error"
        error={new Error(body)}
        onRetry={vi.fn()}
        onNewCase={onNewCase}
      />,
    );
    expect(screen.getByText("Nie znaleziono zgłoszenia.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ponów" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nowe zgłoszenie" }));
    expect(onNewCase).toHaveBeenCalledTimes(1);
  });
});

afterEach(cleanup);
