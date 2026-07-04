/**
 * Transformer: import a REAL Peacock production export (account / transaction /
 * passbook) into this app's double-entry ledger.
 *
 * The export is already a true account-to-account ledger (members hold cash on
 * demand — exactly this app's treasury-per-person model), so we REPLAY every
 * transaction in occurredAt order into balanced postings. Final cached balances
 * fall out of the replay and match the source passbooks — no synthetic
 * reconciliation. Loans are reconstructed from LOAN_TAKEN/LOAN_REPAY.
 *
 * Everything is built in memory then bulk-inserted (a handful of createMany calls)
 * so 1000s of transactions import in seconds rather than 1000s of round-trips.
 *
 * ponytail: no treasury non-negative guard — this is a historical import, not a
 * live cashflow. Real postings still go through postTransaction (which enforces it).
 */
import { PrismaClient, Prisma, type LedgerAccountKind, type TxnType, type MembershipStatus } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FILE = process.argv[2] ?? "peacock_backup_03_46_26_01_46.json";

// The export stores avatarUrl as a bare filename in data/image/. Inline it as a base64 data URL
// (the app renders avatars from the DB field directly); null if the file is missing.
const AVATAR_MIME: Record<string, string> = { jpeg: "image/jpeg", jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
function avatarDataUrl(file: string | null): string | null {
  if (!file) return null;
  const url = new URL(`../data/image/${file}`, import.meta.url);
  if (!existsSync(url)) return null;
  const mime = AVATAR_MIME[file.split(".").pop()!.toLowerCase()] ?? "image/jpeg";
  return `data:${mime};base64,${readFileSync(url).toString("base64")}`;
}
const prisma = new PrismaClient({ datasourceUrl: process.env.DIRECT_URL }); // bulk seed → bypass PgBouncer
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
});

interface Account { id: string; type: "MEMBER" | "VENDOR"; role: string; status: string; firstName: string; lastName: string | null; phone: string | null; username: string; email: string | null; avatarUrl: string | null; passbookId: string; startedAt: string; endedAt: string | null; active: boolean; }
interface Txn { id: string; fromId: string; toId: string; amount: number; type: string; method: string; occurredAt: string; description: string | null; }
interface Passbook { id: string; kind: string; isChit: boolean; payload: Record<string, number>; joiningOffset?: number; delayOffset?: number; }
interface Backup { account: Account[]; transaction: Txn[]; passbook: Passbook[]; }

const backup: Backup = JSON.parse(readFileSync(fileURLToPath(new URL(`../data/${FILE}`, import.meta.url)), "utf8"));
const P = (rupees: number) => BigInt(Math.round((rupees || 0) * 100));

// ---- account lookups -------------------------------------------------------
const accById = new Map(backup.account.map((a) => [a.id, a]));
const pbById = new Map(backup.passbook.map((p) => [p.id, p]));
// One malformed txn references passbook ids instead of account ids; the source's own
// balance engine skipped it (reconciles exactly when we do too), so resolve → null → skip.
const resolve = (id: string): string | null => (accById.has(id) ? id : null);
const isChitVendor = (a: Account) => a.type === "VENDOR" && (pbById.get(a.passbookId)?.isChit ?? false);
// Legacy catch-up / penalty dues cached on the member's passbook (in ₹): joiningOffset = catch-up,
// delayOffset = penalty. The PAID part arrives as OFFSET_DEPOSIT txns; the assigned obligation is
// seeded as a Charge below so outstanding dues surface (see schema §Charge, derive-on-read).
const offsetsFor = (memberId: string) => {
  const p = pbById.get(accById.get(memberId)?.passbookId ?? "");
  return { catchup: P(p?.joiningOffset ?? 0), penalty: P(p?.delayOffset ?? 0) };
};
const fullName = (a: Account) => [a.firstName, a.lastName].filter(Boolean).join(" ").trim() || a.username;

// ---- ledger account ids (deterministic) ------------------------------------
const eqId = (m: string) => `eq_${m}`;
const trId = (m: string) => `tr_${m}`;
const lrId = (m: string) => `lr_${m}`;
const vrId = (v: string) => `vr_${v}`;
const vpId = (v: string) => `vp_${v}`;
const INTEREST_INCOME = "interest-income";
const OTHER_INCOME = "other-income"; // penalty pay-downs land here (club income, shared as profit)
const PROFIT_DISTRIBUTED = "profit-distributed"; // profit paid out to leavers (§12 contra-income)

// In-memory ledger account registry → bulk-created after the replay.
interface Acct { id: string; kind: LedgerAccountKind; balance: bigint; memberId?: string; membershipId?: string; vendorId?: string; }
const accounts = new Map<string, Acct>();
function ensure(id: string, kind: LedgerAccountKind, rel: Omit<Acct, "id" | "kind" | "balance"> = {}): Acct {
  let a = accounts.get(id);
  if (!a) { a = { id, kind, balance: 0n, ...rel }; accounts.set(id, a); }
  return a;
}
const add = (id: string, kind: LedgerAccountKind, amt: bigint, rel?: Omit<Acct, "id" | "kind" | "balance">) => { ensure(id, kind, rel).balance += amt; };

const msId = (m: string) => `ms_${m}`;
const eqAcc = (m: string) => ensure(eqId(m), "MEMBER_EQUITY", { membershipId: msId(m) });
const trAcc = (m: string) => ensure(trId(m), "TREASURY_CASH", { memberId: m });
const lrAcc = (m: string) => ensure(lrId(m), "LOAN_RECEIVABLE", { membershipId: msId(m) });
const vrAcc = (v: string) => ensure(vrId(v), "VENDOR_RECEIVABLE", { vendorId: v });
const vpAcc = (v: string) => ensure(vpId(v), "VENDOR_PROFIT", { vendorId: v });

const treasurers = new Set<string>(); // members who ever hold club cash
const markTreasury = (m: string) => { trAcc(m); treasurers.add(m); };

// ---- replay ----------------------------------------------------------------
const txns = [...backup.transaction].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
const entryRows: { id: string; transactionId: string; accountId: string; amount: bigint }[] = [];
const txnRows: { id: string; type: TxnType; occurredAt: Date; description: string | null; membershipId?: string; loanId?: string; vendorId?: string }[] = [];

// --- pass 1: reconstruct loans from LOAN_TAKEN / LOAN_REPAY (per borrower) ---
interface LoanAcc { id: string; memberId: string; requested: bigint; outstanding: bigint; startedAt: Date; closedAt: Date | null; status: "ACTIVE" | "CLOSED"; }
const loans: LoanAcc[] = [];
const openLoan = new Map<string, LoanAcc>();
const txnLoanId = new Map<string, string>();
// Per-vendor lifetime investment — lets VENDOR_RETURNS split principal vs profit against the
// vendor's TOTAL invested (order-independent), not the running receivable. A chit payout that
// lands before all installments would otherwise book excess as profit and strand later
// installments in receivable, inflating both. Net result per vendor = Σinvest − Σreturns.
const vendorInvestTotal = new Map<string, bigint>();
const vendorPrincipalReturned = new Map<string, bigint>(); // running principal repaid per vendor (pass 2)
// Settlement guide captured at each WITHDRAW replay (old export: withdrawal = capital + profit; loan
// & interest were separate txns already cleared). Feeds Membership.settledGuide so a closed account
// shows the guide (§12) and the profit lands in PROFIT_DISTRIBUTED — see the WITHDRAW case below.
const settlementByMs = new Map<string, { capital: bigint; profit: bigint; paid: bigint }>();
for (const t of txns) {
  const from = resolve(t.fromId), to = resolve(t.toId);
  const A = P(t.amount);
  if (t.type === "VENDOR_INVEST" && to) vendorInvestTotal.set(to, (vendorInvestTotal.get(to) ?? 0n) + A);
  if (t.type === "LOAN_TAKEN" && to) {
    let ln = openLoan.get(to);
    if (!ln) { ln = { id: `loan_${t.id}`, memberId: to, requested: A, outstanding: A, startedAt: new Date(t.occurredAt), closedAt: null, status: "ACTIVE" }; loans.push(ln); openLoan.set(to, ln); }
    else { ln.requested += A; ln.outstanding += A; }
    txnLoanId.set(t.id, ln.id);
  } else if (t.type === "LOAN_REPAY" && from) {
    const ln = openLoan.get(from);
    if (ln) {
      ln.outstanding -= A;
      txnLoanId.set(t.id, ln.id);
      if (ln.outstanding <= 0n) { ln.outstanding = 0n; ln.closedAt = new Date(t.occurredAt); ln.status = "CLOSED"; openLoan.delete(from); }
    }
  }
}

// --- pass 2: post every transaction into balanced ledger entries ------------
const TYPE_MAP: Record<string, TxnType> = {
  PERIODIC_DEPOSIT: "PERIODIC_DEPOSIT", OFFSET_DEPOSIT: "CATCHUP", LOAN_INTEREST: "LOAN_INTEREST",
  WITHDRAW: "WITHDRAW", LOAN_TAKEN: "LOAN_TAKEN", LOAN_REPAY: "LOAN_REPAY",
  VENDOR_INVEST: "VENDOR_INVEST", VENDOR_RETURNS: "VENDOR_RETURN", FUNDS_TRANSFER: "FUNDS_TRANSFER",
};
let skipped = 0;
for (const t of txns) {
  const from = resolve(t.fromId), to = resolve(t.toId);
  if (!from || !to) { skipped++; continue; }
  const A = P(t.amount);
  if (A <= 0n) { skipped++; continue; }
  const when = new Date(t.occurredAt);
  const legs: { id: string; kind: LedgerAccountKind; amt: bigint }[] = [];
  const push = (a: Acct, amt: bigint) => legs.push({ id: a.id, kind: a.kind, amt });
  const row: (typeof txnRows)[number] = { id: t.id, type: TYPE_MAP[t.type] ?? "FUNDS_TRANSFER", occurredAt: when, description: t.description };

  switch (t.type) {
    case "PERIODIC_DEPOSIT": // treasurer(to) +A, member equity(from) −A
      markTreasury(to); push(trAcc(to), A); push(eqAcc(from), -A); row.membershipId = msId(from); break;
    case "OFFSET_DEPOSIT": { // pay-down of a legacy catch-up (→ equity) or penalty (→ club income) due
      const o = offsetsFor(from);
      markTreasury(to); push(trAcc(to), A); row.membershipId = msId(from);
      // penalty pay-down = OTHER_INCOME (this app's model); catch-up pay-down = MEMBER_EQUITY.
      // The source folds both into memberBalance, so a penalty-payer's value is intentionally lower here.
      if (o.penalty > 0n && o.catchup === 0n) { push(ensure(OTHER_INCOME, "OTHER_INCOME"), -A); row.type = "PENALTY"; }
      else { push(eqAcc(from), -A); row.type = "CATCHUP"; }
      break;
    }
    case "LOAN_INTEREST": // treasurer(to) +A, interest income −A
      markTreasury(to); push(trAcc(to), A); push(ensure(INTEREST_INCOME, "INTEREST_INCOME"), -A); row.membershipId = msId(from); break;
    case "WITHDRAW": { // settle & leave: treasurer(from) −A; return capital to equity + book profit to PROFIT_DISTRIBUTED
      // Old export: withdrawal amount = capital + profit (loan/interest cleared via separate txns).
      // Capital = deposits so far = −(current equity balance); the rest is realized profit paid out.
      const eq = eqAcc(to);
      const capital = eq.balance < 0n ? -eq.balance : 0n;
      const profit = A > capital ? A - capital : 0n;
      const capitalReturned = A - profit; // = min(A, capital); zeroes equity on a full settlement
      markTreasury(from);
      push(trAcc(from), -A);
      push(eq, capitalReturned);
      if (profit > 0n) push(ensure(PROFIT_DISTRIBUTED, "PROFIT_DISTRIBUTED"), profit);
      row.membershipId = msId(to);
      // A member can be paid out over SEVERAL withdrawals (e.g. part cash + part UPI) — accumulate,
      // don't overwrite, so the guide reflects the whole settlement (capital first, profit last).
      const prev = settlementByMs.get(msId(to)) ?? { capital: 0n, profit: 0n, paid: 0n };
      settlementByMs.set(msId(to), { capital: prev.capital + capitalReturned, profit: prev.profit + profit, paid: prev.paid + A });
      break;
    }
    case "LOAN_TAKEN": // treasurer(from) −A, loan receivable(to) +A
      markTreasury(from); push(trAcc(from), -A); push(lrAcc(to), A); row.membershipId = msId(to); row.loanId = txnLoanId.get(t.id); break;
    case "LOAN_REPAY": // treasurer(to) +A, loan receivable(from) −A
      markTreasury(to); push(trAcc(to), A); push(lrAcc(from), -A); row.membershipId = msId(from); row.loanId = txnLoanId.get(t.id); break;
    case "VENDOR_INVEST": // treasurer(from) −A, vendor receivable(to) +A
      markTreasury(from); push(trAcc(from), -A); push(vrAcc(to), A); row.vendorId = to;
      if (isChitVendor(accById.get(to)!)) row.type = "CHIT_PAYMENT"; break;
    case "FUNDS_TRANSFER": // treasurer(from) −A, treasurer(to) +A
      markTreasury(from); markTreasury(to); push(trAcc(from), -A); push(trAcc(to), A); break;
    case "VENDOR_RETURNS": { // vendor(from) → treasurer(to): principal reduces receivable, rest is profit.
      // Principal is capped at the vendor's LIFETIME investment (see vendorInvestTotal), so the split
      // is order-independent: Σprincipal = min(Σreturns, Σinvest), Σprofit = max(0, Σreturns − Σinvest).
      markTreasury(to);
      const room = (vendorInvestTotal.get(from) ?? 0n) - (vendorPrincipalReturned.get(from) ?? 0n);
      const principal = room <= 0n ? 0n : room < A ? room : A;
      vendorPrincipalReturned.set(from, (vendorPrincipalReturned.get(from) ?? 0n) + principal);
      push(trAcc(to), A);
      if (principal > 0n) push(vrAcc(from), -principal);
      if (A - principal > 0n) push(vpAcc(from), -(A - principal));
      row.vendorId = from;
      if (isChitVendor(accById.get(from)!)) row.type = "CHIT_PAYOUT"; break;
    }
    default: skipped++; continue;
  }

  // commit legs to in-memory balances + entry rows
  legs.forEach((l, i) => { add(l.id, l.kind, l.amt); entryRows.push({ id: `${t.id}_${i}`, transactionId: t.id, accountId: l.id, amount: l.amt }); });
  txnRows.push(row);
}

// ---------------------------------------------------------------- wipe
console.log(`Importing ${FILE} …\nWiping existing data…`);
await prisma.entry.deleteMany();
await prisma.transaction.deleteMany();
await prisma.charge.deleteMany();
await prisma.loan.deleteMany();
await prisma.ledgerAccount.deleteMany();
await prisma.chitFund.deleteMany();
await prisma.vendor.deleteMany();
await prisma.membership.deleteMany();
await prisma.member.deleteMany();
await prisma.account.deleteMany();
await prisma.session.deleteMany();
await prisma.user.deleteMany();
await prisma.clubConfig.deleteMany();

// ---------------------------------------------------------------- config
const firstStart = backup.account.map((a) => a.startedAt).sort()[0] ?? "2020-08-31";
await prisma.clubConfig.create({
  data: {
    id: "singleton", name: "Peacock Investment Club", startedAt: new Date(firstStart),
    // Deposits: ₹1,000/mo for the first 36 months (from Sep 2020), then ₹2,000/mo from Sep 2023
    // (PRODUCT.md §6). Founding is Aug 31 2020; first deposit month is Sep 2020.
    stages: [
      { name: "Stage 1", amountPaise: 100000, startDate: "2020-09-01", endDate: "2023-09-01" },
      { name: "Stage 2", amountPaise: 200000, startDate: "2023-09-01" },
    ],
    rateSchedule: [{ rateBps: 100, effectiveFrom: firstStart }],
    dayInterestFrom: new Date(firstStart), maxLoanPaise: P(500000),
    alertThresholds: { largeAmountPaise: P(100000).toString(), pendingInterestPaise: P(50000).toString(), pendingDepositPaise: P(20000).toString() },
  },
});

// ---------------------------------------------------------------- members + auth users
const ADMIN_USERNAMES = new Set(["zakir", "cibi"]); // force admins regardless of backup role
const members = backup.account.filter((a) => a.type === "MEMBER");
const vendors = backup.account.filter((a) => a.type === "VENDOR");
const credentials: { name: string; email: string; password: string }[] = [];
const usedPhones = new Set<string>();

const memberCreates: Prisma.MemberCreateManyInput[] = [];
const membershipCreates: { id: string; memberId: string; seq: number; status: MembershipStatus; joinedAt: Date; leftAt: Date | null; settledAmount?: bigint; settledGuide?: Prisma.InputJsonValue }[] = [];

for (let i = 0; i < members.length; i++) {
  const a = members[i];
  const name = fullName(a);
  const digits = (a.phone ?? "").replace(/\D/g, "");
  let phone = digits.length >= 8 ? (a.phone as string) : `+9199${String(i).padStart(8, "0")}`;
  while (usedPhones.has(phone)) phone = `${phone}0`;
  usedPhones.add(phone);
  const email = a.email && a.email.includes("@") ? a.email : `${a.username}@peacock.club`;
  const password = phone.length >= 8 ? phone : "peacock@2024";

  const signUp = await auth.api.signUpEmail({ body: { email, password, name } });

  memberCreates.push({
    id: a.id, firstName: a.firstName || a.username, lastName: a.lastName || null, phone, email,
    username: a.username, avatarUrl: avatarDataUrl(a.avatarUrl), role: a.role === "ADMIN" || ADMIN_USERNAMES.has(a.username) ? "ADMIN" : "MEMBER",
    userId: signUp.user.id, mustChangePassword: true, customerSince: new Date(a.startedAt),
    archivedAt: a.active ? null : a.endedAt ? new Date(a.endedAt) : null,
  });
  const st = settlementByMs.get(msId(a.id)); // frozen settlement guide for a closed stint (§12)
  membershipCreates.push({
    id: msId(a.id), memberId: a.id, seq: 1, status: a.active ? "ACTIVE" : "CLOSED",
    joinedAt: new Date(a.startedAt), leftAt: a.endedAt ? new Date(a.endedAt) : null,
    ...(st ? {
      settledAmount: st.paid,
      settledGuide: { capital: st.capital.toString(), profit: st.profit.toString(), loan: "0", interest: "0", suggested: st.paid.toString(), paid: st.paid.toString() },
    } : {}),
  });
  credentials.push({ name, email, password });
}
await prisma.member.createMany({ data: memberCreates });
await prisma.membership.createMany({ data: membershipCreates });
// treasurer flag (person-level) for anyone who ever held club cash
await prisma.member.updateMany({ where: { id: { in: [...treasurers] } }, data: { isTreasurer: true } });

// legacy catch-up / penalty dues → Charge rows (the assigned obligation; pay-downs replayed above)
const chargeCreates: Prisma.ChargeCreateManyInput[] = [];
for (const a of members) {
  const { catchup, penalty } = offsetsFor(a.id);
  const when = new Date(a.startedAt);
  if (catchup > 0n) chargeCreates.push({ membershipId: msId(a.id), kind: "CATCHUP", reason: "FIRST_TIME_JOIN", amount: catchup, occurredAt: when });
  if (penalty > 0n) chargeCreates.push({ membershipId: msId(a.id), kind: "PENALTY", reason: "DELAYED_PAYMENT", amount: penalty, occurredAt: when });
}
await prisma.charge.createMany({ data: chargeCreates });

// ---------------------------------------------------------------- vendors + chits
const parseLakh = (s: string) => { const m = s.match(/(\d+(?:\.\d+)?)\s*L/i); return m ? P(Number(m[1]) * 100000) : 0n; };
for (const a of vendors) {
  const chit = isChitVendor(a);
  await prisma.vendor.create({
    data: {
      id: a.id, name: fullName(a), type: chit ? "CHIT" : "GENERAL",
      category: chit ? "Chit" : /bank|interest/i.test(a.firstName) ? "Bank" : "General",
      status: a.active ? "ACTIVE" : "CLOSED", startedAt: new Date(a.startedAt), closedAt: a.endedAt ? new Date(a.endedAt) : null,
      ...(chit ? { chit: { create: { chitValue: parseLakh(a.firstName), durationMonths: 20, marginInstallment: parseLakh(a.firstName) / 20n, startedAt: new Date(a.startedAt), status: "RUNNING" } } } : {}),
    },
  });
}

// ---------------------------------------------------------------- ledger accounts (final balances)
await prisma.ledgerAccount.createMany({
  data: [...accounts.values()].map((a) => ({ id: a.id, kind: a.kind, balance: a.balance, memberId: a.memberId ?? null, membershipId: a.membershipId ?? null, vendorId: a.vendorId ?? null })),
});

// ---------------------------------------------------------------- loans
await prisma.loan.createMany({
  data: loans.map((l) => ({ id: l.id, membershipId: msId(l.memberId), requestedAmount: l.requested, principalOutstanding: l.outstanding, monthlyRateBps: 100, startedAt: l.startedAt, closedAt: l.closedAt, status: l.status })),
});

// ---------------------------------------------------------------- transactions + entries
await prisma.transaction.createMany({ data: txnRows });
for (let i = 0; i < entryRows.length; i += 5000) await prisma.entry.createMany({ data: entryRows.slice(i, i + 5000) });

// ---------------------------------------------------------------- verify + report
const all = await prisma.ledgerAccount.findMany({ select: { balance: true } });
const globalSum = all.reduce((s, x) => s + x.balance, 0n);
console.log(`\nLedger global sum (must be 0): ${globalSum}`);
console.log(`Skipped txns (unresolved/zero): ${skipped}`);
console.log(`Members: ${members.length}  Vendors: ${vendors.length}  Loans: ${loans.length} (${loans.filter((l) => l.status === "ACTIVE").length} active)  Treasurers: ${treasurers.size}`);
console.log(`Accounts: ${all.length}  Transactions: ${txnRows.length}  Entries: ${entryRows.length}`);

// spot-check a few members against their source passbook memberBalance
const sample = members.slice(0, 5);
console.log("\n=== balance check (our value vs passbook memberBalance) ===");
for (const a of sample) {
  const acc = accounts.get(eqId(a.id));
  const value = -(acc?.balance ?? 0n);
  const pb = pbById.get(a.passbookId)?.payload;
  console.log(`${fullName(a).padEnd(18)} value=₹${(Number(value) / 100).toLocaleString("en-IN").padStart(9)}  passbook memberBalance=₹${(pb?.memberBalance ?? 0).toLocaleString("en-IN")}`);
}
console.log("\n=== Login credentials (first 12; password = phone) ===");
for (const c of credentials.slice(0, 12)) console.log(`${c.name.padEnd(18)} ${c.email.padEnd(30)} ${c.password}`);

await prisma.$disconnect();
