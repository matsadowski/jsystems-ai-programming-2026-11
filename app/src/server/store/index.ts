import "server-only";

import type { CaseRepository } from "@/server/domain/ports";
import { systemClock } from "@/server/domain/clock";
import { InMemoryCaseRepository } from "./in-memory-case-repository";

export interface CaseRepositoryConfig {
  ttlMinutes?: number;
  maxCases?: number;
}

export function getCaseRepository(config: CaseRepositoryConfig = {}): CaseRepository {
  const globalStore = globalThis as typeof globalThis & {
    __hsdcCaseRepository?: CaseRepository;
  };
  return (globalStore.__hsdcCaseRepository ??= new InMemoryCaseRepository({
    ttlMinutes: config.ttlMinutes ?? 120,
    maxCases: config.maxCases ?? 200,
    clock: systemClock,
  }));
}
