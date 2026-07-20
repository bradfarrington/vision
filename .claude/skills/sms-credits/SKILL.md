---
name: sms-credits
description: Drop-in SMS credit infrastructure for Supabase apps — Twilio send endpoint that deducts credits, GoCardless Instant Bank Pay top-up flow, webhook reconciliation, optional Xero invoicing, and a settings panel for monitoring balance / buying credits / viewing purchase history. Use when adding pay-as-you-go SMS to a multi-tenant React app. Does NOT include a per-app SMS composer — each app builds its own drawer/UI that calls the send-sms endpoint.
---

# SMS Credits skill

Backend + settings UI for a pay-as-you-go SMS system. Extracted from the GamLEARN CRM. Designed to be the **infrastructure layer** — each app builds its own SMS-sending drawer/modal/composer that calls the `send-sms` edge function.

What you get:
- **Twilio send endpoint** that checks the credit balance, sends, deducts 1 credit, and logs to `sms_log` with optional `person_id` / `case_id` link.
- **GoCardless Instant Bank Pay** top-up flow — 4 hardcoded packages (50/100/250/500 credits at £5/£10/£25/£50), Billing Request → hosted checkout → user redirected back.
- **GoCardless webhook handler** that verifies signature, tops up the org balance, records the purchase, and (optionally) creates a paid Xero invoice.
- **Settings panel** (`SmsPanel.tsx`) — drop into Settings → SMS tab. Shows balance hero, enable/disable toggle, sender name config, top-up packages, send-test SMS, purchase history table.

What you DON'T get:
- A per-app SMS composer drawer / send UI — build that yourself per app and POST to `send-sms`.
- Inbound SMS handling — outbound only.
- Per-user credit allocation — credits are org-wide.
- A non-Twilio provider — Twilio is hardcoded. To swap, fork `send-sms/index.ts` and replace the fetch.

## When to use this skill

Invoke when the user wants to:
- Add prepaid/pay-as-you-go SMS sending to a Supabase app
- Add a "buy credits" flow via GoCardless to any app (not necessarily SMS — the pattern generalises)
- Understand or modify the SMS credits system

Do **not** invoke for:
- Building the SMS-sending UI itself (the user said upfront they'd build that custom per app)
- One-off transactional SMS where credit-tracking is overkill — just call Twilio direct
- Anything email-related — that's the `email-builder` skill

## What's in the bundle

```
bundle/
├── src/components/
│   └── SmsPanel.tsx              — Full settings panel: config + top-up + test send + purchase history
├── supabase/
│   ├── migrations/
│   │   └── 001_sms_credits.sql   — Consolidated schema (org_settings cols, sms_templates, sms_log, sms_credit_purchases)
│   └── functions/
│       ├── send-sms/index.ts             — Twilio send + credit deduction + audit log
│       ├── sms-credits/index.ts          — GoCardless checkout creation (Billing Request Flow)
│       └── gocardless-sms-webhook/index.ts  — payments.confirmed handler → top up + optional Xero invoice
└── INTEGRATION.md                — Step-by-step playbook (read on demand)
```

## Integration playbook (high-level)

Read [bundle/INTEGRATION.md](bundle/INTEGRATION.md) for the full walkthrough. Quick version:

1. **Create accounts**: Twilio (SID + auth token + a from number), GoCardless (sandbox or live), optional Xero custom connection.
2. **Run the migration** `bundle/supabase/migrations/001_sms_credits.sql` in the Supabase SQL editor.
3. **Deploy 3 edge functions** with the Supabase CLI.
4. **Set Supabase secrets** for the env vars listed below.
5. **Register the GoCardless webhook** in their dashboard → `https://<project>.supabase.co/functions/v1/gocardless-sms-webhook`, event = `payments.confirmed`.
6. **Drop `SmsPanel.tsx`** into a settings page tab.
7. **Build your custom SMS composer** that POSTs to `/functions/v1/send-sms` (see API contract below).

## Required env vars (Supabase Edge Function secrets)

**Twilio** (for `send-sms`):
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` — fallback E.164 number used when the org's sender name isn't valid alpha

**GoCardless** (for `sms-credits` + `gocardless-sms-webhook`):
- `GOCARDLESS_ACCESS_TOKEN` — from GoCardless dashboard
- `GOCARDLESS_WEBHOOK_SECRET` — generated when you register the webhook endpoint
- `GOCARDLESS_ENVIRONMENT` — `live` or `sandbox` (default `live`)
- `GOCARDLESS_API_VERSION` — optional, default `2015-07-06`

**Xero** (optional — webhook skips Xero invoicing cleanly if unset):
- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — don't set them manually.

## `send-sms` API contract — for custom composers

POST to `https://<project>.supabase.co/functions/v1/send-sms` with the user's JWT in `Authorization: Bearer <jwt>`.

Three actions:

```ts
// Send a test SMS — body content is hardcoded server-side.
{ action: 'test', phone: '+447700900000' }

// Send a free-form message.
{ action: 'send', phone, body, person_id?, case_id? }

// Send using a stored sms_templates row (by system_key).
{ action: 'send_template', phone, system_key, vars?, person_id?, case_id? }
```

All three return `{ ok: true, creditsRemaining, sid }` on success or `{ error }` on failure.

The endpoint:
- **Requires an authenticated staff user** (checks `profiles.is_active`). Reject anyone else — the anon key alone is not enough.
- **Refuses to send** if SMS is disabled in settings or `sms_credits_balance <= 0`.
- **Normalises UK phone numbers** automatically (`07700 900000` → `+447700900000`, etc.).
- **Deducts 1 credit** on Twilio success, writes to `sms_log` (with `person_id`/`case_id` for timeline integration).
- **Falls back** from `sms_sender_name` to `TWILIO_FROM_NUMBER` if the sender name isn't 1–11 alphanumeric chars.

`person_id` / `case_id` are stored on the `sms_log` row but the endpoint does NOT write to a `communications` or `timeline_events` table — that's left to the calling client so each app can shape the integration however it wants.

## Required host-project tables

The consolidated migration creates everything SMS-specific. But the `send-sms` endpoint references one more table that must already exist:

- `profiles (id uuid pk, is_active boolean)` — used to gate sends to active staff only.

If your host project uses a different shape (e.g. no `is_active` flag), edit the auth check in `send-sms/index.ts` accordingly.

## org_settings merge behaviour

The SMS migration handles two cases for `org_settings`:
1. **Table doesn't exist** — creates it with all SMS columns.
2. **Table already exists** (e.g. you installed the `email-builder` skill first) — `ALTER TABLE ADD COLUMN IF NOT EXISTS` adds only the SMS columns without disturbing existing ones.

Safe to install alongside the `email-builder` skill in either order.

## Customisation hot-spots

When integrating, expect to touch:

1. **Credit packages** — `CREDIT_PACKAGES` array exists in two places (must match):
   - `bundle/src/components/SmsPanel.tsx` (display + Buy button)
   - `bundle/supabase/functions/sms-credits/index.ts` (server-side validation)
   Keep these two in sync. If you want config-driven packages, lift them into a DB table.
2. **Xero contact + account code** — hardcoded as "Tony Parente" / AccountCode 200 in `gocardless-sms-webhook/index.ts`. Edit those two lines if you keep Xero invoicing, or delete the `createXeroInvoiceAndMarkPaid` call entirely.
3. **Brand colour + visual style** — `SmsPanel.tsx` uses GamLEARN's purple `#4B0082` and ad-hoc inline styles. Restyle as needed.
4. **UI primitive imports** — same as the email-builder skill, `SmsPanel.tsx` imports `Card`, `Icon`, `Overline`, `Button` from `'../ui/primitives'` and `supabase` from `'../../lib/supabase'`. Adapt paths or copy GamLEARN's primitives across.
5. **Currency / pricing** — currency is `GBP`, scheme is `faster_payments` (UK Instant Bank Pay), prices are in pence. For other currencies/schemes, edit the `payment_request` block in `sms-credits/index.ts`. Note: GoCardless Instant Bank Pay is **UK-only** — for other regions you'd need to switch to a different scheme (e.g. `bacs`, `sepa_core`, `pad`) which may not settle instantly.

## Architectural notes worth knowing

- **Credits are org-wide**, not per-user. There's one `org_settings` row; everyone in the org draws from the same balance.
- **The webhook is idempotent.** Checks `sms_credit_purchases.gocardless_payment_id` first and skips if the payment is already recorded — safe against GoCardless redelivering events.
- **Test sends still cost a credit.** The `test` action is just a hardcoded body, not a free preview. If you want free tests, branch the credit-deduction in `send-sms`.
- **The webhook fails closed on bad signatures** (returns HTTP 498) but **soft-fails on Xero errors** (logs them and returns 200) so a Xero outage can't break credit top-ups.
- **GoCardless API version is pinned** to `2015-07-06` (their longest-published version) unless overridden. Don't touch unless you've read their migration guides.
- **`Idempotency-Key` is fresh per request** in `sms-credits/index.ts`. If you retry a failed checkout creation, GoCardless will create a duplicate Billing Request. For higher reliability, derive the key deterministically from the user + amount + timestamp bucket.

## Things this skill deliberately does NOT include

- **SMS composer / drawer / sending UI** — explicitly out of scope per user direction. Build per app.
- **Inbound SMS / Twilio status webhooks** — outbound + reconciliation only.
- **Per-recipient opt-out tracking** — emails have this (see `email-builder` skill), SMS doesn't here.
- **GoCardless mandate / Direct Debit flow** — uses Instant Bank Pay (Faster Payments) instead. One-off payments, no recurring auth.
- **Alternative payment providers** — Stripe was removed (migration 086). To add it back, fork the `sms-credits` and `gocardless-sms-webhook` functions.
- **Email notifications on low credit** — `sms_low_credit_notified` column exists but nothing currently sets it to `true`. Wire up your own threshold logic.
