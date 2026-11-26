// @vitest-environment jsdom
// CaseApp component tests (ADR 003 §3.1, §8, amendment A5). `fetch` is stubbed with responses built
// ONLY from real captures of our own API (tests/fixtures/api-captures); no /api/chat request is made.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exampleImage } from "../../tests/helpers/example-images";
import { loadCapture } from "../../tests/helpers/captures";
import { CaseApp } from "./CaseApp";

interface Capture {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

const cap = (name: string) => loadCapture<Capture>("api", name);

function toResponse(c: Capture): Response {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.headers)) if (v) headers[k] = v;
  return new Response(JSON.stringify(c.body), { status: c.status, headers });
}

interface Call {
  url: string;
  body: BodyInit | null | undefined;
}

/** Stubs fetch: `script` returns the capture name for each call (by order of the matching endpoint). */
function stubApi(script: (call: Call, n: number) => string | Promise<string>) {
  const calls: Call[] = [];
  const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = { url: String(input), body: init?.body };
    calls.push(call);
    if (call.url.includes("/api/chat")) throw new Error("useChat must not send in these tests");
    return toResponse(cap(await script(call, calls.length - 1)));
  });
  vi.stubGlobal("fetch", fetchStub);
  return calls;
}

const isCreate = (c: Call) => c.url === "/api/cases";
const isDecision = (c: Call) => c.url.endsWith("/decision");

let revoke: ReturnType<typeof vi.fn>;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  let n = 0;
  revoke = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => `blob:photo-${++n}`), configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revoke, configurable: true, writable: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const user = () => userEvent.setup({ applyAccept: false });
const submitButton = () => screen.getByRole("button", { name: "Przeanalizuj zgłoszenie" });

async function fillAndSubmit(u: ReturnType<typeof user>, container: HTMLElement) {
  await u.click(screen.getByRole("radio", { name: "Zwrot" }));
  await u.selectOptions(screen.getByLabelText("Kategoria sprzętu"), "SMARTPHONE");
  await u.type(screen.getByLabelText("Nazwa / model"), "Smartfon testowy");
  fireEvent.change(screen.getByLabelText("Data zakupu"), { target: { value: "2026-10-27" } });
  await u.upload(
    container.querySelector<HTMLInputElement>('input[type="file"]')!,
    new File([new Uint8Array(exampleImage("phone-3.jpeg"))], "phone-3.jpeg", { type: "image/jpeg" }),
  );
  await u.click(submitButton());
}

describe("CaseApp", () => {
  it("renders the empty form with the heading and no new-case button", () => {
    stubApi(() => {
      throw new Error("no request expected");
    });
    render(<CaseApp />);
    expect(screen.getByRole("heading", { level: 1, name: "Nowe zgłoszenie" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nowe zgłoszenie" })).not.toBeInTheDocument();
  });

  it("happy RULES flow: stage 1, stage 2, then the chat screen with the rules decision", async () => {
    let releaseCreate!: () => void;
    let releaseDecision!: () => void;
    const createGate = new Promise<void>((r) => (releaseCreate = r));
    const decisionGate = new Promise<void>((r) => (releaseDecision = r));
    const calls = stubApi(async (call) => {
      if (isCreate(call)) {
        await createGate;
        return "create-return-expired-rules";
      }
      await decisionGate;
      return "decide-return-expired-rules";
    });
    const u = user();
    const { container } = render(<CaseApp />);
    await fillAndSubmit(u, container);

    const stage1 = screen.getByRole("status");
    expect(stage1).toHaveTextContent("Analizuję zdjęcie…");
    expect(submitButton()).toBeDisabled();
    releaseCreate();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Przygotowuję decyzję…"));
    releaseDecision();

    expect(await screen.findByText("Zwrot odrzucony", { selector: "*" })).toBeInTheDocument();
    expect(screen.getByText("Reguła terminu")).toBeInTheDocument();
    expect(screen.getByText("Zdjęcie nie było analizowane — termin minął")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Decyzja: Zwrot odrzucony" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Uzasadnienie" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kolejne kroki" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nowe zgłoszenie" })).toBeInTheDocument();
    // Each screen has exactly one level-1 heading (ADR 003 §3.6 accessibility).
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Rozmowa o zgłoszeniu");

    const caseId = (cap("create-return-expired-rules").body as { caseId: string }).caseId;
    expect(calls.map((c) => c.url)).toEqual(["/api/cases", `/api/cases/${caseId}/decision`]);
  });

  it("sends enum constants, never Polish labels (ADR 003 §5)", async () => {
    const calls = stubApi((call) => (isCreate(call) ? "create-return-expired-rules" : "decide-return-expired-rules"));
    const u = user();
    const { container } = render(<CaseApp />);
    await fillAndSubmit(u, container);
    await screen.findByText("Reguła terminu");

    const create = calls.find(isCreate)!;
    const form = create.body as FormData;
    expect(form.get("caseType")).toBe("RETURN");
    expect(form.get("category")).toBe("SMARTPHONE");
    expect(form.get("model")).toBe("Smartfon testowy");
    expect(form.get("purchaseDate")).toBe("2026-10-27");
    expect(form.get("photo")).toBeInstanceOf(File);
    for (const call of calls) {
      const text = call.body instanceof FormData ? [...call.body.entries()].filter(([k]) => k !== "photo").map(([, v]) => String(v)).join("|") : String(call.body ?? "");
      expect(text).not.toMatch(/Zwrot|Reklamacja|Smartfon\b(?! testowy)/);
    }
    expect(calls.find(isDecision)!.body ?? undefined).toBeUndefined();
  });

  it("decision 504: banner with the AC-33 text, data and photo kept, retry calls only /decision", async () => {
    const outcomes = ["decide-ai-timeout-derived", "decide-return-expired-rules"];
    const calls = stubApi((call) => (isCreate(call) ? "create-return-expired-rules" : outcomes.shift()!));
    const u = user();
    const { container } = render(<CaseApp />);
    await fillAndSubmit(u, container);

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Nie udało się przygotować decyzji. Spróbuj ponownie.");
    expect(screen.getByLabelText("Nazwa / model")).toHaveValue("Smartfon testowy");
    expect(screen.getByLabelText("Data zakupu")).toHaveValue("2026-10-27");
    expect(screen.getByText("phone-3.jpeg")).toBeInTheDocument();
    expect(revoke).not.toHaveBeenCalled();

    await u.click(within(banner).getByRole("button", { name: "Spróbuj ponownie" }));
    expect(await screen.findByText("Reguła terminu")).toBeInTheDocument();
    expect(calls.filter(isCreate)).toHaveLength(1);
    expect(calls.filter(isDecision)).toHaveLength(2);
    expect(calls[1].url).toBe(calls[2].url);
  });

  it("after a 404 on the decision retry, the next retry resubmits /api/cases", async () => {
    const decisions = ["decide-ai-timeout-derived", "decide-unknown-case"];
    const calls = stubApi((call) => (isCreate(call) ? "create-return-expired-rules" : decisions.shift() ?? "decide-return-expired-rules"));
    const u = user();
    const { container } = render(<CaseApp />);
    await fillAndSubmit(u, container);

    await u.click(await screen.findByRole("button", { name: "Spróbuj ponownie" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Sesja zgłoszenia wygasła"));
    expect(calls.map((c) => (isCreate(c) ? "create" : "decision"))).toEqual(["create", "decision", "decision"]);

    await u.click(screen.getByRole("button", { name: "Spróbuj ponownie" }));
    expect(await screen.findByText("Reguła terminu")).toBeInTheDocument();
    expect(calls.map((c) => (isCreate(c) ? "create" : "decision"))).toEqual(["create", "decision", "decision", "create", "decision"]);
  });

  it("400 with fieldErrors: message under the field, no banner", async () => {
    stubApi(() => "create-validation-error");
    const u = user();
    const { container } = render(<CaseApp />);
    await fillAndSubmit(u, container);

    const fieldErrors = (cap("create-validation-error").body as { error: { fieldErrors: Record<string, string> } }).error.fieldErrors;
    expect(await screen.findByText(fieldErrors.model)).toBeInTheDocument();
    expect(screen.getByLabelText("Nazwa / model")).toHaveAccessibleDescription(fieldErrors.model);
    expect(screen.queryByRole("button", { name: "Spróbuj ponownie" })).not.toBeInTheDocument();
    expect(screen.queryByText("Popraw zaznaczone pola")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nazwa / model")).toHaveValue("Smartfon testowy");
  });

  it("new case: confirm resets to an empty form and revokes the object URL; cancel keeps the chat", async () => {
    stubApi((call) => (isCreate(call) ? "create-return-expired-rules" : "decide-return-expired-rules"));
    const u = user();
    const { container } = render(<CaseApp />);
    await fillAndSubmit(u, container);
    await screen.findByText("Reguła terminu");

    await u.click(screen.getByRole("button", { name: "Nowe zgłoszenie" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Bieżąca rozmowa zostanie utracona.");
    await u.click(within(dialog).getByRole("button", { name: "Anuluj" }));
    expect(screen.getByText("Reguła terminu")).toBeInTheDocument();
    expect(revoke).not.toHaveBeenCalled();

    await u.click(screen.getByRole("button", { name: "Nowe zgłoszenie" }));
    await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Rozpocznij nowe" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Nowe zgłoszenie" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nazwa / model")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Zwrot" })).not.toBeChecked();
    expect(revoke).toHaveBeenCalledWith("blob:photo-1");
    expect(screen.queryByText("Reguła terminu")).not.toBeInTheDocument();
  });
});
