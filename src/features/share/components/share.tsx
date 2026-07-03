"use client";

import { useEffect, useRef, useState } from "react";
import * as htmlToImage from "html-to-image";
import { Building2, User, Upload, Download, TriangleAlert, Users, Loader2 } from "lucide-react";
import { PeacockMark } from "@/components/shared/peacock-logo";
import { ClubPoster, MemberPoster } from "./posters";
import type { ShareData } from "@/server/queries/share";

type Mode = "club" | "member";
type Theme = "light" | "dark";
type Stage = "generating" | "ready" | "error" | "empty";

export function Share({ data }: { data: ShareData }) {
  const [mode, setMode] = useState<Mode>("club");
  const [sel, setSel] = useState(0);
  const [theme, setTheme] = useState<Theme>("light");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [stage, setStage] = useState<Stage>("generating");
  const [busy, setBusy] = useState<"dl" | "sh" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [asOf, setAsOf] = useState("");
  const posterRef = useRef<HTMLDivElement>(null);

  // Stamp the capture time on the client (avoids a hydration mismatch on a server-rendered date).
  useEffect(() => {
    const d = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only stamp; server has no "now"
    setAsOf(d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }));
  }, []);

  // Compose: brief "generating" while fonts settle, then ready (or empty for a club with no active members).
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset to the spinner on each mode switch, then transition
    setStage("generating");
    const empty = mode === "club" && data.activeCount === 0;
    const done = () => live && setStage(empty ? "empty" : "ready");
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    Promise.all([fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 450))]).then(done);
    return () => { live = false; };
  }, [mode, data.activeCount]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const roster = includeInactive ? data.members : data.members.filter((m) => m.status !== "inactive");
  const rosterLabel = includeInactive ? `${data.members.length} members · incl. inactive` : `${data.activeCount} active members`;
  const selected = data.members[sel] ?? data.members[0];
  const filename = mode === "member" ? `peacock-${selected?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : "peacock-club-summary";

  async function render(kind: "png" | "blob") {
    const node = posterRef.current;
    if (!node) throw new Error("not ready");
    const opts = { pixelRatio: 2.5, cacheBust: true, backgroundColor: theme === "dark" ? "#141F1D" : "#FFFFFF" };
    return kind === "blob" ? htmlToImage.toBlob(node, opts) : htmlToImage.toPng(node, opts);
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
      const text = mode === "member" ? "Peacock member statement" : "Peacock Investment Club — club summary";
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "Peacock Investment Club", text }); flash("Shared"); }
        catch { /* user cancelled */ }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `${filename}.png`; a.click();
        URL.revokeObjectURL(url);
        flash("Saved — sharing not supported here");
      }
    } catch { setStage("error"); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto max-w-[1200px] p-4 pb-[78px] md:p-[26px] md:pb-[26px]">
      {/* header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PeacockMark px={36} />
          <div>
            <div className="flex items-end gap-1.5">
              <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.03em] text-ink">peacock</span>
              <span className="mb-[3px] size-1.5 rounded-full bg-teal" />
            </div>
            <div className="mt-[5px] font-mono text-[11px] font-semibold leading-none tracking-[0.06em] text-mut">SHARE · CAPTURE IMAGE</div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-bd bg-sf px-3.5 py-2">
          <span className="size-[7px] rounded-full bg-teal" />
          <span className="font-mono text-xs font-semibold leading-none text-teal">As of {asOf}</span>
        </div>
      </div>

      <div className="grid items-start gap-[22px] lg:grid-cols-[330px_1fr]">
        {/* ---------- controls ---------- */}
        <aside className="flex flex-col gap-[18px] rounded-[18px] border border-bd bg-sf p-5 lg:sticky lg:top-7">
          <div>
            <Label>Share type</Label>
            <div className="grid grid-cols-2 gap-2">
              <TypeButton icon={Building2} title="Club card" sub="Summary + all members" on={mode === "club"} onClick={() => setMode("club")} />
              <TypeButton icon={User} title="Member card" sub="One person's numbers" on={mode === "member"} onClick={() => setMode("member")} />
            </div>
          </div>

          {mode === "member" && (
            <div>
              <Label>Pick member</Label>
              <div className="-m-0.5 flex max-h-[280px] flex-col gap-[5px] overflow-auto p-0.5">
                {data.members.map((m, i) => {
                  const on = i === sel;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSel(i)}
                      className={`flex items-center gap-[11px] rounded-[11px] border px-[11px] py-[9px] text-left ${on ? "border-teal/40 bg-tlsf" : "border-hair bg-sf hover:bg-bg"}`}
                    >
                      <span className="flex size-8 flex-none items-center justify-center rounded-full bg-bg2 text-[11px] font-bold leading-none text-mut">{m.ini}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold leading-none text-ink">{m.name}</span>
                        <span className="mt-1 block text-[10.5px] font-medium leading-none text-fnt">{TINT_LABEL[m.status]} · since {m.joined}</span>
                      </span>
                      <span className={`size-4 flex-none rounded-full border-[1.5px] ${on ? "border-teal bg-teal" : "border-bd2 bg-sf"}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "club" && (
            <div>
              <Label>Include</Label>
              <button
                onClick={() => setIncludeInactive((v) => !v)}
                className="flex w-full items-center justify-between rounded-[11px] border border-bd bg-sf px-[13px] py-3 text-left"
              >
                <span>
                  <span className="block text-[12.5px] font-semibold leading-none text-ink">Inactive members</span>
                  <span className="mt-1 block text-[10.5px] font-medium leading-none text-fnt">{includeInactive ? "Shown in the card" : "Hidden — active only"}</span>
                </span>
                <Switch on={includeInactive} />
              </button>
            </div>
          )}

          <div>
            <Label>Theme</Label>
            <div className="flex gap-[3px] rounded-[11px] bg-bg2 p-1">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-semibold capitalize leading-none transition-colors ${theme === t ? "bg-sf text-ink shadow-[0_1px_2px_var(--shadow)]" : "text-mut"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[9px] border-t border-hr2 pt-4">
            <button
              onClick={doShare}
              disabled={!!busy || stage !== "ready"}
              className="flex w-full items-center justify-center gap-[9px] rounded-xl bg-teal p-3.5 text-sm font-bold leading-none text-white shadow-[0_8px_18px_rgba(14,140,130,0.24)] disabled:opacity-60"
            >
              <Upload className="size-4" strokeWidth={2} /> {busy === "sh" ? "Rendering…" : "Share image"}
            </button>
            <button
              onClick={doDownload}
              disabled={!!busy || stage !== "ready"}
              className="flex w-full items-center justify-center gap-[9px] rounded-xl border border-bd2 bg-sf p-[13px] text-sm font-bold leading-none text-ink disabled:opacity-60"
            >
              <Download className="size-4" strokeWidth={2} /> {busy === "dl" ? "Rendering…" : "Download PNG"}
            </button>
            <div className="mt-0.5 text-center text-[10.5px] font-medium leading-[1.4] text-fnt">PNG · high-resolution · {mode === "club" ? "club card" : "member card"}</div>
          </div>
        </aside>

        {/* ---------- preview stage ---------- */}
        <main className="relative min-h-[560px] overflow-hidden rounded-[18px] border border-bd2 bg-bg2">
          <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(var(--bd2)_1px,transparent_1px)] [background-size:18px_18px]" />

          {stage === "generating" && <StageMsg spin title="Composing image…" sub="Loading fonts, avatars & latest ledger figures" />}
          {stage === "error" && (
            <StageMsg icon={TriangleAlert} tone="out" title="Couldn't build the image" sub="The render failed. Check your connection and try again.">
              <button onClick={() => setStage("ready")} className="rounded-[11px] bg-teal px-[22px] py-[11px] text-[13px] font-bold leading-none text-white">Retry</button>
            </StageMsg>
          )}
          {stage === "empty" && <StageMsg icon={Users} title="No active members" sub="Add members to the club, then generate a shareable summary." />}
          {stage === "ready" && (
            <div className="pk-stage relative flex max-h-[78vh] justify-center overflow-auto p-7">
              <div style={{ zoom: mode === "club" ? 0.6 : 0.72, filter: "drop-shadow(0 18px 44px rgba(20,32,30,0.28))" }}>
                {mode === "club"
                  ? <ClubPoster ref={posterRef} data={{ ...data, members: roster }} theme={theme} asOf={asOf} rosterLabel={rosterLabel} />
                  : selected && <MemberPoster ref={posterRef} m={selected} theme={theme} asOf={asOf} />}
              </div>
            </div>
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-7 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-ink px-5 py-3.5 text-[13px] font-semibold leading-none text-white shadow-[0_14px_34px_rgba(20,32,30,0.32)]">
          {toast}
        </div>
      )}
    </div>
  );
}

const TINT_LABEL: Record<ShareData["members"][number]["status"], string> = { active: "Active", onLoan: "On loan", inactive: "Inactive" };

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-[11px] font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-fnt">{children}</div>;
}

function TypeButton({ icon: Icon, title, sub, on, onClick }: { icon: typeof Building2; title: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-[13px] text-left transition-colors ${on ? "border-teal bg-teal" : "border-bd bg-sf hover:bg-bg"}`}>
      <Icon className={`size-5 ${on ? "text-white" : "text-mut"}`} strokeWidth={2} />
      <div className={`mt-[9px] text-[13px] font-bold leading-none ${on ? "text-white" : "text-ink"}`}>{title}</div>
      <div className={`mt-1 text-[10.5px] font-medium leading-[1.3] ${on ? "text-white/75" : "text-fnt"}`}>{sub}</div>
    </button>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`relative h-[23px] w-10 flex-none rounded-full transition-colors ${on ? "bg-teal" : "bg-bd2"}`}>
      <span className={`absolute top-0.5 size-[19px] rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </span>
  );
}

function StageMsg({ icon: Icon, spin, tone, title, sub, children }: { icon?: typeof Users; spin?: boolean; tone?: "out"; title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center gap-3.5 px-8 text-center">
      {spin && <Loader2 className="size-[34px] animate-spin text-teal" strokeWidth={2.5} />}
      {Icon && (
        <span className={`flex size-[52px] items-center justify-center rounded-full ${tone === "out" ? "bg-outbg text-out" : "bg-tlsf text-teal"}`}>
          <Icon className="size-6" strokeWidth={2} />
        </span>
      )}
      <div className="text-[15px] font-bold leading-none text-ink">{title}</div>
      <div className="max-w-[260px] text-xs font-medium leading-[1.5] text-mut">{sub}</div>
      {children}
    </div>
  );
}
