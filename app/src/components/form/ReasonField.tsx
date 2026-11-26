"use client";
import { useId } from "react";
import { REASON_MAX_LENGTH, type CaseType } from "@/lib/shared";
import { FieldError, inputClasses, labelClasses } from "./FieldError";

export interface ReasonFieldProps {
  value: string;
  caseType?: CaseType;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
}

const HELPER: Record<CaseType, string> = {
  COMPLAINT: "Opisz usterkę: co nie działa, od kiedy, w jakich okolicznościach",
  RETURN: "Opcjonalny powód zwrotu",
};

export function ReasonField({ value, caseType, onChange, onBlur, error }: ReasonFieldProps) {
  const id = useId();
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const marker = caseType === "COMPLAINT" ? "(wymagane)" : caseType === "RETURN" ? "(opcjonalne)" : null;
  const describedBy = [caseType ? helperId : null, error ? errorId : null].filter(Boolean).join(" ");
  const tooLong = value.length > REASON_MAX_LENGTH;
  return (
    <div>
      <label htmlFor={id} className={labelClasses}>
        Powód zgłoszenia{marker ? <span className="font-normal text-text-muted"> {marker}</span> : null}
      </label>
      {caseType ? (
        <p id={helperId} className="mb-1 text-sm text-text-muted">
          {HELPER[caseType]}
        </p>
      ) : null}
      <textarea
        id={id}
        name="reason"
        data-field="reason"
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={inputClasses}
      />
      <div className="flex justify-between gap-3">
        <FieldError id={errorId} message={error} />
        <p className={`ml-auto mt-1 text-sm ${tooLong ? "font-semibold text-status-negative" : "text-text-muted"}`}>
          {value.length}/{REASON_MAX_LENGTH}
        </p>
      </div>
    </div>
  );
}
