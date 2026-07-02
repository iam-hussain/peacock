// Static portfolio snapshot shown on the landing hero (illustrative figures from the design).
// `compact` = the mobile variant: tighter padding and no recent-activity rows.
const MINI = [
  { label: "Cash", value: "₹6.85L" },
  { label: "Loans", value: "₹18.4L" },
  { label: "Vendors", value: "₹9.5L" },
];

export function PortfolioPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`animate-in fade-in zoom-in-95 border border-bd bg-sf shadow-[0_1px_2px_var(--shadow),0_24px_60px_var(--shadow)] ${
        compact ? "rounded-[18px] p-[18px]" : "rounded-[20px] p-[22px]"
      }`}
    >
      <div className={`bg-teal text-white ${compact ? "mb-3 rounded-[15px] p-[18px]" : "mb-3.5 rounded-2xl p-5"}`}>
        <div
          className={`font-semibold uppercase leading-none tracking-[0.04em] text-teal-ink ${compact ? "text-[10px]" : "text-[11px]"}`}
        >
          Portfolio value
        </div>
        <div className={`font-mono font-semibold leading-none ${compact ? "my-[11px] text-[28px]" : "my-3 text-[32px]"}`}>
          ₹48,20,000
        </div>
        <div className="text-xs font-semibold leading-none text-teal-soft">+4.2% this month</div>
      </div>

      <div className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-2.5"}`}>
        {MINI.map((m) => (
          <div
            key={m.label}
            className={`border border-hair bg-bg ${compact ? "rounded-[11px] p-[11px]" : "rounded-xl p-[13px]"}`}
          >
            <div
              className={`font-semibold uppercase leading-[1.1] text-fnt ${compact ? "text-[9px]" : "text-[10px]"}`}
            >
              {m.label}
            </div>
            <div
              className={`mt-[6px] font-mono font-semibold leading-none text-ink ${compact ? "text-sm" : "mt-[7px] text-base"}`}
            >
              {m.value}
            </div>
          </div>
        ))}
      </div>

      {!compact && (
        <div className="mt-3.5 overflow-hidden rounded-xl border border-hair">
          <PreviewRow name="Anita Rao · Deposit" amount="+₹5,000" dir="in" divider />
          <PreviewRow name="Rahul Menon · Loan" amount="−₹1.5L" dir="out" />
        </div>
      )}
    </div>
  );
}

function PreviewRow({
  name,
  amount,
  dir,
  divider = false,
}: {
  name: string;
  amount: string;
  dir: "in" | "out";
  divider?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 px-[13px] py-[11px] ${divider ? "border-b border-hr2" : ""}`}>
      <span className={`size-[7px] rounded-full ${dir === "in" ? "bg-in" : "bg-out"}`} />
      <span className="flex-1 text-xs font-semibold leading-none text-ink">{name}</span>
      <span className={`font-mono text-xs font-semibold leading-none ${dir === "in" ? "text-in" : "text-out"}`}>
        {amount}
      </span>
    </div>
  );
}
