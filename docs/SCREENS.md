# Peacock Investment Club — Screens & Minimum Expectations

> What each screen must **show** and **do**, functionally — a checklist for designers and builders.
> This describes *minimums*, not visual design (the full visual design comes separately). Behavior
> rules live in `PRODUCT.md`; field details in `FORMS_AND_FIELDS.md`. When in doubt, `PRODUCT.md`
> wins.
>
> **Applies to every screen:** clear **loading** (skeletons), **empty**, and **error** states;
> mobile-first responsive; money shown in ₹ with proper Indian formatting; admins can act, members
> view only; fast first paint (see engineering standards in `CLAUDE.md`).

---

## 1. Login

**Purpose:** let an existing member sign in (no sign-up).

**Shows:** the club name + slogan; a **searchable list of members** (name + avatar); a password
field once a member is picked; a "forgot password?" action.

**Does:**
- Pick a member → enter password → sign in. (Default password = phone number.)
- "Forgot password?" → submit a **reset request** to admins.
- Clear error on wrong password; throttle on repeated failures (basic).

**Access:** everyone (pre-auth).

---

## 2. Dashboard

**Purpose:** the club's health at a glance, with a deep-dive option. Two views: **Summary** and
**Club Passbook** (toggle), plus a **Screenshot/Share** action.

### Summary view shows
- **5 headline cards:** Total portfolio value (+% this month) · Available cash · Outstanding loans
  (+ overdue flag) · Pending deposits · **Profit per member**.
- **Portfolio trend** chart with **3M / 1Y / All** ranges.
- **Recent activity** feed (latest entries; green in / red out) with "View all".

### Club Passbook view shows
- Grouped detail with a "what it means" tooltip on each figure: club snapshot, member funds &
  pending (incl. catch-up), loans lifetime & active (+ overdue count), vendors (+ chit
  obligations), profit summary, cash-flow (30-day in/out/net), valuation incl. **per-treasurer cash
  breakdown**.

**Does:** switch views; change chart range; open any activity item; share/screenshot; admins get a
quick **"+ Record" entry** shortcut.

**Access:** all (view). Numbers are live.

---

## 3. Members — list

**Purpose:** see everyone and their standing.

**Shows:** searchable/sortable list — name + avatar, status (active/inactive/left), role/treasurer
badges, total paid vs expected, **pending** (highlighted if behind), current loan (if any).

**Does:** search/filter (status, has-loan, behind-on-deposits); open a member; **admin:** add member,
edit, reset password, make admin, mark treasurer.

**Access:** all (view); add/edit = admin.

---

## 4. Member — detail / statement

**Purpose:** one member's full picture.

**Shows:** profile (name, avatar, phone/email, joined date, role/treasurer, status); their numbers —
deposits paid, catch-up, **pending deposits/overdue badge**, current loan + interest pending,
**profit share (full and reduced-by-paid-ratio)**; their **transaction history**.

**Does:** open any of their transactions; **admin:** record an action for this member (deposit,
loan, settle/leave, rejoin, catch-up), edit profile, reset password. If eligible, show **loan
eligibility/priority** hint.

**Access:** all (view); a member sees their own statement; actions = admin.

---

## 5. Loans — list

**Purpose:** all loans at a glance.

**Shows:** borrower, original/approved amount, **outstanding**, **interest to-date & pending**,
start date, status (active/closed), **overdue badge** (past 5 months). Filters: active / overdue /
closed.

**Does:** open a loan; **admin:** record repayment / collect interest / give next tranche.

**Access:** all (view); actions = admin.

---

## 6. Loan — detail

**Purpose:** everything about one loan.

**Shows:** borrower; approved amount; **tranche history** (each disbursement, date, treasurer);
**repayments & interest payments**; **live interest-to-date** and pending; outstanding; overdue
status; the timeline of how interest accrued (per balance segment).

**Does:** **admin:** add tranche, record repayment, collect interest, reverse/edit an entry.

**Access:** all (view); actions = admin.

---

## 7. Vendors — list (general + chit)

**Purpose:** all outside investments.

**Shows:** name + category/label, type (general/chit), amount currently placed, profit so far; for
chits also **months paid / remaining** and **obligation outstanding**; status.

**Does:** filter by type; open a vendor; **admin:** add general vendor, add chit, record
invest/return or chit installment/payout.

**Access:** all (view); actions = admin.

---

## 8. Vendor / Chit — detail

**Purpose:** one vendor's full record.

**Shows (general):** placements, returns, **profit**, ROI, notes; transaction history.
**Shows (chit):** chit value, duration, margin, **installments paid (with the rising amounts)**,
payout (amount/month if taken), **remaining obligation**, profit/loss; transaction history.

**Does:** **admin:** record investment/return (general) or installment/payout/write-off (chit),
edit/reverse entries, close vendor.

**Access:** all (view); actions = admin.

---

## 9. Transactions — ledger + entry drawer

**Purpose:** the full, searchable record + the place to add new entries.

**Shows:** paginated list — date, type (with IN/OUT/neutral tag), who/what, amount (green/red),
treasurer involved, note; filters by type, member/vendor, treasurer, date range; corrections shown
linked to their original.

**Does:**
- **Entry drawer ("What happened?"):** plain-language intent grid (deposit, give loan, repayment,
  collect interest, catch-up, funds transfer, vendor invest/return, chit installment/payout, member
  leaves, member rejoins; corrections under "advanced"). Pick intent → step 2 collects the fields
  (`FORMS_AND_FIELDS.md`), **always including which treasury** → save. Optimistic confirmation.
- Edit / reverse any entry (as a correction, history kept).

**Access:** all (view); add/edit/reverse = admin.

---

## 10. Treasury — cash holders

**Purpose:** see who holds the club's cash and move it.

**Shows:** each treasurer and **how much they hold**; total available cash; recent transfers.

**Does:** **admin:** record a **funds transfer** between treasurers; mark/unmark a member as
treasurer.

**Access:** all (view); actions = admin.

---

## 11. Analytics

**Purpose:** trends over time, straight from the records.

**Shows:** portfolio value, available cash, outstanding loans (as-of each month); deposits/month;
interest/month; **member-vs-club-average**. Range selectors; export.

**Does:** switch series/range; export CSV/image. Historical edits reflect instantly.

**Access:** all (view).

---

## 12. Settings (admin)

**Purpose:** configure the club and manage people.

**Shows / does — configuration:** club name & start date; deposit **stages**; **interest-rate
schedule** (add dated change for new loans); daily-interest-from date; loan limit; loan term;
cooldown; **overdue penalty** (default 0); **late-deposit penalty** (default 0); **dividend** toggle
(off); timezone.

**Shows / does — people:** add/edit members; **reset any member's password**; view & action
**forgot-password requests**; grant/revoke admin; set/unset treasurer; deactivate/archive.

**Does — other:** lock/unlock a period (seam, off by default).

**Access:** **admin only.**

---

## 13. Profile (own)

**Purpose:** a member manages their own basics.

**Shows:** own details + statement summary.

**Does:** **change own password**; update avatar/contact (within allowed limits). Cannot grant
themselves admin or edit club data.

**Access:** the logged-in member.

---

## Cross-screen functional expectations

- **Overdue / pending indicators** everywhere they apply (loans past term, deposits behind) — clear
  badges even though penalties are 0 today.
- **Both profit values** (full vs reduced-by-paid-ratio) wherever a member's profit share is shown.
- **Always pick a treasurer** for any cash movement.
- **Corrections, not deletes** — editing/removing creates a reversal; history is never lost.
- **Live numbers** — after any entry, affected screens refresh (no stale data).
- **Member = read-only**, admin = full edit, everywhere.

---

*Behavior rules: `PRODUCT.md`. Field details: `FORMS_AND_FIELDS.md`. Technical: `IMPLEMENTATION_PLAN.md`.*
