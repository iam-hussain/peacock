"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, ArrowLeftRight, ChevronRight, Plus, Minus, type LucideIcon } from "lucide-react";
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

const ADVANCED: Intent[] = [
  { label: "Catch-up payment", desc: "Join-time equalisation a member pays", dir: "in" },
  { label: "Delayed-payment penalty", desc: "Charge a chronically-late member — club income", dir: "in" },
  { label: "Vendor write-off", desc: "Mark vendor capital as unrecoverable", dir: "out" },
];

const DIR_META: Record<Dir, { Icon: LucideIcon; badge: string; tile: string; color: string }> = {
  in: { Icon: ArrowDown, badge: "IN", tile: "bg-in/10", color: "text-in" },
  out: { Icon: ArrowUp, badge: "OUT", tile: "bg-out/10", color: "text-out" },
  move: { Icon: ArrowLeftRight, badge: "MOVE", tile: "bg-bg2", color: "text-mut" },
};

const INTENT_DIR: Record<string, Dir> = Object.fromEntries(
  [...GROUPS.flatMap((g) => g.items), ...ADVANCED].map((it) => [it.label, it.dir]),
);
const VENDOR_INTENTS = new Set(["Vendor investment", "Vendor return", "Vendor write-off", "Chit installment", "Chit payout"]);

const Ctx = createContext<{ open: () => void } | null>(null);
export const useAddEntry = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAddEntry must be used within AddEntryProvider");
  return c;
};

export function AddEntryProvider({ children, options }: { children: React.ReactNode; options: EntryPickerOptions }) {
  const MEMBER_OPTS: PickOption[] = options.members;
  const VENDOR_OPTS: PickOption[] = options.vendors;
  const TREASURER_OPTS: PickOption[] = options.treasurers;
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [picking, setPicking] = useState<"party" | "holder" | null>(null);
  const [party, setParty] = useState<PickOption | null>(null);
  const [holder, setHolder] = useState<PickOption | null>(null);
  const [amount, setAmount] = useState("");
  const [txnDate, setTxnDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setIntent(null);
    setShowMore(false);
    setPicking(null);
    setParty(null);
    setHolder(null);
    setAmount("");
    setTxnDate(today);
    setError(null);
  };

  const dir = intent ? INTENT_DIR[intent] : "in";
  const partyMeta = useMemo(() => getPartyMeta(intent), [intent]);
  const holderMeta = useMemo(() => getHolderMeta(dir), [dir]);
  const partyOpts = partyMeta.kind === "vendor" ? VENDOR_OPTS : partyMeta.kind === "treasurer" ? TREASURER_OPTS : MEMBER_OPTS;
  const canSave = !!party && !!holder && amount.trim() !== "";

  const submit = () => {
    if (!canSave) return;
    start(async () => {
      const fd = new FormData();
      fd.set("intent", intent ?? "");
      fd.set("party", party?.name ?? "");
      fd.set("amount", amount);
      fd.set("treasurer", holder?.name ?? "");
      fd.set("date", txnDate || today);
      const res = await formAction("entry", fd);
      if (res.ok) close();
      else setError(res.error ?? "Something went wrong.");
    });
  };

  return (
    <Ctx.Provider value={{ open: () => setOpen(true) }}>
      {children}
      <Modal
        open={open}
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
        subtitle={!intent ? "Choose in plain language. Step 1 of 2" : picking ? undefined : "Fill the details. Step 2 of 2"}
        footer={
          intent && !picking ? (
            <button
              type="button"
              onClick={submit}
              disabled={!canSave || pending}
              className="w-full rounded-xl bg-teal py-3.5 text-center text-[15px] font-semibold leading-none text-white transition-opacity disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save entry"}
            </button>
          ) : undefined
        }
      >
        {!intent ? (
          <IntentPicker showMore={showMore} onToggleMore={() => setShowMore((o) => !o)} onPick={setIntent} />
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
                  className="w-full bg-transparent font-mono text-[22px] font-semibold leading-none text-ink outline-none placeholder:text-fnt"
                />
              </div>
            </div>

            <div>
              <SectionLabel>Transaction date (optional)</SectionLabel>
              <input
                type="date"
                value={txnDate}
                onChange={(e) => setTxnDate(e.target.value)}
                className="w-full rounded-xl border border-bd2 bg-transparent px-4 py-3 text-sm font-medium text-ink outline-none focus:border-teal"
              />
            </div>

            <div>
              <SectionLabel>{holderMeta.label}</SectionLabel>
              <p className="mb-2 mt-1 text-[12px] font-medium leading-[1.4] text-fnt">{holderMeta.desc}</p>
              <SelectorCard selected={holder} placeholder={holderMeta.ph} hint={holderMeta.hint} onOpen={() => setPicking("holder")} />
            </div>

            {error && <p className="text-[13px] font-medium leading-[1.4] text-out">{error}</p>}
          </div>
        )}
      </Modal>
    </Ctx.Provider>
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

function IntentPicker({ showMore, onToggleMore, onPick }: { showMore: boolean; onToggleMore: () => void; onPick: (label: string) => void }) {
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

      <button
        type="button"
        onClick={onToggleMore}
        className="flex w-full items-center justify-between rounded-xl border border-dashed border-bd2 px-4 py-3 text-[13px] font-semibold leading-none text-mut transition-colors hover:bg-bg2"
        aria-expanded={showMore}
      >
        <span>{showMore ? "Fewer transaction types" : `More transaction types · ${ADVANCED.length} more`}</span>
        {showMore ? <Minus className="size-4" strokeWidth={2.2} /> : <Plus className="size-4" strokeWidth={2.2} />}
      </button>

      {showMore && (
        <div className="-mt-2 flex flex-col gap-2">
          {ADVANCED.map((it) => (
            <IntentRow key={it.label} it={it} onPick={() => onPick(it.label)} />
          ))}
        </div>
      )}
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
