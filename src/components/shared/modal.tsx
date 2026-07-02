"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Responsive modal: centered dialog on desktop, bottom sheet on mobile.
 * Closes on backdrop click, X, and Escape.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide = false,
  hideHeader = false,
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  hideHeader?: boolean; // when a sub-screen renders its own header (e.g. a back button)
  ariaLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-in fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden border border-bd bg-sf shadow-[0_20px_60px_var(--shadow)] animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:slide-in-from-bottom-0 ${
          wide ? "sm:max-w-[640px]" : "sm:max-w-[480px]"
        } rounded-t-[20px] sm:rounded-2xl`}
      >
        {!hideHeader && (
          <div className="flex items-start gap-3 border-b border-hair px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-tight text-ink">{title}</h2>
              {subtitle && <p className="mt-1 text-xs font-medium leading-[1.4] text-fnt">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Close" className="flex size-8 flex-none items-center justify-center rounded-lg text-mut hover:bg-bg2">
              <X className="size-[18px]" strokeWidth={2} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex gap-2.5 border-t border-hair px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Primary / secondary modal action buttons. */
export function ModalActions({
  onCancel,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  pending = false,
  destructive = false,
  formId,
}: {
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  formId?: string;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 rounded-xl border border-bd2 bg-sf py-3 text-sm font-semibold leading-none text-ink hover:bg-bg2"
      >
        {cancelLabel}
      </button>
      <button
        type="submit"
        form={formId}
        disabled={pending}
        className={`flex-1 rounded-xl py-3 text-sm font-semibold leading-none text-white disabled:opacity-60 ${
          destructive ? "bg-out" : "bg-teal"
        }`}
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </>
  );
}
