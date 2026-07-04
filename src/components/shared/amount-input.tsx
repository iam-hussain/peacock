/** ₹-prefixed numeric amount input used across entry/charge/payment dialogs.
 * `size` picks the display scale ("lg" = primary amount, "md" = secondary/principal). */
export function AmountInput({
  value,
  onChange,
  autoFocus,
  size = "lg",
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  size?: "md" | "lg";
}) {
  const text = size === "lg" ? "text-22" : "text-[18px]";
  return (
    <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-colors focus-within:border-teal ${value ? "border-teal" : "border-bd2"}`}>
      <span className={`font-mono ${text} font-semibold leading-none text-mut`}>₹</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        autoFocus={autoFocus}
        placeholder="0"
        className={`w-full min-w-0 bg-transparent font-mono ${text} font-semibold leading-none text-ink outline-none placeholder:text-fnt`}
      />
    </div>
  );
}
