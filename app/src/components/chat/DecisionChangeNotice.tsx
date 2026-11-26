// ADR 002 §7.5, PRD AC-31.
import { DISCLAIMER } from "@/lib/shared/labels";

export { DISCLAIMER };

export function DecisionChangeNotice({
  fromLabel,
  toLabel,
  reason,
}: {
  fromLabel: string;
  toLabel: string;
  reason?: string;
}) {
  return (
    <div className="my-2 rounded-md border border-border-brand bg-tint-pink-subtle p-3 text-sm">
      <p className="font-bold">{`Decyzja zmieniona: ${fromLabel} → ${toLabel}`}</p>
      {reason ? <p className="mt-1">{reason}</p> : null}
      <p className="mt-1 italic text-text-muted">{DISCLAIMER}</p>
    </div>
  );
}
