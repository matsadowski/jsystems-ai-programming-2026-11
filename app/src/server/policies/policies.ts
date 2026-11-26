import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ConfigError } from "@/server/http/errors";

export type PolicyCaseType = "RETURN" | "COMPLAINT";

export interface Policy {
  text: string;
  version: string;
  clauseIds: ReadonlySet<string>;
}

const POLICY_FILES: Record<PolicyCaseType, string> = {
  RETURN: "return-policy.md",
  COMPLAINT: "complaint-policy.md",
};

const BOLD_CLAUSE = /\*\*([RC]\d+\.\d+)\b/g;
const SECTION_CLAUSE = /^##\s+([RC]\d+)\./gm;

/** Collects bold clause identifiers (`**R1.1**`, `**C2.1 Covered**`) and section headings (`## R1.`). */
export function parseClauseIds(markdown: string): Set<string> {
  const ids = new Set<string>();
  for (const match of markdown.matchAll(BOLD_CLAUSE)) ids.add(match[1]);
  for (const match of markdown.matchAll(SECTION_CLAUSE)) ids.add(match[1]);
  return ids;
}

function loadPolicyFile(caseType: PolicyCaseType, policyDir: string): Policy {
  const filePath = path.join(/* turbopackIgnore: true */ policyDir, POLICY_FILES[caseType]);
  let text: string;
  try {
    text = readFileSync(/* turbopackIgnore: true */ filePath, "utf8");
  } catch (cause) {
    throw new ConfigError({ detail: `Missing policy file: ${filePath}`, cause });
  }
  const version = createHash("sha256").update(text, "utf8").digest("hex").slice(0, 12);
  return { text, version, clauseIds: parseClauseIds(text) };
}

export function loadPolicies(policyDir: string): { RETURN: Policy; COMPLAINT: Policy } {
  return {
    RETURN: loadPolicyFile("RETURN", policyDir),
    COMPLAINT: loadPolicyFile("COMPLAINT", policyDir),
  };
}

const cache = new Map<string, { RETURN: Policy; COMPLAINT: Policy }>();

export function getPolicy(caseType: PolicyCaseType, policyDir: string): Policy {
  const key = path.resolve(policyDir);
  let policies = cache.get(key);
  if (!policies) {
    policies = loadPolicies(policyDir);
    cache.set(key, policies);
  }
  return policies[caseType];
}

export function resetPolicyCache(): void {
  cache.clear();
}
