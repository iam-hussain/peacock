"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { saveClubSettings } from "@/lib/actions-client";
import type { SettingsData } from "@/server/queries/settings";
import { DateInput } from "@/components/shared/date-input";
import { Toggle } from "./settings-primitives";
import { DEFAULT_PENALTY_STATE, PenaltyFields, type PenaltyState } from "./penalty-fields";

const label = "text-11 font-bold uppercase leading-none tracking-6 text-fnt";
const input =
  "w-full rounded-11 border border-bd2 bg-sf px-3.5 py-2.5 text-sm font-medium text-ink outline-none placeholder:text-fnt focus:border-teal";
const locked = "flex items-center justify-between rounded-11 border border-bd bg-bg2 px-3.5 py-2.5 text-sm font-medium text-mut";

export function EditClubButton({ edit, className }: { edit: SettingsData["club"]["edit"]; className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dividend, setDividend] = useState(edit.dividend);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositFrom, setDepositFrom] = useState("");
  const [rate, setRate] = useState("");
  const [rateFrom, setRateFrom] = useState("");
  const penaltyOrDefault = edit.penalty ?? DEFAULT_PENALTY_STATE;
  const [penalty, setPenalty] = useState<PenaltyState>(penaltyOrDefault);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const close = () => {
    setOpen(false);
    setDividend(edit.dividend);
    setDepositAmount("");
    setDepositFrom("");
    setRate("");
    setRateFrom("");
    setPenalty(penaltyOrDefault);
    setError(null);
  };

  const submit = () =>
    start(async () => {
      const res = await saveClubSettings({
        dividend, depositAmount, depositFrom, rate, rateFrom,
        penaltyFrom: penalty.from,
        depositPenaltyEnabled: penalty.depositEnabled, depositPenaltyRate: penalty.depositRate, depositPenaltyMin: penalty.depositMin,
        interestPenaltyEnabled: penalty.interestEnabled, interestPenaltyRate: penalty.interestRate, interestPenaltyMin: penalty.interestMin, interestPenaltyGrace: penalty.interestGrace,
      });
      if (!res.ok) return setError(res.error ?? "Could not save.");
      close();
      router.refresh();
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Edit
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Edit club settings"
        subtitle="Rate and deposit changes apply going forward from their effective date — past records are untouched."
        ariaLabel="Edit club settings"
        footer={<ModalActions onCancel={close} submitLabel="Save changes" pending={pending} onSubmit={submit} />}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className={label}>Club name</span>
            <div className={locked}>
              {edit.name}
              <Lock className="size-4 text-fnt" strokeWidth={2} />
            </div>
            <span className="text-11 font-medium text-fnt">The club name can&apos;t be changed.</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={label}>Monthly deposit</span>
            <div className="grid grid-cols-2 gap-3">
              <input className={input} inputMode="decimal" placeholder="₹ New amount" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
              <DateInput value={depositFrom} onChange={setDepositFrom} />
            </div>
            <span className="text-11 font-medium text-fnt">Currently {edit.currentDeposit} / mo. Leave blank to keep it.</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={label}>Loan interest</span>
            <div className="grid grid-cols-2 gap-3">
              <input className={input} inputMode="decimal" placeholder="New rate % / mo" value={rate} onChange={(e) => setRate(e.target.value)} />
              <DateInput value={rateFrom} onChange={setRateFrom} />
            </div>
            <span className="text-11 font-medium leading-150 text-fnt">
              Applies to new loans only — existing loans keep their origination rate. Currently {edit.currentRate}.
            </span>
          </div>

          <div className="flex items-center justify-between rounded-13 border border-bd px-4 py-3.5">
            <div>
              <div className="text-sm font-bold leading-none text-ink">Dividend distribution</div>
              <div className="mt-1 text-11 font-medium leading-none text-fnt">When off, profit accumulates in the club.</div>
            </div>
            <Toggle on={dividend} onChange={setDividend} />
          </div>

          <PenaltyFields value={penalty} onChange={setPenalty} />

          <div className="flex flex-col gap-1.5">
            <span className={label}>Timezone</span>
            <div className={`${locked} font-mono`}>
              {edit.timezone}
              <Lock className="size-4 text-fnt" strokeWidth={2} />
            </div>
          </div>

          {error && <p className="text-13 font-medium text-out">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
