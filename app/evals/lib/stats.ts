// Small statistics helpers for the eval reports.
/** Nearest-rank percentile (p in 0..100). `null` for an empty input. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

export interface CallStats {
  latencyMs: { p50: number; p95: number } | null;
  /** Mean over calls with a known cost. */
  meanCostUsd: number | null;
  unknownCost: number;
}

export function callStats(latencies: (number | undefined)[], costs: (number | null | undefined)[]): CallStats {
  const lat = latencies.filter((x): x is number => typeof x === "number");
  const known = costs.filter((x): x is number => typeof x === "number");
  return {
    latencyMs: lat.length ? { p50: percentile(lat, 50)!, p95: percentile(lat, 95)! } : null,
    meanCostUsd: known.length ? known.reduce((a, b) => a + b, 0) / known.length : null,
    unknownCost: costs.filter((x) => x === null).length,
  };
}
