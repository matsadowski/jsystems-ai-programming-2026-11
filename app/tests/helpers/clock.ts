// Injectable clock for tests. Production code receives a `{ now(): Date }` clock instead of
// calling `new Date()` directly (TTL, "today" in Europe/Warsaw, busy-flag expiry).
export interface TestClock {
  now(): Date;
  set(iso: string): void;
  advanceMs(ms: number): void;
  advanceMinutes(minutes: number): void;
}

export function fixedClock(iso: string): TestClock {
  let current = new Date(iso).getTime();
  return {
    now: () => new Date(current),
    set: (next) => {
      current = new Date(next).getTime();
    },
    advanceMs: (ms) => {
      current += ms;
    },
    advanceMinutes: (minutes) => {
      current += minutes * 60_000;
    },
  };
}
