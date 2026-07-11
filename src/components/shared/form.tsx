import { cn } from "@/lib/utils";

// Shared with the add-entry / catch-up dialogs so every modal form reads as one system:
// rounded-xl, px-4 py-3, teal focus ring.
const fieldCls =
  "w-full rounded-xl border border-bd2 bg-transparent px-4 py-3 text-sm font-medium text-ink outline-none placeholder:text-fnt focus:border-teal";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-11 font-bold uppercase leading-none tracking-5 text-fnt">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-11 font-medium leading-140 text-fnt">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldCls, "min-h-[80px] resize-y", props.className)} />;
}

export type SelectOption = string | { value: string; label: string };

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }) {
  return (
    <select {...props} className={cn(fieldCls, "appearance-none bg-[right_0.75rem_center] bg-no-repeat pr-9", props.className)}>
      {options.map((o) => {
        const { value, label } = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
    </select>
  );
}

/** Two fields side by side on desktop, stacked on mobile. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
