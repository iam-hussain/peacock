# Peacock Investment Club — Forms, Fields & Admin Settings

> The field-level reference: **what information the app collects** for members, vendors, chits, and
> every transaction, plus **what an admin can configure**. Companion to `PRODUCT.md` (behavior) and
> `IMPLEMENTATION_PLAN.md` (technical). When this and `PRODUCT.md` differ about behavior,
> `PRODUCT.md` wins.
>
> Legend: **R** = required, **O** = optional, **A** = auto (system-set / computed).

---

## 1. Accounts & login (no self-registration)

There is **no public sign-up**. The club's members already exist; people only **log in**.

- **Login:** the screen shows a **list of existing members** (name + avatar). You **pick yourself**
  and **enter your password**. (No typing a username.)
- **Default password = the member's phone number.** Set when the member is created; the member can
  change it after first login.
- **Forgot password:** the member **requests a reset**; an **admin resets it** (back to the phone
  number by default). There is no self-serve email reset flow.
- **Who can log in:** admins always; members optionally (read-only access). Vendors never log in.

### Member fields (the user record)

| Field | R/O/A | Notes |
|-------|:-----:|-------|
| Full name (first, last) | R | Last name optional; shown in lists. |
| Phone number | R | Identity + **default password**; primary contact. |
| Email | O | Optional contact; not required for login. |
| Username | O→A | Optional handle; **auto-generated from the name if left blank** (unique). Not used to log in. |
| Avatar | O | Photo; falls back to initials. |
| Joined date (club) | R | When they joined the club — drives expected deposits & catch-up. |
| Role | A/admin-set | `MEMBER` by default; an admin can grant `ADMIN`. |
| Treasurer | A/admin-set | Flag; a member becomes a treasurer when they hold club cash. |
| Status | A | `ACTIVE` / `INACTIVE` (frozen) / `LEFT` — system-managed via lifecycle. |
| Password | A | Managed by auth; default = phone number; admin-resettable. |

---

## 2. Vendors & chits

A vendor is `GENERAL` (incl. bank) or `CHIT`. Cash movements with vendors are recorded as
**transactions** (§3); the records below are the **setup** of the vendor itself.

### 2.1 General vendor

| Field | R/O/A | Notes |
|-------|:-----:|-------|
| Vendor name | R | E.g. "HDFC Bank", "Surya Traders". |
| Type | R | `GENERAL` (selected). |
| Category / label | O | Free label for grouping in reports — e.g. "Bank", "Stocks". Display only. |
| Notes / description | O | Free text (e.g. "Treasurer's bank FD"). |
| Started date | R | When the relationship began. |
| Status | A/admin-set | `ACTIVE` / `INACTIVE` / `CLOSED`. |

### 2.2 Chit fund

| Field | R/O/A | Notes |
|-------|:-----:|-------|
| Chit name | R | E.g. "Margadarsi 5L-20". |
| Type | R | `CHIT` (selected). |
| Chit value (face value) | R | E.g. ₹5,00,000 / ₹3,00,000 / ₹2,00,000. |
| Duration (months/terms) | R | E.g. 20. |
| Max monthly payable (margin) | A→O | **Auto-calculated = chit value ÷ duration** (e.g. ₹25,000 for ₹5L/20mo) and shown; **admin can override** if a specific chit differs. Installments rise toward this cap, never beyond. |
| Started date | R | First installment month. |
| Notes / description | O | Free text. |
| Status | A | `RUNNING` / `PAID_OUT` / `COMPLETED`. |

> **Decision (margin auto vs manual):** the app **auto-computes** the margin from value ÷ duration
> as the default so the admin doesn't have to, but leaves it **editable** for real-world variance.
> Payout details (amount, month) are captured later at the **Chit payout** transaction, not at
> setup.

---

## 3. Transactions — fields collected per type

Every cash transaction collects three things in common, plus type-specific fields:

- **Date** (when it happened) — R
- **Treasury** (which treasurer's cash is involved) — R for any cash movement
- **Note / reference** — O (cheque/UPI ref or remark)

Below, only the **type-specific** fields are listed (the three common ones apply to all unless
noted). Direction: **IN** = club gains cash, **OUT** = club pays cash, **neutral** = cash moves.

### Everyday

| Transaction | Dir | Fields collected |
|-------------|:---:|------------------|
| **Member paid deposit** | IN | Member (R); Amount (R); Treasury **receiving** (R); *(optional: which month)*. |
| **Catch-up payment** | IN | Member (R); Subtype: late-join / delayed-payment (R); Amount (R, **guide auto-computed**, editable); Treasury receiving (R). |
| **Give a loan** | OUT | Member (R); Amount of this disbursement (R); Treasury **paying out** (R); Approved/requested amount (O — see auto-create below). **A loan record is created/linked automatically in the background.** |
| **Record repayment** | IN | Loan/member (R); Principal amount (R); Interest amount in same entry (O); Treasury receiving (R). Closes the loan automatically when principal hits zero. |
| **Collect interest** | IN | Loan/member (R); Amount (R, **pending interest shown as guide**); Treasury receiving (R). |
| **Funds transfer** | neutral | From-treasury (R); To-treasury (R); Amount (R). No member/vendor. |

### Vendors & chits

| Transaction | Dir | Fields collected |
|-------------|:---:|------------------|
| **Vendor investment** | OUT | Vendor (general) (R); Amount (R); Treasury paying (R). |
| **Vendor return** | IN | Vendor (R); Total amount received (R); Principal portion (R — remainder is booked as profit); Treasury receiving (R). |
| **Chit installment** | OUT | Chit (R); Amount (R, **defaults to expected ≤ margin**, editable); Treasury paying (R). |
| **Chit payout** | IN | Chit (R); Payout amount (R); Principal portion (R — remainder is profit); Month index (O); Treasury receiving (R). Remaining installments stay as an obligation. |

### Member lifecycle

| Transaction | Dir | Fields collected |
|-------------|:---:|------------------|
| **Member leaves (settle up)** | OUT | Member (R); Settlement amount (R, **guide auto-computed**: capital + profit share − loan − unpaid interest; admin enters final); Treasury paying (R). Freezes the member afterward. |
| **Member rejoins** | IN | Member (R); Repayment amount(s) — one or two installments (R); Catch-up amount (R, **guide auto-computed**); Treasury receiving (R). Reactivates the member. |

### Admin corrections (kept in an "advanced" area)

| Transaction | Dir | Fields collected |
|-------------|:---:|------------------|
| **Adjustment** | IN/OUT | Member (R); Signed amount (R); Treasury (R); Reason (R). Rare. |
| **Vendor write-off** | neutral | Vendor (R); Residual amount (A — the leftover receivable); Reason (O). On close with a shortfall. |
| **Correction / reversal** | — | Target transaction (R); Reason (R). Cancels a prior entry; original stays on record. |

### Loan auto-creation (decision)

The admin **does not create a loan separately**. When the **first "Give a loan"** entry is recorded
for a member, the app **creates the loan record in the background** (start date = that date; rate =
the current rate; approved amount = entered value or the disbursed amount). **Further disbursements
to the same member, before that loan closes, attach as additional tranches** of the same loan (up to
the approved amount). A member can't start a second loan until the first is fully repaid (+ cooldown).

---

## 4. Admin settings & capabilities

What an admin can do, in two buckets: **manage people** and **configure the club**.

### 4.1 People management

| Capability | Notes |
|------------|-------|
| Add a member | Capture the member fields (§1). Sets default password = phone number. |
| Edit a member | Update name, phone, email, username, avatar, joined date, role, treasurer flag. |
| Make/remove admin | Grant or revoke the `ADMIN` role. |
| Set/unset treasurer | Mark a member as a cash-holder. |
| **Reset a password** | Reset any member's password (defaults back to their phone number). |
| Handle forgot-password requests | See pending reset requests and action them. |
| Deactivate / archive | Freeze (on leave) or archive a member; history is always kept. |

### 4.2 Club configuration

| Setting | What it controls | Default / current |
|---------|------------------|-------------------|
| Club name & start date | Identity; club inception. | Started 01 Sep 2020. |
| Deposit stages | Monthly deposit amount over time (amount + date range per stage). | ₹1,000 (Sep’20–Aug’23) → ₹2,000 (Sep’23–now). |
| Loan interest rate (schedule) | Monthly rate for **new** loans; dated changes allowed (don't affect existing loans). | 1%/month. |
| Daily-interest-from date | When interest becomes day-pro-rated. | 01 Jun 2024. |
| Loan limit | Max a member may borrow. | ₹5,00,000. |
| Loan term | Months before a loan is "overdue". | 5. |
| Loan cooldown | Wait after closing before borrowing again. | 1 month. |
| Overdue penalty | Extra rate on overdue loans (applies instantly to all). | 0 (off). |
| Late-deposit penalty | Charge for paying a monthly deposit late. | 0 (off). |
| Dividend | Periodic profit payout toggle. | Off. |
| Timezone | Month-boundary timezone. | Asia/Kolkata. |

### 4.3 Other admin actions

- Create / edit vendors and chits (§2).
- Record / edit / reverse any transaction (§3).
- Lock/unlock a period (seam built, off by default).

> Members (non-admin) can **view** everything but change nothing (see `PRODUCT.md` §15).

---

*For the flows behind these fields, see `PRODUCT.md`. For schema/types, see
`IMPLEMENTATION_PLAN.md`.*
