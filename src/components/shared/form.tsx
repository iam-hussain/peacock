import { cn } from "@/lib/utils";

const fieldCls =
  "w-full rounded-[11px] border border-bd2 bg-sf px-3 py-2.5 text-sm font-medium text-ink outline-none placeholder:text-fnt focus:border-teal";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase leading-none tracking-[0.04em] text-fnt">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] font-medium leading-[1.4] text-fnt">{hint}</span>}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldCls, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldCls, "min-h-[80px] resize-y", props.className)} />;
}

export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[] }) {
  return (
    <select {...props} className={cn(fieldCls, "appearance-none bg-[right_0.75rem_center] bg-no-repeat pr-9", props.className)}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Two fields side by side on desktop, stacked on mobile. */
export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}
