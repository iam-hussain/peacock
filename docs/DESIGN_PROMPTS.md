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

### 1.2 Member leave & rejoin — the **bank model** (membership/account epochs)
A member can be set Inactive/Left, but there's no **settlement**, **rejoin**, or **membership
history**. This must follow the bank model (`PRODUCT.md` §2/§12): **the person is one stable customer
(one login), but each stint is a separate "membership/account" that closes on leave and a new one
opens on rejoin** — so old deposits/profit/catch-ups/penalties never mix into the new stint.

> **Prompt — member detail page (banker layout):**
> - **Identity header (person):** avatar, name, phone, role/treasurer, **"Customer since <first
>   join>"** — constant across stints.
> - **Membership bar:** **"Membership #N · Active since <date>"** with a **switcher** shown *only* if
>   there's more than one stint. (For the common single-stint member, the page looks like today.)
> - **Body = the active membership** — all current figures scoped to this stint.
> - **"Previous memberships" card** (only if any closed stints): list **"Membership #1 · Sep 2020 →
>   Aug 2023 · settled ₹X · Closed"**, each expandable to a **read-only** summary + transactions,
>   tagged **Legacy**.
>
> **Prompt — leave flow ("Member leaves / settle up"):** show a **computed settlement guide** = capital
> (deposits + catch-up) **+ profit share − loan owed − unpaid interest**; **admin enters final cash**
> (pick the treasury). On confirm: member **paid in cash**, profit → 0, the **current membership
> closes** (Closed, with leave date + settled amount); history kept.
>
> **Prompt — rejoin flow ("Member rejoins"):** opens a **new membership (#N+1)**. Show **back deposits
> + an auto-added, editable catch-up = total to rejoin** (your Rejoin modal already nails this). On
> confirm the new membership is Active with the catch-up charge; the old one moves to history.

### 1.3 Catch-up & penalty — model them as *charges (dues) paid down over time*
**Update (now confirmed):** catch-up and penalty are **charges the member owes**, raised **multiple
times over time**, each with a **reason**, and **paid down in any number of instalments**. The
designer's newer modals — **Add catch-up charge**, **Add penalty charge**, **Record catch-up/penalty
payment**, and the **Rejoin** modal — are **on the right track**. The thing to fix is the *old*
single "Member Adjustments / owed amount" pattern and the member-card label that reuses one
"Catch-up" figure for the penalty.

> **Prompt:** Build the charge model end-to-end (see `PRODUCT.md` §7/§13, `FORMS_AND_FIELDS.md` §3.1):
> - **Add catch-up charge** & **Add penalty charge** (member page): amount **auto-suggested +
>   editable** (catch-up = profit gap; penalty = from pending dues), a **reason** chip set
>   (catch-up: First-time join · Rejoin · Profit-gap top-up · Mid-term equalisation · Other; penalty:
>   Delayed payment · Loan repayment delay · Holding club money too long · Missed deposit · Other),
>   and a date. These **raise a due**, they don't move cash.
> - **Record catch-up/penalty payment** (pay-down): **remaining balance** shown, **pay amount ≤
>   remaining** with **Full / ½ / ⅓** presets, **received-by treasurer**; allow many instalments.
> - **Member page:** show **cumulative** catch-ups and penalties — each charge (reason, amount, date)
>   with **paid vs remaining** — and keep **catch-up** and **penalty** as *separate* sections (don't
>   reuse one figure). Catch-up builds the member's own value; penalty is club income.
> - **Rejoin** auto-adds a catch-up charge (editable) and shows **back deposits + catch-up = total to
>   rejoin** (your Rejoin modal already does this — keep it).
> - In the entry drawer, the cash intents are **Pay catch-up (IN)** and **Pay penalty (IN)** (not a
>   one-shot "catch-up payment"); *raising* a charge lives on the member page, not the drawer.

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
> - **Everyday:** Member paid deposit (IN) · **Pay catch-up (IN)** · **Pay penalty (IN)** · Give a
>   loan (OUT) · Record repayment (IN) · Collect interest (IN) · Funds transfer (neutral)
> - **Vendors & chit:** Vendor investment (OUT) · Vendor return (IN) · **Chit installment (OUT)** ·
>   **Chit payout (IN)**
> - **Member lifecycle:** **Member leaves / settle up (OUT)** · **Member rejoins (IN)**
> - **No "corrections" group.** Fixing a specific entry = **Edit/Delete** on its ledger row (the app
>   reverses it internally). **Vendor write-off** is reached from the vendor's close flow. There is
>   **no Adjustment** and no manual "correction" card.
>
> *Pay catch-up / Pay penalty* pay down a member's **dues**; **raising** a catch-up/penalty charge is
> a **member-page** action, not a drawer intent (see 1.3).
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

## 6. Governance features — decisions made (now in the spec)

The prototype's admin/governance screens are **resolved**:

1. **Approval workflow — ADOPTED.** Members **submit** entries; an admin **approves/rejects**; only
   approved entries post. An admin's own entry posts directly.
   > **Prompt:** in the entry drawer, a **member's** save creates a **pending** entry ("goes to an
   > admin for approval"); an **admin's** save posts directly. See approvals in notifications below.
2. **Approvals → merged into Notifications.** **Remove the standalone Approvals screen.** Pending
   entries appear as **actionable notification items** (Approve / Reject inline).
   > **Prompt:** the notification list carries three kinds — **events**, **alerts** (overdue, large
   > amount, heavy pending — computed live vs thresholds), and **approvals** (Approve/Reject inline).
   > Keep the bell + unread count + "Mark all read".
3. **Permissions matrix — REMOVED.** Drop the per-capability Permissions screen entirely.
   > **Prompt:** replace it with a **single Settings toggle**: *"Who can submit entries — Admins only
   > / All members."* Everything else is admin-only.
4. **Close financial year → "Close quarter".** Not annual — **quarterly**. It **locks the quarter +
   snapshots** figures (no money moves; profit keeps accumulating). Keep the "can't be undone" warning.
   > **Prompt:** rename/rework the modal to **Close quarter** (the club's financial quarter), showing
   > the period, members, and the snapshot; it's housekeeping (lock + snapshot), not a payout.
5. **Audit log — keep as-is** (who/what/when). It's already in the spec.

---

## 7. Quick checklist for the designer

- [ ] Chit fund: type, setup, detail (installments/payout/obligation/profit), 2 intents (1.1)
- [ ] Bank model: member page = person (identity + membership bar + current stint + **previous memberships** history); leave closes the membership, rejoin opens a new one (1.2)
- [ ] Catch-up & penalty as **charges (dues)**: raise (member page, reason + suggested/editable) + pay-down (remaining/amount/treasurer) + cumulative display; catch-up→value, penalty→income (1.3)
- [ ] Notification bell + centre carrying **events · alerts · approvals** (approve/reject inline) (1.4, 6.2)
- [ ] Approval flow: member save → pending; admin approves/rejects (6.1). **Remove Approvals screen.**
- [ ] **Remove Permissions screen** → single "who can submit entries" toggle in Settings (6.3)
- [ ] **Close financial year → Close quarter** (lock + snapshot, quarterly) (6.4)
- [ ] Loan tranches in Give-a-loan + loan detail (1.5)
- [ ] Entry drawer: full grouped intent set; rename Withdrawal → "Member leaves (settle up)" (2)
- [ ] Add-member: phone required+unique, joined required, username optional/not-login (3.1)
- [ ] Loans: Overdue filter + badge (3.2)
- [ ] Settings: full club config (stages, rate schedule, limit, term, cooldown, penalty, dividend) (3.3, 3.4)
- [ ] Dashboard: Profit per member (4.1); member: full vs actual profit share (4.2)
- [ ] Universal empty/loading/error + theme-token-only styling (5)

*Cross-references: `PRODUCT.md` (behavior), `FORMS_AND_FIELDS.md` (fields), `SCREENS.md` (per-screen
expectations).*
