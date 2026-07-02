"use client";

import { useState } from "react";
import { Upload, Download, Check } from "lucide-react";
import { PeacockMark } from "@/components/shared/peacock-logo";

const SECTIONS = ["Club", "Members", "Loans", "Vendors"] as const;
const INCLUDE = ["Inactive members", "Closed loans", "Closed & active vendors"] as const;

export function Share() {
  const [mode, setMode] = useState<"club" | "single">("club");
  const [sel, setSel] = useState<Record<string, boolean>>({ Club: true, Members: true, Loans: false, Vendors: false });
  const [inc, setInc] = useState<Record<string, boolean>>({ "Inactive members": false, "Closed loans": false, "Closed & active vendors": false });
  const count = Object.values(sel).filter(Boolean).length;

  return (
    <div className="mx-auto max-w-[1280px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      <h1 className="text-2xl font-bold leading-none tracking-[-0.02em] text-ink">Share · capture image</h1>
      <p className="mb-[22px] mt-1 max-w-[600px] text-[13px] font-medium leading-[1.55] text-mut">
        Pick the sections you want, tune the look, and export a clean image to send on WhatsApp or save as a PNG.
      </p>

      <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        {/* controls */}
        <div className="flex flex-col gap-5 rounded-2xl border border-hair bg-sf p-5">
          <div>
            <Label>What to share</Label>
            <div className="mb-3 flex rounded-[11px] border border-hair bg-bg2 p-1">
              {(["club", "single"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg p-2.5 text-center text-xs font-semibold leading-none ${
                    mode === m ? "bg-sf text-ink shadow-[0_1px_2px_var(--shadow)]" : "text-mut"
                  }`}
                >
                  {m === "club" ? "Club report" : "Single member"}
                </button>
              ))}
            </div>
            {mode === "club" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {SECTIONS.map((s) => {
                    const on = sel[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setSel((p) => ({ ...p, [s]: !p[s] }))}
                        className={`flex items-center gap-2.5 rounded-[11px] border px-[13px] py-3 ${
                          on ? "border-teal/50 bg-tlsf" : "border-bd2 bg-sf"
                        }`}
                      >
                        <span className={`flex size-5 flex-none items-center justify-center rounded-md border-[1.5px] ${on ? "border-teal bg-teal text-white" : "border-bd2"}`}>
                          {on && <Check className="size-3" strokeWidth={3} />}
                        </span>
                        <span className={`text-[13px] font-semibold leading-none ${on ? "text-teal" : "text-ink"}`}>{s}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-[9px] text-[11.5px] font-medium leading-[1.4] text-fnt">{count} section(s) selected.</div>
              </>
            )}
          </div>

          <div>
            <Label>Include</Label>
            <div className="flex flex-col gap-2">
              {INCLUDE.map((i) => {
                const on = inc[i];
                return (
                  <button
                    key={i}
                    onClick={() => setInc((p) => ({ ...p, [i]: !p[i] }))}
                    className="flex items-center justify-between rounded-[11px] border border-bd bg-sf px-[13px] py-3"
                  >
                    <span className="text-[13px] font-semibold leading-none text-ink">{i}</span>
                    <span className={`relative h-6 w-[42px] flex-none rounded-full transition-colors ${on ? "bg-teal" : "bg-bd2"}`}>
                      <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-t border-hr2 pt-[18px]">
            <button className="flex w-full items-center justify-center gap-[9px] rounded-xl bg-teal p-3.5 text-sm font-bold leading-none text-white shadow-[0_8px_18px_rgba(14,140,130,0.24)]">
              <Upload className="size-4" strokeWidth={2} /> Share image
            </button>
            <button className="flex w-full items-center justify-center gap-[9px] rounded-xl border border-bd2 bg-sf p-[13px] text-sm font-bold leading-none text-ink">
              <Download className="size-4" strokeWidth={2} /> Download PNG
            </button>
            <div className="mt-0.5 text-center text-[11px] font-medium leading-[1.4] text-fnt">Exports at 1080px wide · PNG</div>
          </div>
        </div>

        {/* preview */}
        <div className="rounded-2xl border border-hair bg-bg2 p-5 md:p-8">
          <div className="mx-auto max-w-[520px] overflow-hidden rounded-2xl border border-bd bg-sf shadow-[0_10px_40px_var(--shadow)]">
            <div className="flex items-center gap-2.5 bg-teal px-6 py-5 text-white">
              <PeacockMark px={34} biasY={54} />
              <div>
                <div className="font-display text-lg font-extrabold leading-none tracking-[-0.02em]">Peacock Club</div>
                <div className="mt-1.5 text-[11px] font-semibold leading-none text-teal-mut">Club report · June 2025</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-hair">
              {[
                { l: "Portfolio value", v: "₹48,20,000" },
                { l: "Members", v: "48" },
                { l: "Cash in hand", v: "₹6,85,400" },
                { l: "Loans out", v: "₹18,40,000" },
              ].map((k) => (
                <div key={k.l} className="bg-sf px-6 py-5">
                  <div className="text-[10px] font-semibold uppercase leading-none tracking-[0.04em] text-fnt">{k.l}</div>
                  <div className="mt-2.5 font-mono text-xl font-semibold leading-none text-ink">{k.v}</div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 text-center text-[11px] font-medium leading-none text-fnt">
              Generated by Peacock · Many feathers, one fortune.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[10px] font-semibold uppercase leading-none tracking-[0.09em] text-fnt">{children}</div>
  );
}
