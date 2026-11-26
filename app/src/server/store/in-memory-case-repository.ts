import "server-only";

import type { Case } from "@/server/domain/case";
import type { Clock } from "@/server/domain/clock";
import type { CaseRepository } from "@/server/domain/ports";

export interface InMemoryCaseRepositoryOptions {
  ttlMinutes: number;
  maxCases: number;
  clock: Clock;
}

export class InMemoryCaseRepository implements CaseRepository {
  private readonly cases = new Map<string, Case>();
  private readonly ttlMs: number;

  constructor(private readonly options: InMemoryCaseRepositoryOptions) {
    this.ttlMs = options.ttlMinutes * 60_000;
  }

  create(c: Case): void {
    const now = this.options.clock.now();
    this.purgeExpired(now);
    this.cases.set(c.id, c);

    while (this.cases.size > this.options.maxCases) {
      this.evictLeastRecentlyAccessed();
    }
  }

  get(id: string): Case | null {
    const now = this.options.clock.now();
    this.purgeExpired(now);

    const stored = this.cases.get(id);
    if (!stored) return null;

    stored.lastAccessAt = now.toISOString();
    return stored;
  }

  update(id: string, mutator: (c: Case) => Case): Case | null {
    const now = this.options.clock.now();
    const stored = this.cases.get(id);
    if (!stored) return null;

    if (this.isExpired(stored, now)) {
      this.cases.delete(id);
      return null;
    }

    const updated = mutator(stored);
    updated.lastAccessAt = now.toISOString();
    this.cases.set(id, updated);
    return updated;
  }

  delete(id: string): void {
    this.cases.delete(id);
  }

  size(): number {
    return this.cases.size;
  }

  tryAcquireChat(id: string): boolean {
    const stored = this.cases.get(id);
    if (!stored) return false;

    const now = this.options.clock.now();
    if (stored.chatInProgress && stored.chatStartedAt !== null) {
      const elapsedMs = now.getTime() - new Date(stored.chatStartedAt).getTime();
      if (elapsedMs < 90_000) return false;
    }

    stored.chatInProgress = true;
    stored.chatStartedAt = now.toISOString();
    return true;
  }

  releaseChat(id: string): void {
    const stored = this.cases.get(id);
    if (!stored) return;

    stored.chatInProgress = false;
    stored.chatStartedAt = null;
  }

  private purgeExpired(now: Date): void {
    for (const [id, stored] of this.cases) {
      if (this.isExpired(stored, now)) this.cases.delete(id);
    }
  }

  private isExpired(stored: Case, now: Date): boolean {
    return now.getTime() - new Date(stored.lastAccessAt).getTime() > this.ttlMs;
  }

  private evictLeastRecentlyAccessed(): void {
    let oldestId: string | undefined;
    let oldestAt = Number.POSITIVE_INFINITY;

    for (const [id, stored] of this.cases) {
      const accessedAt = new Date(stored.lastAccessAt).getTime();
      if (oldestId === undefined || accessedAt < oldestAt) {
        oldestId = id;
        oldestAt = accessedAt;
      }
    }

    if (oldestId !== undefined) this.cases.delete(oldestId);
  }
}
