// Consistency across the 3 runs of a matrix cell (ADR 002 section 6.3). Reported, never a hard failure.
export const AGREEMENT_TARGET = 2 / 3;

export interface CellAgreement {
  cellId: string;
  runs: number;
  modalDecision: string;
  agreeing: number;
  rate: number;
  meetsTarget: boolean;
}

/** Per cell (in first-seen order): share of runs that gave the most common final decision. */
export function agreementByCell(runs: { cellId: string; decision: string }[]): CellAgreement[] {
  const cells = new Map<string, Map<string, number>>();
  for (const { cellId, decision } of runs) {
    const counts = cells.get(cellId) ?? new Map<string, number>();
    counts.set(decision, (counts.get(decision) ?? 0) + 1);
    cells.set(cellId, counts);
  }
  return [...cells].map(([cellId, counts]) => {
    // Map keeps insertion order, so ties resolve to the first-seen decision.
    const [modalDecision, agreeing] = [...counts].reduce((a, b) => (b[1] > a[1] ? b : a));
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    const rate = agreeing / total;
    return { cellId, runs: total, modalDecision, agreeing, rate, meetsTarget: rate >= AGREEMENT_TARGET - 1e-9 };
  });
}
