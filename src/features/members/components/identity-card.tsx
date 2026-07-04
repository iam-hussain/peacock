"use client";

import { CreditCard } from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { useInPoster } from "@/lib/poster";
import { initials } from "@/lib/avatar";
import type { MemberDetailDTO as MemberDetail } from "@/server/queries/members";

function TealAvatar({ name, src, size }: { name: string; src?: string | null; size: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- inline base64 avatar, no image domain config
      <img src={src} alt="" className="flex-none rounded-full border-[3px] border-sf object-cover" style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full border-[3px] border-sf bg-teal font-bold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials(name)}
    </div>
  );
}

// Whole months between a "Mon YYYY" join label and now — for the poster's "N mons" tenure.
const MONTH_IDX: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function monthsSince(monYear: string): number {
  const [mon, yr] = monYear.toLowerCase().split(/\s+/);
  const mi = MONTH_IDX[mon?.slice(0, 3)] ?? 0;
  const now = new Date();
  return Math.max(1, (now.getFullYear() - (Number(yr) || now.getFullYear())) * 12 + (now.getMonth() - mi));
}

export function IdentityCard({ m }: { m: MemberDetail }) {
  const inPoster = useInPoster();
  if (inPoster) {
    const st =
      m.status === "active"
        ? { label: "Active", pill: "bg-tlsf text-teal", dot: "bg-teal" }
        : m.status === "left"
          ? { label: "Settled", pill: "bg-bg2 text-mut", dot: "bg-mut" }
          : { label: "Inactive", pill: "bg-bg2 text-mut", dot: "bg-mut" };
    return (
      <div className="flex items-center justify-center gap-5 rounded-18 border border-bd bg-sf px-6 py-6.5 shadow-card">
        {m.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- inline base64 avatar, no image domain config
          <img src={m.avatarUrl} alt="" className="size-22 flex-none rounded-full object-cover" />
        ) : (
          <span className="flex size-22 flex-none items-center justify-center rounded-full bg-tlsf text-32 font-bold leading-none text-teal">
            {initials(m.name)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-[40px] font-extrabold leading-none tracking-[-0.02em] text-ink">{m.name}</h1>
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold leading-none ${st.pill}`}>
              <span className={`size-2 rounded-full ${st.dot}`} /> {st.label}
            </span>
            <span className="text-15 font-medium leading-none text-mut">Member since {m.joined} · {monthsSince(m.joined)} mons</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-18 border border-bd bg-sf shadow-card">
      <div className="h-[58px] bg-tlsf" />
      <div className="px-5 pb-5">
        <div className="-mt-8">
          <TealAvatar name={m.name} src={m.avatarUrl} size={64} />
        </div>
        <div className="mt-3.25 flex items-center gap-2.5">
          <h1 className="font-display text-21 font-extrabold leading-105 tracking-[-0.02em] text-ink">
            {m.name}
          </h1>
          <StatusBadge status={m.status} />
        </div>
        <p className="mt-2.25 text-xs font-medium leading-145 text-mut">
          Joined {m.joined} · {m.tenure} in the club
        </p>
        <div className="mt-1.5 flex items-center gap-1.75 text-xs font-medium leading-140 text-fnt">
          <CreditCard className="size-3.25" strokeWidth={2} />
          {m.managing ? `Managing ${m.managing} of club funds` : "Holds no club funds"}
        </div>
      </div>
    </div>
  );
}
