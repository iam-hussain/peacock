# Peacock v2 — Implementation Plan (Build Bible)

> **Status:** Pre-build, design-in-progress. Single, expanded, line-by-line engineering plan for
> building the new Peacock repository from scratch. Consolidates and supersedes (for build
> purposes) the three source planning docs.
>
> **Revision 4** — folds in the owner's domain clarifications: the club holds **no cash**
> (member-treasurers do); **multi-tranche loans** with a **fixed-at-origination interest rate** (rate
> changes apply to new loans only) + a **configurable overdue penalty** (default 0, applies instantly
> to all loans); **`GENERAL`** + `CHIT` vendor types (no separate BANK — bank interest is a GENERAL
> return); **chit funds** with **ramping installments**; **catch-up** (renamed from "offset",
> auto-computed + admin-editable); **withdrawal = full exit only** (settle → freeze → reactivate); a
> **comprehensive profit-per-member** on the dashboard (pending interest = profit, pending deposits =
> capital); configurable **late-deposit penalty** (default 0) and **dividend** seam (off). The one
> material open item is the **profit-share-at-exit formula** (§16.3). Undecided items marked **`‹TBD›`**.
>
> **Audience:** the engineer(s) building this. Everything needed to start typing lives here.
> **Out of scope:** visual styling (see `DESIGN_PROMPTS.md`). Functionally the UI mirrors v1.

---

## Table of contents

1. [Purpose & domain](#1-purpose--domain)
2. [Glossary](#2-glossary)
3. [Tech stack](#3-tech-stack)
4. [Locked decisions & defaults](#4-locked-decisions--defaults)
5. [Architecture at a glance](#5-architecture-at-a-glance)
6. [The double-entry ledger — mental model](#6-the-double-entry-ledger--mental-model)
7. [Chart of accounts](#7-chart-of-accounts)
8. [Posting spec — every transaction type, line by line](#8-posting-spec--every-transaction-type-line-by-line)
9. [Database schema (full Prisma + commentary)](#9-database-schema-full-prisma--commentary)
10. [Money handling — the BigInt/paise contract](#10-money-handling--the-bigintpaise-contract)
11. [Dates, timezone & month boundaries](#11-dates-timezone--month-boundaries)
12. [The critical write path — `postTransaction`](#12-the-critical-write-path--posttransaction)
13. [Reverse & edit](#13-reverse--edit)
14. [Loans in depth — tranches, rate schedule, interest](#14-loans-in-depth--tranches-rate-schedule-interest)
15. [Chit funds in depth](#15-chit-funds-in-depth)
16. [Members — deposits, catch-up, withdraw & rejoin](#16-members--deposits-catch-up-withdraw--rejoin)
17. [Calculations — every figure derived, line by line](#17-calculations--every-figure-derived-line-by-line)
18. [Read models / queries](#18-read-models--queries)
19. [Analytics & graphs](#19-analytics--graphs)
20. [Auth, roles & permissions](#20-auth-roles--permissions)
21. [Caching & revalidation](#21-caching--revalidation)
22. [Validation (Zod) & the service contract](#22-validation-zod--the-service-contract)
23. [App structure, routes & the entry drawer](#23-app-structure-routes--the-entry-drawer)
24. [Migration v1 → v2](#24-migration-v1--v2)
25. [Testing strategy](#25-testing-strategy)
26. [Build phases & checklists](#26-build-phases--checklists)
27. [Performance budget](#27-performance-budget)
28. [Open questions / TBDs](#28-open-questions--tbds)

---

## 1. Purpose & domain

**Peacock** is a private investment-club / chit-fund manager for a single club ("Many feathers,
one fortune"). It models real money moving between members, the club's pooled value, and external
vendors.

### The parties

| Party | What it is |
|-------|-----------|
| **Member** | A person in the club. Pays a recurring **monthly deposit**, can **borrow** (loans with daily interest), can **withdraw / leave** and later **rejoin**. All members hold **equal status and value**. |
| **Treasurer** | A **member who currently physically holds club cash**. The club itself is not a physical entity and **holds no money** — cash always sits with one or more member-treasurers. Anyone can be a treasurer (admin or plain member; long- or short-term). |
| **Admin** | A member with **write access** (daily data entry, managing members/vendors/loans/config). Admin is just a member with a role flag. |
| **Vendor** | An external place the club puts money. Two types: **`CHIT`** fund (monthly installments toward a chit, payout later, with an obligation to keep paying) and **`GENERAL`** (any other placement — invest, get returns, profit = returns − invested; **also covers bank deposits/interest**: a treasurer parks club cash in a bank and returns the interest as a GENERAL return). |

So there are really only two kinds of people — **members**, some of whom are **admins** — plus the
**treasurer** capability (holding cash) which any member can have.

### The money flows, in plain English

1. **Deposits.** Every member owes a monthly deposit. The amount is **stage-based** and has been
   raised over time (₹1,000 → ₹2,000). The app tracks *expected vs paid* per member.
2. **Cash lives with treasurers.** When a member pays, the cash goes to a specific treasurer.
   Treasurers can move club cash between themselves (**internal transfer**). Total club cash =
   sum of all treasurers' holdings.
3. **Loans.** The club lends pooled cash to a member. A loan may be **disbursed in tranches**
   (different treasurers chip in over a few days), accrues **daily interest** on the
   outstanding-principal timeline, must be repaid within **5 months** (after which it is
   **overdue** but still active), and is repaid (possibly in parts) back to treasurers.
4. **Vendors.** The club places cash with a **general vendor** (e.g. a bank that earns interest, or
   any other placement) or pays into a **chit fund**
   monthly (gets a payout later, with profit/loss). Money out with vendors is club value too.
5. **Catch-up (equalization).** A new or returning member must pay, on top of the prevailing
   deposit, a **catch-up** equal to existing members' accumulated profit-per-member, so everyone
   holds equal value. Two kinds: **late-join** and **delayed-payment**.
6. **Withdraw / rejoin.** A member leaving **settles out** their value (admin enters the amount);
   their account is **frozen → INACTIVE** but history is kept. They can later **reactivate** by
   repaying (in one or two terms) plus catch-up.

### Two audiences

| Audience | Does |
|----------|------|
| **Admin** (a member) | Daily data entry + management. |
| **Members** | **Read-only transparency** over the whole club. No writes. |

### Why v2 (what v1 got wrong)

`Float` money → drift; MongoDB JSON "passbook" recomputed on every write; two sources of truth;
four cache layers; background recompute jobs; heavy REST. v2: **one ledger, integer paise, O(1)
writes, derive time-based values on read, one cache layer, server actions instead of REST.**

---

## 2. Glossary

| Term | Meaning |
|------|---------|
| **Paise** | ₹1 = 100 paise. All money stored as integer paise in `BigInt`. |
| **Ledger account** (`LedgerAccount`) | A balance bucket in the chart of accounts (≠ Better-Auth `Account`). |
| **Treasury** (`TREASURY_CASH`) | A cash-holding account owned by a member-treasurer. |
| **Entry** | One signed line of a transaction, posted to one ledger account. |
| **Transaction** | A balanced group of entries whose `amount`s **sum to zero**. |
| **Stock / Flow** | A "right now" balance vs a lifetime running total. |
| **Derived-on-read** | Computed at read time, never stored (e.g. loan interest-to-date). |
| **Stage** | A period with a fixed expected monthly deposit (alpha ₹1,000, bravo ₹2,000). |
| **Catch-up** | Equalization payment by a new/returning member (was v1 "offset"). Subtypes: **late-join**, **delayed-payment**. |
| **Tranche** | One disbursement installment of a single loan (loans may be funded by several). |
| **Rate schedule** | Time-versioned global monthly interest rate `[{ rateBps, effectiveFrom }]`. |
| **`dayInterestFrom`** | Date from which interest is pro-rated daily; before it, whole-month only. |
| **Overdue** | A loan still active past its 5-month term — **derived**, not a stored status. |
| **Chit fund** | A `CHIT` vendor: pay a fixed monthly installment for N months, receive a payout. |
| **Reversal** | A transaction negating a prior one; how edits/deletes happen. |
| **bps** | Basis points. 1% = 100 bps. |
| **IST** | Asia/Kolkata; all month bucketing uses it. |

---

## 3. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **TypeScript** (strict) | End-to-end type safety. |
| Framework | **Next.js App Router**, RSC + Server Actions | One codebase, minimal client JS, no REST. |
| Database | **PostgreSQL** (Neon) | Relational + ACID; ideal for a ledger; free tier. |
| ORM | **Prisma** | Typed queries, migrations, `$transaction` for atomic posting. |
| Money | **`BigInt` paise** | Exact integer math; format to ₹ only at the display edge. |
| Auth | **Better Auth** (Prisma adapter) | Lightweight; owns User/Session/Account/Verification. |
| Validation | **Zod** | One validation source for actions and forms. |
| Caching | **Next.js cache + `revalidateTag()`** | One predictable invalidation layer. |
| File storage | **Vercel Blob** | Avatars/files. |
| Charts | lightweight lib (pick in P3) | Series come pre-computed from the ledger. |
| Testing | **Vitest** (unit) + **Playwright** (e2e later) | Heavy unit testing on the ledger/interest. |
| Hosting | **Vercel** + **Neon** | Serverless-friendly; no required background workers. |
| Timezone | **Asia/Kolkata (IST)** | All month boundaries. |

### 3.1 Database choice & portability (PostgreSQL now, MongoDB later?)

**Decision for now: PostgreSQL + Prisma.** The owner may revisit MongoDB later; the plan keeps the
door open with a clean seam, but is honest about the trade-offs.

**Why PG is the better fit for *this* app:** a ledger lives or dies on **atomic multi-row writes**
(`postTransaction` updates several account balances + entries + loan/chit rows in one transaction).
PG gives that natively. The analytics are **grouped aggregates** (`GROUP BY month`, running
`SUM`) — SQL's home turf.

**Keeping it swappable (so a later move isn't a rewrite):**
- **Prisma is the single data layer** and supports **both** PostgreSQL and MongoDB, so the schema
  and most queries port with modest changes.
- All DB access goes through **`server/queries/*` and the `ledger` engine** — no Prisma calls
  scattered in components. Swapping the datasource touches a contained layer.
- Avoid PG-only escapes in app logic: prefer Prisma's `groupBy`/aggregations over raw SQL so the
  analytics layer has a portable path (a raw-SQL fast path can be added later for PG only).

**Caveats to accept if Mongo is chosen later (flagged, not blocking):**
- **Transactions need a replica set** in Mongo (Atlas provides this); single-node dev Mongo can't
  do the multi-document `$transaction` the ledger relies on.
- **`BigInt` mapping differs** — PG stores it natively; Mongo uses `Long`/`Decimal128`. The
  `lib/money` boundary localizes this, but the Prisma field type changes.
- **Referential integrity / unique compound constraints** (`@@unique([memberId, kind])`,
  `onDelete: Restrict`) are weaker/different in Mongo and would shift enforcement into the service
  layer.
- Net: **migrating is "not a big deal" for the *schema*, but the *transaction guarantees* are the
  thing to validate** on Mongo. Recommendation: build on PG; only move if there's a strong external
  reason, and keep the ledger engine the single place that assumes ACID.

---

## 4. Locked decisions & defaults

### 4.1 Hard-locked

- PostgreSQL (Neon) + Prisma; double-entry ledger + incremental cached balances.
- Money = integer paise (`BigInt`); format to ₹ only at display.
- Next.js App Router + RSC + Server Actions (no REST).
- Time-based interest derived on read; optional cached rollups allowed (no *required* jobs).
- Better Auth; tag-based caching only; Vercel Blob.
- **Sign convention:** assets/receivables **positive**; equity & income **negative**.
- **Asia/Kolkata** for all month boundaries.
- Single club, clean `clubId` seam for later.

### 4.2 Domain rules locked in Revision 2

1. **Club holds no cash.** Cash lives in **`TREASURY_CASH`** accounts, one per treasurer-member,
   created **on demand**. Anyone can be a treasurer. `availableCash = Σ TREASURY_CASH`.
2. **`FUNDS_TRANSFER`** (treasury → treasury) is a real, frequently-used, net-zero transaction.
3. **Loans are sequential, not concurrent:** one active loan per member; must clear all
   outstanding before a new one; **no top-ups**; **1-month cooldown** after full repayment.
4. **A loan may be disbursed in multiple tranches** (different treasurers, over days) — modeled as
   one `Loan` with several `LOAN_TAKEN` events.
5. **Loan term = 5 months.** Past term → **overdue** (derived flag), **still ACTIVE**.
6. **Interest rate is global & time-versioned.** 1%/month from club start; admin can change it
   (e.g. → 2%) effective a date; accrual uses the rate in effect for each period.
7. **Interest is daily** from `dayInterestFrom` (01 Jun 2024): whole anchored months + leftover
   days at a daily rate; before that date, whole-month only.
8. **No repayment-amount validation** (no enforced minimum; round figures are advisory).
9. **Loan limit = ₹5,00,000**, configurable in admin settings (revisable).
10. **Vendors are typed:** `GENERAL` (generic placement: invest → return, profit = returns −
    invested; covers bank deposits/interest) and `CHIT` (monthly installments + payout, with a
    remaining-obligation if payout taken early, its own schedule §15). There is **no separate BANK
    type** — a bank is just a GENERAL vendor (note the bank name in the vendor's description).
11. **Catch-up** replaces "offset": late-join + delayed-payment subtypes; equalizes member value.
12. **Withdraw = settle (admin-entered amount) → freeze → INACTIVE**, keep history. **Reactivate**
    = repay (1–2 terms) + catch-up (profit-per-member + owed deposits).
13. **Roles = `ADMIN` / `MEMBER`** only; **treasurer is a flag**, not a role. (`SUPER_ADMIN`
    optional later if a "manages admins" tier is wanted.)
14. **Member visibility:** full read transparency, no write.
15. **Edit/delete:** admin only, via reversal (audited); period-lock seam built, off by default.
16. **Member ↔ User:** separate entities, optional `Member.userId` link.

### 4.3 Deposit stages (locked from owner data)

```
alpha : ₹1,000/month  01 Sep 2020 → 31 Aug 2023
bravo : ₹2,000/month  31 Aug 2023 → present
club startedAt        01 Sep 2020
dayInterestFrom       01 Jun 2024
```
Stored in `ClubConfig.stages` as paise. Month boundaries defined so exactly one stage owns each
month (alpha through Aug 2023, bravo from Sep 2023). Dates were given MM/DD/YYYY in IST.

---

## 5. Architecture at a glance

```mermaid
flowchart TD
  subgraph Client["Browser (minimal JS)"]
    UI["React Server Components<br/>+ client islands (entry drawer, charts)"]
  end
  subgraph Server["Next.js server (Vercel)"]
    RSC["Server Components"]
    ACT["server/actions/* ('use server')"]
    SVC["server/services/* (business logic)"]
    LED["server/ledger/* (double-entry engine)"]
    QRY["server/queries/* (read models)"]
    AUTH["server/auth/* (Better Auth + requireRole)"]
    CACHE["Next.js cache (tag-based)"]
  end
  subgraph Data["Neon PostgreSQL"]
    DB[("Prisma: LedgerAccount / Transaction / Entry /<br/>Member / Vendor / ChitFund / Loan / ClubConfig / AuditLog")]
  end
  UI -->|render| RSC
  RSC -->|read| QRY
  UI -->|mutations| ACT
  ACT --> AUTH
  ACT --> SVC --> LED -->|prisma.$transaction| DB
  QRY -->|SELECT| DB
  QRY <--> CACHE
  SVC -->|revalidateTag| CACHE
```

- **Reads:** Server Components call `server/queries/*` directly (typed, no HTTP), cached + tagged.
- **Writes:** UI → `actions/*` → `services/*` → `ledger/*` → `prisma.$transaction`, then
  `revalidateTag()` only the affected tags.
- **Money conversion** lives only in `lib/money`. The **ledger engine is the single choke point**
  for all balance changes and is the most heavily tested module.

---

## 6. The double-entry ledger — mental model

Every financial event is **one balanced `Transaction`** of signed `Entry` lines that **sum to
zero**. Each line posts to one `LedgerAccount` whose cached `balance` is updated **in the same DB
transaction**.

### Invariants

```
Per Transaction t:    Σ entry.amount == 0                 (enforced before commit)
Per LedgerAccount a:  a.balance == Σ entry.amount         (maintained incrementally; re-summed only to audit)
```

### Sign convention

- **Asset/receivable** (`TREASURY_CASH`, `LOAN_RECEIVABLE`, `VENDOR_RECEIVABLE`) → **positive**.
- **Equity/income** (`MEMBER_EQUITY`, `INTEREST_INCOME`, `VENDOR_PROFIT`) → **negative**.

Net club value nets to zero automatically (assets = equity + income), so we never hand-maintain a
`netClubValue` field.

### The four kinds of numbers

| Kind | Definition | How v2 computes it |
|------|-----------|--------------------|
| **Stock** | balance "right now" | read `LedgerAccount.balance` (O(1)) |
| **Flow** | lifetime running total | `SUM(entry.amount)` filtered by type/account (indexed) |
| **Expected/config** | pure function of config + time | `getMemberTotalDeposit(now)` over stages |
| **Derived-on-read** | time-based, computed on display | `interestToDate(loan)`, `pending = expected − actual` |

No passbook. Nothing that can drift.

---

## 7. Chart of accounts

| Kind (`LedgerAccountKind`) | Cardinality | Normal sign | Meaning |
|----------------------------|-------------|-------------|---------|
| `TREASURY_CASH` | 1 per treasurer-member (on demand) | + | Club cash physically held by that member |
| `MEMBER_EQUITY` | 1 per member | − | The member's stake/contributions |
| `LOAN_RECEIVABLE` | 1 per member | + | Principal the member currently owes |
| `VENDOR_RECEIVABLE` | 1 per vendor (general / chit) | + | Principal/installments currently placed with the vendor |
| `INTEREST_INCOME` | exactly 1 | − | Club income from loan interest |
| `VENDOR_PROFIT` | 1 per vendor | − | Realized profit (or loss) from that vendor |

Creation rules: `INTEREST_INCOME` once at seed; `MEMBER_EQUITY` (+ `LOAN_RECEIVABLE` lazily) when a
member is created; `VENDOR_RECEIVABLE` + `VENDOR_PROFIT` when a vendor is created; `TREASURY_CASH`
the first time a member holds cash (or when flagged treasurer).

> There is **no single club-cash account**. "Available cash" is always `Σ TREASURY_CASH`. This is
> the central structural difference from v1 and from Revision 1 of this plan.

---

## 8. Posting spec — every transaction type, line by line

`A` = amount (paise, > 0). `(m)` member, `(v)` vendor, `(t)`/`(t1,t2)` treasury. `P` = principal
portion. Every row **sums to zero**.

| `TxnType` | Postings (signed paise) | Side-effect |
|-----------|-------------------------|-------------|
| `PERIODIC_DEPOSIT` | `TREASURY_CASH(t) +A`, `MEMBER_EQUITY(m) −A` | — |
| `CATCHUP` (subtype late-join / delayed) | `TREASURY_CASH(t) +A`, `MEMBER_EQUITY(m) −A` | — |
| `ADJUSTMENT` | `TREASURY_CASH(t) +A`, `MEMBER_EQUITY(m) −A` (or signed for corrections) | — |
| `WITHDRAW` | `TREASURY_CASH(t) −A`, `MEMBER_EQUITY(m) +A` | on full settlement: member → INACTIVE, frozen |
| `REJOIN` | `TREASURY_CASH(t) +A`, `MEMBER_EQUITY(m) −A` | member → ACTIVE |
| `FUNDS_TRANSFER` | `TREASURY_CASH(t1) −A`, `TREASURY_CASH(t2) +A` | net-zero on total club cash |
| `LOAN_TAKEN` (tranche) | `TREASURY_CASH(t) −A`, `LOAN_RECEIVABLE(m) +A` | `loan.principalOutstanding += A` |
| `LOAN_REPAY` | `TREASURY_CASH(t) +P`, `LOAN_RECEIVABLE(m) −P` [+ interest leg] | `principalOutstanding −= P`; if 0 → CLOSED |
| `LOAN_INTEREST` | `TREASURY_CASH(t) +A`, `INTEREST_INCOME −A` | — |
| `VENDOR_INVEST` (general) | `TREASURY_CASH(t) −A`, `VENDOR_RECEIVABLE(v) +A` | — |
| `VENDOR_RETURN` (general) | `TREASURY_CASH(t) +A`, `VENDOR_RECEIVABLE(v) −P`, `VENDOR_PROFIT(v) −(A−P)` | — (bank interest: P=0, so all of A is profit) |
| `VENDOR_WRITEOFF` | `VENDOR_RECEIVABLE(v) −R`, `VENDOR_PROFIT(v) +R` (R = residual) | clears shortfall as loss on close |
| `CHIT_PAYMENT` (installment) | `TREASURY_CASH(t) −A`, `VENDOR_RECEIVABLE(v) +A` | `chit.installmentsPaid += 1` |
| `CHIT_PAYOUT` | `TREASURY_CASH(t) +A`, `VENDOR_RECEIVABLE(v) −P`, `VENDOR_PROFIT(v) −(A−P)` | mark payout; track remaining obligation |
| `REVERSAL` | negated copy of target's lines | undo target's side-effects |

Notes:
- A `LOAN_REPAY` may carry a combined principal + interest payment — the interest portion is posted
  as a `LOAN_INTEREST` leg in the same transaction (admin allocates principal vs interest).
- `WITHDRAW` amount is **admin-entered** (the system shows the computed settlement value as a
  guide; the entered figure may be slightly less — see §16).
- `ADJUSTMENT` is the generic signed correction; catch-up and deposits are the common positives.

### Worked examples

**Deposit ₹2,000 collected by treasurer T** (A = 200000):
```
TREASURY_CASH(T) +200000 ; MEMBER_EQUITY(m) -200000        // sum 0 ✓
```

**Internal transfer ₹50,000 from treasurer A to B** (A = 5000000):
```
TREASURY_CASH(A) -5000000 ; TREASURY_CASH(B) +5000000      // sum 0 ✓ ; total cash unchanged
```

**Loan tranche 1: treasurer A funds ₹1,00,000 of a ₹2,50,000 loan** (A = 10000000):
```
TREASURY_CASH(A) -10000000 ; LOAN_RECEIVABLE(m) +10000000  // loan.principalOutstanding += 10000000
```

**Vendor (general) returns ₹22,000, ₹20,000 principal** (A = 2200000, P = 2000000):
```
TREASURY_CASH(t) +2200000 ; VENDOR_RECEIVABLE(v) -2000000 ; VENDOR_PROFIT(v) -200000   // sum 0 ✓
```

**Chit closes ₹2,000 short** (R = 200000): `VENDOR_RECEIVABLE −200000 ; VENDOR_PROFIT +200000` (loss).

---

## 9. Database schema (full Prisma + commentary)

> Ledger accounts are `LedgerAccount` to avoid clashing with Better Auth's `Account`.

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

// ---------- Identity ----------
model Member {
  id          String   @id @default(cuid())
  firstName   String
  lastName    String?
  phone       String?
  avatarUrl   String?
  role        MemberRole   @default(MEMBER)   // ADMIN or MEMBER (admin = write access)
  isTreasurer Boolean      @default(false)    // convenience flag; treasury cash lives in LedgerAccount
  status      MemberStatus @default(ACTIVE)   // ACTIVE / INACTIVE (frozen) / LEFT
  joinedAt    DateTime                         // admission date (drives late-join catch-up)
  userId      String?  @unique                 // optional Better Auth user link
  accounts    LedgerAccount[]                  // equity, loan-receivable, and treasury (if any)
  loans       Loan[]
  archivedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([status])
}

model Vendor {
  id          String   @id @default(cuid())
  name        String
  type        VendorType                        // GENERAL or CHIT
  status      VendorStatus @default(ACTIVE)     // ACTIVE / INACTIVE / CLOSED
  accounts    LedgerAccount[]                   // receivable + profit
  chit        ChitFund?                          // present iff type = CHIT
  startedAt   DateTime @default(now())
  closedAt    DateTime?
  archivedAt  DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ChitFund {
  id                 String  @id @default(cuid())
  vendorId           String  @unique
  vendor             Vendor  @relation(fields: [vendorId], references: [id])
  chitValue          BigInt                      // face value, e.g. ₹5,00,000
  durationMonths     Int                         // e.g. 20
  marginInstallment  BigInt                      // the CAP = chitValue / durationMonths (e.g. ₹25,000); installments ramp up to this
  startedAt          DateTime
  payoutMonth        Int?                        // month index the payout was taken (10..20 or last)
  payoutAt           DateTime?
  payoutAmount       BigInt?                     // cash received at payout
  status             ChitStatus @default(RUNNING) // RUNNING / PAID_OUT / COMPLETED
  createdAt          DateTime @default(now())
}

// ---------- Ledger ----------
model LedgerAccount {
  id        String   @id @default(cuid())
  kind      LedgerAccountKind
  balance   BigInt   @default(0)               // cached running balance (paise)
  memberId  String?                             // for TREASURY_CASH / MEMBER_EQUITY / LOAN_RECEIVABLE
  member    Member?  @relation(fields: [memberId], references: [id])
  vendorId  String?                             // for VENDOR_RECEIVABLE / VENDOR_PROFIT
  vendor    Vendor?  @relation(fields: [vendorId], references: [id])
  entries   Entry[]
  createdAt DateTime @default(now())
  @@unique([memberId, kind])                    // one equity / one loan-acct / one treasury per member, per kind
  @@unique([vendorId, kind])
  @@index([kind])
}

model Transaction {
  id          String   @id @default(cuid())
  type        TxnType
  subtype     TxnSubtype?                        // e.g. catch-up LATE_JOIN / DELAYED_PAYMENT
  occurredAt  DateTime                           // drives month bucketing (UTC stored, IST bucketed)
  description String?
  reference   String?
  reversesId  String?  @unique                   // set when this reverses another txn
  loanId      String?                            // link for loan-related txns (tranches, repay, interest)
  vendorId    String?                            // link for vendor/chit txns
  entries     Entry[]
  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([occurredAt])
  @@index([type, occurredAt])
  @@index([loanId])
  @@index([vendorId])
}

model Entry {
  id            String  @id @default(cuid())
  transactionId String
  accountId     String
  amount        BigInt                            // signed paise
  transaction   Transaction   @relation(fields: [transactionId], references: [id], onDelete: Restrict)
  account       LedgerAccount @relation(fields: [accountId], references: [id])
  @@index([accountId])
  @@index([transactionId])
}

model Loan {
  id                   String   @id @default(cuid())
  memberId             String
  member               Member   @relation(fields: [memberId], references: [id])
  requestedAmount      BigInt                     // what the member asked for (funded via tranches)
  principalOutstanding BigInt   @default(0)       // Σ disbursed − Σ repaid (kept current)
  monthlyRateBps       Int                        // SNAPSHOT of rateAt(startedAt); fixed for the loan's life (§14.2)
  startedAt            DateTime                   // first tranche date; drives the 5-month term
  closedAt             DateTime?
  status               LoanStatus @default(ACTIVE) // ACTIVE / CLOSED  (overdue is derived)
  createdAt            DateTime @default(now())
  @@index([memberId])
  @@index([status])
}

// ---------- Config & audit ----------
model ClubConfig {
  id               String   @id @default("singleton")
  name             String
  startedAt        DateTime
  stages           Json     // [{ name, amountPaise, startDate, endDate? }]
  rateSchedule     Json     // [{ rateBps, effectiveFrom }]  (1% from start; admin appends changes)
  dayInterestFrom  DateTime // daily proration applies from this date onward
  maxLoanPaise     BigInt   // current loan limit (₹5,00,000), revisable
  loanTermMonths   Int      @default(5)
  loanCooldownMonths Int    @default(1)
  overduePenaltyBps  Int    @default(0)  // extra monthly rate on the overdue portion (G1); CURRENT config — applies instantly to ALL loans
  lateDepositPenaltyPaise BigInt @default(0) // per-late-deposit penalty (G7); 0 = off, only show overdue indicator
  dividendEnabled  Boolean  @default(false) // periodic member dividend seam (G2); off for now
  timezone         String   @default("Asia/Kolkata")
  updatedAt        DateTime @updatedAt
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?
  action     String
  entityType String
  entityId   String
  meta       Json?
  createdAt  DateTime @default(now())
  @@index([entityType, entityId])
}

// Optional cache, rebuilt deterministically from the ledger (added only if profiling needs it):
// model MonthlyRollup { month DateTime @id; data Json; builtAt DateTime }

enum LedgerAccountKind { TREASURY_CASH MEMBER_EQUITY LOAN_RECEIVABLE VENDOR_RECEIVABLE INTEREST_INCOME VENDOR_PROFIT }
enum TxnType { PERIODIC_DEPOSIT CATCHUP ADJUSTMENT WITHDRAW REJOIN FUNDS_TRANSFER LOAN_TAKEN LOAN_REPAY LOAN_INTEREST VENDOR_INVEST VENDOR_RETURN VENDOR_WRITEOFF CHIT_PAYMENT CHIT_PAYOUT REVERSAL }
enum TxnSubtype { LATE_JOIN DELAYED_PAYMENT }
enum MemberRole { ADMIN MEMBER }
enum MemberStatus { ACTIVE INACTIVE LEFT }
enum VendorType { GENERAL CHIT }
enum VendorStatus { ACTIVE INACTIVE CLOSED }
enum ChitStatus { RUNNING PAID_OUT COMPLETED }
enum LoanStatus { ACTIVE CLOSED }
```

### Commentary

- **`@@unique([memberId, kind])`** resolves Revision 1's bug: a member can now hold up to three
  accounts (equity, loan-receivable, treasury), at most one of each kind.
- **Loan principal timeline is reconstructed from `LOAN_TAKEN`/`LOAN_REPAY` entries** (by
  `loanId` + `occurredAt`); no separate tranche table. `principalOutstanding` is the cached stock.
- **No per-loan rate**: interest uses the global `rateSchedule` (a rate bump applies to all live
  loans from its effective date). `‹TBD›` if any loan ever needs an override.
- **`ClubConfig.rateSchedule`** seeded as `[{ rateBps: 100, effectiveFrom: clubStart }]` (1%).
- Money inside JSON (`stages`, `payoutAmount` etc.) is stored as **string paise** to avoid JS
  float in JSON.

---

## 10. Money handling — the BigInt/paise contract

Money is `BigInt` paise on the server, everywhere. It becomes a formatted ₹ string only at the
display edge, only via `lib/money`.

`BigInt` is **not** serializable in RSC payloads / Server Action returns by default, so DTOs cross
the boundary as **string paise** (field suffix `Paise`, e.g. `availableCashPaise: string`).

### `lib/money` API (P0)

```ts
type Paise = bigint
rupeesToPaise(r: number|string): Paise   // validates ≤ 2 dp
paiseToRupees(p: Paise): number          // for charts/math only
formatINR(p: Paise): string              // Intl en-IN → "₹5,000.00"
serializePaise(p): string ; parsePaise(s): Paise
addPaise(...xs): Paise ; negate(p): Paise ; isZero(p): boolean
roundToWholeRupee(p: Paise): Paise       // interest rounding (§14)
```

Never do floating-point math on money. Map rows → DTOs (don't globally monkey-patch
`BigInt.toJSON`). Rounding happens only where a real rule applies (interest), as a tested function.

---

## 11. Dates, timezone & month boundaries

All bucketing/age math in **IST** (no DST — simplifies things), timestamps stored UTC.

### `lib/date` API (P0)

```ts
TZ = "Asia/Kolkata"
monthStartIST(d) ; monthEndIST(d)
monthsSince(start, asOf): number               // whole months, IST
anchoredMonths(from, asOf): { months, extraDays }  // day-of-month anchored (the "20th→20th" rule, §14)
daysInMonthIST(d): number
bucketKey(d): "YYYY-MM"
```

`anchoredMonths` implements the owner's loan-interest counting: a loan from the **20th** completes
one "month" on the **20th** of the next month; trailing days are counted separately. Unit-tested
against month-length edges (e.g. 31 Jan → 28 Feb).

---

## 12. The critical write path — `postTransaction`

The single choke point for all balance changes (`server/ledger/postTransaction.ts`).

```ts
interface PostTransactionInput {
  type: TxnType; subtype?: TxnSubtype
  occurredAt: Date; description?: string; reference?: string
  loanId?: string; vendorId?: string; reversesId?: string
  lines: { accountId: string; amount: Paise }[]   // signed, must sum to 0
  actorId?: string
}
```

Callers rarely hand-build `lines`; intent helpers (§22) build them from §8.

```
postTransaction(input):
  # 0. pure pre-validate
  assert input.lines.length >= 2
  assert Σ line.amount == 0
  assert every line.amount != 0
  Zod type-specific shape check (correct account kinds; A>0; P<=A; etc.)

  # 1. one DB transaction
  prisma.$transaction(tx => {
    accounts = tx.ledgerAccount.findMany(id IN lines.accountId)  # FOR UPDATE (lock)
    assert all referenced accounts exist
    txn = tx.transaction.create({ ...header })
    tx.entry.createMany(lines → { transactionId, accountId, amount })
    for line: tx.ledgerAccount.update(id=line.accountId, balance += line.amount)   # atomic increment, O(lines)
    if input.loanId: apply loan side-effects (LOAN_TAKEN/REPAY/REVERSAL) → principalOutstanding, status
    if input.vendorId && chit: apply chit side-effects (installmentsPaid, payout, status)
    tx.auditLog.create({ ... })
    return txn
  })

  # 2. after commit
  revalidateTag(...affectedTags(input))
```

Why the ordering: validate before any write; everything atomic in one `$transaction`; balances via
SQL `increment` (safe under concurrency with row locks); `revalidateTag` only after commit.

```mermaid
sequenceDiagram
  participant UI as Entry drawer
  participant ACT as action
  participant SVC as intent helper
  participant LED as postTransaction
  participant DB as Postgres ($transaction)
  UI->>ACT: submit { intent, amount, member/treasury, date }
  ACT->>ACT: requireRole(ADMIN) + Zod
  ACT->>SVC: e.g. giveLoanTranche(loanId, treasuryId, amount, date)
  SVC->>SVC: build balanced lines (§8)
  SVC->>LED: postTransaction(input)
  LED->>DB: BEGIN → lock accounts → insert txn+entries → balances += → loan/chit update → audit → COMMIT
  LED-->>ACT: txn
  ACT->>ACT: revalidateTag(affected)
  ACT-->>UI: success (optimistic confirmed)
```

### 12.1 Validations & invariants (no-drawbacks guardrails)

Beyond `Σ lines == 0`, the engine + services enforce (each unit-tested):

| Guard | Rule |
|-------|------|
| **Non-negative treasury** | A cash-out leg (`WITHDRAW`, `LOAN_TAKEN`, `VENDOR_INVEST`, `CHIT_PAYMENT`, `FUNDS_TRANSFER` source) must not drive `TREASURY_CASH(t).balance` below 0 — a treasurer can't pay out cash they don't hold. |
| **Account-kind correctness** | Each `TxnType` may only touch the kinds in its §8 row (e.g. `LOAN_INTEREST` hits `TREASURY_CASH` + `INTEREST_INCOME` only). |
| **Loan funding cap** | Σ disbursed tranches ≤ `loan.requestedAmount`; `requestedAmount ≤ ClubConfig.maxLoanPaise`. |
| **No top-up** | No `LOAN_TAKEN` once the loan is fully funded (Σ tranches == requestedAmount) or in repayment. |
| **One active loan / cooldown** | Opening a loan requires the member has **no** ACTIVE loan, no outstanding loan balance, and ≥ `loanCooldownMonths` since the last loan's `closedAt`. |
| **Repay ≤ outstanding** | `LOAN_REPAY` principal leg ≤ `principalOutstanding`; closes the loan exactly at 0. |
| **Vendor return split** | `P ≤ A` on `VENDOR_RETURN` / `CHIT_PAYOUT`; residual cleared via `VENDOR_WRITEOFF` on close. |
| **Frozen member** | No new financial postings (except reactivation) against an `INACTIVE`/`LEFT` member. |
| **Period lock** | If the target month is locked, refuse create/edit/reverse (seam off by default). |
| **Positive amounts** | Every line `amount != 0`; intent amounts `> 0`; rounding only via `lib/money`. |

These run in the **pure pre-validate** step (§12) where possible, and inside the `$transaction`
(with `FOR UPDATE` locks) for balance-dependent checks (non-negative treasury, repay ≤ outstanding)
so they're race-safe.

---

## 13. Reverse & edit

```
reverseTransaction(targetId, actorId):
  target = load txn + entries ; assert not already reversed ; assert period not locked
  post REVERSAL with negated lines, reversesId=target.id, same loanId/vendorId
  # loan/chit side-effects undone in the REVERSAL branch

editTransaction(targetId, corrected, actorId):
  $transaction: reverseTransaction(targetId) ; postTransaction(corrected)   # atomic; O(lines)
```

Delete = reverse (history kept, balances restored). Edit = reverse + re-post. Both refuse on a
locked period. `‹TBD›` `REVERSAL.occurredAt`: date "now" (audit-accurate) vs target's date
(keeps analytics buckets stable) — recommend dating the reversal to the target's `occurredAt` for
edits so buckets stay correct.

---

## 14. Loans in depth — tranches, rate schedule, interest

The richest part of the system. **One `Loan` = one borrowing**, funded by tranches, repaid in
parts, interest derived from the principal timeline crossed with the global rate schedule.

### 14.1 Lifecycle & rules

```mermaid
flowchart LR
  R["request (requestedAmount ≤ maxLoanPaise)"] --> D1["LOAN_TAKEN tranche 1 (treasurer A)"]
  D1 --> D2["LOAN_TAKEN tranche 2 (treasurer B)…"]
  D2 --> A["ACTIVE (interest accrues daily)"]
  A --> RP["LOAN_REPAY (partial, principal + interest legs)"]
  RP --> A
  A -->|now > start+5mo| OV["overdue (derived) — still ACTIVE"]
  RP -->|principalOutstanding == 0| C["CLOSED"]
  C -->|+1 month cooldown| R2["eligible for next loan"]
```

- **Eligibility:** member has **no** ACTIVE loan and no outstanding balance; ≥ 1 month since last
  loan's `closedAt`; `requestedAmount ≤ ClubConfig.maxLoanPaise`.
- **Tranches:** multiple `LOAN_TAKEN` until cumulative disbursed = `requestedAmount`. **No top-ups
  after fully funded.** `startedAt` = first tranche date.
- **Overdue:** `isOverdue(loan) = status==ACTIVE && monthsSince(startedAt, now) > loanTermMonths`.
  Derived; not stored.
- **Repayment:** any amount (no minimum), to any treasury; may include an interest portion.
- **Close:** when `principalOutstanding == 0` → `CLOSED`, `closedAt = occurredAt`.

### 14.2 The global rate schedule — applies to NEW loans only

```
ClubConfig.rateSchedule = [{ rateBps, effectiveFrom }, ...]   # sorted
rateAt(date) = rateBps of the latest entry with effectiveFrom <= date
```
Seed: `[{ rateBps: 100, effectiveFrom: clubStart }]` (1%/month). The admin may append e.g.
`{ rateBps: 200, effectiveFrom: <date> }`.

**A rate change affects only loans that START on/after its effective date.** An existing loan
**keeps the rate it was opened with for its entire life** — rate changes never apply mid-loan. So
each `Loan` snapshots its rate at creation: `loan.monthlyRateBps = rateAt(loan.startedAt)`. This
removes all mid-loan rate-splitting from the interest engine.

### 14.3 Interest engine (derive-on-read)

Each loan has a **single fixed rate** (§14.2). The principal-over-time curve has breakpoints only
at **each tranche**, **each repayment**, and **`dayInterestFrom`**. **The month-anchor resets at
each principal change** ("from that day the interest is calculated for that ₹30,000").

```
interestToDate(loan, asOf = now):
  rate     = loan.monthlyRateBps / 10000                  # fixed for the whole loan
  events   = sorted [(date, ±amount)] from LOAN_TAKEN(+) and LOAN_REPAY principal legs(−)
  segments = principalTimeline(events, asOf)              # (balance B, segStart, segEnd), B constant per segment
  total = 0
  for (B, s, e) in segments:
      for (ss, ee, daily) in splitAtDailyBoundary(s, e):  # split only at dayInterestFrom
          { months, extraDays } = anchoredMonths(ss, ee)  # anchored at ss (the segment's own start)
          if daily:                                       # on/after dayInterestFrom
              dailyRate = (B*rate) / daysInIncompleteMonthIST(ss, months)   # monthlyRate ÷ days in the trailing incomplete month
              total += B*rate*months + dailyRate*extraDays
          else:                                           # before dayInterestFrom: whole-month, round partial up
              total += B*rate * (months + (extraDays > 0 ? 1 : 0))
  total += overduePenalty(loan, asOf)                     # G1; 0 when overduePenaltyBps == 0
  return roundToWholeRupee(total)

# Overdue penalty — uses the CURRENT global config (applies instantly to all loans), NOT a snapshot.
overduePenalty(loan, asOf):
  penaltyBps = ClubConfig.overduePenaltyBps              # default 0 → returns 0
  if penaltyBps == 0: return 0
  termEnd = loan.startedAt + ClubConfig.loanTermMonths (IST)
  if asOf <= termEnd: return 0
  # accrue extra rate on the outstanding-balance timeline ONLY for the overdue window [termEnd, asOf]
  return Σ over segments in [termEnd, asOf] of  B * (penaltyBps/10000) * (anchored months + daily extra)

interestPending(loan) = interestToDate(loan) − Σ loan's LOAN_INTEREST payments
```

- **Daily denominator (owner-confirmed):** the trailing leftover days are pro-rated over the number
  of days in **the incomplete (next, partial) anchored month** — i.e. `daysInIncompleteMonthIST(ss,
  months)` = days between the last completed anchor (`ss + months`) and the following anchor
  (`ss + months + 1 month`). Daily rate = `monthlyRate ÷ that day-count`.
- **Worked example (owner's):** ₹1L day 0; +₹1.5L day 7 (→ ₹2.5L); single-shot repay at ~5 months
  ⇒ `accrue(₹1L, day0→day7)` + `accrue(₹2.5L, day7→repay)`. Partial: repay ₹2L mid-way, remaining
  ₹50k accrues from that day (anchor reset) until paid two weeks later at the daily rate.

`‹TBD›` only the migration edge remains: pre-`dayInterestFrom` partial month rounds **up** to a
full month (assumed) — lock to v1 fixtures.

### 14.4 Loan figures

```
loan.outstanding        = LOAN_RECEIVABLE(m).balance contribution from this loan (or principalOutstanding)
loan.interestToDate     = §14.3
loan.interestPending    = interestToDate − interestPaid
loan.isOverdue          = derived (§14.1)
member.currentLoanOutstanding = LOAN_RECEIVABLE(m).balance
expectedTotalLoanInterest     = Σ active loans interestToDate(loan)   # club-level, derive-on-read
```

### 14.5 Borrower priority (advisory, G5)

The backend derives a **priority hint** for the new-loan screen; it is **advisory only** — the admin
may follow it or not. Higher priority = members who have borrowed less.

```
borrowerPriority(m) = HIGH  if member never took a loan or has minimal borrowing history
                    = LOW   if member borrows frequently / large
# surfaced in the loan UI as a HIGH/LOW badge; NOT a hard block on lending.
```

---

## 15. Chit funds in depth

A `CHIT` vendor models: pay a **monthly installment that ramps up over time** for
`durationMonths`; receive a **payout** at some month (10..20 or last); **must keep paying to term
even if payout taken early**.

**Installments vary (owner-confirmed):** they start lower and increase month to month, **capped at
the margin** `marginInstallment = chitValue / durationMonths` (e.g. ₹5,00,000 / 20 = ₹25,000) —
never beyond. Actual amounts are recorded per `CHIT_PAYMENT` entry; `marginInstallment` is the cap
used for the **maximum** remaining-obligation estimate.

### Mechanics (owner's example: ₹5,00,000 chit, 20 months, margin ₹25,000)

```mermaid
flowchart LR
  S["create CHIT vendor + ChitFund (value, duration, margin, start)"] --> P["monthly CHIT_PAYMENT (actual amount → VENDOR_RECEIVABLE)"]
  P --> P
  P --> PO["CHIT_PAYOUT at month k (cash in; profit = payout − net paid so far)"]
  PO --> O["remaining (duration−k) installments stay as an OBLIGATION; payments continue"]
  O --> P2["CHIT_PAYMENT continues to term"]
  P2 --> CL["month = duration → COMPLETED"]
```

### Accounts & postings

- **Installment:** `CHIT_PAYMENT` → `TREASURY_CASH(t) −A`, `VENDOR_RECEIVABLE(v) +A`; `installmentsPaid++`.
- **Payout:** `CHIT_PAYOUT` → `TREASURY_CASH(t) +A`, `VENDOR_RECEIVABLE(v) −P`, `VENDOR_PROFIT(v) −(A−P)`.
- **Close short / loss:** `VENDOR_WRITEOFF`.

### Derived figures

```
chit.totalPaid           = Σ CHIT_PAYMENT to date                     # actual amounts
chit.installmentsLeft     = max(0, durationMonths − installmentsPaid)
chit.remainingObligation  = installmentsLeft × marginInstallment      # MAX liability still owed (cap-based; actuals may be less)
chit.netProfit            = (payoutAmount ?? 0) − totalPaid           # may be negative
   active : reported as max(netProfit, 0) until COMPLETED (rule §17)
   completed: full netProfit
```

Profit recognition (recommended, owner to confirm): realize profit at payout; carry
`remainingObligation` as a disclosed liability that **reduces** `currentValue` / `profitPerMember`
(§17.3). `remainingObligation` is a conservative **maximum** (installments ramp toward the margin
but may be lower), so the obligation shown is the worst case.

---

## 16. Members — deposits, catch-up, withdraw & rejoin

### 16.1 Expected deposit (stage-based)

```
getMemberTotalDeposit(member, asOf):           # expected cumulative deposit, paise
  total = 0
  for stage in ClubConfig.stages:
      from = max(stage.startDate, member.joinedAt-relevant start)
      to   = min(stage.endDate ?? asOf, asOf)
      total += stage.amountPaise × monthsBetweenInclusive(from, to)   # IST, clamp ≥ 0
  return total
```
`‹TBD›` exact month-count semantics (join-month inclusive? first-month proration?) — lock to v1
fixtures during migration.

### 16.2 Catch-up (equalization)

A new/returning member pays, beyond the prevailing deposit, a **catch-up** so they hold equal
value. The system **auto-computes a guide amount and the admin can edit it** (increase/decrease) —
same pattern as settlements (G6):

```
catchUpGuide(member, asOf = today) =
      getMemberTotalDeposit(member, clubStart..asOf)   # all monthly deposits from club start to today (DELAYED_PAYMENT part)
    + profitPerMember(asOf)                            # accumulated profit-per-member from start to today (LATE_JOIN part)
# shown to admin as the guide; admin edits the final figure; the math is done by the system.
```

- **late-join** (`subtype = LATE_JOIN`): the **profit-per-member** portion — brings the joiner up to
  existing members' accumulated profit.
- **delayed-payment** (`subtype = DELAYED_PAYMENT`): the **deposits** portion — months they hadn't
  contributed.

Posted as `CATCHUP` (deposit-shaped: `TREASURY_CASH +A`, `MEMBER_EQUITY −A`), reported separately
from periodic deposits. Maps from v1 `joiningOffset` → LATE_JOIN, `delayOffset` → DELAYED_PAYMENT.

### 16.3 Withdraw → freeze → reactivate

```mermaid
flowchart LR
  AC["ACTIVE"] -->|leaving| W["WITHDRAW (admin-entered settlement amount)"]
  W --> Z["profit → 0 ; equity settled out ; status = INACTIVE (frozen) ; history kept"]
  Z -->|returns| RA["REACTIVATE"]
  RA --> PAY["repay in 1–2 terms (REJOIN) + CATCHUP (profit-per-member + owed deposits)"]
  PAY --> AC2["ACTIVE again, equal value"]
```

**Withdrawal is a FULL EXIT only (G3).** There is **no** partial withdrawal, no profit-only
withdrawal, and no withdrawal-without-leaving. A member either stays fully in or leaves and settles.

- **Withdraw / leave:** the system **computes a guide value** and shows it; the **admin enters the
  actual settlement** (may be slightly less). The guide nets the member's capital, their loan, and
  their profit share:

  ```
  memberSettlementGuide(m) =
        contributedCapital(m)            # paid periodic + catch-up deposits (their actual capital in)
      + memberProfitShare(m)             # see the OPEN QUESTION below
      − memberLoanOutstanding(m)         # loan principal netted out of the settlement
      − memberInterestPending(m)         # unpaid accrued loan interest netted out
  ```

  Note **pending/unpaid deposits are NOT subtracted as a debt** — a leaver who underpaid simply
  contributed less capital (and, per the owner's example, earns proportionally less profit). Their
  unpaid deposits are not collected on exit. Posting: `TREASURY_CASH(t) −A`, `MEMBER_EQUITY(m) +A`;
  member → `INACTIVE`, frozen; **all history retained**.

  > **⚠ OPEN QUESTION — `memberProfitShare(m)` (needs owner confirm; do not assume).** The owner's
  > example (expected cumulative deposit ₹20k, member paid ₹10k, loan ₹5k → "remaining ₹5,000 given
  > + one-member-profit ÷ 2") reads as **profit proportional to how fully the member paid**:
  > ```
  > memberProfitShare(m) = profitPerMember × min(1, contributedCapital(m) / expectedDeposit(m))
  >                      # ₹10k paid / ₹20k expected = ½ → half of one member's profit
  > ```
  > The alternative reading is a flat **equal** share (`profitPerMember`), where "÷ 2" only meant
  > "÷ number of members (2)". These give different numbers whenever a member is behind on deposits.
  > **Confirm which.** (Leaning: proportional-to-contribution, per the example.)

  > **⚠ Cash-flow caveat (still open):** part of `profitPerMember` is *unrealized* (uncollected loan
  > interest). Paying a leaver that share in cash pays out money the club hasn't collected yet.
  > Confirm whether settled **cash** includes unrealized profit or only displays it.
- **Reactivate (rejoin):** admin reactivates; member repays over **one or two terms** (`REJOIN`
  postings) and pays **catch-up** (§16.2 guide: profit-per-member + owed deposits), restoring equal
  value. Member → `ACTIVE`.

Pending uses **contributions, not balance** (rule §17.1), so a settled/negative equity never
creates phantom debt.

---

## 17. Calculations — every figure derived, line by line

> **⚠ Sign normalization (read first).** Entries on equity/income accounts (`MEMBER_EQUITY`,
> `INTEREST_INCOME`, `VENDOR_PROFIT`) are **negative** for the normal direction. Use a helper that
> returns a **positive magnitude**:
> ```
> flow(type, scope?) = | Σ entry.amount WHERE txn.type=type [AND scope] |
> ```
> i.e. sum the cash leg (positive for inflows) or negate the equity/income leg; an income/equity
> "balance read" is reported as `−account.balance`. Every `SUM`/`flow`/income-balance below is the
> **normalized positive** value unless a `±` is shown. Unit-tested.

### 17.1 Business rules (carry over verbatim)

1. **Pending uses contributions, not balance** — withdrawn principal isn't phantom debt.
2. **Profit-withdrawal split** — a `WITHDRAW`/settlement beyond contributed principal is profit
   withdrawn.
3. **Vendor/chit profit recognition** — active → `max(net, 0)`; closed/completed → full `net`
   (may be negative).
4. **Current value = asset-side identity** — `Σ treasuries + Σ loans outstanding + Σ vendor
   holdings` (never the equity-side sum).
5. **Interest = anchored months + daily, time-versioned rate, rounded to ₹** (§14).
6. **Stage-based expected deposits** (§16.1); **catch-up equalizes value** (§16.2).

### 17.2 Member figures (member `m`)

| Figure | Kind | Derivation |
|--------|------|-----------|
| Periodic deposits | flow | `flow(PERIODIC_DEPOSIT, m)` |
| Catch-up (late-join / delayed) | flow | `flow(CATCHUP, m)` (split by `subtype`) |
| Total deposits / balance | stock | `−MEMBER_EQUITY(m).balance` |
| Withdrawals / settled | flow | `flow(WITHDRAW, m)` |
| Profit withdrawn | derived | settlement beyond contributed principal (rule §17.1.2) |
| Loan outstanding | stock | `LOAN_RECEIVABLE(m).balance` |
| Interest paid / pending | flow / derived | `flow(LOAN_INTEREST, m)` / `interestToDate − paid` |
| Expected deposit (to date) | expected | `getMemberTotalDeposit(m, now)` |
| Pending contribution | derived | `expected − (periodic + delayed-catchup)` (contributions, not balance) |
| Deposit status (G7) | derived | `OVERDUE` when pending contribution > 0 past the month due; UI shows a "pending/overdue" indicator. Late penalty = `ClubConfig.lateDepositPenaltyPaise` (default **0** → indicator only). |
| Profit share | derived | `memberProfitShare(m)` (see §16.3 open question) |

### 17.3 Club / dashboard tiles

```
activeMembers           = COUNT(members WHERE status = ACTIVE)
clubAgeMonths           = monthsSince(ClubConfig.startedAt, now)            # IST

# Cash (no single club account)
availableCash           = Σ TREASURY_CASH.balance                          # + per-treasurer breakdown
perTreasurer[t]         = TREASURY_CASH(t).balance

# Member funds
totalExpectedDeposits   = Σ_active getMemberTotalDeposit(m, now)
memberDepositsPaid      = flow(PERIODIC_DEPOSIT)
totalMemberPending      = Σ_active( expected − (periodic + delayed-catchup) )
totalCatchUp            = flow(CATCHUP)

# Loans
totalLoanGiven          = flow(LOAN_TAKEN)                                  # lifetime disbursed
currentLoanOutstanding  = Σ LOAN_RECEIVABLE.balance
totalInterestCollected  = −INTEREST_INCOME.balance
expectedTotalLoanInterest = Σ active loans interestToDate(loan)            # derive-on-read (§14)
interestBalance         = max(0, expectedTotalLoanInterest − totalInterestCollected)
overdueLoans            = COUNT(active loans WHERE isOverdue)

# Vendors (general + chit)
vendorHolding           = Σ VENDOR_RECEIVABLE.balance
vendorProfit            = Σ vendor P&L (active: max(net,0); closed/completed: net)   # net = −VENDOR_PROFIT(v).balance
chitRemainingObligation = Σ running chits' remainingObligation

# Valuation
totalProfit             = vendorProfit + totalInterestCollected
totalInvested           = currentLoanOutstanding + vendorHolding
currentValue            = availableCash + currentLoanOutstanding + vendorHolding     # asset-side identity (realized)
totalPortfolioValue     = currentValue + interestBalance + totalMemberPending
pendingAmounts          = totalMemberPending + interestBalance

# Comprehensive profit-per-member (shown on dashboard; also the withdraw/rejoin guide, §16.3)
# KEY RULE (owner): pending INTEREST is profit; pending DEPOSITS are NOT profit (they are capital owed).
realizedProfit          = totalInterestCollected + vendorProfit                      # already in the books
pendingInterestProfit   = interestBalance                                            # loan interest accrued up to TODAY, not yet collected → PROFIT
                                                                                     # (loan interest is the only thing that ACCRUES continuously)
obligationsOut          = chitRemainingObligation                                    # future chit installments still owed → reduces profit
netDistributableProfit  = realizedProfit + pendingInterestProfit − obligationsOut − profitWithdrawals
profitPerMember         = netDistributableProfit / activeMembers                     # ← DASHBOARD TILE
returnPerMember         = profitPerMember                                            # alias (kept for parity)
availableProfit         = realizedProfit − profitWithdrawals                         # cash-realizable subset

# NOTES:
# - totalMemberPending (unpaid deposits) is CAPITAL owed, NOT profit. It sits in
#   totalPortfolioValue / pendingAmounts but is deliberately EXCLUDED from netDistributableProfit.
# - Bank/general/chit profit is recognized only when REALIZED (on VENDOR_RETURN / CHIT_PAYOUT),
#   so it lands in realizedProfit. Only LOAN INTEREST accrues continuously, so it is the only
#   "pending" item counted as profit. (A running chit before payout shows obligationsOut, not gain.)
# - In the withdraw guide (§16.3) a member's own pending deposits REDUCE their settlement (capital
#   still owed), while their share of pendingInterestProfit INCREASES it.
# - Division remainder: profitPerMember floors to whole paise; the residual stays in the club pot
#   (never silently dropped). Settlement uses the per-member share as a guide; admin enters the final.
```

---

## 18. Read models / queries

`server/queries/*`, each typed, Zod-validated DTO (money = string paise), tag-cached.

| Query | Returns | Backed by |
|-------|---------|-----------|
| `getDashboard()` | §17.3 tiles + per-treasurer cash | balance reads + a few `SUM`s + interest over active loans |
| `getMemberStatement(id)` | §17.2 figures + member's txns + loans | member accounts + filtered entries |
| `listMembers()` | members + balances + pending + role/treasurer flags | members → accounts |
| `listTreasurers()` | members holding cash + amounts | `TREASURY_CASH` accounts |
| `listLoans(filter?)` | loans + outstanding + interestToDate + overdue | loans + interest engine |
| `listVendors()` | general + chits, holding + profit + obligation | vendor accounts + chit |
| `getChit(id)` | chit schedule, paid, payout, obligation | `ChitFund` + entries |
| `listTransactions(filter, page)` | paginated ledger | transactions + entries (indexed) |
| `getGraphSeries(range)` | §19 series | grouped aggregates over entries |

---

## 19. Analytics & graphs

Both kinds straight from the ledger; historical edits reflect instantly.

```
balanceAsOf(account, monthEnd) = Σ entry.amount WHERE account=a AND occurredAt <= monthEnd
flow(type, month)              = Σ entry.amount WHERE type=t AND occurredAt IN month  GROUP BY month
interestThroughMonth(M)        = Σ active loans interestToDate(loan, monthEndIST(M))
```

Series (decision 16): portfolio value · available cash (and per-treasurer) · outstanding loans ·
deposits/month · interest/month · member-vs-club-average. **Optional `MonthlyRollup`** cache,
rebuilt deterministically from the ledger and invalidated for the earliest dirty month, added only
if profiling demands (owner OK'd background caching for non-time-sensitive aggregates).

---

## 20. Auth, roles & permissions

- **Better Auth** owns User/Session/Account/Verification. `Member.userId` optionally links.
- **Roles: `ADMIN` / `MEMBER`** on the member (write vs read). **Treasurer** is a separate
  capability (`isTreasurer` + holding a `TREASURY_CASH` account), not a role.
- `requireRole(min)` wraps protected actions/pages.

| Capability | ADMIN | MEMBER |
|------------|:-----:|:------:|
| View dashboard, members, loans, vendors, transactions, own statement | ✓ | ✓ (read) |
| Create / edit / reverse transactions; manage members/vendors/loans/chits | ✓ | — |
| Hold club cash (be a treasurer) | ✓ (any member) | ✓ (any member) |
| Edit club config (stages, rate schedule, loan limit); lock periods | ✓ | — |

`‹TBD›` whether to add `SUPER_ADMIN` (manages admins) — not needed for v1 functionality.

---

## 21. Caching & revalidation

One layer: Next.js cache, tag-invalidated, only after commit.

| Tag | Covers | Invalidated by |
|-----|--------|----------------|
| `dashboard` | tiles | any financial mutation |
| `member:{id}` / `members` | statement / list | member-touching mutations |
| `treasuries` | treasurer cash | any cash movement / transfer |
| `loans` | loan views | loan mutations |
| `vendors` | general + chit views | vendor/chit mutations |
| `transactions` | ledger | any txn create/reverse |
| `analytics` | graphs | any financial mutation |
| `config` | ClubConfig | config edits |

```
affectedTags(input):
  tags = ["dashboard","analytics","transactions","treasuries"]   # cash leg almost always present
  if touches member m: tags += ["member:"+m, "members"]
  if loan-related:      tags += ["loans"]
  if vendor/chit:       tags += ["vendors"]
  return unique(tags)

# config mutations cascade (stages/rate/limit feed derived views):
configTags() = ["config","dashboard","members","loans","vendors","analytics"]   # or a global config-version tag
```

---

## 22. Validation (Zod) & the service contract

**Mutations** (`actions/*` → `services/*` → `ledger`): `postTransaction`, `reverseTransaction`,
`editTransaction`; member CRUD + `withdrawMember` / `reactivateMember`; treasurer
designate/transfer; vendor CRUD (`GENERAL`/`CHIT`); chit `payInstallment` / `recordPayout`;
loan `openLoan` / `addTranche` / `repayLoan` / `payInterest` / `closeLoan`; `updateClubConfig`
(incl. `appendRateChange`, `setLoanLimit`, `editStages`); `lockPeriod`.

**Intent helpers** that build §8 lines: `depositForMember`, `catchUpForMember`, `transferCash`,
`giveLoanTranche`, `repayLoan`, `payLoanInterest`, `vendorInvest`, `vendorReturn`, `chitPayment`,
`chitPayout`, `settleMember`, `rejoinMember`.

**Queries:** as §18. All inputs/outputs Zod-validated; money fields = string paise.

```ts
'use server'
export async function repayLoan(form: unknown) {
  const s = await requireRole('ADMIN')
  const i = RepayLoanSchema.parse(form)   // { loanId, treasuryId, principalPaise, interestPaise?, occurredAt }
  const txn = await services.repayLoan(i, s.userId)
  for (const t of affectedTags({ type:'LOAN_REPAY', loanId:i.loanId, memberId:i.memberId })) revalidateTag(t)
  return { ok: true, id: txn.id }
}
```

---

## 23. App structure, routes & the entry drawer

```
src/
  app/  (auth)/login  dashboard/  members/[id]  loans/  transactions/  vendors/[id]  treasury/  analytics/  settings/  profile/
  server/  ledger/  services/  actions/  queries/  auth/
  lib/  money  date  zod  format
  components/  db/
prisma/  schema.prisma  seed.ts  migrate-from-v1.ts
```

The admin picks an **intent**, the drawer builds the posting and **always asks which treasury**
handles the cash:

```mermaid
flowchart LR
  A["Admin: what happened?"] --> B{intent}
  B -->|Deposit / Catch-up| C["member, amount, treasury, date"]
  B -->|Internal transfer| D["from-treasury, to-treasury, amount, date"]
  B -->|Give loan / tranche| E["member/loan, amount, treasury, date"]
  B -->|Repay loan| F["loan, principal (+interest), treasury, date"]
  B -->|Bank invest/return| G["vendor, amount, (principal), treasury, date"]
  B -->|Chit payment/payout| H["chit, amount, treasury, date"]
  B -->|Withdraw / reactivate| I["member, amount, treasury, date"]
  C & D & E & F & G & H & I --> J["intent helper → balanced §8 lines"] --> K["postTransaction → optimistic UI + revalidateTag"]
```

---

## 24. Migration v1 → v2

```mermaid
flowchart TD
  S1["1. Neon + v2 schema"] --> S2["2. Seed ClubConfig: name, startedAt, stages (alpha/bravo), rateSchedule [1% from start], dayInterestFrom, maxLoanPaise=₹5L"]
  S2 --> S3["3. Accounts: 1× INTEREST_INCOME; per member MEMBER_EQUITY (+LOAN_RECEIVABLE); per vendor RECEIVABLE+PROFIT; TREASURY_CASH per historical cash-holder"]
  S3 --> S4["4. Replay each v1 txn (by date) → balanced v2 postings (§8), assigning the correct treasury"]
  S4 --> S5["5. joiningOffset → CATCHUP(LATE_JOIN); delayOffset → CATCHUP(DELAYED_PAYMENT)"]
  S5 --> S6["6. Rebuild Loans + tranches/repayments from v1 loan history; recompute interest via §14"]
  S6 --> S7{"7. RECONCILE every §17 figure (v2) == v1 reported?"}
  S7 -->|no| S8["fix mapping; re-run (idempotent)"] --> S4
  S7 -->|yes| S9["8. cut over; keep v1 read-only"]
```

- **Treasury assignment (resolved):** v1 **does** record a treasurer on every transaction (and
  maintains treasurer balances), so the importer maps each v1 transaction's recorded treasurer →
  the corresponding `TREASURY_CASH` account and assigns the cash leg there. No default/opening
  treasury needed; v2 per-treasurer balances should reconcile against v1's.
- Importer is **idempotent**. **Blocker:** need v1 repo/data export + fixture numbers (different
  repo, no access yet).

---

## 25. Testing strategy

| Layer | Tool | What |
|-------|------|------|
| Ledger invariants | Vitest | `Σ lines = 0`; `balance == Σ entries`; reversal restores exactly; double-reverse rejected |
| Every `TxnType` | Vitest | postings + balance deltas + loan/chit side-effects (treasury-aware) |
| **Loan interest** | Vitest | multi-tranche + partial repay + fixed per-loan rate + dayInterestFrom + anchored months/days (daily = monthlyRate ÷ incomplete-month days) vs hand-computed and v1 fixtures |
| Chit | Vitest | installments, early payout + remaining obligation, profit recognition |
| Business rules §17.1 | Vitest | pending-from-contributions, profit split, vendor/chit active/closed, asset-side value |
| Money / dates | Vitest | paise↔₹, no drift, IST boundaries, anchored months |
| Withdraw/rejoin | Vitest | settle→freeze→reactivate; equal-value catch-up |
| Reconciliation | script | v2 totals == v1 reported (migration gate) |
| E2E (later) | Playwright | login → deposit → loan tranche → repay → chit → dashboard updates |

v1 fixtures are the source of truth for "correct."

---

## 26. Build phases & checklists

### P0 — Foundation
- [ ] Next.js (App Router, TS strict), ESLint/Prettier, CI (typecheck + test).
- [ ] Prisma + Neon; apply schema (with `@@unique([memberId,kind])`).
- [ ] `lib/money` + `lib/date` (incl. `anchoredMonths`) + exhaustive tests.
- [ ] Better Auth + `requireRole`.
- [ ] **`ledger/postTransaction` + `reverseTransaction`** + exhaustive tests (invariants, every
      `TxnType`, treasury-aware), gated by v1 fixtures.
- [ ] **Interest engine** (§14.3) + tests (multi-tranche, partial, rate schedule, daily boundary).
- [ ] `seed.ts` (ClubConfig with stages/rateSchedule/limit; INTEREST_INCOME account).

### P1 — Core data + entry
- [ ] ClubConfig settings (stages, rate-change append, loan limit, overdue penalty, late-deposit
      penalty, dividend toggle).
- [ ] Member CRUD (role, treasurer flag); Vendor CRUD (GENERAL/CHIT + ChitFund).
- [ ] Loan open/tranche/repay/interest/close; chit payment/payout.
- [ ] Withdraw/settle + reactivate + catch-up flows.
- [ ] Intent helpers + entry drawer (treasury-aware, optimistic UI); transactions view.

### P2 — Reads & dashboards
- [ ] `getDashboard` (+ per-treasurer), `getMemberStatement`, `listMembers`, `listTreasurers`,
      `listLoans` (overdue), `listVendors`/`getChit`. Interest-on-read everywhere.
- [ ] Tag caching + `affectedTags` / config cascade wired in.

### P3 — Analytics & polish
- [ ] `getGraphSeries`; the 6 series; exports; empty/loading; mobile cards.

### P4 — Migration
- [ ] `migrate-from-v1.ts` (idempotent) incl. treasury assignment + reconciliation → green; cut over.

---

## 27. Performance budget

- **Writes O(lines)** (2–3 typical): header + entries + atomic `increment`s + maybe one loan/chit
  update + audit. No recompute, no replay. Edits = reverse + re-post = O(lines).
- **Dashboard** = a few indexed balance reads + a few `SUM`s + one interest pass over **active**
  loans. Indexed by `kind`, `type+occurredAt`, `occurredAt`, `loanId`, `vendorId`.
- **Analytics** = one/two grouped aggregates over indexed `occurredAt`/`type`.
- **No required background jobs**; optional rollup cache only if profiling needs it.
- One cache layer; tag invalidation touches only affected views.

The "very fast website" goal holds because v1's expensive move
(recompute-everything-per-write + multi-layer invalidation) **does not exist** here.

---

## 28. Open questions / TBDs

**Resolved (Rev 3):** daily denominator = `monthlyRate ÷ days in the incomplete trailing month`;
rate changes apply to **new loans only** (each loan keeps its opening rate); chit installments
**vary, ramping up to the margin** `chitValue/durationMonths`; migration assigns treasuries from
**v1's recorded treasurer per transaction**; pending **interest is profit**, pending **deposits are
not** (capital owed).

**Resolved (Rev 4 — owner answers to G1–G7):**
- **G1 Overdue penalty:** configurable `overduePenaltyBps`, **default 0**; when set it applies
  **instantly to all current + future loans** (current config, not a per-loan snapshot). Functionality
  implemented (§14.3 `overduePenalty`), no penalty by default.
- **G2 Dividend:** **no** periodic member dividend; profit accumulates to the club until a member
  leaves. `dividendEnabled` seam kept **off**.
- **G3 Withdrawal = full exit only:** no partial withdrawal, no profit-only withdrawal, no
  withdrawal without leaving (§16.3). *(Profit-share formula at exit is the one open item below.)*
- **G4 Vendor types:** **dropped `BANK`** — types are now **`GENERAL`** + `CHIT`; bank deposits/
  interest are a GENERAL vendor (realized on receipt).
- **G5 Borrower priority:** derived HIGH/LOW hint shown in the loan UI, **advisory**, admin's choice
  (§14.5).
- **G6 Catch-up:** auto-computed guide = cumulative expected deposit (start→today) + profit-per-
  member; **admin-editable** (§16.2).
- **G7 Late deposit:** `lateDepositPenaltyPaise` config, **default 0** (indicator only); UI shows a
  pending/overdue badge (§17.2).

Still open, non-blocking for P0 unless noted:

1. **★ Profit share at exit (`memberProfitShare`)** — equal flat `profitPerMember`, or **proportional
   to how fully the member paid** (`profitPerMember × paid/expected`)? The G3 example implies
   proportional; **needs explicit confirm** (§16.3). This is the one open item that changes a core
   number.
2. **Settlement cash vs paper value** — pay a leaver their share of *unrealized* loan interest in
   cash, or display-only with cash settled from realized funds? (§16.3; affects cash sufficiency).
3. **Pre-`dayInterestFrom` rounding** — partial month rounds up to a full month? (assumed; lock to
   v1 fixtures).
4. **`getMemberTotalDeposit` month semantics** — join-month inclusive? first-month proration? (lock
   to v1 fixtures).
5. **Chit early-payout profit timing** — realize profit at payout while carrying remaining obligation
   as a liability (recommended) — confirm.
6. **`REVERSAL.occurredAt`** — date reversals to the target's date (recommended) vs now.
7. **`SUPER_ADMIN` tier** — needed or not.
8. **v1 access** — repo/export + fixtures required for P4 reconciliation (currently no access).
