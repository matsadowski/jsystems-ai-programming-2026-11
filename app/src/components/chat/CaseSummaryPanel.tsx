"use client";

import { useRef } from "react";
import type { AnalysisDTO, AssessmentDTO, AssessmentItemDTO, CaseSummary, DecisionDTO } from "@/lib/shared";
import { DecisionBadge } from "./DecisionBadge";
import { DecisionPathLabel } from "./DecisionPathLabel";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function itemText(i: AssessmentItemDTO) {
  return i.certaintyPct === null ? `${i.label}: ${i.answerLabel}` : `${i.label}: ${i.answerLabel} — ${i.certaintyPct}%`;
}

function AssessmentSection({
  analysis,
  assessment,
  decision,
}: {
  analysis: AnalysisDTO | null;
  assessment: AssessmentDTO | null;
  decision: DecisionDTO;
}) {
  const path = decision.decisionPath;
  if (path === "RULES") {
    return <p>Zdjęcie nie było analizowane — termin minął</p>;
  }
  if (path === "FAST") {
    return (
      <div>
        <h3 className="font-bold">Ocena automatyczna</h3>
        <ul className="mt-1 list-disc pl-5">
          {(assessment?.items ?? []).map((i) => (
            <li key={i.key}>{itemText(i)}</li>
          ))}
        </ul>
      </div>
    );
  }
  const uncertain = (assessment?.items ?? []).filter((i) => assessment?.uncertainKeys.includes(i.key));
  return (
    <div>
      <h3 className="font-bold">Opis zdjęcia (AI)</h3>
      <p className="mt-1">{analysis?.summary}</p>
      {path === "LLM_ESCALATED" && uncertain.length > 0 ? (
        <div className="mt-2">
          <h4 className="font-bold">Niepewne elementy oceny wstępnej</h4>
          <ul className="mt-1 list-disc pl-5">
            {uncertain.map((i) => (
              <li key={i.key}>{itemText(i)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CaseSummaryPanel({
  caseSummary,
  analysis,
  assessment,
  decision,
  photoPreviewUrl,
}: {
  caseSummary: CaseSummary;
  analysis: AnalysisDTO | null;
  assessment: AssessmentDTO | null;
  decision: DecisionDTO;
  photoPreviewUrl: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  return (
    <section aria-label="Podsumowanie zgłoszenia" className="space-y-4 rounded-lg bg-bg-default p-4 shadow-card">
      {photoPreviewUrl ? (
        <>
          <button
            type="button"
            aria-label="Powiększ zdjęcie"
            onClick={() => dialogRef.current?.showModal()}
            className="block min-h-11 w-full overflow-hidden rounded-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={photoPreviewUrl} alt="Zdjęcie urządzenia" className="h-40 w-full object-cover" />
          </button>
          <dialog ref={dialogRef} className="m-auto max-w-[90vw] rounded-lg p-2 backdrop:bg-bg-overlay-strong">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img src={photoPreviewUrl} alt="Zdjęcie urządzenia (powiększone)" className="max-h-[80vh] max-w-full" />
            <form method="dialog" className="mt-2 text-right">
              <button className="min-h-11 rounded-lg border border-border-brand px-4 font-bold text-text-brand">Zamknij</button>
            </form>
          </dialog>
        </>
      ) : null}

      <div className="space-y-1">
        <DecisionBadge label={decision.label} tone={decision.tone} />
        <DecisionPathLabel decisionPath={decision.decisionPath} />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-text-muted">Rodzaj</dt>
        <dd>{caseSummary.caseTypeLabel}</dd>
        <dt className="text-text-muted">Kategoria</dt>
        <dd>{caseSummary.categoryLabel}</dd>
        <dt className="text-text-muted">Model</dt>
        <dd>{caseSummary.model}</dd>
        <dt className="text-text-muted">Data zakupu</dt>
        <dd>{`${formatDate(caseSummary.purchaseDate)} (${decision.daysSincePurchase} dni temu)`}</dd>
      </dl>

      <details open className="text-sm">
        <summary className="min-h-11 cursor-pointer font-bold">Ocena zdjęcia</summary>
        <AssessmentSection analysis={analysis} assessment={assessment} decision={decision} />
      </details>
    </section>
  );
}
