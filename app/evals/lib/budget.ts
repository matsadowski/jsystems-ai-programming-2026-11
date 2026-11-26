// Cost budget for the eval run (ADR 002 section 6.3, amendment A4: EVAL_MAX_COST_USD).
// The runner calls `canSpend(estimate)` before every model call and `record(cost)` after it.
export interface Budget {
  readonly maxUsd: number;
  readonly spent: number;
  readonly stopped: boolean;
  readonly stopReason: string | null;
  /** Calls whose cost OpenRouter did not report (counted as 0 spent). */
  readonly unknownCostCalls: number;
  /** True when the call fits. When it does not, the budget becomes stopped (sticky). */
  canSpend(estimateUsd: number): boolean;
  record(costUsd: number | null): void;
}

export function createBudget(maxUsd: number): Budget {
  if (!Number.isFinite(maxUsd) || maxUsd < 0) throw new Error(`Invalid eval budget: ${maxUsd}`);
  let spent = 0;
  let unknownCostCalls = 0;
  let stopReason: string | null = null;
  const stop = (reason: string) => {
    stopReason ??= reason;
  };
  return {
    maxUsd,
    get spent() {
      return spent;
    },
    get stopped() {
      return stopReason !== null;
    },
    get stopReason() {
      return stopReason;
    },
    get unknownCostCalls() {
      return unknownCostCalls;
    },
    canSpend(estimateUsd) {
      if (stopReason !== null) return false;
      // Small epsilon: summing floats must not stop a run that sits exactly on the budget.
      if (spent + estimateUsd > maxUsd + 1e-9) {
        stop(`Next call (estimated $${estimateUsd}) would exceed EVAL_MAX_COST_USD=${maxUsd}; spent $${spent.toFixed(4)}`);
        return false;
      }
      return true;
    },
    record(costUsd) {
      if (costUsd === null) {
        unknownCostCalls += 1;
        return;
      }
      spent += costUsd;
      if (spent > maxUsd + 1e-9) stop(`Spent $${spent.toFixed(4)} exceeded EVAL_MAX_COST_USD=${maxUsd}`);
    },
  };
}
