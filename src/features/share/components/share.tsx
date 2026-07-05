"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload, Download, Check, Users, TriangleAlert, Loader2, ChevronDown } from "lucide-react";
import { PeacockMark } from "@/components/shared/peacock-logo";
import { initials } from "@/lib/avatar";
import { usePageQuery, fetchJson } from "@/lib/use-page-query";
import { ClubReportPoster, MemberStatementPoster, type ClubSections, type ClubData } from "./posters";
import type { CurrentUser } from "@/server/queries/session";
import type { MemberDetailDTO } from "@/server/queries/members";

type Mode = "club" | "member";
type Stage = "generating" | "ready" | "error" | "empty";
const SECTION_KEYS = ["club", "members", "loans", "vendors"] as const;
const SECTION_LABELS: Record<keyof ClubSections, string> = { club: "Club", members: "Members", loans: "Loans", vendors: "Vendors" };
const statusLabel = (s: string) => (s === "active" ? "Active" : s === "left" ? "Left" : "Inactive");

export function Share() {
  const [mode, setMode] = useState<Mode>("club");
  const [sections, setSections] = useState<ClubSections>({ club: true, members: true, loans: true, vendors: true });
  const [incInactive, setIncInactive] = useState(false);
  const [incClosedLoans, setIncClosedLoans] = useState(false);
  const [incClosedVendors, setIncClosedVendors] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("generating");
  const [busy, setBusy] = useState<"dl" | "sh" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [asOf, setAsOf] = useState("");
  const posterRef = useRef<HTMLDivElement>(null);

  // Same endpoints + query keys as the real pages, so the posters assemble from the app's shared
  // client cache — the page shell renders instantly and each piece streams in as it resolves.
  const dash = usePageQuery<ClubData["dashboard"]>(["dashboard"], "/api/dashboard");
  const mem = usePageQuery<{ members: ClubData["members"] }>(["members"], "/api/members");
  const loan = usePageQuery<{ loans: ClubData["loans"]; stats: ClubData["loanStats"]; rate: ClubData["rate"] }>(["loans"], "/api/loans");
  const ven = usePageQuery<{ vendors: ClubData["vendors"]; stats: ClubData["vendorStats"] }>(["vendors"], "/api/vendors");
  const me = usePageQuery<{ user: CurrentUser }>(["me"], "/api/me");

  const members = mem.data?.members ?? [];
  const meId = me.data?.user.id ?? null;
  const effSelId = selId ?? meId ?? members[0]?.id ?? null;

  // Member statement is fetched per selection, on demand — same key the member page uses.
  const detail = useQuery({
    queryKey: ["member", effSelId],
    queryFn: () => fetchJson<MemberDetailDTO>(`/api/members/${effSelId}`),
    enabled: mode === "member" && !!effSelId,
  });

  const club: ClubData | null =
    dash.data && mem.data && loan.data && ven.data
      ? { dashboard: dash.data, members: mem.data.members, loans: loan.data.loans, loanStats: loan.data.stats, rate: loan.data.rate, vendors: ven.data.vendors, vendorStats: ven.data.stats }
      : null;
  const err = dash.error ?? mem.error ?? loan.error ?? ven.error ?? me.error ?? (mode === "member" ? detail.error : null);
  if (err) throw err;

  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only stamp; server has no "now"
    setAsOf(d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }));
  }, []);

  const sectionCount = SECTION_KEYS.filter((k) => sections[k]).length;
  const selected = members.find((m) => m.id === effSelId);
  const noContent = mode === "club" ? sectionCount === 0 : !!mem.data && !selected;
  const dataReady = mode === "club" ? !!club : !!detail.data || noContent;

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to spinner, then transition after fonts settle
    setStage("generating");
    if (!dataReady) return; // stay on the spinner until the queries resolve
    const done = () => live && setStage(noContent ? "empty" : "ready");
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    Promise.all([fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 450))]).then(done);
    return () => { live = false; };
  }, [mode, noContent, dataReady]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2600); };
  const by = me.data?.user.name ?? "Peacock admin";
  const pickerMembers = incInactive ? members : members.filter((m) => m.status === "active");
  const filename = mode === "member" ? `peacock-${selected?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "peacock-club-report";
  const sectionNote = SECTION_KEYS.filter((k) => sections[k]).map((k) => SECTION_LABELS[k].toLowerCase()).join(" · ");

  async function render(kind: "png" | "blob") {
    const node = posterRef.current;
    if (!node) throw new Error("not ready");
    // Heavy client-only lib — loaded on demand so it stays out of the initial bundle.
    const htmlToImage = await import("html-to-image");
    // Safari folds the preview wrapper's CSS `zoom` into the computed styles html-to-image
    // copies onto its clone, so the poster laid out squeezed/cropped. Capture at zoom 1
    // (explicit canvas size as extra safety), then restore the preview scale.
    const wrap = node.parentElement as HTMLElement;
    const prevZoom = wrap.style.zoom;
    wrap.style.zoom = "1";
    try {
      const width = parseInt(node.style.width, 10);
      const opts = { pixelRatio: 2, cacheBust: true, backgroundColor: "#F7F8F7", width, height: node.offsetHeight };
      return kind === "blob" ? await htmlToImage.toBlob(node, opts) : await htmlToImage.toPng(node, opts);
    } finally {
      wrap.style.zoom = prevZoom;
    }
  }
  async function doDownload() {
    if (busy) return;
    setBusy("dl");
    try {
      const url = (await render("png")) as string;
      const a = document.createElement("a"); a.href = url; a.download = `${filename}.png`; a.click();
      flash("Image downloaded");
    } catch { setStage("error"); } finally { setBusy(null); }
  }
  async function doShare() {
    if (busy) return;
    setBusy("sh");
    try {
      const blob = (await render("blob")) as Blob | null;
      if (!blob) throw new Error("no blob");
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
      const text = mode === "member" ? "Peacock member statement" : "Peacock Investment Club — club report";
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Peacock Investment Club", text }); flash("Shared"); } catch { /* cancelled */ }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${filename}.png`; a.click();
        URL.revokeObjectURL(url);
        flash("Saved — sharing not supported here");
      }
    } catch { setStage("error"); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-[1200px] p-4 pb-19.5 md:p-6.5 md:pb-6.5">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PeacockMark px={36} />
          <div>
            <div className="flex items-end gap-1.5">
              <span className="font-display text-22 font-extrabold leading-none tracking-[-0.03em] text-ink">peacock</span>
              <span className="mb-0.75 size-1.5 rounded-full bg-teal" />
            </div>
            <div className="mt-1.25 font-mono text-11 font-semibold leading-none tracking-6 text-mut">SHARE · CAPTURE IMAGE</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-bd bg-sf px-3.5 py-2">
          <span className="size-1.75 rounded-full bg-teal" />
          <span className="font-mono text-xs font-semibold leading-none text-teal">As of {asOf}</span>
        </div>
      </div>

      <div className="grid items-start gap-5.5 lg:grid-cols-[330px_1fr]">
        {/* ---------- controls ---------- */}
        <aside className="flex flex-col gap-4.5 rounded-18 border border-bd bg-sf p-5 lg:sticky lg:top-7">
          <div>
            <Label>What to share</Label>
            <div className="flex gap-0.75 rounded-11 border border-hair bg-bg2 p-1">
              {(["club", "member"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)} aria-pressed={mode === m} className={`flex-1 rounded-lg py-2.5 text-center text-13 font-semibold leading-none transition-colors ${mode === m ? "bg-sf text-ink shadow-card" : "text-mut"}`}>
                  {m === "club" ? "Club report" : "Single member"}
                </button>
              ))}
            </div>
          </div>

          {mode === "club" ? (
            <>
              <div>
                <div className="grid grid-cols-2 gap-2">
                  {SECTION_KEYS.map((k) => {
                    const on = sections[k];
                    return (
                      <button key={k} onClick={() => setSections((s) => ({ ...s, [k]: !s[k] }))} className={`flex items-center gap-2.5 rounded-11 border px-3.25 py-3 ${on ? "border-teal/50 bg-tlsf" : "border-bd2 bg-sf"}`}>
                        <span className={`flex size-5 flex-none items-center justify-center rounded-md border-[1.5px] ${on ? "border-teal bg-teal text-white" : "border-bd2"}`}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                        <span className={`text-13 font-semibold leading-none ${on ? "text-teal" : "text-ink"}`}>{SECTION_LABELS[k]}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2.25 text-[11.5px] font-medium leading-140 text-fnt">{sectionCount} section{sectionCount === 1 ? "" : "s"} — combined into one image</div>
              </div>
              <div>
                <Label>Include</Label>
                <div className="flex flex-col gap-2">
                  <ToggleRow label="Inactive members" on={incInactive} onClick={() => setIncInactive((v) => !v)} />
                  <ToggleRow label="Closed loans" on={incClosedLoans} onClick={() => setIncClosedLoans((v) => !v)} />
                  <ToggleRow label="Closed & active vendors" on={incClosedVendors} onClick={() => setIncClosedVendors((v) => !v)} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <Label>Member</Label>
                <button onClick={() => setPickerOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={pickerOpen} className="flex w-full items-center gap-3 rounded-11 border border-bd bg-sf px-3.25 py-3 text-left">
                  {selected && <span className="flex size-9 flex-none items-center justify-center rounded-full bg-bg2 text-12 font-bold leading-none text-mut">{initials(selected.name)}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-15 font-bold leading-none text-ink">{selected?.name ?? "Select a member"}</span>
                    <span className="mt-1.5 block text-11 font-medium leading-none text-fnt">{effSelId === meId ? "Defaults to you · click to change" : "click to change"}</span>
                  </span>
                  <ChevronDown className={`size-4 flex-none text-fnt transition-transform ${pickerOpen ? "rotate-180" : ""}`} strokeWidth={2} />
                </button>
                {pickerOpen && (
                  <div role="listbox" className="absolute z-20 mt-1.5 flex max-h-75 w-full flex-col gap-1.25 overflow-auto rounded-12 border border-bd bg-sf p-1.5 shadow-[0_10px_30px_var(--shadow)]">
                    {pickerMembers.map((m) => {
                      const on = m.id === selId;
                      return (
                        <button key={m.id} role="option" aria-selected={on} onClick={() => { setSelId(m.id); setPickerOpen(false); }} className={`flex items-center gap-2.75 rounded-10 px-2.75 py-2.25 text-left ${on ? "bg-tlsf" : "hover:bg-bg"}`}>
                          <span className="flex size-8 flex-none items-center justify-center rounded-full bg-bg2 text-11 font-bold leading-none text-mut">{initials(m.name)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-semibold leading-none text-ink">{m.name}</span>
                            <span className="mt-1 block text-[10.5px] font-medium leading-none text-fnt">{statusLabel(m.status)} · Joined {m.joined}</span>
                          </span>
                          {on && <Check className="size-4 flex-none text-teal" strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <Label>Include</Label>
                <ToggleRow label="Inactive members" on={incInactive} onClick={() => setIncInactive((v) => !v)} />
              </div>
            </>
          )}

          <div className="flex flex-col gap-2.25 border-t border-hr2 pt-4">
            <button onClick={doShare} disabled={!!busy || stage !== "ready"} className="flex w-full items-center justify-center gap-2.25 rounded-xl bg-teal p-3.5 text-sm font-bold leading-none text-white shadow-[0_8px_18px_rgba(14,140,130,0.24)] disabled:opacity-60">
              <Upload className="size-4" strokeWidth={2} /> {busy === "sh" ? "Rendering…" : "Share image"}
            </button>
            <button onClick={doDownload} disabled={!!busy || stage !== "ready"} className="flex w-full items-center justify-center gap-2.25 rounded-xl border border-bd2 bg-sf p-3.25 text-sm font-bold leading-none text-ink disabled:opacity-60">
              <Download className="size-4" strokeWidth={2} /> {busy === "dl" ? "Rendering…" : "Download PNG"}
            </button>
            <div className="mt-0.5 text-center text-[10.5px] font-medium leading-140 text-fnt">PNG · high-resolution · {mode === "club" ? sectionNote || "nothing selected" : "member statement"}</div>
          </div>
        </aside>

        {/* ---------- preview stage ---------- */}
        <main className="relative min-h-50 overflow-hidden rounded-18 border border-bd2 bg-bg2 md:min-h-140">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(var(--bd2)_1px,transparent_1px)] [background-size:18px_18px]" />
          {stage === "generating" && <StageMsg spin title="Composing image…" sub="Loading fonts, avatars & latest ledger figures" />}
          {stage === "error" && (
            <StageMsg icon={TriangleAlert} tone="out" title="Couldn't build the image" sub="The render failed. Check your connection and try again.">
              <button onClick={() => setStage("ready")} className="rounded-11 bg-teal px-5.5 py-2.75 text-13 font-bold leading-none text-white">Retry</button>
            </StageMsg>
          )}
          {stage === "empty" && <StageMsg icon={Users} title={mode === "club" ? "Nothing to show" : "No member selected"} sub={mode === "club" ? "Pick at least one section to include in the image." : "Choose a member to generate their statement."} />}
          {stage === "ready" && (
            <div className="pk-stage relative flex max-h-50 justify-center overflow-auto p-7 md:max-h-[78vh]">
              <div style={{ zoom: mode === "club" ? 0.5 : 0.62, filter: "drop-shadow(0 18px 44px rgba(20,32,30,0.28))" }}>
                {mode === "club"
                  ? club && <ClubReportPoster ref={posterRef} data={club} sections={sections} incInactive={incInactive} incClosedLoans={incClosedLoans} incClosedVendors={incClosedVendors} asOf={asOf} by={by} />
                  : detail.data && <MemberStatementPoster ref={posterRef} detail={detail.data} asOf={asOf} by={by} />}
              </div>
            </div>
          )}
        </main>
      </div>

      {toast && <div className="fixed bottom-7 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-5 py-3.5 text-13 font-semibold leading-none text-white shadow-[0_14px_34px_rgba(20,32,30,0.32)]">{toast}</div>}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.75 font-mono text-10 font-semibold uppercase leading-none tracking-[0.1em] text-fnt">{children}</div>;
}
function ToggleRow({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} role="switch" aria-checked={on} className="flex w-full items-center justify-between rounded-11 border border-bd bg-sf px-3.25 py-3 text-left">
      <span className="text-13 font-semibold leading-none text-ink">{label}</span>
      <span className={`relative h-6 w-10.5 flex-none rounded-full transition-colors ${on ? "bg-teal" : "bg-bd2"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
function StageMsg({ icon: Icon, spin, tone, title, sub, children }: { icon?: typeof Users; spin?: boolean; tone?: "out"; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-50 flex-col items-center justify-center gap-3.5 px-8 text-center md:min-h-140">
      {spin && <Loader2 className="size-8.5 animate-spin text-teal" strokeWidth={2.5} />}
      {Icon && <span className={`flex size-13 items-center justify-center rounded-full ${tone === "out" ? "bg-outbg text-out" : "bg-tlsf text-teal"}`}><Icon className="size-6" strokeWidth={2} /></span>}
      <div className="text-15 font-bold leading-none text-ink">{title}</div>
      <div className="max-w-[260px] text-xs font-medium leading-150 text-mut">{sub}</div>
      {children}
    </div>
  );
}
