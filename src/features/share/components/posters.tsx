import { forwardRef, type CSSProperties } from "react";
import { PeacockMark } from "@/components/shared/peacock-logo";
import type { ShareData, ShareMember, ShareStatus } from "@/server/queries/share";

// ponytail: this is an EXPORT surface — the PNG must look identical regardless of the viewer's app
// theme, and it carries its own light/dark. So its palette is baked here (as CSS vars) rather than
// pulled from the app tokens. This is the "capture card" exception, not app chrome.
type Theme = "light" | "dark";
const POSTER: Record<Theme, CSSProperties> = {
  light: { "--pp-bg": "#FFFFFF", "--pp-panel": "#F6F8F7", "--pp-hair": "#E7EAE9", "--pp-rowhair": "#F0F3F2", "--pp-ink": "#14201E", "--pp-mut": "#7A8884", "--pp-teal": "#0E8C82" } as CSSProperties,
  dark: { "--pp-bg": "#141F1D", "--pp-panel": "#1C2A27", "--pp-hair": "#2C3C39", "--pp-rowhair": "#243431", "--pp-ink": "#F1F6F4", "--pp-mut": "#9AB0AB", "--pp-teal": "#2BB6A9" } as CSSProperties,
};
const TINT: Record<ShareStatus, { bg: string; fg: string; dot: string; label: string }> = {
  active: { bg: "#EAF3F1", fg: "#0B6E66", dot: "#0E8C82", label: "Active" },
  onLoan: { bg: "#FBF1E3", fg: "#9A6B12", dot: "#D9A521", label: "On loan" },
  inactive: { bg: "#EEF1F0", fg: "#7A8884", dot: "#9AA8A4", label: "Inactive" },
};
const DARK_HEADER = "#14201E"; // poster header is always dark ink in both themes
const RED = "#C0392B";
const AMBER = "#9A6B12";

const ink = { color: "var(--pp-ink)" };
const mut = { color: "var(--pp-mut)" };
const mono = "font-mono";

function Avatar({ m, px }: { m: ShareMember; px: number }) {
  const t = TINT[m.status];
  return (
    <span style={{ width: px, height: px, background: t.bg, color: t.fg, fontSize: Math.round(px * 0.36) }} className="flex flex-none items-center justify-center rounded-full font-bold leading-none">
      {m.ini}
    </span>
  );
}

/** Club summary poster — 1080px capture surface: dark hero, KPI strip, member roster, footer. */
export const ClubPoster = forwardRef<HTMLDivElement, { data: ShareData; theme: Theme; asOf: string; rosterLabel: string }>(
  function ClubPoster({ data, theme, asOf, rosterLabel }, ref) {
    const kpis = [
      { l: "MEMBERS", v: data.club.members, s: "active" },
      { l: "CASH", v: data.club.cash, s: "available" },
      { l: "DEPOSITS", v: data.club.deposits, s: "total held" },
      { l: "LOANS", v: data.club.loans, s: "outstanding" },
      { l: "INTEREST", v: data.club.interest, s: "pending" },
    ];
    return (
      <div ref={ref} style={{ ...POSTER[theme], width: 1080, background: "var(--pp-bg)", borderRadius: 8, overflow: "hidden" }}>
        {/* hero */}
        <div style={{ background: DARK_HEADER, color: "#fff", padding: "46px 56px 40px" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <PeacockMark px={62} onDark />
              <div>
                <div className="flex items-end gap-2">
                  <span className="font-display font-extrabold" style={{ fontSize: 40, lineHeight: 0.9, letterSpacing: "-0.03em" }}>peacock</span>
                  <span className="rounded-full" style={{ width: 10, height: 10, background: "#0E8C82", marginBottom: 7 }} />
                </div>
                <div className="font-semibold" style={{ fontSize: 15, color: "#8FA39E", letterSpacing: "0.05em", marginTop: 10 }}>INVESTMENT CLUB</div>
              </div>
            </div>
            <div className="text-right">
              <div className={`${mono} font-semibold`} style={{ fontSize: 13, color: "#5FA89F", letterSpacing: "0.14em" }}>CLUB SUMMARY</div>
              <div className="font-medium" style={{ fontSize: 18, lineHeight: 1.35, color: "#D6E0DD", marginTop: 12 }}>As of<br />{asOf}</div>
            </div>
          </div>
          <div style={{ marginTop: 38 }}>
            <div className="font-semibold uppercase" style={{ fontSize: 14, letterSpacing: "0.05em", color: "#7FB8B0" }}>Total portfolio value</div>
            <div className={`${mono} font-semibold`} style={{ fontSize: 76, lineHeight: 0.95, marginTop: 16 }}>{data.club.portfolio}</div>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", background: "var(--pp-panel)", borderBottom: "1px solid var(--pp-hair)" }}>
          {kpis.map((k, i) => (
            <div key={k.l} style={{ padding: "26px 22px", borderRight: i < 4 ? "1px solid var(--pp-hair)" : undefined }}>
              <div className={`${mono} font-semibold`} style={{ fontSize: 12, letterSpacing: "0.1em", ...mut }}>{k.l}</div>
              <div className={`${mono} font-semibold`} style={{ fontSize: 30, lineHeight: 1, marginTop: 13, ...ink }}>{k.v}</div>
              <div className="font-medium" style={{ fontSize: 12, marginTop: 8, ...mut }}>{k.s}</div>
            </div>
          ))}
        </div>

        {/* roster */}
        <div style={{ padding: "40px 56px 30px", background: "var(--pp-bg)" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
            <div className="font-bold" style={{ fontSize: 28, letterSpacing: "-0.02em", ...ink }}>Members</div>
            <div className="font-medium" style={{ fontSize: 16, ...mut }}>{rosterLabel}</div>
          </div>
          <div style={{ background: "var(--pp-panel)", border: "1px solid var(--pp-hair)", borderRadius: 20, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) 1fr 1fr 1fr 1fr", gap: 14, padding: "16px 28px", borderBottom: "1px solid var(--pp-hair)" }}>
              {["MEMBER", "PENDING", "DEPOSIT", "LOAN", "INTEREST"].map((h, i) => (
                <div key={h} className={`${mono} font-semibold`} style={{ fontSize: 12, letterSpacing: "0.08em", textAlign: i === 0 ? "left" : "right", ...mut }}>{h}</div>
              ))}
            </div>
            {data.members.map((m) => (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.7fr) 1fr 1fr 1fr 1fr", gap: 14, alignItems: "center", padding: "18px 28px", borderBottom: "1px solid var(--pp-rowhair)" }}>
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar m={m} px={56} />
                  <div className="min-w-0">
                    <div className="truncate font-bold" style={{ fontSize: 22, lineHeight: 1, ...ink }}>{m.name}</div>
                    <div className="flex items-center gap-2" style={{ marginTop: 9 }}>
                      <span className="rounded-full" style={{ width: 8, height: 8, background: TINT[m.status].dot }} />
                      <span className="font-medium" style={{ fontSize: 14, ...mut }}>{m.meta}</span>
                    </div>
                  </div>
                </div>
                <Cell v={m.pending} color={RED} />
                <Cell v={m.deposit} />
                <Cell v={m.loan} color={AMBER} />
                <Cell v={m.interestDue} color={AMBER} />
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between" style={{ background: "var(--pp-bg)", padding: "8px 56px 44px" }}>
          <div className="flex items-center gap-4">
            <PeacockMark px={42} />
            <div className="font-semibold" style={{ fontSize: 19, lineHeight: 1.2, color: "var(--pp-teal)" }}>Many feathers,<br />one fortune.</div>
          </div>
          <div className="text-right">
            <div className={`${mono} font-semibold`} style={{ fontSize: 14, letterSpacing: "0.04em", ...mut }}>peacock.club</div>
            <div className="font-medium" style={{ fontSize: 13, marginTop: 10, ...mut }}>Figures in ₹ · admin snapshot</div>
          </div>
        </div>
      </div>
    );
  },
);

// A right-aligned mono money cell; muted "—" when absent, tinted when present.
function Cell({ v, color }: { v: string | null; color?: string }) {
  return (
    <div className={`${mono} font-semibold`} style={{ fontSize: 22, lineHeight: 1, textAlign: "right", color: v ? color ?? "var(--pp-ink)" : "var(--pp-mut)" }}>
      {v ?? "—"}
    </div>
  );
}

/** Single-member statement poster — 880px capture surface. */
export const MemberPoster = forwardRef<HTMLDivElement, { m: ShareMember; theme: Theme; asOf: string }>(
  function MemberPoster({ m, theme, asOf }, ref) {
    const t = TINT[m.status];
    const stats = [
      { l: "PENDING BALANCE", v: m.pending, color: RED },
      { l: "TOTAL DEPOSIT", v: m.deposit },
      { l: "CURRENT LOAN", v: m.loan, color: AMBER },
      { l: "INTEREST PENDING", v: m.interestDue, color: AMBER },
    ];
    return (
      <div ref={ref} style={{ ...POSTER[theme], width: 880, background: "var(--pp-bg)", borderRadius: 8, overflow: "hidden" }}>
        <div className="flex items-start justify-between" style={{ background: DARK_HEADER, color: "#fff", padding: "38px 50px 34px" }}>
          <div className="flex items-center gap-3.5">
            <PeacockMark px={40} onDark />
            <div className="flex items-end gap-1.5">
              <span className="font-display font-extrabold" style={{ fontSize: 26, lineHeight: 0.9, letterSpacing: "-0.03em" }}>peacock</span>
              <span className="rounded-full" style={{ width: 7, height: 7, background: "#0E8C82", marginBottom: 4 }} />
            </div>
          </div>
          <div className="text-right">
            <div className={`${mono} font-semibold`} style={{ fontSize: 12, color: "#5FA89F", letterSpacing: "0.14em" }}>MEMBER STATEMENT</div>
            <div className="font-medium" style={{ fontSize: 15, color: "#D6E0DD", marginTop: 10 }}>As of {asOf}</div>
          </div>
        </div>

        <div style={{ padding: "42px 50px 30px", background: "var(--pp-bg)" }}>
          <div className="flex items-center gap-5">
            <Avatar m={m} px={96} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold" style={{ fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em", ...ink }}>{m.name}</div>
              <div className="flex items-center gap-3" style={{ marginTop: 13 }}>
                <div className="flex items-center gap-2 rounded-full" style={{ background: t.bg, padding: "7px 14px" }}>
                  <span className="rounded-full" style={{ width: 8, height: 8, background: t.dot }} />
                  <span className="font-semibold" style={{ fontSize: 14, color: t.fg }}>{t.label}</span>
                </div>
                <div className="font-medium" style={{ fontSize: 16, ...mut }}>Member since {m.joined} · {m.tenure}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 34 }}>
            {stats.map((s) => (
              <div key={s.l} style={{ background: "var(--pp-panel)", border: "1px solid var(--pp-hair)", borderRadius: 18, padding: "24px 26px" }}>
                <div className={`${mono} font-semibold`} style={{ fontSize: 13, letterSpacing: "0.06em", ...mut }}>{s.l}</div>
                <div className={`${mono} font-semibold`} style={{ fontSize: 38, lineHeight: 1, marginTop: 16, color: s.v ? s.color ?? "var(--pp-ink)" : "var(--pp-ink)" }}>{s.v ?? "₹0"}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between" style={{ marginTop: 16, background: "var(--pp-teal)", borderRadius: 18, padding: "24px 28px" }}>
            <div>
              <div className="font-semibold uppercase" style={{ fontSize: 13, letterSpacing: "0.04em", color: "#CFF3EF" }}>Total holding value</div>
              <div className="font-semibold" style={{ fontSize: 16, color: "#EAFBF8", marginTop: 9 }}>Deposits + profit share</div>
            </div>
            <div className={`${mono} font-semibold`} style={{ fontSize: 44, lineHeight: 1, color: "#fff" }}>{m.holding}</div>
          </div>
        </div>

        <div className="flex items-center justify-between" style={{ background: "var(--pp-bg)", padding: "6px 50px 40px" }}>
          <div className="font-semibold" style={{ fontSize: 18, lineHeight: 1.2, color: "var(--pp-teal)" }}>Many feathers, one fortune.</div>
          <div className="text-right">
            <div className={`${mono} font-semibold`} style={{ fontSize: 13, letterSpacing: "0.04em", ...mut }}>peacock.club</div>
            <div className="font-medium" style={{ fontSize: 12, marginTop: 9, ...mut }}>Figures in ₹</div>
          </div>
        </div>
      </div>
    );
  },
);
