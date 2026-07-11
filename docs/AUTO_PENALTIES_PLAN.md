# Automatic Penalties — Plan (IMPLEMENTED)

**Status:** ✅ **Built** (Jul 2026). Confirmed direction with the owner and shipped with two tweaks
to the original plan: (1) a single **global effective-from date** (default **1 Sep 2026**) so it is
**not retroactive** — each penalty still has its **own on/off toggle**; (2) auto penalties are
**materialised** as real `Charge(PENALTY, auto)` rows **when an entry is recorded** (deduped by a
deterministic id — never charged twice), with an admin **Auto penalties** page (register + Sync now +
Dismiss) rather than being purely derived-on-read. The live behaviour is documented in **PRODUCT.md
§13.1** and **IMPLEMENTATION_PLAN.md §16.2.1**; this file is retained as the design record.

---

## 1. What we're adding

Two **automatic** penalties, both fully configurable by the admin and **off by default**:

| Penalty | Trigger | Charge |
|---|---|---|
| **Deposit penalty** | On the **1st of every month (IST)**, a member's total pending deposits is **more than ₹6,000** | **2% of the full pending amount**, for that month |
| **Loan-interest penalty** | A loan is **fully repaid (closed)** but interest is still unpaid; **30 days** of grace have passed; pending interest is **more than ₹1,000** | **2% of the pending interest**, every **30 days** from the close date (Option A) |

Both are **simple** (non-compounding): the 2% is always on the pending *base* (deposits or
interest), never on previously accrued penalty.

### Admin knobs (Settings → Club → Edit)

| Knob | Deposit penalty | Loan-interest penalty |
|---|---|---|
| On / off | ✅ (default **off**) | ✅ (default **off**) |
| Monthly rate | ✅ (default **2%**) | ✅ (default **2%**) |
| Minimum trigger | ✅ (default **₹6,000** pending deposits) | ✅ (default **₹1,000** pending interest) |
| Grace | — | ✅ (default **30 days** from loan close) |

---

## 2. Exact rules

### 2.1 Deposit penalty — month-start evaluation

- On the **1st of each month (IST)**: `pending = expected deposits so far − periodic deposits paid`
  (the same "Deposit pending" figure already shown on the members page; catch-up and penalty
  buckets are **not** part of it).
- If `pending > ₹6,000` → that month adds `2% × pending` to the member's penalty due.
- Crossing the threshold mid-month costs nothing until the next 1st. Whole months only — no daily
  proration.
- Active members only; a member's months are counted **from their current stint's join date**
  (a rejoiner is never penalised for months before they rejoined).

> **Open question (default chosen, flag if wrong):** on the 1st, the just-started month's deposit
> already counts as pending (that is how "expected" works everywhere in the app today). So a member
> who is one month behind can tip past ₹6,000 the moment a new month starts. If you want the
> current month excluded until it is actually late, say so — it's a one-line change to the rule.

### 2.2 Loan-interest penalty — 30-day clock from loan close (Option A)

- A loan **closes** on day **X** (principal fully repaid). Unpaid interest may remain.
- **Grace:** nothing happens until **X + 30 days**.
- At **X + 30d, X + 60d, X + 90d, …**: if pending interest at that instant is **more than ₹1,000**
  → add `2% × pending interest` to the member's penalty due.
- `pending interest = total interest accrued on their loans − interest payments made so far`, so
  every interest payment immediately shrinks the next tick's charge (and stops it entirely once
  pending ≤ ₹1,000).
- If the member takes a **new loan**, the ticks pause (their interest is part of a live loan
  again); the clock re-anchors to the new loan's close date when that one closes.

### 2.3 Worked examples (for verification)

**Deposit:** expected ₹2,000/mo, member paid nothing since March.
- 1 Jun: pending ₹8,000 (> 6k) → +₹160. 1 Jul: pending ₹10,000 → +₹200. Accrued penalty ₹360.
- Member pays ₹6,000 on 10 Jul → 1 Aug pending is ₹6,000 (not > 6k) → no new charge.

**Loan interest:** loan closed 1 May with ₹5,000 interest unpaid.
- 31 May (X+30d): pending ₹5,000 → +₹100. 30 Jun (X+60d): still ₹5,000 → +₹100.
- Member pays ₹4,200 interest on 5 Jul → 30 Jul (X+90d): pending ₹800 (≤ ₹1,000) → no charge.

---

## 3. How it runs — derived on read, **no daily job**

Decided in discussion: **no cron / scheduled job.** Like loan interest today, the accrued penalty
is a **formula recomputed from history** every time a page loads: walk the month-starts (deposit)
or 30-day ticks (loan), sum the charges. Why this beats a daily writer:

1. **Duplicates are impossible by construction.** Nothing is written, so a retry / overlapping
   run / manual trigger can never double-charge. A daily job would need idempotency keys and
   cleanup logic — real code, real bugs, and every bug is money on a member's page.
2. **Backdated and edited entries self-correct.** This club backdates deposits and reverses
   entries routinely. Written penalty rows would go stale the moment history changes under them;
   a formula just recomputes.
3. **Nothing to miss.** A cron that silently fails for 3 days leaves gaps; a formula can't.
4. **Clean on/off.** Toggle off → penalties disappear from every page; on → recomputed. No stored
   rows to clean up. The daily freshness you wanted already exists: the stats cache recomputes
   once a day (IST), so figures roll over daily on their own.

**Consequence — retroactivity:** because it is recomputed from history, switching a penalty **on
applies to the past too** (same convention as the existing overdue-loan penalty: "applies
immediately to all loans"). Enabling the deposit penalty for a member who has been ₹10k behind for
a year will show ~12 months of accrued penalty at once. The thresholds and the off-switch are the
control. If instead you want "count only from the day I enabled it", that needs one extra
*effective-from* date per penalty — say so before build.

### Collection — reuses the existing penalty flow

The derived amount joins the member's **penalty due**, alongside manual penalty charges. The
admin collects through the existing **"Pay penalty"** entry; payments are normal audited ledger
transactions that net against the combined penalty pool. No new transaction types, no new screens.

---

## 4. Build checklist (after approval)

| # | Layer | Change |
|---|---|---|
| 1 | **Schema** | One optional `penaltyConfig` JSON field on `ClubConfig` — `{ deposit: {enabled, rateBps, minPaise}, interest: {enabled, rateBps, graceDays, minPaise} }`. Defaults in code; `db push` only, no data migration. |
| 2 | **Engine** | New `src/server/queries/penalties.ts`: pure tick-walk functions (unit-checkable with the §2.3 examples) + one batched `autoPenalties()` → per-membership `{deposit, interest}` accrued, integer paise. |
| 3 | **Reads** | Fold the derived amounts into penalty due at: members list (Pending / Adjustment columns), member detail (penalty card gains "Auto penalty" lines; overall pending), dashboard (Pending-dues KPI + Penalties group), entries member-financials (Pay-penalty prefill). |
| 4 | **Settings UI** | Club tab shows both penalty rules; Edit-club modal gains the two knob sections (toggle, rate %, min ₹, grace days); `saveClubSettings` extended (admin-only, validated). |
| 5 | **Docs** | Sync PRODUCT.md §13, ABOUT.md, FORMS_AND_FIELDS.md, SCREENS.md, IMPLEMENTATION_PLAN.md. |
| 6 | **Verify** | Run the §2.3 examples against the engine; then exercise the app end-to-end (enable knobs on a test config, check member page / dashboard figures). |

### Explicitly out of scope

- Settlement/exit math unchanged (penalty due already shows in pending, like manual charges).
- The existing **overdue-loan penalty** (extra rate on loans past the 5-month term) is untouched —
  this plan adds a *different* penalty for interest left unpaid **after** a loan closes.
- No stored per-month penalty rows / audit lines (accrual is shown live, payments are the audit
  trail). Revisit only if a frozen monthly statement is ever required.

---

## 5. Open decisions before build

1. **Current month on the 1st** — counts toward the ₹6k pending (default, matches the app today) or excluded until late?
2. **Retroactive on enable** (default, matches club convention) or accrue only from an effective-from date?
