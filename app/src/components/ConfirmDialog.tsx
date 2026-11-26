"use client";

import { useEffect, useRef } from "react";

/** Native modal `<dialog>`: focus is trapped by the browser, Escape fires `cancel` (ADR 003 §3.2). */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-text"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto rounded-lg p-6 shadow-card backdrop:bg-bg-overlay"
    >
      <p id="confirm-dialog-text" className="text-md font-bold">
        Bieżąca rozmowa zostanie utracona.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" autoFocus onClick={onCancel} className="min-h-11 rounded-lg border border-border-brand px-5 font-bold text-text-brand">
          Anuluj
        </button>
        <button type="button" onClick={onConfirm} className="min-h-11 rounded-lg bg-brand-primary px-5 font-bold text-text-on-dark">
          Rozpocznij nowe
        </button>
      </div>
    </dialog>
  );
}
