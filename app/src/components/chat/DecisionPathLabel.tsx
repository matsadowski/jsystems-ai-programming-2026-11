import { DECISION_PATH_LABELS, type DecisionPath } from "@/lib/shared";

export function DecisionPathLabel({ decisionPath }: { decisionPath: DecisionPath }) {
  return <p className="text-sm text-text-muted">{DECISION_PATH_LABELS[decisionPath]}</p>;
}
