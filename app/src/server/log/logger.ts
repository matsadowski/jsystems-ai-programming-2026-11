// Structured, redacting logger (ADR 001 §5.4). One JSON line per call via console.* so tests can
// capture it. Callers pass lengths, never reason text or image data.
const SECRET_VALUE = /sk-or-[\w-]+/g;
const SECRET_KEY = /api[-_]?key|authorization|token|(^|[-_])key$/i;
const BASE64_LIKE = /^[A-Za-z0-9+/=_-]+$/;
const LONG = 500;

function redactString(s: string): string {
  if (s.length > LONG && (s.startsWith("data:") || BASE64_LIKE.test(s))) {
    return `[REDACTED_BASE64 len=${s.length}]`;
  }
  return s.replace(SECRET_VALUE, "[REDACTED]");
}

function redact(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SECRET_KEY.test(k) ? "[REDACTED]" : redact(v, seen);
  }
  return out;
}

type Level = "info" | "warn" | "error";

function write(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const safe = redact({ ...fields }, new WeakSet()) as Record<string, unknown>;
  let line: string;
  try {
    line = JSON.stringify({ level, event: redactString(event), ...safe });
  } catch {
    line = JSON.stringify({ level, event: redactString(event), logError: "unserializable fields" });
  }
  console[level](line);
}

export const logger = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
