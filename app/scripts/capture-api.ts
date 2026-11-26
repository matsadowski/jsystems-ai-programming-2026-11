// Real captures of our own API (ADR 003 amendment A5). Run against a started server:
//   npm run build && npm run start -- --port 3000   (RULES path needs no real OpenRouter key)
//   npm run capture:api            (BASE_URL defaults to http://localhost:3000)
// Each response is saved verbatim as tests/fixtures/api-captures/<name>.json plus <name>.meta.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.resolve(__dirname, "../tests/fixtures/api-captures");
const IMAGES_DIR = path.resolve(__dirname, "../../assets/example-images");
const COMPLAINT_REASON = "Klient zgłasza usterkę urządzenia i prosi o rozpatrzenie reklamacji.";

/** Calendar date (YYYY-MM-DD) in Europe/Warsaw, `days` days and `months` months before today. */
export function purchaseDate(daysAgo: number, monthsAgo = 0, now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(now);
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 - monthsAgo, d - daysAgo));
  return date.toISOString().slice(0, 10);
}

interface Captured {
  status: number;
  headers: { "content-type": string | null; "x-request-id": string | null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

async function save(name: string, target: string, response: Response, request: object, notes: string): Promise<Captured> {
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  const captured: Captured = {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
      "x-request-id": response.headers.get("x-request-id"),
    },
    body,
  };
  const meta = {
    capturedAt: new Date().toISOString(),
    target,
    request,
    server: "next start (local)",
    notes,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(captured, null, 2) + "\n");
  writeFileSync(path.join(OUT_DIR, `${name}.meta.json`), JSON.stringify(meta, null, 2) + "\n");
  console.log(`${name}: ${response.status}`);
  return captured;
}

interface CaseFields {
  caseType: string;
  category: string;
  model?: string;
  purchaseDate: string;
  reason: string;
}

function caseForm(fields: CaseFields, photo: { name: string; bytes: Uint8Array; type: string; sendAs?: string }): FormData {
  const form = new FormData();
  form.set("caseType", fields.caseType);
  form.set("category", fields.category);
  if (fields.model !== undefined) form.set("model", fields.model);
  form.set("purchaseDate", fields.purchaseDate);
  form.set("reason", fields.reason);
  form.set("photo", new Blob([photo.bytes as BlobPart], { type: photo.type }), photo.sendAs ?? photo.name);
  return form;
}

function image(name: string, type: string) {
  return { name, type, bytes: new Uint8Array(readFileSync(path.join(IMAGES_DIR, name))) };
}

function summary(fields: CaseFields, photoName: string) {
  return {
    fields: { ...fields, reason: fields.reason || "(empty)" },
    image: photoName,
  };
}

async function createCase(name: string, fields: CaseFields, photo: ReturnType<typeof image> & { sendAs?: string }, notes: string) {
  const res = await fetch(`${BASE_URL}/api/cases`, { method: "POST", body: caseForm(fields, photo) });
  return save(name, "POST /api/cases", res, summary(fields, photo.sendAs ?? photo.name), notes);
}

async function decide(name: string, caseId: string, notes: string) {
  const res = await fetch(`${BASE_URL}/api/cases/${caseId}/decision`, { method: "POST" });
  return save(name, "POST /api/cases/{caseId}/decision", res, { caseId: "(from the matching create capture)" }, notes);
}

async function main() {
  const rules = "RULES path (purchase date outside the return/complaint window): no model call.";

  const ret = await createCase(
    "create-return-expired-rules",
    { caseType: "RETURN", category: "SMARTPHONE", model: "Smartfon testowy", purchaseDate: purchaseDate(30), reason: "" },
    image("phone-3.jpeg", "image/jpeg"),
    `Return 30 days ago. ${rules}`,
  );
  const retId = ret.body.caseId as string;
  await decide("decide-return-expired-rules", retId, `Decision for the expired return. ${rules}`);
  await decide("decide-return-expired-rules-repeat", retId, "Second decision call for the same case (idempotency): same decision expected.");

  const comp = await createCase(
    "create-complaint-expired-rules",
    { caseType: "COMPLAINT", category: "LAPTOP", model: "Laptop testowy", purchaseDate: purchaseDate(0, 25), reason: COMPLAINT_REASON },
    image("laptop-2.webp", "image/webp"),
    `Complaint 25 months ago. ${rules}`,
  );
  await decide("decide-complaint-expired-rules", comp.body.caseId as string, `Decision for the expired complaint. ${rules}`);

  await createCase(
    "create-validation-error",
    { caseType: "RETURN", category: "SMARTPHONE", purchaseDate: purchaseDate(-5), reason: "" },
    image("phone-1.jpg", "image/jpeg"),
    "Missing model and purchase date in the future: 400 with fieldErrors.",
  );

  await createCase(
    "create-unsupported-media",
    { caseType: "RETURN", category: "SMARTPHONE", model: "Smartfon testowy", purchaseDate: purchaseDate(3), reason: "" },
    {
      name: "x.jpg",
      type: "image/jpeg",
      bytes: new TextEncoder().encode("To nie jest obraz, tylko zwykły tekst.\n"),
    },
    "A plain text file named x.jpg: the server decides by content, 415 expected.",
  );

  await decide("decide-unknown-case", randomUUID(), "Random UUID that was never created: 404 expected.");

  await createCase(
    "create-in-window-ai-unavailable",
    { caseType: "RETURN", category: "SMARTPHONE", model: "Smartfon testowy", purchaseDate: purchaseDate(3), reason: "" },
    image("phone-1.jpg", "image/jpeg"),
    "In-window return needs the vision model; the AI pipeline is not wired yet (or the key is a placeholder), so the server answers 502 AI_UNAVAILABLE. Replace with a real capture once T12b/T14b are wired.",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
