"use client";
import { useId } from "react";
import { CASE_TYPES, CASE_TYPE_LABELS, type CaseType } from "@/lib/shared";
import { FieldError } from "./FieldError";

export interface CaseTypeSelectorProps {
  value?: CaseType;
  onChange: (value: CaseType) => void;
  onBlur?: () => void;
  error?: string;
}

export function CaseTypeSelector({ value, onChange, onBlur, error }: CaseTypeSelectorProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} data-field="caseType">
      <legend className="mb-1 text-base font-bold text-text-primary">Typ zgłoszenia</legend>
      <div className="grid grid-cols-2 gap-3">
        {CASE_TYPES.map((type) => (
          <label
            key={type}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 border-border-default bg-bg-default px-4 py-3 text-base font-bold has-[:checked]:border-brand-primary has-[:checked]:bg-tint-pink has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
          >
            <input
              type="radio"
              name="caseType"
              value={type}
              checked={value === type}
              onChange={() => onChange(type)}
              onBlur={onBlur}
              className="size-5 accent-brand-primary"
            />
            {CASE_TYPE_LABELS[type]}
          </label>
        ))}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
