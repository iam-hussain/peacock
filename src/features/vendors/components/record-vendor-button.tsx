"use client";

import { Plus } from "lucide-react";
import { useAddEntry } from "@/features/entries/add-entry";

/** Opens the Add-Entry dialog prefilled to record a return for this vendor (§10). */
export function RecordReturnButton({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const addEntry = useAddEntry();
  return (
    <button
      type="button"
      onClick={() => addEntry.open({ intent: "Vendor return", party: { id: vendorId, name: vendorName } })}
      className="flex flex-none items-center gap-1.75 rounded-9 bg-teal px-4 py-2.5 text-13 font-semibold leading-none text-white hover:opacity-90"
    >
      <Plus className="size-3.5" strokeWidth={2.5} /> Record return
    </button>
  );
}
