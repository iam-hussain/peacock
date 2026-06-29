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

## Engineering standards (build rules — follow strictly)

These are non-negotiable conventions for all code in this repo.

### Architecture
- **Feature-based (feature-sliced) architecture.** Organize by feature/domain, **not** by file
  type. Each feature owns its UI, hooks, server actions, queries, schemas, and types:
  `src/features/<feature>/{components,hooks,actions,queries,schema,types}`.
- **Cross-cutting core stays central:** `src/server/ledger` (the double-entry + interest engine),
  `src/server/db` (Prisma client), `src/server/auth`, and `src/lib/*` (money, date, utils).
- **Shared UI:** `src/components/ui` = shadcn primitives; `src/components/shared` = cross-feature
  reusable composites. A component used by 2+ features moves to `shared`.
- Keep clear boundaries: features may use `shared`/`lib`/`server` core; features should **not**
  reach into each other's internals.

### Components
- **Small, single-responsibility, reusable. No heavy components.** If a component grows large (a
  good rule of thumb: ~150 lines or >1 clear responsibility), **split it**.
- **Compose, don't duplicate.** Build big screens from small pieces.
- **Server Components by default;** add `"use client"` only for genuine interactivity, and keep
  those client components as small "islands."
- No prop-drilling marathons; lift small, pass minimal props, prefer composition/slots.

### Styling (shadcn + Tailwind + CVA)
- **shadcn/ui + Tailwind CSS**, variants via **class-variance-authority (CVA)**, class merging via
  `cn()` (`clsx` + `tailwind-merge`). Icons via `lucide-react`.
- **Everything theme-based — ZERO hard-coded styles.** No hard-coded hex colors, no arbitrary
  magic numbers (`mt-[13px]`), no inline styles. Use **design tokens**: shadcn CSS variables
  (HSL) + the Tailwind theme scale (colors, spacing, radius, typography). Light/dark must work
  from tokens.
- When the **full design is shared (from the cloud)**, implement it **exactly** — spacing, type,
  color, states — but expressed through theme tokens, not literals. Add the real functionality
  behind it, not static mockups.

### Data & APIs
- **No REST layer.** Reads = Server Components calling `server/queries/*` directly; mutations =
  Server Actions → services → ledger. Validate all I/O with **Zod**.
- **Fetch only what's needed.** Use Prisma `select`/projections; return slim **DTOs**, never raw
  rows or unused fields. No over-fetching, no "select all then filter in JS."
- **React Query / TanStack Query is optional.** With RSC + Server Actions it's usually unnecessary;
  use it only for genuinely client-driven cache/optimistic needs. Prefer React's `useOptimistic`
  / `useActionState` for optimistic UI.
- Follow API/data best practices: pagination for lists, stable typed contracts, no N+1 queries
  (batch/include deliberately), handle errors explicitly.

### Caching (one layer, always clean)
- **One cache layer:** Next.js cache + **tag-based** `revalidateTag()` (and `revalidatePath` where
  apt). After every mutation, invalidate exactly the affected tags.
- **Clear caches properly — local AND on Vercel.** Invalidation must propagate to the Vercel/CDN
  data cache, not just in-memory. Never leave stale views. No NodeCache/ETag/sessionStorage layers.
- Tag scheme and `affectedTags()` are defined in `IMPLEMENTATION_PLAN.md` — keep them exhaustive.

### Performance & reliability
- The app must feel **seamlessly fast**. Use **lazy loading** (`next/dynamic`, `React.lazy`),
  code-splitting, **Suspense + streaming**, and skeleton/loading states for below-the-fold or
  heavy UI.
- Do non-critical work in the **background / non-blocking**; defer what the user doesn't need
  immediately. Optimize images (`next/image`), minimize client JS, memoize expensive client work.
- Reliability first: explicit loading/empty/error states everywhere; never a blank or janky screen.

### Code quality
- **DRY.** Extract **generic, reusable functions/utilities**; never copy-paste logic. Shared logic
  lives in `lib/` or the relevant feature's helpers.
- **No junk, no dead code.** No commented-out blocks, unused exports, leftover scaffolding, or
  placeholder data shipped. Run dead-code/unused checks (e.g. `knip` / `ts-prune`) and keep clean.
- **Strict TypeScript**, no `any` (justify any rare exception). ESLint + Prettier clean.
- **Don't reinvent the wheel.** For solved problems, use a **popular, well-maintained, trusted**
  package instead of hand-rolling (e.g. forms: `react-hook-form` + `@hookform/resolvers`; tables:
  `@tanstack/react-table`; charts: a maintained lib; dates: `date-fns`/`date-fns-tz`; toasts:
  `sonner`). Prefer what shadcn/Radix already gives for a11y. Evaluate fit/size/maintenance before
  adding.
- Accessibility: rely on Radix/shadcn a11y; keyboard + focus + aria correct.
- Raise standards proactively — if a better-practice approach exists, apply it (and note it).
