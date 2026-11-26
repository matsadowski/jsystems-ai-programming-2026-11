"use client";

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  disabled?: boolean;
}

export function ErrorBanner({ message, onRetry, disabled }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-status-negative bg-status-negative-bg p-4 text-status-negative"
    >
      <p className="font-semibold">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={disabled}
          className="min-h-11 cursor-pointer rounded-lg bg-brand-primary px-6 py-2 font-bold text-text-on-dark hover:bg-brand-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Spróbuj ponownie
        </button>
      ) : null}
    </div>
  );
}
