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

**a. In Resend:** verify the domain **getvision.uk** (add the SPF/DKIM/DMARC DNS
records at your registrar; wait for **Verified**) and create an **API key** (`re_…`).

**b. Enable the hook** — Dashboard → **Authentication → Hooks → Send Email Hook**:
enable it, choose **HTTPS**, point it at the deployed function
`https://<project-ref>.functions.supabase.co/send-auth-email`, and copy the
**hook secret** it shows (`v1,whsec_…`).

**c. Set the function's secrets** — Dashboard → **Edge Functions → Secrets**:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | your Resend key (`re_…`) |
| `SEND_EMAIL_HOOK_SECRET` | the hook secret (`v1,whsec_…`) |
| `APP_URL` | base URL of the CRM app — `http://localhost:3000` (dev) / your Vercel URL (prod) |

`APP_URL` is what makes the email link point at your app's `/auth/confirm` page
rather than the Supabase API. Without it, links break with "No API key found".

**d. Deploy the function** (redeploy whenever the function code changes):

```bash
npx supabase functions deploy send-auth-email --no-verify-jwt
```

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

### Troubleshooting

- **`email rate limit exceeded`** (server log, no email sent, nothing in the
  function logs): Supabase Auth throttled the request *before* calling the hook.
  Raise it at **Authentication → Rate Limits → "Rate limit for sending emails"**
  (safe now that sends go through your own Resend). There's also a ~60s cooldown
  per address.
- **Link shows `{"message":"No API key found in request"}`**: the email link is
  pointing at the Supabase API instead of the app — set the `APP_URL` function
  secret (§3c) and redeploy.

## Running the stack locally

The cloud project configures the Send Email Hook in the dashboard (§3), but
`supabase/config.toml` also declares it for local dev — and an HTTP hook must be
signed, so the config requires a secret. The CLI resolves `env(...)` from your
**shell environment**, so export it before any `supabase` command (`start`,
`status`, `db reset`, `functions serve`) or config parsing fails with
*"Missing required field … auth.hook.send_email.secrets"*:

```bash
# any well-formed value works locally; format is v1,whsec_<base64>, ≥32 chars
export SEND_EMAIL_HOOK_SECRET="v1,whsec_$(openssl rand -base64 32)"
npx supabase start
```

### Verify tenant isolation

The RLS foundation ships with an isolation test. After the stack is up:

```bash
npx supabase db reset                       # applies migrations + loads seed.sql
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
     -f supabase/tests/tenant_isolation.sql  # must print "ALL ISOLATION CHECKS PASSED."
```

It logs in as a BSW user and a Vision user (via `request.jwt.claims`) and proves
neither can read or write the other's rows, even with an unscoped query. Any leak
raises and the script exits non-zero.

## What's deferred (pre-launch)

- Self-serve **free-trial** signup (creates company + owner, `plan='trial'`)
- Company-admin **invite** flow with `seat_limit` enforcement (`inviteUserByEmail`)
- **Stripe** per-seat billing

See AGENTS.md § "Auth, onboarding & platform email" for the decisions behind this.
