export function Card({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-bd bg-sf shadow-card">{children}</div>;
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-6.5 w-11.5 flex-none rounded-full transition-colors ${on ? "bg-teal" : "bg-bd2"}`}
    >
      <span className={`absolute top-0.75 size-5 rounded-full bg-white shadow-sm transition-all ${on ? "left-[23px]" : "left-0.75"}`} />
    </button>
  );
}

export function FieldRow({ label, value, last = false, mono = true }: { label: string; value: string; last?: boolean; mono?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-5 py-3.5 ${last ? "" : "border-b border-hr2"}`}>
      <span className="text-13 font-medium leading-none text-mut">{label}</span>
      <span className={`text-13 font-semibold leading-none text-ink ${mono ? "font-mono" : "font-sans"}`}>{value}</span>
    </div>
  );
}
