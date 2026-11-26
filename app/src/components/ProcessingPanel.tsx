"use client";

export interface ProcessingPanelProps {
  /** 1 = "Analizuję zdjęcie…", 2 = "Przygotowuję decyzję…" */
  stage: 1 | 2;
}

const STAGES = ["Analizuję zdjęcie…", "Przygotowuję decyzję…"] as const;

export function ProcessingPanel({ stage }: ProcessingPanelProps) {
  return (
    <div className="rounded-lg bg-bg-default p-6 shadow-card">
      {/* Only the current stage is announced. */}
      <p role="status" aria-live="polite" className="sr-only">
        {STAGES[stage - 1]}
      </p>
      <ol className="flex flex-col gap-3">
        {STAGES.map((label, i) => {
          const n = i + 1;
          const done = n < stage;
          const current = n === stage;
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={`flex items-center gap-3 text-base ${current ? "font-bold text-text-primary" : "text-text-muted"}`}
            >
              <span aria-hidden="true" className="flex size-6 items-center justify-center">
                {done ? (
                  <span className="font-bold text-status-positive">✓</span>
                ) : current ? (
                  <span className="size-5 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
                ) : (
                  <span className="size-3 rounded-full border-2 border-border-neutral-strong" />
                )}
              </span>
              <span>{label}</span>
              {done ? <span className="sr-only">(ukończono)</span> : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
