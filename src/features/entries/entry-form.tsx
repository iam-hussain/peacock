"use client";

import { SelectorCard, type PickOption } from "@/components/shared/entity-picker";
import { AmountInput } from "@/components/shared/amount-input";
import { SectionLabel } from "@/components/shared/section-label";
import type { getPartyMeta, getHolderMeta } from "./entry-meta";

/** The step-2 entry form (party + amount/date + optional principal + holder + note). State lives in
 * the dialog; this is the presentational form body wired to it via props. */
export function EntryForm({
  partyMeta,
  party,
  onOpenParty,
  amount,
  setAmount,
  txnDate,
  setTxnDate,
  needsPrincipal,
  principal,
  setPrincipal,
  holderMeta,
  holder,
  onOpenHolder,
  note,
  setNote,
  error,
}: {
  partyMeta: ReturnType<typeof getPartyMeta>;
  party: PickOption | null;
  onOpenParty: () => void;
  amount: string;
  setAmount: (v: string) => void;
  txnDate: string;
  setTxnDate: (v: string) => void;
  needsPrincipal: boolean;
  principal: string;
  setPrincipal: (v: string) => void;
  holderMeta: ReturnType<typeof getHolderMeta>;
  holder: PickOption | null;
  onOpenHolder: () => void;
  note: string;
  setNote: (v: string) => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <SectionLabel>{partyMeta.label}</SectionLabel>
        <SelectorCard selected={party} placeholder={partyMeta.ph} hint={partyMeta.hint} onOpen={onOpenParty} />
      </div>

      {/* Amount + date sit side by side on desktop, stack on mobile. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <SectionLabel>Amount</SectionLabel>
          <AmountInput value={amount} onChange={setAmount} />
        </div>

        <div>
          <SectionLabel>Date</SectionLabel>
          <input
            type="date"
            value={txnDate}
            onChange={(e) => setTxnDate(e.target.value)}
            className="h-[48px] w-full rounded-xl border border-bd2 bg-transparent px-4 text-sm font-medium text-ink outline-none focus:border-teal"
          />
        </div>
      </div>

      {needsPrincipal && (
        <div>
          <SectionLabel>Principal returned (optional)</SectionLabel>
          <AmountInput value={principal} onChange={setPrincipal} size="md" />
          <p className="mb-0 mt-2 text-12 font-medium leading-140 text-fnt">
            How much of this is your capital coming back (reduces the vendor balance). Leave blank for pure
            interest/profit — the rest books as profit.
          </p>
        </div>
      )}

      <div>
        <SectionLabel>{holderMeta.label}</SectionLabel>
        <p className="mb-2 mt-1 text-12 font-medium leading-140 text-fnt">{holderMeta.desc}</p>
        <SelectorCard selected={holder} placeholder={holderMeta.ph} hint={holderMeta.hint} onOpen={onOpenHolder} />
      </div>

      <div>
        <SectionLabel>Note <span className="font-medium normal-case text-fnt">optional</span></SectionLabel>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note…"
          className="w-full rounded-xl border border-bd2 bg-transparent px-4 py-3 text-sm font-medium text-ink outline-none placeholder:text-fnt focus:border-teal"
        />
      </div>

      {error && <p className="text-13 font-medium leading-140 text-out">{error}</p>}
    </div>
  );
}
