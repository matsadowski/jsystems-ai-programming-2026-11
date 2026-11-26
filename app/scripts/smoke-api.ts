// Real-stack API smoke (T14b). Run against a started server (this script makes REAL LLM calls
// through the server, so it is run by the orchestrator, never by tests):
//   npm run build && npm run start -- --port 3000
//   npm run smoke:api            (BASE_URL defaults to http://localhost:3000)
// Flow: POST /api/cases -> 201, POST /api/cases/{id}/decision -> 200, POST /api/chat -> streamed.
// Prints status codes, decision values and stream statistics only; saves nothing.
import { readFileSync } from "node:fs";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const IMAGES_DIR = path.resolve(__dirname, "../../assets/example-images");

/** Calendar date (YYYY-MM-DD) in Europe/Warsaw, `daysAgo` days before today. */
function purchaseDate(daysAgo: number, now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(now);
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - daysAgo)).toISOString().slice(0, 10);
}

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  const form = new FormData();
  form.set("caseType", "RETURN");
  form.set("category", "SMARTPHONE");
  form.set("model", "Smartfon testowy");
  form.set("purchaseDate", purchaseDate(3));
  form.set("reason", "");
  const photoName = "phone-1.jpg";
  form.set("photo", new Blob([readFileSync(path.join(IMAGES_DIR, photoName))], { type: "image/jpeg" }), photoName);

  const created = await fetch(`${BASE_URL}/api/cases`, { method: "POST", body: form });
  console.log(`POST /api/cases -> ${created.status}`);
  check("create returns 201", created.status === 201);
  if (created.status !== 201) return;
  const createdBody = (await created.json()) as { caseId: string; decisionPath: string; analysis: { summary: string } | null };
  console.log(`  decisionPath=${createdBody.decisionPath} analysis=${createdBody.analysis ? "yes" : "no"}`);

  const decided = await fetch(`${BASE_URL}/api/cases/${createdBody.caseId}/decision`, { method: "POST" });
  console.log(`POST /api/cases/{id}/decision -> ${decided.status}`);
  check("decision returns 200", decided.status === 200);
  if (decided.status !== 200) return;
  const decidedBody = (await decided.json()) as { decision: { value: string; citedClauses: string[] } };
  console.log(`  decision=${decidedBody.decision.value} clauses=${decidedBody.decision.citedClauses.join(",")}`);

  const chat = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      caseId: createdBody.caseId,
      message: {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: "Dlaczego rekomendujesz tę decyzję? Wymień punkty regulaminu." }],
      },
    }),
  });
  console.log(`POST /api/chat -> ${chat.status} (${chat.headers.get("content-type")})`);
  check("chat returns 200 as an event stream", chat.status === 200 && (chat.headers.get("content-type") ?? "").includes("text/event-stream"));
  if (chat.status !== 200 || !chat.body) return;

  const body = await chat.text();
  const textDeltas = (body.match(/"type":"text-delta"/g) ?? []).length;
  console.log(`  text-delta chunks=${textDeltas}`);
  check("stream carries text", textDeltas > 0);
  check("stream carries decision metadata on finish", /"messageMetadata":\{"decision":\{"value":"[A-Z_]+"/.test(body));
  check("no error chunk", !body.includes('"type":"error"'));
}

main()
  .catch((error: unknown) => {
    console.error(`smoke failed: ${error instanceof Error ? error.message : String(error)}`);
    failures++;
  })
  .finally(() => {
    console.log(failures === 0 ? "SMOKE OK" : `SMOKE FAILED (${failures})`);
    process.exit(failures === 0 ? 0 : 1);
  });
