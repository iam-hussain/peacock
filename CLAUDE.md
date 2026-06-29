# CLAUDE.md — working agreement for this repository

Guidance for Claude (and any AI assistant) working in the Peacock repository.

## The two source-of-truth documents

| Document | What it is | Authority |
|----------|-----------|-----------|
| **`docs/PRODUCT.md`** | The **product source of truth** — what Peacock does and how every flow behaves (in plain language, with diagrams). Written for designers and stakeholders. | **Authoritative for product behavior.** If anything disagrees with it about *how the product should behave*, this document wins. |
| **`docs/IMPLEMENTATION_PLAN.md`** | The **technical companion** — architecture, schema, calculations, the ledger/interest engines, migration, build phases. | Authoritative for *how it's built*. Must always stay consistent with `PRODUCT.md`. |

## Rules for `docs/PRODUCT.md` (the product source of truth)

1. **Always consult it first.** For any question about product behavior, rules, flows, penalties,
   catch-up, loans, interest, profit, vendors, settlements, etc. — read `docs/PRODUCT.md` and follow
   it. Do not infer product behavior from memory or from code when this document covers it.

2. **Claude maintains this document.** When the product genuinely changes, Claude is responsible for
   keeping `docs/PRODUCT.md` accurate, clean, and well-structured (including diagrams and user flows).

3. **ALWAYS ASK BEFORE CHANGING A FLOW.** Before editing `docs/PRODUCT.md` in any way that changes
   product behavior or a flow, **ask the owner to confirm first** — e.g.:
   > "Are we updating this flow? You're changing **X** from **A** to **B** — confirm and I'll update
   > `docs/PRODUCT.md`."
   Only proceed after an explicit "yes." This applies to behavior/flow changes. (Pure typo/format
   fixes that don't change meaning don't need confirmation, but mention them.)

4. **Keep the two docs in sync.** When a confirmed product change lands in `docs/PRODUCT.md`, update
   `docs/IMPLEMENTATION_PLAN.md` to match (schema, calculations, etc.). If a technical constraint
   forces a product behavior change, surface it and ask before changing `PRODUCT.md`.

5. **No code/schema in `PRODUCT.md`.** Keep it plain-language and diagram-driven so non-engineers
   can read it. Technical detail belongs in `IMPLEMENTATION_PLAN.md`.

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
