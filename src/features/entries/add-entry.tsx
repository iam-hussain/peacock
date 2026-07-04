"use client";

import { createContext, Suspense, use, useContext, useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/shared/modal";
import { PickerSheet, type PickOption } from "@/components/shared/entity-picker";
import { formAction } from "@/server/actions";
import type { EntryPickerOptions } from "@/server/queries/entries";
import { INTENT_DIR, MEMBER_CTX_KEY } from "./entry-constants";
import { IntentPicker } from "./intent-picker";
import { DirBadge, getPartyMeta, getHolderMeta } from "./entry-meta";
import { EntryForm } from "./entry-form";

/** Prefill the dialog straight into step 2 for a fixed intent/party (e.g. the member
 * detail's "Record catch-up/penalty payment" reusing this flow). */
export interface AddEntryPreset {
  intent?: string;
  party?: PickOption;
}

const Ctx = createContext<{ open: (preset?: AddEntryPreset) => void } | null>(null);
export const useAddEntry = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAddEntry must be used within AddEntryProvider");
  return c;
};

export function AddEntryProvider({ children, optionsPromise }: { children: React.ReactNode; optionsPromise: Promise<EntryPickerOptions> }) {
  // Picker data (a slow, non-critical query) is fetched lazily and never blocks page render —
  // the dialog only mounts, and only then unwraps the promise, when the user opens Add-Entry.
  const [preset, setPreset] = useState<AddEntryPreset | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open: (p) => { setPreset(p ?? null); setOpen(true); } }}>
      {children}
      {open && (
        <Suspense fallback={null}>
          <AddEntryDialog optionsPromise={optionsPromise} preset={preset} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}

function AddEntryDialog({ optionsPromise, preset, onClose }: { optionsPromise: Promise<EntryPickerOptions>; preset: AddEntryPreset | null; onClose: () => void }) {
  const options = use(optionsPromise);
  const MEMBER_OPTS = options.members;
  const VENDOR_OPTS = options.vendors;
  const TREASURER_OPTS = options.treasurers;
  const LOAN_OPTS = options.loanCandidates;
  const today = new Date().toISOString().slice(0, 10);
  const [intent, setIntent] = useState<string | null>(preset?.intent ?? null);
  const [picking, setPicking] = useState<"party" | "holder" | null>(null);
  const [party, setParty] = useState<PickOption | null>(preset?.party ?? null);
  const [holder, setHolder] = useState<PickOption | null>(null);
  const [amount, setAmount] = useState("");
  const [principal, setPrincipal] = useState("");
  const [txnDate, setTxnDate] = useState(today);
  const [note, setNote] = useState("");
  // Vendor return / chit payout can split the receipt into returned-capital vs profit; the rest
  // (or all of it, when blank) books as profit. Reduces the vendor receivable by the principal part.
  const needsPrincipal = intent === "Vendor return" || intent === "Chit payout";
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = onClose; // unmounts the dialog → all local state resets on next open

  const dir = intent ? INTENT_DIR[intent] : "in";
  const partyMeta = useMemo(() => getPartyMeta(intent), [intent]);
  const holderMeta = useMemo(() => getHolderMeta(dir), [dir]);
  // The member picker's sub-line is context-aware: it shows the figure relevant to the action being
  // recorded (dues for a deposit, loan for a repayment, …). Give-a-loan uses the eligibility list (§8).
  const memberOpts = useMemo(() => {
    if (intent === "Give a loan") return LOAN_OPTS;
    const key = intent ? MEMBER_CTX_KEY[intent] : undefined;
    return key ? MEMBER_OPTS.map((o) => ({ ...o, sub: o.ctx?.[key] ?? o.sub })) : MEMBER_OPTS;
  }, [intent, LOAN_OPTS, MEMBER_OPTS]);
  const partyOpts = partyMeta.kind === "vendor" ? VENDOR_OPTS : partyMeta.kind === "treasurer" ? TREASURER_OPTS : memberOpts;
  const canSave = !!party && !!holder && amount.trim() !== "";

  const submit = () => {
    if (!canSave) return;
    start(async () => {
      const fd = new FormData();
      fd.set("intent", intent ?? "");
      fd.set("party", party?.name ?? "");
      // Also carry the picked ids so the server resolves by id, not by an ambiguous display name.
      if (party?.id) fd.set("partyId", party.id);
      fd.set("amount", amount);
      if (needsPrincipal && principal.trim() !== "") fd.set("principal", principal);
      fd.set("treasurer", holder?.name ?? "");
      if (holder?.id) fd.set("treasurerId", holder.id);
      fd.set("date", txnDate || today);
      if (note.trim() !== "") fd.set("note", note.trim());
      const res = await formAction("entry", fd);
      if (res.ok) close();
      else setError(res.error ?? "Something went wrong.");
    });
  };

  return (
      <Modal
        open
        onClose={close}
        wide={!intent}
        hideHeader={!!picking}
        ariaLabel={intent ?? "What happened?"}
        title={
          intent ? (
            <span className="flex items-center gap-2.5">
              <DirBadge dir={dir} />
              {intent}
            </span>
          ) : (
            "What happened?"
          )
        }
        footer={
          picking ? undefined : intent ? (
            <>
              <button
                type="button"
                onClick={submit}
                disabled={!canSave || pending}
                className="flex-1 rounded-xl bg-teal py-3.5 text-center text-15 font-semibold leading-none text-white transition-opacity disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save entry"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-bd2 bg-sf px-6 py-3.5 text-15 font-semibold leading-none text-ink hover:bg-bg2"
              >
                Cancel
              </button>
            </>
          ) : (
            // Intent picker (first screen): a full-width Cancel so the selection list is
            // dismissable from the bottom on mobile without drilling into an option first.
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-xl border border-bd2 bg-sf py-3.5 text-center text-15 font-semibold leading-none text-ink hover:bg-bg2"
            >
              Cancel
            </button>
          )
        }
      >
        {!intent ? (
          <IntentPicker onPick={setIntent} />
        ) : picking ? (
          <PickerSheet
            title={picking === "party" ? partyMeta.pickerTitle : "Cash holder"}
            subtitle={picking === "party" ? partyMeta.pickerSub : holderMeta.pickerSub}
            searchPlaceholder={picking === "party" ? partyMeta.search : "Search treasurers"}
            options={picking === "party" ? partyOpts : TREASURER_OPTS}
            onPick={(o) => {
              if (picking === "party") setParty(o);
              else setHolder(o);
              setPicking(null);
            }}
            onBack={() => setPicking(null)}
          />
        ) : (
          <EntryForm
            partyMeta={partyMeta}
            party={party}
            onOpenParty={() => setPicking("party")}
            amount={amount}
            setAmount={setAmount}
            txnDate={txnDate}
            setTxnDate={setTxnDate}
            needsPrincipal={needsPrincipal}
            principal={principal}
            setPrincipal={setPrincipal}
            holderMeta={holderMeta}
            holder={holder}
            onOpenHolder={() => setPicking("holder")}
            note={note}
            setNote={setNote}
            error={error}
          />
        )}
      </Modal>
  );
}
