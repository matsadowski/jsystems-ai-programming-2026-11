// Client form data structures (ADR 003 §4).
import type { CaseType, DeviceCategory } from "@/lib/shared";

/** Enums are optional until chosen (AC-02: nothing preselected). */
export interface FormValues {
  caseType?: CaseType;
  category?: DeviceCategory;
  model: string;
  purchaseDate: string;
  reason: string;
}

/** `previewUrl` is an object URL owned by whoever created it (PhotoDropzone creates and revokes). */
export interface PhotoState {
  file: File;
  previewUrl: string;
  name: string;
  sizeBytes: number;
}

export const FIELD_ORDER = ["caseType", "category", "model", "purchaseDate", "reason", "photo"] as const;
export type FieldKey = (typeof FIELD_ORDER)[number];
export type FieldErrors = Partial<Record<FieldKey, string>>;

export interface BannerError {
  message: string;
}
