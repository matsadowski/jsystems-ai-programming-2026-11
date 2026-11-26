export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-sm font-semibold text-status-negative">
      {message}
    </p>
  );
}

export const inputClasses =
  "min-h-11 w-full rounded-sm border border-border-neutral-strong bg-bg-default px-3 py-2 text-base text-text-primary placeholder:text-text-muted disabled:cursor-not-allowed disabled:bg-bg-light aria-[invalid=true]:border-status-negative aria-[invalid=true]:border-2";

export const labelClasses = "mb-1 block text-base font-bold text-text-primary";
