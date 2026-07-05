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
      className={`border border-bd bg-sf shadow-pop ${
        compact ? "rounded-18 p-4.5" : "rounded-20 p-5.5"
      }`}
    >
      <div className={`bg-teal text-white ${compact ? "mb-3 rounded-15 p-4.5" : "mb-3.5 rounded-2xl p-5"}`}>
        <div
          className={`font-semibold uppercase leading-none tracking-4 text-teal-ink ${compact ? "text-10" : "text-11"}`}
        >
          Portfolio value
        </div>
        <div className={`font-mono font-semibold leading-none ${compact ? "my-2.75 text-28" : "my-3 text-32"}`}>
          ₹48,20,000
        </div>
        <div className="text-xs font-semibold leading-none text-teal-soft">+4.2% this month</div>
      </div>

      <div className={`grid grid-cols-3 ${compact ? "gap-2" : "gap-2.5"}`}>
        {MINI.map((m) => (
          <div
            key={m.label}
            className={`border border-hair bg-bg ${compact ? "rounded-11 p-2.75" : "rounded-xl p-3.25"}`}
          >
            <div
              className={`font-semibold uppercase leading-110 text-fnt ${compact ? "text-9" : "text-10"}`}
            >
              {m.label}
            </div>
            <div
              className={`mt-1.5 font-mono font-semibold leading-none text-ink ${compact ? "text-sm" : "mt-1.75 text-base"}`}
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
    <div className={`flex items-center gap-2.5 px-3.25 py-2.75 ${divider ? "border-b border-hr2" : ""}`}>
      <span className={`size-1.75 rounded-full ${dir === "in" ? "bg-in" : "bg-out"}`} />
      <span className="flex-1 text-xs font-semibold leading-none text-ink">{name}</span>
      <span className={`font-mono text-xs font-semibold leading-none ${dir === "in" ? "text-in" : "text-out"}`}>
        {amount}
      </span>
    </div>
  );
}
