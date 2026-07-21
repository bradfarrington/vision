-- ============================================================================
-- Vision CRM — company entitlements (billing / trial / seats)
-- ============================================================================
-- Added up front so self-serve trials, license-per-seat enforcement, and Stripe
-- billing are not a retrofit. See AGENTS.md § "Auth, onboarding & platform email".
--
--   plan                 which product tier the company is on
--   subscription_status  lifecycle: trialing -> active -> past_due -> canceled
--   trial_ends_at        when a free trial expires (null once converted)
--   seat_limit           max active users; invites are checked against this
--   stripe_customer_id / stripe_subscription_id  billing linkage (filled later)
-- ============================================================================

alter table public.companies
  add column plan                 text not null default 'trial',
  add column subscription_status  text not null default 'trialing',
  add column trial_ends_at        timestamptz,
  add column seat_limit           integer not null default 3,
  add column stripe_customer_id   text,
  add column stripe_subscription_id text;

-- Count of active (non-disabled) users in a company — the number an invite flow
-- compares against seat_limit before allowing a new seat. SECURITY DEFINER so it
-- can count within the tenant regardless of the caller's row visibility, but it
-- is scoped to the caller's own company via current_company_id().
create or replace function public.company_seats_used()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.users
  where company_id = public.current_company_id()
    and active = true
$$;

revoke execute on function public.company_seats_used() from anon, public;
grant   execute on function public.company_seats_used() to authenticated;

-- Seed tenants: give the two demo companies a sensible trial posture.
update public.companies set plan = 'internal', subscription_status = 'active', seat_limit = 25
  where slug in ('vision', 'bsw');
