# SMS Credits — integration playbook

Step-by-step guide for dropping this skill into a new project. Assumes a **React + Vite + Supabase** host project. Adapt freely.

---

## Step 1 — Create provider accounts

### Twilio
1. Sign up at [twilio.com](https://www.twilio.com).
2. Buy or assign a UK number capable of SMS. (Or use a Twilio trial number for sandbox.)
3. From the console, note:
   - **Account SID** (`AC…`)
   - **Auth Token**
   - **From Number** in E.164 format (e.g. `+447700900000`)
4. If you want to use an alphanumeric sender ID (e.g. "GamLEARN" instead of a phone number), enable Sender ID in Twilio Console → Messaging → Sender Pool. Alphanumeric IDs are 1–11 alphanumeric chars and **don't support replies**.

### GoCardless
1. Sign up at [gocardless.com](https://gocardless.com) — start with **sandbox** to test.
2. Verify the business / bank account (live mode only).
3. **Developers → Access tokens** → create one with full permissions → copy the `access-` token.
4. Note your environment (`sandbox` or `live`) for the env var.
5. Webhook secret is created in Step 5 below.

### Xero (optional)
Skip if you don't need invoice generation.
1. Create an app at [developer.xero.com](https://developer.xero.com) → "New app" → choose **Custom Connection**.
2. Authorise the connection against your Xero organisation.
3. Note **Client ID** and **Client Secret**.
4. The webhook will fetch the first connected tenant + first active BANK account automatically.

---

## Step 2 — Run the database migration

Open the Supabase SQL editor and run `bundle/supabase/migrations/001_sms_credits.sql`. Or copy it into your project's `supabase/migrations/` with the next free number.

**Pre-flight checklist:**
- `public.profiles (id uuid pk, is_active boolean)` must already exist — the `send-sms` endpoint checks this for staff auth gating.
- If you've already installed the **email-builder** skill, the migration's `create table if not exists public.org_settings` is a no-op and the SMS-specific columns are added via `alter table add column if not exists`. Safe to run.

The migration:
- Creates / extends `org_settings` with SMS columns
- Creates `sms_templates` (+ seeds 2 starter rows — edit/remove as needed)
- Creates `sms_log` and `sms_credit_purchases`
- Adds indexes for the common query patterns (recent sends, per-person history)
- Enables RLS with permissive `authenticated` policies — tighten for your role model

---

## Step 3 — Deploy the edge functions

From the project root:

```bash
supabase functions deploy send-sms
supabase functions deploy sms-credits
supabase functions deploy gocardless-sms-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag on the webhook is critical — GoCardless's POSTs have no Supabase JWT; the request is authenticated by the HMAC signature in the `webhook-signature` header.

If your project doesn't use the Supabase CLI yet, copy the three function folders from `bundle/supabase/functions/` into your `supabase/functions/` directory first.

> **IDE TypeScript errors are expected** — the edge functions run in Deno. TypeScript will complain about `Deno is not defined` and `Cannot find module 'https://deno.land/...'`. Add a `deno.json` in `supabase/functions/` for clean tooling; otherwise ignore. They run correctly on Supabase regardless.

---

## Step 4 — Set Supabase secrets

In **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

| Name | Required by | Notes |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | send-sms | From Twilio console |
| `TWILIO_AUTH_TOKEN` | send-sms | From Twilio console |
| `TWILIO_FROM_NUMBER` | send-sms | E.164 fallback — used if `sms_sender_name` is invalid alpha |
| `GOCARDLESS_ACCESS_TOKEN` | sms-credits, webhook | `access-` prefix |
| `GOCARDLESS_ENVIRONMENT` | sms-credits, webhook | `live` or `sandbox` (default `live`) |
| `GOCARDLESS_WEBHOOK_SECRET` | webhook | Set in Step 5 below |
| `GOCARDLESS_API_VERSION` | sms-credits, webhook | Optional; default `2015-07-06` |
| `XERO_CLIENT_ID` | webhook (optional) | Omit to skip Xero invoicing cleanly |
| `XERO_CLIENT_SECRET` | webhook (optional) | Only used if `XERO_CLIENT_ID` is set |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — don't set them manually.

---

## Step 5 — Register the GoCardless webhook

1. GoCardless Dashboard → **Developers → Webhook endpoints → Create**.
2. URL: `https://<your-project-ref>.supabase.co/functions/v1/gocardless-sms-webhook`
3. Events to receive: **Payments → confirmed** (everything else is ignored by the handler anyway).
4. After saving, GoCardless reveals a **secret** (32-char hex). Copy it and set as `GOCARDLESS_WEBHOOK_SECRET` in the Supabase secrets (Step 4).
5. Send a test event from the GoCardless dashboard → confirm you see a 200 response in the GoCardless logs and a row appear in `sms_credit_purchases` once you make a real test payment.

---

## Step 6 — Drop the settings panel into your UI

Copy `bundle/src/components/SmsPanel.tsx` into your `src/components/` directory.

Add it as a tab in your settings page:

```tsx
import SmsPanel from './components/SmsPanel';

// in your tab switcher
{activeTab === 'sms' && <SmsPanel />}
```

The panel imports:
- `'../lib/supabase'` — adjust path or alias to your Supabase client
- `'./ui/primitives'` — `Card`, `Icon`, `Overline`, `Button` from GamLEARN's UI kit

If you don't have those primitives, either:
- (a) Copy `src/components/ui/primitives.tsx` from the GamLEARN repo across
- (b) Replace the imports with native equivalents and your own button styling

The panel handles its own routing trick — after a successful GoCardless redirect, the URL contains `?purchase=success` and the panel shows a green toast then strips the param. Make sure the success URL passed to `createCheckout` lands on whatever route hosts the panel.

---

## Step 7 — Build your custom SMS composer

The skill deliberately doesn't ship a sending UI. Build one per app. Minimum viable composer:

```tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function SendSmsButton({ phone, personId, caseId }: { phone: string; personId?: string; caseId?: string }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: { action: 'send', phone, body, person_id: personId, case_id: caseId },
    });
    setSending(false);
    if (error || data?.error) {
      alert(error?.message || data?.error || 'Send failed');
      return;
    }
    alert(`Sent. Credits left: ${data.creditsRemaining}`);
  }

  return (
    <div>
      <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={1600} />
      <button onClick={send} disabled={sending || !body.trim()}>Send SMS</button>
    </div>
  );
}
```

For the template version, swap to:
```ts
{ action: 'send_template', phone, system_key: 'appointment_reminder',
  vars: { person_name: 'Jamie', worker_name: 'Sam', date: 'Tuesday', time: '2pm' },
  person_id: personId, case_id: caseId }
```

Server-side substitution mixes in `org_name` automatically from `org_settings`.

For the **character / segment counter** (UI nicety):
- 1 segment = up to 160 GSM-7 chars (or 70 UCS-2 chars if any emoji/non-Latin)
- Multi-segment messages drop to 153 chars per segment (header overhead)
- 1 credit per segment if you bill segment-wise; the bundled `send-sms` deducts exactly 1 credit per send regardless of length. Adjust if you want segment-based billing.

---

## Step 8 — End-to-end test

1. Visit `/settings` → SMS tab → toggle **Enable SMS notifications** on → save.
2. Set a **sender name** if you want alpha (e.g. "MyApp"); otherwise leave blank to use the Twilio number.
3. Click **Buy 50 credits** → redirected to GoCardless hosted page → complete bank authorisation.
4. On redirect back, you should see green toast "SMS credits purchased successfully!" — but the balance won't update until the webhook fires (usually <5s).
5. Refresh; balance should now read 50 and a row should appear in the purchase history.
6. Enter your phone number → click **Send test** → SMS arrives → balance drops to 49, `sms_log` has a `'sent'` row.
7. If Xero is configured: check Xero → Invoices → AUTHORISED → there should be a PAID invoice for £5 against your configured contact.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| **`Out of SMS credits`** before sending | `org_settings.sms_credits_balance` is 0; top up via the panel |
| **`SMS is disabled in settings`** | Toggle is off — flip it in the panel and save |
| **`Staff account required to send SMS`** | The caller's `profiles` row has `is_active = false`, or there's no `profiles` row at all — most likely a member-portal user, not a staff user |
| **`SMS provider not configured`** | Twilio env vars missing |
| **Twilio 401** | `TWILIO_AUTH_TOKEN` wrong, or trial account trying to send to an unverified number |
| **Webhook fires but credits don't top up** | Check the function logs — most likely `meta.product !== 'sms_credits'` (the payment wasn't created via `sms-credits/index.ts`) |
| **Webhook returns 498** | `GOCARDLESS_WEBHOOK_SECRET` mismatch — double-check what's in the GC dashboard vs Supabase secrets |
| **GoCardless `validation_failed`** on checkout | Live mode requires the merchant account to be verified; switch `GOCARDLESS_ENVIRONMENT` to `sandbox` for testing |
| **Xero `XERO_CLIENT_ID not configured`** | Expected if you didn't set it — the webhook now skips Xero cleanly. Result row will read `xero: 'skipped (not configured)'` |
| **Xero `No active bank account found`** | Add at least one BANK type account in Xero and mark it active |
| **IDE TypeScript errors** in the edge functions | Expected — they run in Deno, not Node. Add a `supabase/functions/deno.json` for clean tooling or ignore |
| **Purchase history empty after a successful payment** | Webhook hasn't fired yet (check GC dashboard → Webhook deliveries), or the `sms_credit_purchases` insert failed (check function logs) |

---

## Customisation reference

### Change credit packages
Both files must match:

```ts
// bundle/src/components/SmsPanel.tsx — line ~5
const CREDIT_PACKAGES = [
  { credits: 50,  pricePence: 500,  price: '£5.00'  },
  // …
];

// bundle/supabase/functions/sms-credits/index.ts — line ~36
const CREDIT_PACKAGES = [
  { credits: 50,  pricePence: 500,  label: '50 credits — £5.00'  },
  // …
];
```

For dynamic packages, lift these into a DB table (`sms_credit_packages`) and read both client + server from there.

### Change currency / payment scheme
In `sms-credits/index.ts`, edit the `payment_request` block:
```ts
payment_request: {
  amount:      pkg.pricePence,
  currency:    'GBP',            // ← change here
  description: `${pkg.credits} SMS Credits`,
  scheme:      'faster_payments', // ← change here
  // …
}
```
**Note:** Instant Bank Pay (`faster_payments`) is **UK-only**. For EU use `sepa_core`, for AUS use `becs`, etc. — but those are typically Direct Debit (delayed settlement), so credits won't top up instantly anymore.

### Change Xero invoice contact
In `gocardless-sms-webhook/index.ts`, find `createXeroInvoiceAndMarkPaid`:
```ts
Contact: { Name: 'Tony Parente', EmailAddress: 'tony@gamlearn.org.uk' },
// …
LineItems: [{
  Description: `${credits} SMS Credits`,
  Quantity:    1,
  UnitAmount:  amountGBP,
  AccountCode: '200', // ← UK Xero standard "Sales"
}],
```
Edit Contact, AccountCode, and Reference inline. For multiple orgs / dynamic billing, refactor to read these from env vars or a DB row.

### Remove Xero entirely
1. Delete `getXeroToken`, `getXeroTenantId`, `xeroHeaders`, `createXeroInvoiceAndMarkPaid` from `gocardless-sms-webhook/index.ts`.
2. Delete the `if (!Deno.env.get('XERO_CLIENT_ID')) … else …` block in the event loop.
3. Replace the call with `results.push({ eventId: event.id, paymentId, credits, topped_up: true });`

### Bill per segment, not per send
In `send-sms/index.ts`, after computing `messageBody`, compute segment count:
```ts
const segments = messageBody.length <= 160 ? 1 : Math.ceil(messageBody.length / 153);
// …
const newBalance = (settings.sms_credits_balance || 0) - segments;
// …
credits_used: segments,
```
Show estimated cost in your composer UI so users see "Will cost 2 credits" before sending.

### Add low-credit email alert
`org_settings.sms_low_credit_notified` exists but nothing currently flips it. After deducting credits in `send-sms`:
```ts
if (newBalance <= 10 && !settings.sms_low_credit_notified) {
  // send email + set flag to true
  await supabase.from('org_settings').update({ sms_low_credit_notified: true }).eq('id', settings.id);
}
```
Reset the flag in the webhook on successful top-up — already done there.

---

## What's left after integration

- **Per-app SMS composer** (Step 7) — required for users to actually send SMS.
- **Inbound SMS handler** if your app needs replies — set up a separate Twilio webhook → Supabase function that writes to a `sms_inbound` table or your `communications` table.
- **Segment-based billing** if 1-credit-per-send is wrong for your pricing model.
- **Multi-tenant credit isolation** if you have multiple orgs in one Supabase project — currently `org_settings` is a single-row global; you'd need to add `org_id` to all the tables and adjust RLS.
