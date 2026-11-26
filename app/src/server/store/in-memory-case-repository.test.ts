import { afterEach, describe, expect, it } from "vitest";
import type { Case } from "@/server/domain/case";
import { fixedClock } from "../../../tests/helpers/clock";
import { getCaseRepository } from "./index";
import { InMemoryCaseRepository } from "./in-memory-case-repository";

const START = "2026-11-26T12:00:00.000Z";

function makeCase(id: string, lastAccessAt = START): Case {
  return {
    id,
    status: "ANALYZED",
    input: {
      caseType: "RETURN",
      category: "LAPTOP",
      model: "ThinkPad T14",
      purchaseDate: "2026-11-20",
      reason: "",
    },
    imageMeta: {
      originalFormat: "jpeg",
      originalWidth: 800,
      originalHeight: 600,
      originalByteSize: 12_000,
      width: 800,
      height: 600,
      byteSize: 10_000,
    },
    analysis: null,
    facts: {
      submissionDate: "2026-11-26",
      daysSincePurchase: 6,
      windowDays: 14,
      withinWindow: true,
      deadOnArrivalWindow: false,
    },
    decision: null,
    decisionHistory: [],
    messages: [],
    policyVersion: "test-policy",
    promptVersions: { vision: "v1", decision: "v1", chat: "v1" },
    decisionPath: "LLM",
    lunaAssessment: null,
    shadow: null,
    chatInProgress: false,
    chatStartedAt: null,
    createdAt: START,
    lastAccessAt,
  };
}

describe("InMemoryCaseRepository", () => {
  it("purges entries beyond the TTL and refreshes TTL when a case is accessed", () => {
    const clock = fixedClock(START);
    const repository = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 10, clock });

    repository.create(makeCase("expired"));
    clock.advanceMinutes(121);
    expect(repository.get("expired")).toBeNull();

    repository.create(makeCase("active", clock.now().toISOString()));
    clock.advanceMinutes(119);
    expect(repository.get("active")).not.toBeNull();
    clock.advanceMinutes(119);
    expect(repository.get("active")).not.toBeNull();
    clock.advanceMinutes(120);
    expect(repository.get("active")).not.toBeNull();
    clock.advanceMinutes(120);
    clock.advanceMs(1);
    expect(repository.get("active")).toBeNull();
  });

  it("evicts the least recently accessed case when capacity is exceeded", () => {
    const clock = fixedClock(START);
    const repository = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 3, clock });
    repository.create(makeCase("one"));
    clock.advanceMinutes(1);
    repository.create(makeCase("two", clock.now().toISOString()));
    clock.advanceMinutes(1);
    repository.create(makeCase("three", clock.now().toISOString()));

    clock.advanceMinutes(1);
    expect(repository.get("one")).not.toBeNull();
    clock.advanceMinutes(1);
    repository.create(makeCase("four", clock.now().toISOString()));

    expect(repository.size()).toBe(3);
    expect(repository.get("one")).not.toBeNull();
    expect(repository.get("two")).toBeNull();
    expect(repository.get("three")).not.toBeNull();
    expect(repository.get("four")).not.toBeNull();
  });

  it("updates a case synchronously and returns null for an unknown id", () => {
    const clock = fixedClock(START);
    const repository = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 10, clock });
    repository.create(makeCase("case-1"));

    const updated = repository.update("case-1", (item) => ({
      ...item,
      input: { ...item.input, model: "Updated model" },
    }));

    expect(updated?.input.model).toBe("Updated model");
    expect(updated?.lastAccessAt).toBe(START);
    expect(repository.update("missing", (item) => item)).toBeNull();
  });

  it("acquires, rejects a concurrent chat, takes over stale flags and releases the lock", () => {
    const clock = fixedClock(START);
    const repository = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 10, clock });
    repository.create(makeCase("case-1"));

    expect(repository.tryAcquireChat("case-1")).toBe(true);
    expect(repository.tryAcquireChat("case-1")).toBe(false);
    clock.advanceMs(91_000);
    expect(repository.tryAcquireChat("case-1")).toBe(true);
    repository.releaseChat("case-1");
    expect(repository.tryAcquireChat("case-1")).toBe(true);
    expect(repository.tryAcquireChat("missing")).toBe(false);
  });

  it("returns one global repository and uses the supplied capacity on first creation", () => {
    const globalStore = globalThis as typeof globalThis & { __hsdcCaseRepository?: unknown };
    delete globalStore.__hsdcCaseRepository;

    const first = getCaseRepository({ ttlMinutes: 120, maxCases: 3 });
    const second = getCaseRepository({ ttlMinutes: 120, maxCases: 1 });

    expect(first).toBe(second);
    const accessAt = new Date().toISOString();
    first.create(makeCase("one", accessAt));
    first.create(makeCase("two", accessAt));
    first.create(makeCase("three", accessAt));
    first.create(makeCase("four", accessAt));
    expect(first.size()).toBe(3);
    expect(first.get("one")).toBeNull();
    delete globalStore.__hsdcCaseRepository;
  });

  it("returns null for update when the stored case has expired", () => {
    const clock = fixedClock(START);
    const repository = new InMemoryCaseRepository({ ttlMinutes: 120, maxCases: 10, clock });
    repository.create(makeCase("expired"));
    clock.advanceMinutes(121);

    expect(repository.update("expired", (item) => item)).toBeNull();
    expect(repository.size()).toBe(0);
  });
});

afterEach(() => {
  const globalStore = globalThis as typeof globalThis & { __hsdcCaseRepository?: unknown };
  delete globalStore.__hsdcCaseRepository;
});
