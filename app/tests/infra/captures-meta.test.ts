// Every capture has meta, and no capture contains secrets (ADR 000 TAC-06, AGENTS.md).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPTURE_DIRS,
  REQUIRED_META_KEYS,
  listCaptures,
  loadCaptureMeta,
  type CaptureKind,
} from "../helpers/captures";

const SECRET_PATTERNS = [/sk-or-[A-Za-z0-9-]{8,}/, /Bearer\s+[A-Za-z0-9._-]{16,}/i];

for (const kind of Object.keys(CAPTURE_DIRS) as CaptureKind[]) {
  describe(`${kind} captures`, () => {
    const names = listCaptures(kind);
    it.each(names.length ? names : ["(none yet)"])("%s has meta and no secrets", (name) => {
      if (name === "(none yet)") return;
      const meta = loadCaptureMeta(kind, name);
      for (const key of REQUIRED_META_KEYS) expect(meta, `${name}.meta.json`).toHaveProperty(key);
      for (const file of [`${name}.json`, `${name}.meta.json`]) {
        const text = readFileSync(path.join(CAPTURE_DIRS[kind], file), "utf8");
        for (const p of SECRET_PATTERNS) expect(text, file).not.toMatch(p);
      }
    });
  });
}
