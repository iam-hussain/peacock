# Peacock Investment Club — Design Review & Change Prompts

> Review of the current design prototype (`Peacock_App.dc.html`) against the locked product spec
> (`PRODUCT.md`, `FORMS_AND_FIELDS.md`, `SCREENS.md`). It lists **what to keep**, the **gaps**, and
> **copy-paste-ready prompts** the designer can act on, screen by screen.
>
> The prototype is a good foundation but was built on the **earlier 8-intent model**; several flows
> we finalised later are missing or modelled the old way. Items are tagged **[BLOCKER]** (core flow
> missing/wrong), **[FIX]** (mismatch to correct), or **[POLISH]**. A final section lists **product
> decisions that are yours, not the designer's** — the prototype invented features that contradict
> the spec.

---

## 0. What the design already gets right (keep these)

- **Login as a member-picker** ("Who's signing in? Tap your name" + password, "try your phone
  number", forgot-password → admin). ✔ matches spec.
- **Treasury model nailed:** "The club has no account of its own — these members hold its cash,"
  holder is **automatic** ("anyone listed on an entry as the holder"). ✔
- **Entry drawer shape:** plain-language "What happened?" → Step 2 with **member, amount, date, cash
  holder (treasury), note**. ✔ The *who-holds-the-cash* picker is exactly right.
- Dashboard headline cards + portfolio trend + recent activity; transactions table with
  filters/pagination; analytics; member detail richness (deposits, loan cycles, interest); theme
  light/dark; guide & terms; backup/restore. ✔ Keep all.

---

## 1. [BLOCKER] Missing whole flows / screens

### 1.1 Chit funds — entirely missing
Vendors are generic; "chit-fund" appears only in marketing copy. Chit is a **first-class** part of
the club (see `PRODUCT.md` §10).

> **Prompt:** Add a **vendor type** distinction — **General** (incl. bank) and **Chit**. For Chit
> vendors design: (a) a **chit setup** form (chit name, chit value e.g. ₹5,00,000, duration in
> months e.g. 20, **max monthly / margin auto-filled = value ÷ months = ₹25,000, editable**, start
> date); (b) a **chit detail screen** showing the **monthly installments paid (amounts rise over
> time toward the margin)**, the **payout** (amount + which month, once taken), the **remaining
> installments still owed (obligation)**, and **profit/loss = payout − total paid**; (c) two new
> entry intents: **Chit installment (OUT)** and **Chit payout (IN)**. General vendors keep the
> current invest/return design, plus an optional **category label** ("Bank", "Stocks").

### 1.2 Member leave (settle up) & rejoin — missing
A member can be set Inactive/Left, but there's no **settlement** or **rejoin** flow. These are core
(`PRODUCT.md` §12).

> **Prompt:** Design a **"Member leaves (settle up)"** flow: show a **computed settlement guide** =
> their capital (deposits + catch-up) **+ profit share − loan owed − unpaid interest**, with the
> **admin entering the final cash amount** (may differ slightly). On confirm: member is **paid in
> cash** (pick the treasury), profit resets to zero, account **freezes → Inactive**, history kept.
> Then a **"Member rejoins"** flow: member repays (one or two installments) **+ a catch-up** (guide
> auto-computed) to return to equal value; account reactivates.

### 1.3 Catch-up & delayed-payment penalty are modelled the OLD way
The prototype treats **late-join** and **delayed-payment** as editable "owed adjustment amounts" (a
"Member Adjustments" modal) and labels the member-card penalty figure as "Catch-up." Our model
changed: **catch-up** and **delayed-payment** are **two different things**, both recorded as
**entries**, not as editable owed fields.

> **Prompt:** Split these cleanly:
> - **Catch-up payment (IN)** — a join-time **equalisation** a new/returning member *pays* (guide =
>   missed deposits from club start + their share of profit; admin-editable). It's a contribution.
> - **Delayed-payment penalty (IN)** — a **manual penalty** the admin charges a chronically-late
>   member; the money is **club income shared as profit** (not the member's capital).
> Remove the "edit owed adjustment amounts" pattern as the primary mechanism; both become
> intents in the entry drawer. On the member card/detail, show **Catch-up paid** and **Penalty
> paid** as *separate* lines (don't reuse one "Catch-up" figure for the penalty).

### 1.4 Notifications — missing
There's an Approvals inbox but no general **in-app notification centre** (`PRODUCT.md` §18).

> **Prompt:** Add a **notification bell** (with unread count) in the top bar and a **notifications
> list**: short message, time, read/unread, link to the item. Members see their relevant events
> (new joiner, their deposit/loan/interest/settlement, password reset); admins also see
> forgot-password requests, new entries, and lifecycle events.

### 1.5 Loan multi-tranche disbursement — missing
Loans show one amount per cycle. In reality one loan can be **funded in parts by different
treasurers over a few days** (`PRODUCT.md` §8).

> **Prompt:** In **Give a loan**, allow the loan to be **disbursed in tranches** (each tranche: an
> amount + which treasurer paid it + date), all under **one loan with one start date**. On the
> **loan detail**, show the **tranche history** (each disbursement) alongside repayments and
> interest, and the live **interest-to-date**.

---

## 2. [FIX] Entry drawer — the "What happened?" intent list

Current intents (8): Member paid deposit · Give a loan · Record repayment · Collect interest ·
Withdrawal · Vendor investment · Vendor return · Funds transfer. This is the **old set** — it's
**incomplete and one label is wrong**.

> **Prompt:** Update the intent grid to the full set, grouped:
> - **Everyday:** Member paid deposit (IN) · **Catch-up payment (IN)** · **Delayed-payment penalty
>   (IN)** · Give a loan (OUT) · Record repayment (IN) · Collect interest (IN) · Funds transfer
>   (neutral)
> - **Vendors & chit:** Vendor investment (OUT) · Vendor return (IN) · **Chit installment (OUT)** ·
>   **Chit payout (IN)**
> - **Member lifecycle:** **Member leaves / settle up (OUT)** · **Member rejoins (IN)**
> - **Advanced (admin corrections):** Adjustment · Vendor write-off · Correction/Reversal
>
> **Rename** "Withdrawal — Member takes funds out" → **"Member leaves (settle up)"** (withdrawal is
> always a **full exit** — there is no partial/profit-only withdrawal). "Funds transfer — Move money
> between accounts" should read **between treasurers (cash holders)**.

---

## 3. [FIX] Field & data mismatches

### 3.1 Add-member form
The form makes **Username required ("used for login")** and **Phone & Joined date optional**. Per
spec this is reversed.

> **Prompt:** Login is by **picking the member from a list**, not by username — so:
> - **Phone:** **required and unique** (it's the **default password**). Not optional.
> - **Joined date:** **required** (it drives expected deposits & catch-up).
> - **Username:** **optional**; auto-generate from the name if blank; it is **not** the login
>   credential. Drop "used for login."
> - Keep first/last/email/avatar/status as-is. Add a hint that **first login forces a password
>   change**.

### 3.2 Loans list — add the Overdue state
Filters are All / Active / Inactive. Overdue is a real state (past 5 months, **still active**).

> **Prompt:** Loan filters → **All / Active / Overdue / Closed**. Give overdue loans a clear
> **badge** (e.g. amber "Overdue") on cards and in the member's loan history. Overdue is *derived*
> (active and older than the term), not a separate manual status.

### 3.3 Settings — incomplete configuration set
Settings shows monthly deposit, default loan interest, overdue-after. The full configurable set is
larger (`FORMS_AND_FIELDS.md` §4.2).

> **Prompt:** Design the **Club config** section to edit: **deposit stages** (amount + date range,
> multiple over time — e.g. ₹1,000 then ₹2,000), **loan interest-rate schedule** (current rate +
> ability to add a **dated change that applies to new loans only**), **daily-interest-from date**,
> **loan limit (₹5,00,000)**, **loan term (5 months)**, **loan cooldown (1 month)**, **overdue
> penalty (default 0)**, **dividend toggle (off)**, **timezone**. Show interest as the **live config
> value**, not a hard "2%/month" (see 3.4).

### 3.4 Interest rate shown as a fixed "2% / month"
Default in spec is **1%/month** (historically), **configurable**, and **changes apply to new loans
only** (existing loans keep their original rate).

> **Prompt:** Treat the rate as the **current config value** (don't bake "2%"). On loan
> cards/detail show **that loan's own rate** (fixed at origination), which may differ from the
> current club rate.

---

## 4. [FIX] Dashboard & member figures

### 4.1 Add "Profit per member" to the dashboard
Headline cards are Portfolio value · Cash · Outstanding loans · Pending deposits. **Profit per
member** (the club's signature metric) is missing.

> **Prompt:** Add a **Profit per member** headline figure on the dashboard. Optionally keep a
> per-treasurer cash breakdown visible (it's a unique feature of this club).

### 4.2 Show the member's profit share as **full vs actual**
Profit is shared **proportionally to how fully a member paid** their deposits.

> **Prompt:** On member detail, show **two** profit numbers: the **full** share (if fully paid) and
> the **actual** share (reduced by their paid ratio), so the shortfall from underpaying is visible.

---

## 5. [POLISH] Smaller items

- **Currency:** keep the Indian grouping (₹48,20,000) and the lakh shorthand (₹48.2L) consistently;
  every money value should come from theme-formatted output (no hard-coded strings).
- **Empty / loading / error states** for every list (members, loans, vendors, transactions,
  notifications) — the prototype has a couple ("No loans yet", "All caught up"); make them universal.
- **Overdue / pending indicators** for deposits on member cards (red badge) even though the penalty
  is manual.
- Ensure **theme-token-only** styling (no hard-coded hex) so light/dark and any rebrand work from
  tokens — this is a build requirement (`CLAUDE.md`).

---

## 6. ⚠ Product decisions for YOU (not the designer) — the prototype invented these

The designer added features that **contradict or extend** the locked spec. Decide whether to adopt
(I'll update the spec) or drop (designer removes them):

1. **Approval workflow.** The prototype says *"This entry goes to an admin for approval before it's
   posted,"* with an **Approvals** inbox and a **Permissions** screen (*"who can post entries:
   Treasurer / All members"*). Our spec is **admin-only writes; members are read-only; no approval
   step.** → **Decide:** do you want members/treasurers to *submit* entries that an admin approves?
   If yes, it's a real new capability (and a permissions model) we should spec. If no, remove
   Approvals + Permissions + the "needs approval" note.
2. **Close financial year / reinvest profit.** The prototype has a **"Close financial year"** action
   that **locks the year and "reinvests net profit into the club."** Our spec keeps profit
   **accumulating** (no dividend) and the **period-lock as an off-by-default seam.** A year-close
   that locks + rolls profit forward is *compatible* with "accumulate," but it's not in scope yet.
   → **Decide:** include year-close now, or later?
3. **Granular permissions** (post entries / approve loans / manage vendors / export). → tied to (1);
   only needed if you adopt the approval/permissions model. Otherwise roles stay **Admin / Member**.

---

## 7. Quick checklist for the designer

- [ ] Chit fund: type, setup, detail (installments/payout/obligation/profit), 2 intents (1.1)
- [ ] Member leave (settle-up guide → cash → freeze) + rejoin (repay + catch-up) flows (1.2)
- [ ] Catch-up vs delayed-payment penalty as **two separate entries**, not "owed adjustments" (1.3)
- [ ] Notification bell + centre (1.4)
- [ ] Loan tranches in Give-a-loan + loan detail (1.5)
- [ ] Entry drawer: full grouped intent set; rename Withdrawal → "Member leaves (settle up)" (2)
- [ ] Add-member: phone required+unique, joined required, username optional/not-login (3.1)
- [ ] Loans: Overdue filter + badge (3.2)
- [ ] Settings: full club config (stages, rate schedule, limit, term, cooldown, penalty, dividend) (3.3, 3.4)
- [ ] Dashboard: Profit per member (4.1); member: full vs actual profit share (4.2)
- [ ] Universal empty/loading/error + theme-token-only styling (5)
- [ ] **Owner to decide:** approvals/permissions (6.1), year-close (6.2)

*Cross-references: `PRODUCT.md` (behavior), `FORMS_AND_FIELDS.md` (fields), `SCREENS.md` (per-screen
expectations).*
