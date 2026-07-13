---
name: verify
description: How to build, run, and drive Peacock locally to verify a change end-to-end.
---

# Verifying Peacock changes

- `.env` `DATABASE_URL` points at **peacock_v2_dev** (MongoDB Atlas) — safe for test writes; the real club data is `peacock_v2`. Confirm before driving mutations: `grep DATABASE_URL .env`.
- The owner usually has `next dev` running on :3000 — **don't kill it**, and a second `next dev` refuses to start. Use a prod build instead: `npm run build && PORT=3100 npm start` (dev artifacts live in `.next/dev`, so the running dev server is unaffected).
- DB scripts must live inside the repo (module resolution): copy to `scripts/tmp-*.mts`, run `npx tsx --env-file=.env scripts/tmp-x.mts`, delete after.
- After deleting test transactions/entries directly, repair cached balances: `npx tsx --env-file=.env scripts/rebuild-balances.mts --write` (also clears StatsCache).

## WhatsApp webhook (`/api/whatsapp`)

Run with env: `WHATSAPP_VERIFY_TOKEN=vt-test WHATSAPP_TOKEN=test-token WHATSAPP_PHONE_NUMBER_ID=555 WHATSAPP_GRAPH_URL=http://localhost:<mock> WHATSAPP_APP_SECRET=shh-test`.
- `WHATSAPP_GRAPH_URL` redirects outbound sends to a local capture server (tiny node http server appending POST bodies to a jsonl file) — that file is where you read the bot's replies.
- Sign inbound POSTs: `sha256=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac shh-test -r | cut -d' ' -f1)` in `x-hub-signature-256`.
- Inbound text shape: `{"entry":[{"changes":[{"value":{"messages":[{"from":"<waid>","type":"text","text":{"body":"balance"}}]}}]}]}`; button taps: `"type":"interactive","interactive":{"type":"button_reply","button_reply":{"id":"wa:ok:<subId>"}}`.
- Sender identity = last 10 digits of `from` matched to `Member.phone`; pick real members from the dev DB first.
- Entry parser self-check: `npx tsx scripts/check-whatsapp-parse.mts`.
