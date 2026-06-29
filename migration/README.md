# Migration (v1 → v2)

One-time/repeatable import of the existing **Peacock v1** data into the v2 ledger, with a hard
**reconciliation gate** against v1's reported numbers. Full behavior spec lives in
`docs/IMPLEMENTATION_PLAN.md` §24; this README covers the **data source** and **how to run**.

## Where the source data goes

- Put the v1 export at **`migration/data/v1-backup.json`**.
- **`migration/data/` is git-ignored on purpose** — the export contains member **PII and
  credentials** (phone numbers double as default passwords; `passwordHash` is present). Never commit
  it. For each run (now or in future syncs), drop a fresh export in this folder.

## Source file shape (v1 backup)

A single JSON object with three arrays:

| Key | Count (sample) | What it is |
|-----|----------------|-----------|
| `account` | 33 | People & vendors. `type` ∈ {`MEMBER`(27), `VENDOR`(6)}; `role` ∈ {`ADMIN`,`MEMBER`}; `status` ∈ {`ACTIVE`,`INACTIVE`}. Has `firstName/lastName/phone/email/username/avatarUrl/passwordHash/canLogin/startedAt/passbookId`. |
| `passbook` | 35 | One per account **plus a CLUB passbook**. `kind` ∈ {`CLUB`(1),`MEMBER`(27),`VENDOR`(7)}; `isChit` (5 true). Holds `joiningOffset`, `delayOffset`, `loanHistory`, and a `payload` of derived totals. |
| `transaction` | 1344 | The ledger. `type`, `amount` (**in rupees**), `fromId`/`toId` (account ids — **one side is the treasurer**), `occurredAt`, `method`, `description`. |

### Key facts that drive the mapping
- **Amounts are in rupees** → multiply by 100 for v2 paise.
- **`fromId`/`toId` encode the treasurer.** For a deposit, `toId` is the treasurer who received the
  cash; for a loan, `fromId` is the treasurer who paid it out. This gives us the **`TREASURY_CASH`**
  owner for every entry — no guessing needed.
- v1 transaction types map to v2 as: `PERIODIC_DEPOSIT`→same, `OFFSET_DEPOSIT`→`CATCHUP`,
  `WITHDRAW`→`WITHDRAW` (full-exit settlement), `LOAN_TAKEN`/`LOAN_REPAY`/`LOAN_INTEREST`→same,
  `VENDOR_INVEST`→same, `VENDOR_RETURNS`→`VENDOR_RETURN`, `FUNDS_TRANSFER`→same. Per-member
  `joiningOffset`→`CATCHUP`, `delayOffset`→`DELAY_PENALTY`.
- Vendors with `isChit=true` become **`CHIT`** vendors; the rest **`GENERAL`** (a bank is GENERAL
  with `category="Bank"`).
- Loans are rebuilt from `LOAN_TAKEN`/`LOAN_REPAY` transactions (grouped per member, in date order);
  interest is **imported as the recorded `LOAN_INTEREST`** (we do not recompute history).

## Reconciliation gate (must pass)

After import, v2-derived figures must equal the v1 **CLUB passbook `payload`** (the same numbers
shown on the v1 dashboard), e.g. `availableCashBalance`, `loansOutstanding`, `interestCollectedTotal`,
`activeMembersCount`, `memberTotalDepositExpected`, `activeMemberPendingTotal`, `pendingLoanInterest`,
`vendorInvestmentTotal/ReturnsTotal`. These are the captured fixtures.

## Running (implemented in P4, once the app is scaffolded)

The script lives at `prisma/migrate-from-v1.ts` and is **idempotent / re-runnable** (so it can sync
again as v1 keeps changing until cutover). It reads `migration/data/v1-backup.json`, rebuilds
accounts/treasuries/members/vendors/chits/loans, replays transactions through `postTransaction`, then
runs the reconciliation check and prints a pass/fail diff.
