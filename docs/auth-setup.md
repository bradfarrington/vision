# Auth setup — Supabase Auth + Resend

One-time configuration to make login and password reset work end to end. Code
is already built (see `src/app/(auth)/`); these are the dashboard/DNS steps.

## 1. Push the entitlement migration + regenerate types

```bash
npx supabase db push
npx supabase gen types typescript --linked > src/lib/supabase/types.ts
```

This applies `20260721090300_company_entitlements.sql` (plan / seat_limit / trial
columns) and refreshes the generated types. After this, `plan` can go back on
the "/" proof page.

## 2. Supabase URL configuration

Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (dev). Set to the deployed URL in prod.
- **Redirect URLs** (allow-list): add `http://localhost:3000/**` and your
  production `https://<domain>/**`.

Keep `NEXT_PUBLIC_SITE_URL` in `.env.local` in sync with the Site URL.

## 3. Resend — send auth emails via the API (Send Email Hook)

All auth emails are sent by the **`send-auth-email`** edge function through the
Resend **API**, from `support@getvision.uk`. Templates are Vision-branded in code
(`supabase/functions/send-auth-email/index.ts`) — nothing to edit in the
dashboard, and every link points at our `/auth/confirm` route.

**a. In Resend:**
1. Add + verify the domain **getvision.uk** — add the SPF/DKIM/DMARC DNS records
   Resend shows, at your registrar. Wait for **Verified**.
2. Create an **API key** (`re_…`).

**b. Enable the hook** — Dashboard → **Authentication → Hooks → Send Email Hook**:
- Enable it, type **HTTPS**, pointing at the deployed function
  `https://<project-ref>.functions.supabase.co/send-auth-email`.
- Copy the **hook secret** it generates (`v1,whsec_…`).

**c. Set secrets + deploy the function.** Put both values in
`supabase/functions/.env` (gitignored):

```ini
RESEND_API_KEY="re_xxxxxxxx"
SEND_EMAIL_HOOK_SECRET="v1,whsec_xxxxxxxx"
```

```bash
npx supabase secrets set --env-file supabase/functions/.env
npx supabase functions deploy send-auth-email --no-verify-jwt
```

> Local dev: `config.toml` already enables this hook against the local functions
> runtime — run `npx supabase functions serve` and put the same two values in a
> local `.env` so emails send while developing.

## 5. Create two test users (one per tenant)

We don't self-provision yet, so create test logins by hand.

**a. Create the auth users** — Dashboard → **Authentication → Users → Add user**
(tick *Auto Confirm*):
- `owner@vision.test` — pick a password
- `owner@bsw.test` — pick a password

**b. Link each to a company + role.** Copy each new user's UUID from the Users
list, then run in the SQL Editor (company UUIDs are from `seed.sql`):

```sql
insert into public.users (id, company_id, email, first_name, last_name, role) values
  ('<vision-user-uuid>', '00000000-0000-0000-0000-000000000001', 'owner@vision.test', 'Vision', 'Owner', 'company_admin'),
  ('<bsw-user-uuid>',    '00000000-0000-0000-0000-000000000002', 'owner@bsw.test',    'BSW',    'Owner', 'company_admin');
```

The access-token hook reads `public.users.company_id`, so **this row must exist**
before the JWT will carry a tenant. (No row → the user is signed in but sees
nothing — which is the safe default.)

## 6. Try it

```bash
npm run dev
```

- Visit any page → redirected to `/login`.
- Sign in as `owner@vision.test` → the "/" card shows the Vision company via an
  RLS-scoped read. Sign out, sign in as `owner@bsw.test` → shows BSW instead.
- **Forgot password?** → enter the email → the reset link (from Resend) lands on
  `/reset/update` to set a new password.

## Deploying to Vercel (production)

The Next.js CRM deploys to **Vercel**. The `send-auth-email` function stays on
**Supabase** (Auth must be able to call it) — two hosting homes, by design.

When you deploy, point everything at the real domain or reset links will email a
broken `localhost` URL:

1. **Vercel → Environment Variables:** add `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and set `NEXT_PUBLIC_SITE_URL` to the
   production URL (not localhost).
2. **Supabase → Auth → URL Configuration → Site URL:** set to the production URL.
3. **Redirect allow-list:** add `https://<prod-domain>/**`.

(Tenant *websites* built in the app deploy to their own per-tenant Vercel projects
via the Vercel API — separate from this CRM deployment. See AGENTS.md.)

## What's deferred (pre-launch)

- Self-serve **free-trial** signup (creates company + owner, `plan='trial'`)
- Company-admin **invite** flow with `seat_limit` enforcement (`inviteUserByEmail`)
- **Stripe** per-seat billing

See AGENTS.md § "Auth, onboarding & platform email" for the decisions behind this.
