// Captures console output so tests can assert what was (not) logged (ADR 001 TAC-001-05).
// The app logger (src/server/log) writes through console.*, so this captures it too.
const METHODS = ["log", "info", "warn", "error", "debug"] as const;

function format(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export interface CapturedLogs {
  lines: string[];
  text(): string;
  restore(): void;
}

export function captureLogs(): CapturedLogs {
  const lines: string[] = [];
  const originals = METHODS.map((m) => [m, console[m]] as const);
  for (const m of METHODS) {
    console[m] = (...args: unknown[]) => {
      lines.push(args.map(format).join(" "));
    };
  }
  return {
    lines,
    text: () => lines.join("\n"),
    restore: () => {
      for (const [m, fn] of originals) console[m] = fn;
    },
  };
}
