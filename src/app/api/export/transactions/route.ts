import { z } from "zod";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/queries/session";
import { getTransactionsPage, type TxnDTO } from "@/server/queries/transactions";

// CSV export of the ledger — honours the SAME filters as /api/transactions (so a party filter is a
// member statement), always exports every matching row. Amounts are plain signed rupees so the
// file opens clean in a spreadsheet.
const params = z.object({
  q: z.string().optional(),
  type: z.string().optional(),
  party: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function toCsv(rows: TxnDTO[]): string {
  const header = "Date,Type,From,To,Direction,Amount (₹),Note,Entered";
  const lines = rows.map((t) =>
    [
      t.isoDate,
      t.what,
      t.from.name,
      t.to.name,
      t.dir,
      (t.dir === "out" ? "-" : "") + t.amountValue,
      t.note ?? "",
      t.entered,
    ]
      .map(esc)
      .join(","),
  );
  return [header, ...lines].join("\n");
}

export async function GET(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const f = params.parse(Object.fromEntries(new URL(req.url).searchParams));
  const { rows } = await getTransactionsPage({ ...f, page: 1, size: Number.MAX_SAFE_INTEGER });
  const name = `peacock-transactions${f.party ? `-${f.party.toLowerCase().replace(/\s+/g, "-")}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(`﻿${toCsv(rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
