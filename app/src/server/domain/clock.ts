/** Injected time source. Production uses `systemClock`; tests use a fixed clock. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };
