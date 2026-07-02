/**
 * Seed the club from data/peacock-backup.json.
 *
 * The backup is DISPLAY data (per-member aggregates, a few recent rows), not a
 * cash-true event history — so this is an IMPORT: we post the notable events as
 * real balanced double-entry for history, then reconcile every account to its
 * target snapshot balance via a single opening leg. A `club-opening` suspense
 * account (kind OTHER_INCOME, id "club-opening") absorbs the residual and is
 * excluded from every read. The double-entry invariant (Σ entries == cached
 * balance, global sum == 0) holds throughout.
 *
 * ponytail: no treasury non-negative guard here — an opening import isn't a
 * cashflow simulation. Real postings (server actions) still go through
 * postTransaction, which enforces it.
 */
import { PrismaClient, type LedgerAccountKind, type TxnType } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
});

const backup = JSON.parse(
  readFileSync(fileURLToPath(new URL("../data/peacock-backup.json", import.meta.url)), "utf8"),
);

const P = (rupees: number) => BigInt(Math.round((rupees || 0) * 100)); // rupees → paise
const rp = (s: string | null | undefined) => P(Number(String(s ?? "").replace(/[^0-9.]/g, "")) || 0); // "₹1,50,000" → paise
const OPENING = "club-opening";

// "Sep 2020" / "06 Feb 2024" → Date (UTC). Recent "27 Jun" rows get year 2026.
function parseDate(s: string, fallbackYear = 2026): Date {
  const months = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
  const parts = s.trim().toLowerCase().replace(/,/g, "").split(/\s+/);
  let day = 1,
    mon = 0,
    year = fallbackYear;
  for (const p of parts) {
    if (/^\d{4}$/.test(p)) year = +p;
    else if (/^\d{1,2}$/.test(p)) day = +p;
    else {
      const i = months.indexOf(p.slice(0, 3));
      if (i >= 0) mon = i;
    }
  }
  return new Date(Date.UTC(year, mon, day));
}

// --- account id helpers (deterministic ids so the seed is re-runnable) ---
const equityId = (mid: string) => `eq_${mid}`;
const treasuryId = (mid: string) => `tr_${mid}`;
const loanRecvId = (mid: string) => `lr_${mid}`;
const vendorRecvId = (vid: string) => `vr_${vid}`;
const vendorProfitId = (vid: string) => `vp_${vid}`;
const INTEREST_INCOME = "interest-income";
const OTHER_INCOME = "other-income";

type Line = { accountId: string; amount: bigint };
async function ensureAccount(id: string, kind: LedgerAccountKind, rel: Partial<{ memberId: string; membershipId: string; vendorId: string }> = {}) {
  await prisma.ledgerAccount.upsert({ where: { id }, update: {}, create: { id, kind, balance: 0n, ...rel } });
}
// balanced posting: create txn + entries, increment cached balances (no guard — import).
async function post(type: TxnType, occurredAt: Date, lines: Line[], links: Partial<{ membershipId: string; loanId: string; vendorId: string; description: string }> = {}) {
  const nonzero = lines.filter((l) => l.amount !== 0n);
  if (nonzero.length < 2) return;
  const sum = nonzero.reduce((s, l) => s + l.amount, 0n);
  if (sum !== 0n) throw new Error(`unbalanced ${type}: ${sum}`);
  const txn = await prisma.transaction.create({
    data: { type, occurredAt, description: links.description ?? null, membershipId: links.membershipId, loanId: links.loanId, vendorId: links.vendorId },
  });
  await prisma.entry.createMany({ data: nonzero.map((l) => ({ transactionId: txn.id, accountId: l.accountId, amount: l.amount })) });
  for (const l of nonzero) await prisma.ledgerAccount.update({ where: { id: l.accountId }, data: { balance: { increment: l.amount } } });
}

// ---------------------------------------------------------------- wipe
console.log("Wiping existing data…");
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
await prisma.clubConfig.create({
  data: {
    id: "singleton",
    name: backup.club?.name ?? "Peacock Investment Club",
    startedAt: new Date("2023-01-01"),
    stages: [{ name: "Stage 1", amountPaise: 200000, startDate: "2023-01-01" }],
    rateSchedule: [{ rateBps: 100, effectiveFrom: "2023-01-01" }],
    dayInterestFrom: new Date("2023-01-01"),
    maxLoanPaise: P(500000),
    alertThresholds: { largeAmountPaise: P(100000).toString(), pendingInterestPaise: P(50000).toString(), pendingDepositPaise: P(20000).toString() },
  },
});

// ---------------------------------------------------------------- members + auth users
const slug = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
// handle: "rajesh.k" from "Rajesh Kumar", "karthik.s" from "Karthik S"
function handle(first: string, last: string) {
  const l = (last || first).trim().replace(/[^a-z]/gi, "").toLowerCase();
  return `${first.toLowerCase()}.${l ? l[0] : "x"}`;
}

const memberByName = new Map<string, { id: string; membershipId: string }>();
const credentials: { name: string; email: string; password: string }[] = [];

for (let i = 0; i < backup.members.length; i++) {
  const m = backup.members[i];
  const [first, ...rest] = m.name.trim().split(/\s+/);
  const last = rest.join(" ") || null;
  const id = slug(m.name);
  const uname = handle(first, last ?? "");
  const email = `${uname}@peacockclub.in`;
  const phone = `+9198${String(76540000 + i * 111).padStart(8, "0")}`; // unique, ≥8 chars → default password
  const isAdmin = i === 0; // Rajesh Kumar = treasurer + admin
  const isTreasurer = m.held != null || isAdmin;
  const since = parseDate(m.joined);

  // Better Auth user (hashes the password); then link the member.
  const signUp = await auth.api.signUpEmail({ body: { email, password: phone, name: m.name } });
  const userId = signUp.user.id;

  await prisma.member.create({
    data: {
      id,
      firstName: first,
      lastName: last,
      phone,
      email,
      username: uname,
      role: isAdmin ? "ADMIN" : "MEMBER",
      isTreasurer,
      userId,
      mustChangePassword: true,
      customerSince: since,
    },
  });

  const inactiveNoLoan = m.statusKey === "inactive" && m.currentLoan === 0;
  const membership = await prisma.membership.create({
    data: {
      memberId: id,
      seq: 1,
      status: inactiveNoLoan ? "CLOSED" : "ACTIVE",
      joinedAt: since,
      leftAt: inactiveNoLoan ? parseDate("Jun 2026") : null,
    },
  });
  if (inactiveNoLoan) await prisma.member.update({ where: { id }, data: { archivedAt: parseDate("Jun 2026") } });

  await ensureAccount(equityId(id), "MEMBER_EQUITY", { membershipId: membership.id });
  if (isTreasurer) await ensureAccount(treasuryId(id), "TREASURY_CASH", { memberId: id });
  await ensureAccount(loanRecvId(id), "LOAN_RECEIVABLE", { membershipId: membership.id });

  // dues → charges (pending deposit = CATCHUP; penalty offsets = PENALTY)
  if (m.depositBal > 0)
    await prisma.charge.create({ data: { membershipId: membership.id, kind: "CATCHUP", reason: "PROFIT_GAP_TOPUP", amount: P(m.depositBal), occurredAt: since } });
  if (m.offsetNum > 0)
    await prisma.charge.create({ data: { membershipId: membership.id, kind: "PENALTY", reason: "DELAYED_PAYMENT", amount: P(m.offsetNum), occurredAt: since } });

  memberByName.set(m.name, { id, membershipId: membership.id });
  credentials.push({ name: m.name, email, password: phone });
}

// singleton income accounts
await ensureAccount(INTEREST_INCOME, "INTEREST_INCOME");
await ensureAccount(OTHER_INCOME, "OTHER_INCOME");
await ensureAccount(OPENING, "OTHER_INCOME"); // suspense (excluded from reads)

// pick the primary treasurer (admin) as the default cash holder for imports
const primaryTreasurer = memberByName.get(backup.members[0].name)!;

// ---------------------------------------------------------------- vendors
const vendorByName = new Map<string, string>();
for (const v of backup.vendors) {
  const id = slug(v.name);
  vendorByName.set(v.name, id);
  const isChit = v.type === "chit";
  await prisma.vendor.create({
    data: {
      id,
      name: v.name,
      type: isChit ? "CHIT" : "GENERAL",
      category: v.category ?? null,
      status: v.status === "closed" ? "CLOSED" : "ACTIVE",
      startedAt: isChit ? parseDate(v.chit.start) : parseDate(v.cycle ?? "Jan 2026"),
      closedAt: v.status === "closed" ? parseDate("Mar 2026") : null,
    },
  });
  await ensureAccount(vendorRecvId(id), "VENDOR_RECEIVABLE", { vendorId: id });
  await ensureAccount(vendorProfitId(id), "VENDOR_PROFIT", { vendorId: id });
  if (isChit) {
    const c = v.chit;
    await prisma.chitFund.create({
      data: {
        vendorId: id,
        chitValue: P(c.value),
        durationMonths: c.months,
        marginInstallment: P(c.margin),
        startedAt: parseDate(c.start),
        payoutMonth: c.payoutMonth || null,
        payoutAt: c.payoutMonth ? parseDate(c.start) : null,
        payoutAmount: c.payout ? P(c.payout) : null,
        status: c.payoutMonth ? "PAID_OUT" : "RUNNING",
      },
    });
  }
}

// ---------------------------------------------------------------- loans (rows + tranche history)
for (const ln of backup.loans) {
  const mem = memberByName.get(ln.member);
  if (!mem) continue;
  const started = parseDate(ln.start);
  const requested = rp(ln.amount);
  const loan = await prisma.loan.create({
    data: {
      membershipId: mem.membershipId,
      requestedAmount: requested,
      principalOutstanding: ln.status === "closed" ? 0n : requested, // trued-up below against currentLoan
      monthlyRateBps: (ln.rate ?? 1) * 100,
      startedAt: started,
      closedAt: ln.status === "closed" ? parseDate("Jun 2026") : null,
      status: ln.status === "closed" ? "CLOSED" : "ACTIVE",
    },
  });
  // tranche disbursements: TREASURY(by) −amt, LOAN_RECEIVABLE(member) +amt
  for (const tr of ln.tranches) {
    const by = memberByName.get(tr.by) ?? primaryTreasurer;
    const amt = rp(tr.amt);
    await ensureAccount(treasuryId(by.id), "TREASURY_CASH", { memberId: by.id });
    await post("LOAN_TAKEN", parseDate(tr.date), [
      { accountId: treasuryId(by.id), amount: -amt },
      { accountId: loanRecvId(mem.id), amount: amt },
    ], { membershipId: mem.membershipId, loanId: loan.id, description: `Loan tranche · ${ln.member}` });
  }
}

// ---------------------------------------------------------------- deposits (history + deposit tag)
for (const m of backup.members) {
  const mem = memberByName.get(m.name)!;
  const dep = P(m.periodicNum);
  if (dep <= 0n) continue;
  const holder = m.held != null ? mem : primaryTreasurer;
  await ensureAccount(treasuryId(holder.id), "TREASURY_CASH", { memberId: holder.id });
  await post("PERIODIC_DEPOSIT", parseDate(m.joined), [
    { accountId: treasuryId(holder.id), amount: dep },
    { accountId: equityId(mem.id), amount: -dep },
  ], { membershipId: mem.membershipId, description: `Deposits to date · ${m.name}` });
}

// ---------------------------------------------------------------- vendor invest + realized profit
for (const v of backup.vendors) {
  const vid = vendorByName.get(v.name)!;
  if (v.type === "chit") continue;
  const invested = rp(v.invested);
  await post("VENDOR_INVEST", parseDate(v.cycle ?? "Jan 2026"), [
    { accountId: treasuryId(primaryTreasurer.id), amount: -invested },
    { accountId: vendorRecvId(vid), amount: invested },
  ], { vendorId: vid, description: `Invested · ${v.name}` });
  const profit = rp(v.profit);
  if (profit > 0n)
    await post("VENDOR_RETURN", parseDate(v.cycle ?? "Jan 2026"), [
      { accountId: treasuryId(primaryTreasurer.id), amount: profit },
      { accountId: vendorProfitId(vid), amount: -profit },
    ], { vendorId: vid, description: `Return (profit) · ${v.name}` });
}

// ---------------------------------------------------------------- the recent transaction rows
type Row = { what: string; from: string; to: string; holder: string; date: string; amt: string };
for (const t of backup.transactions as Row[]) {
  const A = rp(t.amt);
  const when = parseDate(t.date);
  const holder = memberByName.get(t.holder) ?? primaryTreasurer;
  await ensureAccount(treasuryId(holder.id), "TREASURY_CASH", { memberId: holder.id });
  const tr = treasuryId(holder.id);
  const member = (name: string) => memberByName.get(name);
  const vendor = (name: string) => vendorByName.get(name);

  switch (t.what) {
    case "Deposit": {
      const m = member(t.from);
      if (m) await post("PERIODIC_DEPOSIT", when, [{ accountId: tr, amount: A }, { accountId: equityId(m.id), amount: -A }], { membershipId: m.membershipId, description: "Deposit" });
      break;
    }
    case "Loan disbursed": {
      const m = member(t.to);
      if (m) { await ensureAccount(loanRecvId(m.id), "LOAN_RECEIVABLE", { membershipId: m.membershipId }); await post("LOAN_TAKEN", when, [{ accountId: tr, amount: -A }, { accountId: loanRecvId(m.id), amount: A }], { membershipId: m.membershipId, description: "Loan disbursed" }); }
      break;
    }
    case "Repayment": {
      const m = member(t.from);
      if (m) { await ensureAccount(loanRecvId(m.id), "LOAN_RECEIVABLE", { membershipId: m.membershipId }); await post("LOAN_REPAY", when, [{ accountId: tr, amount: A }, { accountId: loanRecvId(m.id), amount: -A }], { membershipId: m.membershipId, description: "Repayment" }); }
      break;
    }
    case "Interest": {
      const m = member(t.from);
      await post("LOAN_INTEREST", when, [{ accountId: tr, amount: A }, { accountId: INTEREST_INCOME, amount: -A }], { membershipId: m?.membershipId, description: "Interest collected" });
      break;
    }
    case "Vendor return": {
      const vid = vendor(t.from);
      if (vid) await post("VENDOR_RETURN", when, [{ accountId: tr, amount: A }, { accountId: vendorProfitId(vid), amount: -A }], { vendorId: vid, description: "Vendor return" });
      break;
    }
    case "Withdrawal": {
      const m = member(t.to);
      if (m) await post("WITHDRAW", when, [{ accountId: tr, amount: -A }, { accountId: equityId(m.id), amount: A }], { membershipId: m.membershipId, description: "Withdrawal" });
      break;
    }
  }
}

// ---------------------------------------------------------------- interest income to target (Σ interestPaid)
{
  const totalInterest: bigint = backup.members.reduce((s: bigint, m: { interestPaid?: number }) => s + P(m.interestPaid ?? 0), 0n);
  const acct = await prisma.ledgerAccount.findUnique({ where: { id: INTEREST_INCOME } });
  const delta = 0n - totalInterest - (acct?.balance ?? 0n); // credit target = −total
  if (delta !== 0n) await post("LOAN_INTEREST", parseDate("Jun 2026"), [{ accountId: INTEREST_INCOME, amount: delta }, { accountId: OPENING, amount: -delta }], { description: "Interest income (opening)" });
}

// ---------------------------------------------------------------- reconcile every account to its target snapshot
function targetFor(m: { name: string; periodicNum: number; profitNum: number; held: string | null; currentLoan: number }): { equity: bigint; treasury?: bigint } {
  const value = P(m.periodicNum + m.profitNum);
  const t: { equity: bigint; treasury?: bigint } = { equity: -value };
  if (m.held != null) t.treasury = rp(m.held);
  return t;
}

for (const m of backup.members) {
  const mem = memberByName.get(m.name)!;
  const tgt = targetFor(m);
  // equity → −value
  const eq = await prisma.ledgerAccount.findUnique({ where: { id: equityId(mem.id) } });
  const dEq = tgt.equity - (eq?.balance ?? 0n);
  if (dEq !== 0n) await post("REJOIN", parseDate("Jun 2026"), [{ accountId: equityId(mem.id), amount: dEq }, { accountId: OPENING, amount: -dEq }], { membershipId: mem.membershipId, description: "Opening balance" });
  // loan receivable → currentLoan
  const lr = await prisma.ledgerAccount.findUnique({ where: { id: loanRecvId(mem.id) } });
  const dLr = P(m.currentLoan) - (lr?.balance ?? 0n);
  if (dLr !== 0n) await post("LOAN_REPAY", parseDate("Jun 2026"), [{ accountId: loanRecvId(mem.id), amount: dLr }, { accountId: OPENING, amount: -dLr }], { membershipId: mem.membershipId, description: "Loan opening balance" });
  // treasury → held
  if (tgt.treasury != null) {
    const tacc = await prisma.ledgerAccount.findUnique({ where: { id: treasuryId(mem.id) } });
    const dT = tgt.treasury - (tacc?.balance ?? 0n);
    if (dT !== 0n) await post("FUNDS_TRANSFER", parseDate("Jun 2026"), [{ accountId: treasuryId(mem.id), amount: dT }, { accountId: OPENING, amount: -dT }], { description: "Cash on hand (opening)" });
  }
}
// vendor accounts → invested / −profit
for (const v of backup.vendors) {
  const vid = vendorByName.get(v.name)!;
  const invTgt = v.type === "chit" ? P((v.chit.paidCount ?? 0) * v.chit.margin) : v.status === "closed" ? 0n : rp(v.invested);
  const profTgt = v.type === "chit" ? 0n : -rp(v.profit);
  const rec = await prisma.ledgerAccount.findUnique({ where: { id: vendorRecvId(vid) } });
  const dR = invTgt - (rec?.balance ?? 0n);
  if (dR !== 0n) await post("VENDOR_INVEST", parseDate("Jan 2026"), [{ accountId: vendorRecvId(vid), amount: dR }, { accountId: OPENING, amount: -dR }], { vendorId: vid, description: "Vendor opening balance" });
  const pf = await prisma.ledgerAccount.findUnique({ where: { id: vendorProfitId(vid) } });
  const dP = profTgt - (pf?.balance ?? 0n);
  if (dP !== 0n) await post("VENDOR_RETURN", parseDate("Jan 2026"), [{ accountId: vendorProfitId(vid), amount: dP }, { accountId: OPENING, amount: -dP }], { vendorId: vid, description: "Vendor profit (opening)" });
}
// true-up active loans' principalOutstanding from the reconciled LOAN_RECEIVABLE
for (const mem of memberByName.values()) {
  const lr = await prisma.ledgerAccount.findUnique({ where: { id: loanRecvId(mem.id) } });
  const active = await prisma.loan.findFirst({ where: { membershipId: mem.membershipId, status: "ACTIVE" } });
  if (active) await prisma.loan.update({ where: { id: active.id }, data: { principalOutstanding: lr?.balance ?? 0n } });
}

// ---------------------------------------------------------------- verify invariant + report
const all = await prisma.ledgerAccount.findMany({ select: { balance: true } });
const globalSum = all.reduce((s, a) => s + a.balance, 0n);
console.log(`\nLedger global sum (must be 0): ${globalSum}`);
console.log(`Accounts: ${all.length}  Transactions: ${await prisma.transaction.count()}  Entries: ${await prisma.entry.count()}`);
console.log(`Members: ${await prisma.member.count()}  Vendors: ${await prisma.vendor.count()}  Loans: ${await prisma.loan.count()}`);
console.log("\n=== Login credentials (email / password = phone) ===");
for (const c of credentials) console.log(`${c.name.padEnd(15)} ${c.email.padEnd(28)} ${c.password}`);

await prisma.$disconnect();
