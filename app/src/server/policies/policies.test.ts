import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigError } from "@/server/http/errors";
import { getPolicy, loadPolicies, parseClauseIds, resetPolicyCache } from "./policies";

const POLICY_DIR = path.resolve(__dirname, "../../../../docs/policies");

const tempDirs: string[] = [];
afterEach(() => {
  resetPolicyCache();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("parseClauseIds", () => {
  it("collects a bold identifier at the start of a bold span", () => {
    const ids = parseClauseIds("- **C2.1 Covered** — x");
    expect(ids.has("C2.1")).toBe(true);
  });

  it("collects section headings and bold identifiers", () => {
    const ids = parseClauseIds("## R5. Outcomes\n\n- **R1.1** x\n- **C6** not a clause id\n");
    expect(ids).toEqual(new Set(["R5", "R1.1"]));
  });
});

describe("loadPolicies", () => {
  it("loads the return policy and parses its clause IDs", () => {
    const { RETURN } = loadPolicies(POLICY_DIR);
    expect(RETURN.text).toContain("Return Policy");
    for (const id of [
      "R1.1",
      "R1.2",
      "R1.3",
      "R1.4",
      "R2.1",
      "R2.2",
      "R2.3",
      "R2.4",
      "R3.1",
      "R3.2",
      "R4.1",
      "R5",
    ]) {
      expect(RETURN.clauseIds.has(id), id).toBe(true);
    }
  });

  it("loads the complaint policy and parses its clause IDs", () => {
    const { COMPLAINT } = loadPolicies(POLICY_DIR);
    expect(COMPLAINT.text).toContain("Complaint Policy");
    for (const id of [
      "C1.1",
      "C1.2",
      "C1.3",
      "C1.4",
      "C2.1",
      "C2.2",
      "C2.3",
      "C2.4",
      "C3.1",
      "C3.2",
      "C3.3",
      "C3.4",
      "C4.1",
      "C4.2",
      "C4.3",
      "C6",
    ]) {
      expect(COMPLAINT.clauseIds.has(id), id).toBe(true);
    }
  });

  it("computes a stable 12-char lowercase hex version per file", () => {
    const first = loadPolicies(POLICY_DIR);
    const second = loadPolicies(POLICY_DIR);
    for (const key of ["RETURN", "COMPLAINT"] as const) {
      expect(first[key].version).toMatch(/^[0-9a-f]{12}$/);
      expect(second[key].version).toBe(first[key].version);
    }
  });

  it("throws ConfigError naming the missing path", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "policies-"));
    tempDirs.push(dir);
    let error: unknown;
    try {
      loadPolicies(dir);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).detail).toContain(path.join(dir, "return-policy.md"));
  });
});

describe("getPolicy", () => {
  it("returns the requested policy and caches per directory", () => {
    const a = getPolicy("RETURN", POLICY_DIR);
    const b = getPolicy("RETURN", POLICY_DIR);
    expect(a).toBe(b);
    expect(a.clauseIds.has("R1.1")).toBe(true);
  });

  it("reloads after resetPolicyCache", () => {
    const a = getPolicy("COMPLAINT", POLICY_DIR);
    resetPolicyCache();
    const b = getPolicy("COMPLAINT", POLICY_DIR);
    expect(b).not.toBe(a);
    expect(b.version).toBe(a.version);
  });
});
