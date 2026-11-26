"use client";
import { useId } from "react";
import { MIN_PURCHASE_DATE } from "@/lib/shared";
import { FieldError, inputClasses, labelClasses } from "./FieldError";

export interface PurchaseDateInputProps {
  value: string;
  /** ISO date (`YYYY-MM-DD`); the `max` of the native picker. */
  today: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
}

export function PurchaseDateInput({ value, today, onChange, onBlur, error }: PurchaseDateInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={labelClasses}>
        Data zakupu
      </label>
      <input
        id={id}
        type="date"
        name="purchaseDate"
        data-field="purchaseDate"
        value={value}
        min={MIN_PURCHASE_DATE}
        max={today}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClasses}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}
