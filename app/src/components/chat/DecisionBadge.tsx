import type { DecisionTone } from "@/lib/shared";

const TONE_CLASSES: Record<DecisionTone, string> = {
  positive: "bg-status-positive-bg text-status-positive border-status-positive",
  negative: "bg-status-negative-bg text-status-negative border-status-negative",
  warning: "bg-status-warning-bg text-status-warning border-status-warning",
};

const ICON_PATHS: Record<DecisionTone, string> = {
  positive: "M5 13l4 4L19 7",
  negative: "M6 6l12 12M18 6L6 18",
  warning: "M12 8v5m0 3.5v.5",
};

/** Label + icon + tone: meaning is never conveyed by color alone (ADR 003 §3.2). */
export function DecisionBadge({ label, tone }: { label: string; tone: DecisionTone }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold ${TONE_CLASSES[tone]}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICON_PATHS[tone]} />
      </svg>
      {label}
    </span>
  );
}
