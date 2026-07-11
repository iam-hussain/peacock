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
- **First login forces a password change** before continuing.
- "Forgot password?" → submit a **reset request** to admins (admin is notified in-app).
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

**Purpose:** one **person's** full picture (banker model — see `PRODUCT.md` §2/§12).

**Shows:**
- **Identity header (person):** name, avatar, phone/email, role/treasurer, **"Customer since …"**.
- **Membership bar:** **"Membership #N · Active since …"** with a **switcher** (only if >1 stint).
- **Current membership body:** deposits paid, **pending deposits/overdue badge**, current loan +
  interest pending, **profit share (full and reduced-by-paid-ratio)**; a **Catch-up** section and a
  **Penalty** section each listing that membership's **charges cumulatively** (each: reason, amount,
  date, **paid vs remaining**) with total outstanding; this membership's **transaction history**.
- **Previous memberships (history)** — only if any: a list of **closed** stints ("Membership #1 ·
  Sep 2020 → Aug 2023 · settled ₹X · Closed"), each expandable to a **read-only** summary + its
  transactions, tagged **Legacy**. (Hidden entirely for members who never left.)

**Does:** open any of their transactions; **admin:** record an action for this member (deposit,
give loan, settle/leave, rejoin, **add catch-up charge**, **add penalty charge**, **pay catch-up /
pay penalty** down), edit profile, reset password. If eligible, show **loan eligibility/priority**
hint.

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
- **Entry drawer ("What happened?"):** plain-language intent grid (deposit, pay catch-up, pay
  penalty, give loan, repayment, collect interest, funds transfer, vendor invest/return, chit
  installment/payout, member leaves, member rejoins). **No "corrections" group.** Pick intent → step 2
  collects the fields (`FORMS_AND_FIELDS.md`), **always including which treasury** → save.
  - **Admin** save → posts directly (optimistic confirmation).
  - **Member** save (if allowed) → creates a **pending submission**; the drawer shows "goes to an
    admin for approval." It appears in admins' notifications with **Approve / Reject** and only posts
    on approval.
- **Edit / Delete** any entry on its row → the app reverses the original (and re-posts the corrected
  one on edit); **history kept**. This *is* the correction mechanism — no separate adjustment entry.

**Access:** view = all; **submit** = admins (direct) or members (pending, if the club allows);
**approve / edit / reverse** = admin.

---

## 10. Treasury — cash holders

**Purpose:** see who holds the club's cash and move it.

**Shows:** each treasurer and **how much they hold**; total available cash; recent transfers.

**Does:** **admin:** record a **funds transfer** between treasurers; mark/unmark a member as
treasurer.

**Access:** all (view); actions = admin.

---

## 11. Analytics

**Purpose:** trend **any club metric over time**, straight from the records (a metric explorer).

**Shows:**
- A **metric picker** — choose which figure to chart. Full catalogue:
  Active Members · Club Age · Member Deposits · Catch-up (Member Adjustments) · Member Pending ·
  Catch-up Pending (Adjustments Pending) · Total Loan Given · Total Interest Collected · Current
  Loan Taken · Interest Pending · Vendor Investment · Vendor Profit · Current Profit · Profit
  Withdrawals · Total Invested · Total Pending · Available Cash · Current Value · Total Portfolio
  Value. *(Optionally: Penalty Income, Profit per Member.)*
- A **time-range** control: **1M · 3M · 6M · 1Y · ALL** (spacing adapts: 1M daily, 3M/6M weekly,
  1Y/ALL monthly).
- The selected metric as a **line/area chart** with the current value + change over the range; a
  compact **latest-value strip** for context.

**Does:** switch metric + range; **export** (CSV / image). Historical edits reflect **instantly**
(every point is computed from the ledger, not a snapshot).

**Access:** all (view).

---

## 12. Settings (admin)

**Purpose:** configure the club and manage people.

**Shows / does — configuration:** club name & start date; deposit **stages**; **interest-rate
schedule** (add dated change for new loans); daily-interest-from date; loan limit; loan term;
cooldown; **overdue penalty** (default 0, auto); **auto penalties** — deposit + loan-interest, each a
toggle with **rate %**, **minimum**, (loan) **grace days**, and a shared **apply-from date** (default
off, see §13.1); **dividend** toggle (off); **who can submit entries** (admins only / all members);
**alert thresholds** (large amount, heavy pending deposit/interest); timezone. The Club tab shows an
**Auto penalties** summary (on/off, rate, minimum, effective-from) for each. *(Late/delayed payment
can also be a **manual** penalty **charge** on the member page. There is **no permissions matrix**.)*

**Shows / does — people:** add/edit members; **reset any member's password**; grant/revoke admin;
set/unset treasurer; deactivate/archive. *(Forgot-password requests arrive as **notifications**, not a
separate queue.)*

**Does — other:** **Audit log** (who did what, when — browsable); **Auto penalties** page (every
system-added deposit / loan-interest penalty with member, reference, amount, date; **Sync now**;
per-row **Dismiss** — see §13.1); **Close quarter** (locks the quarter + snapshot, with an "can't be
undone" warning). *(Backup/restore export too.)*

**Access:** **admin only.**

---

## 13. Profile (own)

**Purpose:** a member manages their own basics.

**Shows:** own details + statement summary.

**Does:** **change own password**; **change own avatar**; update own contact (within allowed limits).
Cannot grant themselves admin or edit club data.

**Access:** the logged-in member.

---

## 14. Notifications — the one inbox (events · alerts · approvals)

**Purpose:** a single in-app centre for everything that needs attention (see `PRODUCT.md` §18). **This
replaces a separate Approvals screen and the Permissions screen.**

**Shows:** a **bell with an unread count** (app shell) and a **list** carrying three kinds:
- **Events** — "recorded a ₹5,000 deposit", "loan disbursed", "vendor return", "member settled/
  rejoined", "password reset requested".
- **Alerts** (computed live) — "loan overdue (6 months)", "large amount", "heavy pending deposit/
  interest" — against the thresholds in Settings.
- **Approvals** — a **pending submitted entry** with **Approve / Reject** buttons inline (admins).

**Does:** open an item → jump to it / mark read; **Approve / Reject** a pending entry inline (on
approve it posts to the ledger); **Mark all read**. Members see their relevant events; admins also
see approvals + forgot-password requests + alerts.

**Access:** everyone (their own notifications; approvals shown to admins).

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
