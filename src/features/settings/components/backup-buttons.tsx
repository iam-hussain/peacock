"use client";

import { useRef, useState, useTransition } from "react";
import { exportBackup, importBackup } from "@/lib/actions-client";

/** Download the whole club DB as a JSON file. */
export function CreateBackupButton() {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const onExport = () =>
    start(async () => {
      const res = await exportBackup();
      if (!res.ok || !res.json) return setErr(res.error ?? "Export failed.");
      setErr(null);
      const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `peacock-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={onExport} disabled={pending} className="rounded-lg bg-tlsf px-3.5 py-2.5 text-xs font-semibold leading-none text-teal hover:bg-teal/15 disabled:opacity-60">
        {pending ? "Preparing…" : "Create backup"}
      </button>
      {err && <span className="text-11 font-medium text-out">{err}</span>}
    </div>
  );
}

/** Merge a JSON backup into the DB — adds rows that don't already exist, keeps current data. */
export function ImportButton() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!confirm("Restore will add any rows from this backup that aren't already in the club. Existing data is kept unchanged. Continue?")) return;
    const reader = new FileReader();
    reader.onload = () =>
      start(async () => {
        const res = await importBackup(String(reader.result));
        if (!res.ok) setMsg({ ok: false, text: res.error ?? "Import failed." });
        else {
          setMsg({ ok: true, text: "Restored — reloading…" });
          location.reload();
        }
      });
    reader.readAsText(file);
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
      <button onClick={() => fileRef.current?.click()} disabled={pending} className="rounded-lg border border-bd2 px-3.5 py-2.5 text-xs font-semibold leading-none text-ink hover:bg-bg2 disabled:opacity-60">
        {pending ? "Restoring…" : "Import"}
      </button>
      {msg && <span className={`text-11 font-medium ${msg.ok ? "text-in" : "text-out"}`}>{msg.text}</span>}
    </div>
  );
}
