"use client";

import { useId, useState, useTransition } from "react";
import { Modal, ModalActions } from "./modal";
import { Field, TextInput, Textarea, Select, FieldRow, type SelectOption } from "./form";
import { SelectorCard, PickerSheet, type PickOption } from "./entity-picker";
import { formAction } from "@/server/actions";

export interface FieldDef {
  name: string;
  label: string;
  type?: "text" | "tel" | "email" | "date" | "month" | "password" | "number" | "textarea";
  options?: SelectOption[];
  placeholder?: string;
  hint?: string;
  defaultValue?: string;
  required?: boolean;
  half?: boolean; // renders half-width; two consecutive half fields sit side by side
  // when set, the field renders as a selector-card that opens an entity picker
  pickerOptions?: PickOption[];
  pickerTitle?: string;
  pickerSubtitle?: string;
  pickerSearch?: string;
}

// Group fields into rows: two consecutive `half` fields pair into one 2-col row; everything else
// is its own full-width row.
function groupHalves(fields: FieldDef[]): FieldDef[][] {
  const rows: FieldDef[][] = [];
  for (let i = 0; i < fields.length; i++) {
    if (fields[i].half && fields[i + 1]?.half) {
      rows.push([fields[i], fields[i + 1]]);
      i++;
    } else {
      rows.push([fields[i]]);
    }
  }
  return rows;
}

/**
 * Renders a trigger (render-prop) that opens a modal with a field-driven form.
 * Submits to the stub action and closes. Used for add/edit/admin dialogs everywhere.
 */
export function FormModalButton({
  children,
  buttonClassName,
  buttonAriaLabel,
  title,
  subtitle,
  kind,
  fields,
  submitLabel = "Save",
  destructive = false,
  intro,
  outro,
  hiddenFields,
}: {
  children: React.ReactNode;
  buttonClassName?: string;
  buttonAriaLabel?: string;
  title: string;
  subtitle?: string;
  kind: string;
  fields: FieldDef[];
  submitLabel?: string;
  destructive?: boolean;
  intro?: React.ReactNode;
  outro?: React.ReactNode;
  hiddenFields?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [picking, setPicking] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, PickOption | null>>({});
  const id = useId();

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await formAction(kind, fd);
      if (res.ok) {
        setError(null);
        close();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  };

  const close = () => {
    setError(null);
    setOpen(false);
    setPicking(null);
    setPicked({});
  };

  const pickingField = picking ? fields.find((f) => f.name === picking) : null;
  const today = new Date().toISOString().slice(0, 10); // date fields default to today

  const renderField = (f: FieldDef) => (
    <Field key={f.name} label={f.label} hint={f.hint}>
      {f.pickerOptions ? (
        <>
          <SelectorCard
            selected={picked[f.name] ?? null}
            placeholder={f.placeholder ?? "Nothing selected"}
            hint="Tap to choose"
            onOpen={() => setPicking(f.name)}
          />
          <input type="hidden" name={f.name} value={picked[f.name]?.name ?? ""} />
        </>
      ) : f.options ? (
        <Select name={f.name} options={f.options} defaultValue={f.defaultValue} />
      ) : f.type === "textarea" ? (
        <Textarea name={f.name} placeholder={f.placeholder} defaultValue={f.defaultValue} required={f.required} />
      ) : (
        <TextInput
          name={f.name}
          type={f.type ?? "text"}
          placeholder={f.placeholder}
          defaultValue={f.defaultValue ?? (f.type === "date" ? today : undefined)}
          required={f.required}
        />
      )}
    </Field>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={buttonClassName} aria-label={buttonAriaLabel}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={close}
        title={title}
        ariaLabel={title}
        subtitle={picking ? undefined : subtitle}
        hideHeader={!!picking}
        footer={picking ? undefined : <ModalActions onCancel={close} submitLabel={submitLabel} pending={pending} formId={id} destructive={destructive} />}
      >
        {picking && pickingField ? (
          <PickerSheet
            title={pickingField.pickerTitle ?? pickingField.label}
            subtitle={pickingField.pickerSubtitle ?? "Choose one."}
            searchPlaceholder={pickingField.pickerSearch ?? "Search…"}
            options={pickingField.pickerOptions ?? []}
            onPick={(o) => {
              setPicked((p) => ({ ...p, [pickingField.name]: o }));
              setPicking(null);
            }}
            onBack={() => setPicking(null)}
          />
        ) : (
          <>
            {intro}
            <form id={id} onSubmit={onSubmit} className="flex flex-col gap-5">
              {hiddenFields &&
                Object.entries(hiddenFields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              {groupHalves(fields).map((row) =>
                row.length === 2 ? (
                  <FieldRow key={row[0].name}>{row.map(renderField)}</FieldRow>
                ) : (
                  <div key={row[0].name}>{renderField(row[0])}</div>
                ),
              )}
              {outro}
              {error && <p className="text-[13px] font-medium leading-[1.4] text-out">{error}</p>}
            </form>
          </>
        )}
      </Modal>
    </>
  );
}
