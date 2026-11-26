// Shared limits (PRD AC-04–AC-09, AC-32; ADR 001 §3.2–3.3).
export const MODEL_MIN_LENGTH = 2;
export const MODEL_MAX_LENGTH = 100;
export const REASON_MAX_LENGTH = 2000;
export const COMPLAINT_REASON_MIN_LENGTH = 10;
export const CHAT_MESSAGE_MAX_LENGTH = 2000;
export const MIN_PURCHASE_DATE = "2000-01-01";

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MIN_IMAGE_SIDE_PX = 200;
export const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ACCEPTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;

export const RETURN_WINDOW_DAYS = 14;
export const COMPLAINT_WINDOW_MONTHS = 24;
export const COMPLAINT_WINDOW_DAYS_INFO = 730;
export const DEAD_ON_ARRIVAL_DAYS = 14;
