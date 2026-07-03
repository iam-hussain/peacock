"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { closeQuarterNow } from "@/server/actions";
import type { QuarterPreview } from "@/server/queries/close-quarter";

export function CloseQuarterButton({ quarter, className, children }: { quarter: QuarterPreview; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setError(null);
  };

  const confirm = () =>
    start(async () => {
      const res = await closeQuarterNow();
      if (!res.ok) return setError(res.error ?? "Could not close the quarter.");
      close();
      router.refresh();
    });

  const rows = [
    { l: "Period", v: quarter.period },
    { l: "Active members", v: String(quarter.activeMembers) },
    { l: "Net profit this quarter", v: quarter.netProfit, accent: true },
    { l: "Available cash at close", v: quarter.availableCash },
    { l: "Portfolio value at close", v: quarter.portfolio },
  ];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Close quarter"
        subtitle={`${quarter.label} · ${quarter.period}`}
        ariaLabel="Close quarter"
        footer={
          quarter.alreadyClosed ? (
            <button type="button" onClick={close} className="flex-1 rounded-xl border border-bd2 bg-sf py-3 text-sm font-semibold leading-none text-ink hover:bg-bg2">
              Close
            </button>
          ) : (
            <ModalActions onCancel={close} submitLabel="Close quarter" destructive pending={pending} onSubmit={confirm} />
          )
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5 rounded-xl bg-outbg px-3.5 py-3 text-[13px] font-medium leading-[1.45] text-out">
            <AlertTriangle className="mt-0.5 size-[18px] flex-none" strokeWidth={2} />
            {quarter.alreadyClosed
              ? `${quarter.label} is already closed.`
              : `This locks all entries in ${quarter.period} and saves a snapshot. Profit stays in the club — no payout. This can't be undone.`}
          </div>

          <div className="overflow-hidden rounded-xl border border-bd">
            {rows.map((r, i) => (
              <div key={r.l} className={`flex items-center justify-between px-4 py-3 ${i < rows.length - 1 ? "border-b border-hr2" : ""}`}>
                <span className="text-[13px] font-medium leading-none text-mut">{r.l}</span>
                <span className={`font-mono text-[13px] font-semibold leading-none ${r.accent ? "text-teal" : "text-ink"}`}>{r.v}</span>
              </div>
            ))}
          </div>

          <p className="text-[11px] font-medium leading-[1.5] text-fnt">
            Net profit is shown for the record only — it stays in the club and keeps accumulating. No money moves.
          </p>
          {error && <p className="text-[13px] font-medium text-out">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
