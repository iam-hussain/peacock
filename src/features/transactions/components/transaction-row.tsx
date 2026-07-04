"use client";

import { Pencil, Trash2 } from "lucide-react";
import { FormModalButton } from "@/components/shared/form-modal-button";
import { useIsAdmin } from "@/lib/admin";
import { type Txn, type Role, type Dir } from "../data";

const DOT: Record<Dir, string> = { in: "bg-in", out: "bg-out", neutral: "bg-fnt" };
const AMT: Record<Dir, string> = { in: "text-in", out: "text-out", neutral: "text-ink" };
export const ROLE_DOT: Record<Role, string> = { treasurer: "bg-teal", member: "bg-ink", vendor: "bg-wfg" };
const PILL: Record<Role, string> = { treasurer: "bg-tlsf text-teal", member: "bg-bg2 text-ink", vendor: "bg-wbg text-wfg" };

export const GRID = "grid-cols-[1.4fr_2.6fr_0.9fr_0.9fr_1fr_72px]";

/** Column header row for the ledger table — shared by the desktop and mobile table views. */
export function HeaderRow() {
  return (
    <div className={`grid ${GRID} gap-3 border-b border-hair bg-sf2 px-5.5 py-2.75`}>
      {["Type", "From → To", "Date", "Method", "Amount", ""].map((h, i) => (
        <div key={h || "actions"} className={`text-10 font-semibold uppercase leading-none tracking-6 text-fnt ${i === 4 ? "text-right" : ""}`}>
          {h}
        </div>
      ))}
    </div>
  );
}

function PartyPill({ p, tinted = false }: { p: Txn["from"]; tinted?: boolean }) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-11 font-semibold leading-none ${
        tinted ? PILL[p.role] : "bg-bg2 text-ink"
      }`}
    >
      <span className={`size-1.5 flex-none rounded-full ${ROLE_DOT[p.role]}`} />
      <span className="truncate">{p.name}</span>
    </span>
  );
}

/** Mobile card — matches the "card view": type + amount, tinted party pills + method, dates. */
export function MobileCard({ t }: { t: Txn }) {
  return (
    <div className="rounded-2xl border border-bd bg-sf px-4 py-3.5">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.25">
          <span className={`size-2 flex-none rounded-full ${DOT[t.dir]}`} />
          <span className="text-15 font-semibold leading-tight text-ink">{t.what}</span>
        </div>
        <span className={`flex-none font-mono text-15 font-semibold leading-none ${AMT[t.dir]}`}>{t.amount}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.75">
        <PartyPill p={t.from} tinted />
        <span className="text-xs font-semibold text-fnt">→</span>
        <PartyPill p={t.to} tinted />
        <span className="text-11 font-medium leading-none text-fnt">· {t.method}</span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-11 font-medium leading-none text-fnt">
          {t.date} · entered {t.entered}
        </span>
        <RowActions t={t} />
      </div>
    </div>
  );
}

export function Row({ t }: { t: Txn }) {
  return (
    <div className={`grid ${GRID} items-center gap-3 border-b border-hr2 px-5.5 py-3.25 last:border-b-0`}>
      <div className="flex items-center gap-2.25">
        <span className={`size-2 flex-none rounded-full ${DOT[t.dir]}`} />
        <span className="text-13 font-semibold leading-tight text-ink">{t.what}</span>
      </div>
      <div className="flex min-w-0 flex-nowrap items-center gap-1.75">
        <PartyPill p={t.from} tinted />
        <span className="flex-none font-semibold text-fnt">→</span>
        <PartyPill p={t.to} tinted />
      </div>
      <div>
        <div className="whitespace-nowrap font-mono text-xs font-semibold leading-none text-ink">{t.date}</div>
        <div className="mt-1 text-10 font-medium leading-120 text-fnt">Entered {t.entered}</div>
      </div>
      <div>
        <span className="rounded-md bg-bg2 px-2.25 py-1.25 text-11 font-semibold leading-none text-mut">{t.method}</span>
      </div>
      <div className={`text-right font-mono text-sm font-semibold leading-none ${AMT[t.dir]}`}>{t.amount}</div>
      <RowActions t={t} />
    </div>
  );
}

/** Edit / Delete affordances for a ledger row (§16 — both are reversal-backed corrections). Admin-only. */
function RowActions({ t }: { t: Txn }) {
  const isAdmin = useIsAdmin();
  if (!isAdmin || (!t.canEdit && !t.canDelete)) return <span />;
  return (
    <div className="flex items-center justify-end gap-1">
      {t.canEdit && (
        <FormModalButton
          kind="editTransaction"
          title="Edit transaction"
          subtitle={`${t.what} · ${t.from.name} → ${t.to.name}`}
          submitLabel="Save changes"
          hiddenFields={{ id: t.id }}
          buttonClassName="grid size-8 place-items-center rounded-lg text-fnt transition-colors hover:bg-bg2 hover:text-ink"
          buttonAriaLabel="Edit transaction"
          fields={[
            { name: "amount", label: "Amount (₹)", type: "text", defaultValue: t.amountValue, required: true },
            { name: "date", label: "Transaction date", type: "date", defaultValue: t.isoDate },
          ]}
        >
          <Pencil className="size-3.75" strokeWidth={2} />
        </FormModalButton>
      )}
      {t.canDelete && (
        <FormModalButton
          kind="deleteTransaction"
          title="Delete transaction?"
          subtitle={`${t.what} · ${t.amount}`}
          submitLabel="Delete"
          destructive
          hiddenFields={{ id: t.id }}
          fields={[]}
          intro={
            <p className="mb-4 text-13 font-medium leading-150 text-fnt">
              This reverses the posting and unwinds its balances. The original stays on record for the audit
              trail, but it leaves the list. This can’t be undone.
            </p>
          }
          buttonClassName="grid size-8 place-items-center rounded-lg text-fnt transition-colors hover:bg-out/10 hover:text-out"
          buttonAriaLabel="Delete transaction"
        >
          <Trash2 className="size-3.75" strokeWidth={2} />
        </FormModalButton>
      )}
    </div>
  );
}
