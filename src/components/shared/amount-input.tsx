/** Live Indian grouping as the user types ("106000" → "1,06,000"). Idempotent; keeps a
 * ".dd" decimal and the L/Cr shorthand rupeesToPaise already understands. */
function formatAmount(v: string): string {
  const raw = v.toLowerCase().trim();
  const suffix = raw.endsWith("cr") ? "cr" : raw.endsWith("l") ? "l" : "";
  const [int = "", ...dec] = raw.replace(/[^0-9.]/g, "").split(".");
  const grouped = int ? new Intl.NumberFormat("en-IN").format(BigInt(int)) : "";
  const decimal = dec.length ? `.${dec.join("").slice(0, 2)}` : "";
  return grouped + decimal + suffix;
}

/** ₹-prefixed numeric amount input used across entry/charge/payment/vendor dialogs.
 * `size` picks the display scale ("lg" = primary amount, "md" = secondary/principal);
 * `highlight` gives the teal ring used for auto-filled values (e.g. chit margin). */
export function AmountInput({
  value,
  onChange,
  autoFocus,
  size = "lg",
  placeholder = "0",
  highlight = false,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  size?: "md" | "lg";
  placeholder?: string;
  highlight?: boolean;
}) {
  const text = size === "lg" ? "text-22" : "text-[18px]";
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-colors focus-within:border-teal ${
        highlight ? "border-teal bg-tlsf/40" : value ? "border-teal" : "border-bd2"
      }`}
    >
      <span className={`font-mono ${text} font-semibold leading-none text-mut`}>₹</span>
      <input
        value={formatAmount(value)}
        onChange={(e) => onChange(formatAmount(e.target.value))}
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={`w-full min-w-0 bg-transparent font-mono ${text} font-semibold leading-none text-ink outline-none placeholder:text-fnt`}
      />
    </div>
  );
}
