"use client";
import { useId } from "react";
import { CATEGORY_LABELS, DEVICE_CATEGORIES, type DeviceCategory } from "@/lib/shared";
import { FieldError, inputClasses, labelClasses } from "./FieldError";

export interface CategorySelectProps {
  value?: DeviceCategory;
  onChange: (value: DeviceCategory | undefined) => void;
  onBlur?: () => void;
  error?: string;
}

export function CategorySelect({ value, onChange, onBlur, error }: CategorySelectProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={labelClasses}>
        Kategoria sprzętu
      </label>
      <select
        id={id}
        name="category"
        data-field="category"
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || undefined) as DeviceCategory | undefined)}
        onBlur={onBlur}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={inputClasses}
      >
        <option value="">Wybierz kategorię</option>
        {DEVICE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
