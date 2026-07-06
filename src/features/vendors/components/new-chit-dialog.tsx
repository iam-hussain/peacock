"use client";

import { useId, useState, useTransition } from "react";
import { Modal, ModalActions } from "@/components/shared/modal";
import { Field, TextInput, FieldRow } from "@/components/shared/form";
import { AmountInput } from "@/components/shared/amount-input";
import { MonthInput } from "@/components/shared/month-input";
import { formAction } from "@/lib/actions-client";

const digits = (s: string) => s.replace(/[^\d]/g, "");

export function NewChitDialog({ children, buttonClassName }: { children: React.ReactNode; buttonClassName?: string }) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [months, setMonths] = useState("20");
  const [margin, setMargin] = useState("");
  const [marginTouched, setMarginTouched] = useState(false);
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  // Auto margin = chit value ÷ duration (PRODUCT.md §10), shown until the admin overrides it.
  const v = Number(digits(value));
  const m = Number(months);
  const autoMargin = v > 0 && m > 0 ? Math.round(v / m) : 0;
  const marginDisplay = marginTouched ? margin : autoMargin > 0 ? autoMargin.toLocaleString("en-IN") : "";

  const close = () => {
    setOpen(false);
    setValue("");
    setMonths("20");
    setMargin("");
    setMarginTouched(false);
    setStart(new Date().toISOString().slice(0, 7));
    setError(null);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("value", digits(value));
    fd.set("months", months);
    fd.set("margin", marginTouched ? digits(margin) : ""); // blank → server computes value ÷ months
    fd.set("start", start);
    run(async () => {
      const res = await formAction("newChit", fd);
      if (res.ok) close();
      else setError(res.error ?? "Something went wrong.");
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={close}
        title="Set up a chit fund"
        subtitle="The max monthly (margin) is the chit value divided by its duration — editable if your chit differs."
        wide
        footer={<ModalActions onCancel={close} submitLabel="Create chit" pending={pending} formId={formId} />}
      >
        <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label="Chit name">
            <TextInput name="name" placeholder="e.g. Sri Lakshmi Chits" required />
          </Field>

          <FieldRow>
            <Field label="Chit value (₹)">
              <AmountInput size="md" value={value} onChange={setValue} placeholder="5,00,000" />
            </Field>
            <Field label="Duration (months)">
              <TextInput type="number" min={1} value={months} onChange={(e) => setMonths(e.target.value)} placeholder="20" />
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Max monthly · margin" hint="Auto = value ÷ months">
              <AmountInput
                size="md"
                value={marginDisplay}
                onChange={(val) => {
                  setMarginTouched(true);
                  setMargin(val);
                }}
                placeholder="25,000"
                highlight={!marginTouched && autoMargin > 0}
              />
            </Field>
            <Field label="Start date">
              <MonthInput value={start} onChange={setStart} />
            </Field>
          </FieldRow>

          {error && <p className="text-13 font-medium leading-140 text-out">{error}</p>}
        </form>
      </Modal>
    </>
  );
}
