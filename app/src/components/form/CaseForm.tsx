"use client";
// CaseForm — the case form screen (PRD §9.2, ADR 003 §3.2).
//
// API for CaseApp (T18). Controlled: the parent owns values, photo and server errors (reducer in
// ../case-app-reducer.ts); the form keeps only UI state (touched fields, submit attempt).
//
//   values          FormValues             current field values
//   photo           PhotoState | null      current photo (PhotoDropzone creates/revokes its object URL)
//   onValuesChange  (patch) => void        dispatch EDIT_VALUES
//   onPhotoChange   (photo|null) => void   dispatch PHOTO_CHANGED
//   onSubmit        (values: CaseInput, photoFile: File) => void
//                   called ONLY when the whole form (incl. photo) is valid; values are parsed/trimmed
//   fieldErrors?    FieldErrors            server field errors (shown immediately; first is focused)
//   bannerError?    { message }            general banner above the submit button (AC-33)
//   onRetry?        () => void             "Spróbuj ponownie" in the banner
//   disabled?       boolean                processing: fieldset and buttons locked (AC-12)
//   today?          string (ISO)           injectable "today" (default: Europe/Warsaw)
//
// Client errors appear after blur or after a submit attempt (AC-11); after a failed submit focus
// moves to the first invalid field.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  COMPLAINT_REASON_MIN_LENGTH,
  VALIDATION_MESSAGES,
  makeCaseInputSchema,
  toFieldErrors,
  todayInZone,
  type CaseInput,
} from "@/lib/shared";
import { ErrorBanner } from "../ErrorBanner";
import { CaseTypeSelector } from "./CaseTypeSelector";
import { CategorySelect } from "./CategorySelect";
import { FieldError, inputClasses, labelClasses } from "./FieldError";
import { PhotoDropzone } from "./PhotoDropzone";
import { PurchaseDateInput } from "./PurchaseDateInput";
import { ReasonField } from "./ReasonField";
import { FIELD_ORDER, type BannerError, type FieldErrors, type FieldKey, type FormValues, type PhotoState } from "./types";

export interface CaseFormProps {
  values: FormValues;
  photo: PhotoState | null;
  onValuesChange: (patch: Partial<FormValues>) => void;
  onPhotoChange: (photo: PhotoState | null) => void;
  onSubmit: (values: CaseInput, photoFile: File) => void;
  fieldErrors?: FieldErrors;
  bannerError?: BannerError;
  onRetry?: () => void;
  disabled?: boolean;
  today?: string;
}

const APP_TIMEZONE = "Europe/Warsaw";

function focusField(form: HTMLFormElement | null, field: FieldKey) {
  form?.querySelector<HTMLElement>(`[data-field="${field}"] input, input[data-field="${field}"], select[data-field="${field}"], textarea[data-field="${field}"], button[data-field="${field}"]`)?.focus();
}

export function CaseForm({
  values,
  photo,
  onValuesChange,
  onPhotoChange,
  onSubmit,
  fieldErrors = {},
  bannerError,
  onRetry,
  disabled = false,
  today: todayProp,
}: CaseFormProps) {
  const [fallbackToday] = useState(() => todayInZone(new Date(), APP_TIMEZONE));
  const today = todayProp ?? fallbackToday;
  const formRef = useRef<HTMLFormElement>(null);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const schema = useMemo(() => makeCaseInputSchema(today), [today]);
  const parsed = schema.safeParse(values);
  const clientErrors: FieldErrors = parsed.success ? {} : (toFieldErrors(parsed.error) as FieldErrors);
  // The shared schema's cross-field rule (reason required for complaints) only runs when all
  // other fields are valid, so show it independently here.
  if (
    !clientErrors.reason &&
    values.caseType === "COMPLAINT" &&
    values.reason.trim().length < COMPLAINT_REASON_MIN_LENGTH
  ) {
    clientErrors.reason = VALIDATION_MESSAGES.reasonComplaint;
  }
  if (!photo) clientErrors.photo = VALIDATION_MESSAGES.photoRequired;
  const valid = parsed.success && photo !== null && !clientErrors.reason;

  const errorFor = (field: FieldKey): string | undefined =>
    fieldErrors[field] ?? (submitAttempted || touched[field] ? clientErrors[field] : undefined);
  const touch = (field: FieldKey) => () => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  // Server field errors: focus the first one.
  useEffect(() => {
    const first = FIELD_ORDER.find((f) => fieldErrors[f]);
    if (first) focusField(formRef.current, first);
  }, [fieldErrors]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    if (!parsed.success || !photo) {
      setSubmitAttempted(true);
      const invalid = FIELD_ORDER.filter((f) => clientErrors[f]);
      setAnnouncement(`Formularz zawiera błędy: ${invalid.map((f) => clientErrors[f]).join(". ")}`);
      if (invalid[0]) focusField(formRef.current, invalid[0]);
      return;
    }
    setAnnouncement("");
    onSubmit(parsed.data, photo.file);
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Nowe zgłoszenie</h1>
        <p className="text-base text-text-secondary">
          Uzupełnij dane zgłoszenia i dodaj zdjęcie sprzętu, a przygotuję decyzję.
        </p>
      </div>
      <div aria-live="assertive" className="sr-only">
        {announcement}
      </div>
      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-6">
        <CaseTypeSelector
          value={values.caseType}
          onChange={(caseType) => {
            touch("caseType")();
            onValuesChange({ caseType });
          }}
          onBlur={touch("caseType")}
          error={errorFor("caseType")}
        />
        <CategorySelect
          value={values.category}
          onChange={(category) => onValuesChange({ category })}
          onBlur={touch("category")}
          error={errorFor("category")}
        />
        <ModelInput
          value={values.model}
          onChange={(model) => onValuesChange({ model })}
          onBlur={touch("model")}
          error={errorFor("model")}
        />
        <PurchaseDateInput
          value={values.purchaseDate}
          today={today}
          onChange={(purchaseDate) => onValuesChange({ purchaseDate })}
          onBlur={touch("purchaseDate")}
          error={errorFor("purchaseDate")}
        />
        <ReasonField
          value={values.reason}
          caseType={values.caseType}
          onChange={(reason) => onValuesChange({ reason })}
          onBlur={touch("reason")}
          error={errorFor("reason")}
        />
        <PhotoDropzone
          photo={photo}
          onChange={(p) => {
            touch("photo")();
            onPhotoChange(p);
          }}
          caseType={values.caseType}
          error={errorFor("photo")}
        />
      </fieldset>
      {bannerError ? <ErrorBanner message={bannerError.message} onRetry={onRetry} disabled={disabled} /> : null}
      <button
        type="submit"
        disabled={disabled || !valid}
        className="min-h-11 cursor-pointer self-start rounded-lg bg-brand-primary px-8 py-3 text-base font-bold text-text-on-dark hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        Przeanalizuj zgłoszenie
      </button>
    </form>
  );
}

function ModelInput({
  value,
  onChange,
  onBlur,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
}) {
  const id = "case-model";
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={labelClasses}>
        Nazwa / model
      </label>
      <input
        id={id}
        type="text"
        name="model"
        data-field="model"
        value={value}
        placeholder="Lenovo ThinkPad T14 Gen 4"
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
