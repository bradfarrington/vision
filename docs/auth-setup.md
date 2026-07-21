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

## 3. Resend — send auth emails from support@getvision.uk

**In Resend:**
1. Add the domain **getvision.uk**.
2. Add the DNS records Resend shows (SPF/DKIM, and DMARC) at your domain
   registrar. Wait for **Verified**.
3. Create an **API key** (used as the SMTP password below).

**In Supabase** → **Authentication → Emails → SMTP Settings** → enable custom SMTP:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | *(your Resend API key)* |
| Sender email | `support@getvision.uk` |
| Sender name | `Vision` |

> Until custom SMTP is on, Supabase's shared dev mailer works but is
> rate-limited (a few/hour) and generic. Fine for testing, not for real users.

## 4. Point the reset email at our handler

Dashboard → **Authentication → Emails → Templates → Reset Password**. Set the
link to use the token-hash format our `/auth/confirm` route expects:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset/update
```

(Optionally re-brand the template copy to Vision.)

## 5. Create two test users (one per tenant)

We don't self-provision yet, so create test logins by hand.

**a. Create the auth users** — Dashboard → **Authentication → Users → Add user**
(tick *Auto Confirm*):
- `owner@vision.test` — pick a password
- `owner@bsw.test` — pick a password

**b. Link each to a company + role.** This resolves each user's ID *by email*
automatically (no UUID copy-pasting) — edit the emails + company IDs and run in
the SQL Editor. Get company IDs from `select id, slug from public.companies;`.

```sql
insert into public.users (id, company_id, email, first_name, last_name, role)
select u.id, c.company_id, u.email, c.first_name, c.last_name, 'company_admin'
from auth.users u
join (values
  ('owner@vision.test', '<vision-company-id>'::uuid, 'Vision', 'Owner'),
  ('owner@bsw.test',    '<bsw-company-id>'::uuid,    'BSW',    'Owner')
) as c(email, company_id, first_name, last_name) on c.email = u.email
on conflict (id) do update
  set company_id = excluded.company_id,
      first_name = excluded.first_name,
      last_name  = excluded.last_name,
      role       = excluded.role;
```

If it reports **0 rows**, the auth user for that email doesn't exist yet — create
it in step (a) first. `on conflict` makes the query safe to re-run.

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

## What's deferred (pre-launch)

- Self-serve **free-trial** signup (creates company + owner, `plan='trial'`)
- Company-admin **invite** flow with `seat_limit` enforcement (`inviteUserByEmail`)
- **Stripe** per-seat billing

See AGENTS.md § "Auth, onboarding & platform email" for the decisions behind this.
