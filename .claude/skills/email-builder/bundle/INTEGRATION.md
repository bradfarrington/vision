# Email Builder — integration playbook

Step-by-step guide for dropping this skill into a new project. Assumes a **React + Vite + Supabase** host project. Adapt freely.

---

## Step 1 — Install dependencies

```bash
npm install mjml-browser react-quill-new dompurify lucide-react \
  @supabase/supabase-js react-router-dom
npm install --save-dev @types/dompurify
```

The bundle was extracted from a React 19 / Vite 8 / TypeScript 6 project. It should work on React 18+ unchanged.

---

## Step 2 — Copy the source tree

Copy `bundle/src/features/email-marketing/` into the host project's `src/features/`:

```
src/features/email-marketing/
├── EmailBuilderPage.tsx
├── CampaignSendDrawer.tsx
├── ListMembersModal.tsx
├── EmailBuilder.css
└── builder/
    ├── BlockEditPanel.tsx
    ├── components.tsx
    ├── constants.ts
    ├── mjml.ts
    ├── panels.tsx
    └── systemTemplates.ts
```

---

## Step 3 — Wire up the imports

The bundled files import from these relative paths (assuming they're at `src/features/email-marketing/...`):

```ts
// EmailBuilderPage.tsx, CampaignSendDrawer.tsx
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../components/ui/ConfirmModal';
import { Button, Icon, Avatar } from '../../components/ui/primitives';

// BlockEditPanel.tsx
import { Dropdown } from '../../../components/ui/Dropdown';
import { DatePicker } from '../../../components/ui/DatePicker';

// CampaignSendDrawer.tsx
import { Dropdown } from '../../components/ui/Dropdown';

// components.tsx
import { useConfirm } from '../../../components/ui/ConfirmModal';
import { supabase } from '../../../lib/supabase';

// panels.tsx
// (no project-specific imports beyond builder/* and lucide-react)
```

You have two options:

### Option A — Copy the GamLEARN primitives over too

Files to bring across from the GamLEARN repo:
- `src/lib/supabase.ts`
- `src/contexts/AuthContext.tsx`
- `src/components/ui/ConfirmModal.tsx`
- `src/components/ui/primitives.tsx`
- `src/components/ui/Dropdown.tsx`
- `src/components/ui/DatePicker.tsx`

This is fastest if you don't have your own UI kit yet.

### Option B — Adapt the imports

Replace each import with the host project's equivalent. Minimum surface area:

| Import | Required shape |
|---|---|
| `supabase` | A standard `createClient(url, anonKey)` instance |
| `useAuth()` | Returns `{ user: { id, email }, profile: { id, email, full_name, role } }` |
| `useConfirm()` | Returns `{ confirm(msg, opts) → Promise<bool>, alert(msg, opts) → Promise<void> }` |
| `<Button variant size icon onClick>` | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'destructive'`; `icon` is a string name |
| `<Icon name size color>` | `name` is a string lookup into your icon set |
| `<Dropdown value options onChange placeholder>` | `options: { value, label, description? }[]` |
| `<DatePicker value onChange placeholder>` | ISO `YYYY-MM-DD` for value/onChange |

Wrap the app in `<ConfirmProvider>` at the root so `useConfirm()` works.

---

## Step 4 — Run the database migration

Open the Supabase SQL editor and run `bundle/supabase/migrations/001_email_builder.sql`. If your project already has numbered migrations, copy it into `supabase/migrations/` with the next free number instead.

**Pre-flight checklist** — the migration assumes these tables exist:
- `public.profiles (id uuid pk, full_name text, email text, role text)`
- `public.people (id uuid pk, full_name, email, phone, ref_code, address, region, preferred_name)`
- `public.notifications (user_id, type, title, body, link)` — for the post-send bell ping

If your project uses different table names (e.g. `users` instead of `profiles`), search/replace before running.

The migration:
- Creates 8 tables under `public`
- Adds 3 columns to `people` (`marketing_opt_out`, `marketing_opt_out_at`, `marketing_opt_out_source`)
- Creates the `email-images` storage bucket with RLS
- Seeds an `org_settings` row + two `system_email_templates` (staff_invite, password_reset) — customise these for your app

---

## Step 5 — Deploy the edge functions

From the project root:

```bash
supabase functions deploy send-campaign
supabase functions deploy unsubscribe --no-verify-jwt
```

The `--no-verify-jwt` flag on `unsubscribe` is critical — recipients have no Supabase auth, so the token in the URL is the only thing authenticating the request.

If your project doesn't use the Supabase CLI yet, copy `bundle/supabase/functions/send-campaign/`, `bundle/supabase/functions/unsubscribe/`, and `bundle/supabase/functions/_shared/` into your `supabase/functions/` directory first.

> **IDE TypeScript errors are expected** — the edge functions run in Deno. TypeScript will complain about `Deno is not defined` and `Cannot find module 'https://deno.land/...'`. Configure a `deno.json` in `supabase/functions/` if you want clean tooling; otherwise ignore. They run correctly on Supabase regardless.

---

## Step 6 — Set environment variables

In **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

| Name | Value | Notes |
|---|---|---|
| `RESEND_API_KEY` | `re_xxx…` | From [resend.com](https://resend.com) — verify your sending domain first |
| `UNSUBSCRIBE_BASE_URL` | `https://yourapp.com/unsubscribe` | Public URL of your front-end unsub page (not the edge function URL) |
| `UNSUBSCRIBE_SECRET` | `openssl rand -hex 32` | 32+ random bytes. Never change without setting `UNSUBSCRIBE_SECRET_PREVIOUS` first or old links break |
| `CAMPAIGN_FROM_EMAIL` | `"Your App <hello@yourapp.com>"` | Fallback — only used if `org_settings.campaign_from_email` is empty |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by the Supabase runtime — don't set them manually.

---

## Step 7 — Add the route

In your router config:

```tsx
import EmailBuilderPage from './features/email-marketing/EmailBuilderPage';

<Route path="communications/builder" element={<EmailBuilderPage />} />
```

The builder reads `?campaignId=`, `?templateId=`, or `?systemTemplateId=` from the URL to know what mode to open in. Build a listing page (campaigns + templates) that links here with the right param. The GamLEARN `CommunicationsPage.tsx` is a good reference — it's not bundled because list/grid pages are very project-specific.

---

## Step 8 — Build the public unsubscribe page

The edge function is bundled, but the recipient-facing UI page that hits it is project-specific. Minimum viable:

```tsx
// src/pages/UnsubscribePage.tsx
import { useEffect, useState } from 'react';

export default function UnsubscribePage() {
  const [state, setState] = useState<'loading'|'ready'|'done'|'error'>('loading');
  const [email, setEmail] = useState<string>('');
  const token = new URLSearchParams(window.location.search).get('t') || '';
  const fnUrl = `https://YOUR_PROJECT.supabase.co/functions/v1/unsubscribe?t=${encodeURIComponent(token)}`;

  useEffect(() => {
    fetch(fnUrl).then(r => r.json()).then(d => {
      if (d.ok) { setEmail(d.email); setState('ready'); } else setState('error');
    });
  }, []);

  async function confirm() {
    await fetch(fnUrl, { method: 'POST' });
    setState('done');
  }

  if (state === 'loading') return <p>Loading…</p>;
  if (state === 'error') return <p>Invalid or expired link.</p>;
  if (state === 'done') return <p>You've been unsubscribed. {email}</p>;
  return (
    <div>
      <p>Unsubscribe {email} from all marketing emails?</p>
      <button onClick={confirm}>Unsubscribe</button>
    </div>
  );
}
```

Add route at the path matching `UNSUBSCRIBE_BASE_URL`.

---

## Step 9 — Customise merge tags for your domain

Edit `src/features/email-marketing/builder/constants.ts`:

```ts
export const MERGE_TAGS = [
  { group: 'Person', tags: [
    { key: '{{person_name}}', label: 'Full Name' },
    // …add/remove to match what your app actually has on the `people` table
  ]},
  // …add domain-specific groups
];

export const SAMPLE_DATA = {
  '{{person_name}}': 'Jamie Carter',  // realistic-looking preview values
  // …
};
```

Then mirror them server-side in `supabase/functions/send-campaign/index.ts` — `buildPersonContext()` resolves these from real DB rows at send time. Whatever keys you add to `MERGE_TAGS` should appear in `buildPersonContext()` (or `buildCaseContext()` for case-related ones).

**If your app has no concept of "cases":** strip the `buildCaseContext()` function and its call sites. The merge resolver will just leave any `{{case_*}}` tags unsubstituted, which is fine.

---

## Step 10 — Customise system / transactional templates

System templates live in `system_email_templates` and are keyed by string. To add a new one:

1. **Seed the row** in the migration (or run a one-off insert):
   ```sql
   insert into public.system_email_templates (key, name, description, subject, preview_text)
   values ('order_confirmation', 'Order confirmation', 'Sent when an order is placed.',
           'Your order from {{org_name}}', 'Thanks for your purchase.');
   ```

2. **Add a default design** in `src/features/email-marketing/builder/systemTemplates.ts`:
   ```ts
   const TEMPLATES: Record<string, SystemTemplateDefault> = {
     // …
     order_confirmation: {
       settings: { ...baseSettings, subject: 'Your order from {{org_name}}', previewText: 'Thanks!' },
       blocks: [
         heading('oc-1', '<p>Order confirmed</p>'),
         text('oc-1', '<p>Hi {{recipient_first_name}}, your order is on its way.</p>'),
       ],
     },
   };
   ```

3. **Add sample data** for the preview in the same file (`SYSTEM_SAMPLE_DATA`).

4. **Send it from a server-side function** by loading the row's `body_html` and POSTing to your email provider with merge-tag substitution. The skill doesn't bundle a generic "send-system-email" function — wire it up to whatever event triggers the email (order webhook, user-signup hook, etc.).

---

## Step 11 — Test end-to-end

1. Visit `/communications/builder?templateId=<new-uuid-or-omit>` to open the builder cold
2. Build a simple template, hit Save
3. From the campaigns listing, create a campaign that uses the template
4. Add yourself to a test mailing list
5. Open the campaign in the builder → Save & Continue → pick the test list → Send test
6. Check inbox; confirm merge tags resolved, unsubscribe link is signed (`/unsubscribe?t=<long-token>`)
7. Click the unsubscribe link → confirm → check `email_opt_outs` row was written and your `people.marketing_opt_out` is `true`
8. Try sending another campaign to the same list — you should appear as `skipped` in `comms_campaign_recipients`

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| **`No campaign From address`** on send | `org_settings.campaign_from_email` is empty AND `CAMPAIGN_FROM_EMAIL` env var isn't set |
| **`Campaign has no rendered body`** on send | The builder didn't run `Save` after edits — `body_html` is null on the row |
| **Resend 403 / `domain not verified`** | Add and verify your sending domain in the Resend dashboard before sending from an `@yourdomain.com` address |
| **Image upload fails with `row-level security`** | The storage policies on `email-images` aren't installed — re-run the migration's storage policy block |
| **Unsubscribe link gives `invalid_token`** | `UNSUBSCRIBE_SECRET` is set differently on send vs verify, or the link was generated with `UNSUBSCRIBE_SECRET_PREVIOUS` and that's no longer set |
| **Merge tags show as raw `{{person_name}}`** in sent emails | The key isn't in `buildPersonContext()` server-side — add it. (Client-side preview works because `SAMPLE_DATA` has it.) |
| **TypeScript errors `Cannot find name 'Deno'`** in edge functions | Expected — the IDE doesn't know it's Deno. Add a `supabase/functions/deno.json` for clean tooling or ignore. |

---

## What's left after integration

The skill gets you a working end-to-end email builder. After integration, consider adding:

- **Resend webhook handler** — process `email.opened`, `email.clicked`, `email.bounced`, `email.complained` events to populate the `opened_at` / `clicked_at` / `bounced_at` / `complained_at` columns on `comms_campaign_recipients` and auto-opt-out hard bounces. GamLEARN has this as `resend-webhook` but it's not bundled (it's mostly boilerplate).
- **Campaigns list page** — the builder edits one campaign at a time; users need a listing UI to discover them.
- **Mailing list management UI** — `ListMembersModal.tsx` is bundled but you need a parent page that lets users create lists and open the modal.
- **Engagement analytics** — opens/clicks per campaign, top links, etc. The data's there in `comms_campaign_recipients` once the webhook is wired.
- **Scheduled sends** — currently campaigns send immediately. Add a `scheduled_for timestamptz` column and a cron job.
