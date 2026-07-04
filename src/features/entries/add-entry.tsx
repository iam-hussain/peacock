"use client";

import { createContext, Suspense, use, useContext, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowLeftRight, ChevronRight, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { SelectorCard, PickerSheet, type PickOption } from "@/components/shared/entity-picker";
import { formAction } from "@/server/actions";
import type { EntryPickerOptions } from "@/server/queries/entries";

type Dir = "in" | "out" | "move";
interface Intent {
  label: string;
  desc: string;
  dir: Dir;
}

const GROUPS: { name: string; items: Intent[] }[] = [
  {
    name: "Member",
    items: [
      { label: "Member paid deposit", desc: "Monthly contribution coming in", dir: "in" },
      { label: "Funds transfer", desc: "Move money between treasurers (cash holders)", dir: "move" },
    ],
  },
  {
    name: "Loan",
    items: [
      { label: "Give a loan", desc: "Disburse funds to a member", dir: "out" },
      { label: "Record repayment", desc: "Member repays loan principal", dir: "in" },
      { label: "Collect interest", desc: "Interest earned on a loan", dir: "in" },
    ],
  },
  {
    name: "Vendor",
    items: [
      { label: "Vendor investment", desc: "Place capital with a vendor", dir: "out" },
      { label: "Vendor return", desc: "Returns paid back by a vendor", dir: "in" },
    ],
  },
  {
    name: "Chit",
    items: [
      { label: "Chit installment", desc: "Monthly installment to a chit", dir: "out" },
      { label: "Chit payout", desc: "Lump sum received from a chit", dir: "in" },
    ],
  },
];

// Note: catch-up & penalty are recorded from the member's own page (they need the member's
// remaining balance + suggested amount), and vendor write-off from the vendor page — so none of
// them appear in this top-bar picker (§15).

const DIR_META: Record<Dir, { Icon: LucideIcon; badge: string; tile: string; color: string }> = {
  in: { Icon: ArrowDown, badge: "IN", tile: "bg-in/10", color: "text-in" },
  out: { Icon: ArrowUp, badge: "OUT", tile: "bg-out/10", color: "text-out" },
  move: { Icon: ArrowLeftRight, badge: "MOVE", tile: "bg-bg2", color: "text-mut" },
};

const INTENT_DIR: Record<string, Dir> = Object.fromEntries(
  GROUPS.flatMap((g) => g.items).map((it) => [it.label, it.dir]),
);
const VENDOR_INTENTS = new Set(["Vendor investment", "Vendor return", "Chit installment", "Chit payout"]);

// Which member figure to show under each name in the picker (context-aware sub-line).
const MEMBER_CTX_KEY: Record<string, "dues" | "loan" | "interest"> = {
  "Member paid deposit": "dues",
  "Record repayment": "loan",
  "Collect interest": "interest",
};

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
      fd.set("amount", amount);
      if (needsPrincipal && principal.trim() !== "") fd.set("principal", principal);
      fd.set("treasurer", holder?.name ?? "");
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
                className="flex-1 rounded-xl bg-teal py-3.5 text-center text-[15px] font-semibold leading-none text-white transition-opacity disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save entry"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-xl border border-bd2 bg-sf px-6 py-3.5 text-[15px] font-semibold leading-none text-ink hover:bg-bg2"
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
              className="flex-1 rounded-xl border border-bd2 bg-sf py-3.5 text-center text-[15px] font-semibold leading-none text-ink hover:bg-bg2"
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
          <div className="flex flex-col gap-5">
            <div>
              <SectionLabel>{partyMeta.label}</SectionLabel>
              <SelectorCard selected={party} placeholder={partyMeta.ph} hint={partyMeta.hint} onOpen={() => setPicking("party")} />
            </div>

            {/* Amount + date sit side by side on desktop, stack on mobile. */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <SectionLabel>Amount</SectionLabel>
                <div
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-colors focus-within:border-teal ${
                    amount ? "border-teal" : "border-bd2"
                  }`}
                >
                  <span className="font-mono text-[22px] font-semibold leading-none text-mut">₹</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent font-mono text-[22px] font-semibold leading-none text-ink outline-none placeholder:text-fnt"
                  />
                </div>
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
                <div
                  className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-colors focus-within:border-teal ${
                    principal ? "border-teal" : "border-bd2"
                  }`}
                >
                  <span className="font-mono text-[18px] font-semibold leading-none text-mut">₹</span>
                  <input
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent font-mono text-[18px] font-semibold leading-none text-ink outline-none placeholder:text-fnt"
                  />
                </div>
                <p className="mb-0 mt-2 text-[12px] font-medium leading-[1.4] text-fnt">
                  How much of this is your capital coming back (reduces the vendor balance). Leave blank for pure
                  interest/profit — the rest books as profit.
                </p>
              </div>
            )}

            <div>
              <SectionLabel>{holderMeta.label}</SectionLabel>
              <p className="mb-2 mt-1 text-[12px] font-medium leading-[1.4] text-fnt">{holderMeta.desc}</p>
              <SelectorCard selected={holder} placeholder={holderMeta.ph} hint={holderMeta.hint} onOpen={() => setPicking("holder")} />
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

            {error && <p className="text-[13px] font-medium leading-[1.4] text-out">{error}</p>}
          </div>
        )}
      </Modal>
  );
}

function getPartyMeta(intent: string | null) {
  if (intent === "Funds transfer")
    return { kind: "treasurer" as const, label: "To treasurer (receives)", ph: "No treasurer selected", hint: "Tap to pick who receives the transfer", pickerTitle: "Transfer to", pickerSub: "Choose the treasurer receiving the cash.", search: "Search treasurers" };
  if (intent && VENDOR_INTENTS.has(intent))
    return { kind: "vendor" as const, label: "Vendor", ph: "No vendor selected", hint: "Click to choose the vendor", pickerTitle: "Choose a vendor", pickerSub: "Choose the vendor this entry is for.", search: "Search any vendor" };
  return { kind: "member" as const, label: "Member", ph: "No member selected", hint: "Click to choose who this entry is for", pickerTitle: "Record entry for", pickerSub: "Choose the member this entry belongs to.", search: "Search any member" };
}

function getHolderMeta(dir: Dir) {
  if (dir === "out")
    return { label: "Money comes from (who pays)", desc: "The club has no account of its own. Pick the treasurer paying out the cash.", ph: "No payer selected", hint: "Tap to pick who pays", pickerSub: "Choose the treasurer paying out the cash." };
  if (dir === "move")
    return { label: "From treasurer (sends)", desc: "Pick the treasurer sending the cash.", ph: "No sender selected", hint: "Tap to pick the sender", pickerSub: "Choose the treasurer sending the cash." };
  return { label: "Money goes to (who holds it)", desc: "The club has no account of its own — any member can hold its cash. Pick who receives it.", ph: "No holder selected", hint: "Tap to pick who receives the cash", pickerSub: "Choose the treasurer who receives the cash." };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase leading-none tracking-[0.05em] text-fnt">{children}</div>;
}

function DirBadge({ dir }: { dir: Dir }) {
  const m = DIR_META[dir];
  return <span className={`rounded-md px-2 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.04em] ${m.tile} ${m.color}`}>{m.badge}</span>;
}

function IntentPicker({ onPick }: { onPick: (label: string) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.name}>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase leading-none tracking-[0.06em] text-fnt">{g.name}</span>
            <span className="h-px flex-1 bg-hair" />
          </div>
          <div className="mt-2.5 flex flex-col gap-2">
            {g.items.map((it) => (
              <IntentRow key={it.label} it={it} onPick={() => onPick(it.label)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function IntentRow({ it, onPick }: { it: Intent; onPick: () => void }) {
  const m = DIR_META[it.dir];
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3.5 rounded-xl border border-bd2 bg-sf px-3.5 py-3 text-left transition-colors hover:border-teal hover:bg-tlsf"
    >
      <span className={`flex size-10 flex-none items-center justify-center rounded-[10px] ${m.tile}`}>
        <m.Icon className={`size-[18px] ${m.color}`} strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold leading-tight text-ink">{it.label}</div>
        <div className="mt-0.5 text-[12px] font-medium leading-[1.35] text-fnt">{it.desc}</div>
      </div>
      <span className={`flex-none text-[11px] font-bold uppercase tracking-[0.04em] ${m.color}`}>{m.badge}</span>
      <ChevronRight className="size-4 flex-none text-fnt" strokeWidth={2} />
    </button>
  );
}
