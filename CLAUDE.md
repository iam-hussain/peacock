# CLAUDE.md — working agreement for this repository

Guidance for Claude (and any AI assistant) working in the Peacock repository.

The product is **Peacock Investment Club** — slogan **"Many feathers, one fortune."**

## The three documents

| Document | What it is | Audience | Authority |
|----------|-----------|----------|-----------|
| **`docs/ABOUT.md`** | **Non-technical guide** — plain-English, layman-friendly explanation of what the club is and each feature. No jargon, no spec detail. | Anyone (members, newcomers, general readers). | Friendly explainer; must agree with `PRODUCT.md`. |
| **`docs/PRODUCT.md`** | **Product source of truth** — how every flow behaves, precisely (plain language + diagrams, no code). | Designers, stakeholders, the build team. | **Authoritative for product behavior.** If anything disagrees about *how the product should behave*, this wins. |
| **`docs/IMPLEMENTATION_PLAN.md`** | **Technical companion** — architecture, schema, calculations, ledger/interest engines, migration, build phases. | Engineers. | Authoritative for *how it's built*. Must stay consistent with `PRODUCT.md`. |

## Rules for the product docs (`PRODUCT.md` + `ABOUT.md`)

1. **Always consult `docs/PRODUCT.md` first.** For any question about product behavior, rules, flows,
   penalties, catch-up, loans, interest, profit, vendors, settlements, etc. — read it and follow it.
   Do not infer product behavior from memory or from code when this document covers it.

2. **Claude maintains these documents.** When the product genuinely changes, Claude keeps both
   `docs/PRODUCT.md` (precise) and `docs/ABOUT.md` (plain-language) accurate, clean, and
   well-structured (diagrams and user flows in `PRODUCT.md`).

3. **ALWAYS ASK BEFORE CHANGING A FLOW.** Before editing `docs/PRODUCT.md` (or `docs/ABOUT.md`) in
   any way that changes product behavior or a flow, **ask the owner to confirm first** — e.g.:
   > "Are we updating this flow? You're changing **X** from **A** to **B** — confirm and I'll update
   > the product docs."
   Only proceed after an explicit "yes." (Pure typo/format fixes that don't change meaning don't need
   confirmation, but mention them.)

4. **Keep all three docs in sync.** A confirmed product change updates `PRODUCT.md`, the matching
   plain-language wording in `ABOUT.md`, and the technical detail in `IMPLEMENTATION_PLAN.md`. If a
   technical constraint forces a product behavior change, surface it and ask before changing the
   product docs.

5. **Keep the audiences clean.** `ABOUT.md` = no jargon, no spec/numbers-heavy detail beyond what a
   layman needs. `PRODUCT.md` = precise behavior, plain language + diagrams, **no code/schema**.
   Code/schema lives only in `IMPLEMENTATION_PLAN.md`.

## Project snapshot (orientation)

- **Peacock** is a manager for a private investment club: members pay monthly deposits, the club
  lends to members for interest and invests with vendors (bank/general, chit funds).
- Key product facts (see `docs/PRODUCT.md` for the full picture): the club holds **no central
  cash** (member-treasurers hold it); **money is exact** (integer paise); loans are **one-at-a-time,
  multi-tranche, daily interest, fixed rate at origination, 5-month term**; **catch-up** equalizes
  member value; **profit is shared proportionally to deposits paid**; withdrawal is a **full exit**
  (settle → freeze → rejoin); penalties exist but are **off (zero)** today.
- Intended stack (see `docs/IMPLEMENTATION_PLAN.md`): Next.js (App Router, Server Actions),
  PostgreSQL + Prisma, double-entry ledger with cached balances, Better Auth, tag-based caching.

## Working conventions

- Develop on the designated feature branch; commit with clear messages; open/maintain a PR.
- Money is always integer paise on the server; format to ₹ only at display.
- When in doubt about product behavior: **read `docs/PRODUCT.md`; if it's silent or ambiguous, ask
  the owner** — don't assume.
