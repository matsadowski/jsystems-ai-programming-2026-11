"use client";
import { useId, useRef, useState, type DragEvent } from "react";
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  ACCEPTED_IMAGE_MIME_TYPES,
  MAX_PHOTO_BYTES,
  VALIDATION_MESSAGES,
  type CaseType,
} from "@/lib/shared";
import { FieldError } from "./FieldError";
import type { PhotoState } from "./types";

export interface PhotoDropzoneProps {
  photo: PhotoState | null;
  /** Called with the new photo (object URL already created) or `null` after removal/rejection. */
  onChange: (photo: PhotoState | null) => void;
  caseType?: CaseType;
  /** External error (required / server). A local rejection message takes precedence. */
  error?: string;
  disabled?: boolean;
}

const HELPER: Record<CaseType, string> = {
  RETURN: "Pokaż cały sprzęt — zdjęcie ma potwierdzić brak śladów użytkowania",
  COMPLAINT: "Pokaż wyraźnie uszkodzenie",
};

/** Client-side hint only (the server decides by content): MIME **or** extension, size ≤ 10 MB. */
export function checkPhotoFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const typeOk = (ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
  const extOk = ACCEPTED_IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
  if (!typeOk && !extOk) return VALIDATION_MESSAGES.photoFormat;
  if (file.size > MAX_PHOTO_BYTES) return VALIDATION_MESSAGES.photoSize;
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function PhotoDropzone({ photo, onChange, caseType, error, disabled }: PhotoDropzoneProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const shownError = rejection ?? error;

  function revokeCurrent() {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
  }

  function accept(file: File | undefined) {
    if (!file) return;
    const problem = checkPhotoFile(file);
    revokeCurrent();
    if (problem) {
      setRejection(problem);
      onChange(null);
      return;
    }
    setRejection(null);
    onChange({ file, previewUrl: URL.createObjectURL(file), name: file.name, sizeBytes: file.size });
  }

  function remove() {
    revokeCurrent();
    setRejection(null);
    onChange(null);
    inputRef.current?.focus();
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) accept(e.dataTransfer.files[0]);
  }

  const describedBy = [caseType ? helperId : null, shownError ? errorId : null].filter(Boolean).join(" ");
  const buttonClasses =
    "min-h-11 cursor-pointer rounded-lg border-2 border-brand-primary px-6 py-2 font-bold text-brand-primary hover:bg-tint-pink disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div data-field-group="photo">
      <span id={labelId} className="mb-1 block text-base font-bold text-text-primary">
        Zdjęcie sprzętu
      </span>
      {caseType ? (
        <p id={helperId} className="mb-1 text-sm text-text-muted">
          {HELPER[caseType]}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        name="photo"
        accept={ACCEPTED_IMAGE_MIME_TYPES.join(",")}
        aria-labelledby={labelId}
        tabIndex={-1}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-4 ${
          dragging ? "border-brand-primary bg-tint-pink" : "border-border-neutral-strong bg-bg-default"
        } ${shownError ? "border-status-negative" : ""}`}
      >
        {photo ? (
          <div className="flex flex-wrap items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img
              src={photo.previewUrl}
              alt={`Podgląd zdjęcia ${photo.name}`}
              className="size-24 rounded-sm border border-border-default object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text-primary">{photo.name}</p>
              <p className="text-sm text-text-muted">{formatFileSize(photo.sizeBytes)}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                data-field="photo"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                aria-describedby={describedBy || undefined}
                className={buttonClasses}
              >
                Zmień
              </button>
              <button type="button" disabled={disabled} onClick={remove} className={buttonClasses}>
                Usuń
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p className="text-base text-text-secondary">Przeciągnij zdjęcie lub wybierz plik</p>
            <button
              type="button"
              data-field="photo"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              aria-describedby={describedBy || undefined}
              className={buttonClasses}
            >
              Wybierz plik
            </button>
            <p className="text-sm text-text-muted">Formaty: JPG, PNG, WEBP · maksymalnie 10 MB</p>
          </div>
        )}
      </div>
      <FieldError id={errorId} message={shownError} />
    </div>
  );
}
