"use client";

import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useVisualViewport } from "@/lib/use-visual-viewport";

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

  // The fixed container anchors to the layout viewport, whose bottom sits under the iOS
  // keyboard — a bottom-sheet there vanishes behind it on the first re-layout while typing.
  // Pin the container to the visual viewport instead so the sheet rides above the keyboard.
  const box = useRef<HTMLDivElement>(null);
  useVisualViewport(
    useCallback(
      (vv) => {
        const el = box.current;
        if (!el) return;
        const shrunk = vv.height < document.documentElement.clientHeight - 1;
        el.style.height = shrunk ? `${vv.height}px` : "";
        el.style.transform = shrunk || vv.offsetTop > 1 ? `translateY(${vv.offsetTop}px)` : "";
      },
      // re-run when the modal (re)opens so an already-shrunk viewport is applied on mount
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [open],
    ),
  );

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div ref={box} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px] animate-in fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? (typeof title === "string" ? title : undefined)}
        className={`relative flex max-h-[min(80vh,100%)] min-h-[min(70vh,100%)] w-full flex-col overflow-hidden sm:min-h-0 border border-bd bg-sf shadow-[0_20px_60px_var(--shadow)] animate-in slide-in-from-bottom-4 sm:zoom-in-95 sm:slide-in-from-bottom-0 ${
          wide ? "sm:max-w-[640px]" : "sm:max-w-120"
        } rounded-t-20 sm:rounded-2xl`}
      >
        {!hideHeader && (
          <div className="relative flex flex-col items-center gap-1 px-12 py-4 text-center">
            <h2 className="text-base font-bold leading-tight text-ink">{title}</h2>
            {subtitle && <p className="text-xs font-medium leading-140 text-fnt">{subtitle}</p>}
            <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-mut hover:bg-bg2">
              <X className="size-4.5" strokeWidth={2} />
            </button>
          </div>
        )}
        {/* With the shared header the body is the scroller (form fields scroll under the fixed
            title); a hideHeader sub-screen (PickerSheet) pins its own header/search and scrolls
            only its list, so hand it the height instead of scrolling it whole. */}
        <div className={`flex-1 px-5 py-4 ${hideHeader ? "flex min-h-0 flex-col overflow-hidden" : "overflow-y-auto"}`}>
          {children}
        </div>
        {footer && <div className="flex gap-2.5 px-5 py-4">{footer}</div>}
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
  onSubmit,
}: {
  onCancel: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  destructive?: boolean;
  formId?: string;
  onSubmit?: () => void; // imperative submit (modals without a native <form>)
}) {
  // Primary action fills the row (left); Cancel is a compact button on the right — matches the
  // add-entry footer so every modal's actions read identically.
  return (
    <>
      <button
        type={onSubmit ? "button" : "submit"}
        form={onSubmit ? undefined : formId}
        onClick={onSubmit}
        disabled={pending}
        className={`flex-1 rounded-xl py-3.5 text-15 font-semibold leading-none text-white transition-opacity disabled:opacity-60 ${
          destructive ? "bg-out" : "bg-teal"
        }`}
      >
        {pending ? "Saving…" : submitLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-bd2 bg-sf px-6 py-3.5 text-15 font-semibold leading-none text-ink hover:bg-bg2"
      >
        {cancelLabel}
      </button>
    </>
  );
}
