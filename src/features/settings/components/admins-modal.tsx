"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Modal } from "@/components/shared/modal";
import { Avatar } from "@/components/shared/avatar";
import { setAdmin } from "@/server/actions";
import type { SettingsData } from "@/server/queries/settings";

export function AdminsButton({
  admins,
  members,
  className,
  children,
}: {
  admins: SettingsData["admins"];
  members: SettingsData["memberOptions"];
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const adminIds = useMemo(() => new Set(admins.map((a) => a.id)), [admins]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return members.filter((m) => !adminIds.has(m.value) && (m.label.toLowerCase().includes(s) || m.sub.includes(s))).slice(0, 6);
  }, [q, members, adminIds]);

  const act = (id: string, makeAdmin: boolean) =>
    start(async () => {
      const res = await setAdmin(id, makeAdmin);
      if (!res.ok) return setError(res.error ?? "Could not update admins.");
      setError(null);
      setQ("");
      router.refresh();
    });

  const close = () => {
    setOpen(false);
    setQ("");
    setError(null);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Admins"
        subtitle="Add or remove admins. Holding club cash is automatic — anyone can."
        ariaLabel="Manage admins"
        footer={
          <button type="button" onClick={close} className="flex-1 rounded-xl bg-teal py-3 text-sm font-semibold leading-none text-white">
            Done
          </button>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-11 font-bold uppercase leading-none tracking-6 text-fnt">Add an admin</div>
            <div className="flex items-center gap-2 rounded-11 border border-bd2 px-3">
              <Search className="size-3.75 flex-none text-fnt" strokeWidth={2} />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a member to make admin"
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm font-medium text-ink outline-none placeholder:text-fnt"
              />
            </div>
            {matches.length > 0 && (
              <div className="mt-1.5 overflow-hidden rounded-11 border border-bd">
                {matches.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    disabled={pending}
                    onClick={() => act(m.value, true)}
                    className="flex w-full items-center gap-3 border-b border-hr2 px-3 py-2.5 text-left last:border-b-0 hover:bg-bg2 disabled:opacity-60"
                  >
                    <Avatar name={m.label} size={34} muted />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold leading-tight text-ink">{m.label}</div>
                      <div className="truncate text-12 font-medium leading-tight text-fnt">{m.sub}</div>
                    </div>
                    <span className="text-13 font-semibold text-teal">Add</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-11 font-bold uppercase leading-none tracking-6 text-fnt">Current admins · {admins.length}</div>
            <div className="flex flex-col gap-2.5">
              {admins.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-13 border border-bd px-3.5 py-3">
                  <Avatar name={a.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold leading-none text-ink">{a.name}</div>
                    <div className="mt-1 truncate text-11 font-medium leading-none text-fnt">
                      Admin access{a.holds ? ` · Holds ${a.holds}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(a.id, false)}
                    className="rounded-lg border border-bd2 px-3.5 py-2 text-13 font-semibold leading-none text-out hover:bg-outbg disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-13 font-medium text-out">{error}</p>}
        </div>
      </Modal>
    </>
  );
}
