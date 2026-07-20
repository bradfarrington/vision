-- ============================================================================
-- SMS Credits — consolidated schema migration
--
-- Creates everything the SMS send + GoCardless top-up + webhook flow need.
-- Run this once in the Supabase SQL editor (or as a new numbered migration
-- in your project's supabase/migrations/ directory).
--
-- Tables created (all under public):
--   org_settings              — single-row config: SMS toggle, sender name,
--                               credits balance, low-credit flag
--                               (CREATE IF NOT EXISTS — see notes below)
--   sms_templates             — reusable templates with {{var}} substitution
--   sms_log                   — audit trail: every send (success + failure)
--   sms_credit_purchases      — completed GoCardless purchase records
--
-- HOST PROJECT MUST ALREADY HAVE:
--   profiles (id uuid pk, is_active boolean) — for send-sms staff auth gate
--
-- NOTE on org_settings co-existence:
--   If you've already installed the email-builder skill (or another skill
--   that creates org_settings), the `create table if not exists` is a no-op
--   and the SMS columns are added separately via `alter table add column`.
--   Safe to run in any order.
-- ============================================================================

-- ─── helpers: updated_at trigger ────────────────────────────────────────
create or replace function public.touch_sms_credits_updated_at()
returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

-- ─── org_settings ───────────────────────────────────────────────────────
-- Create if it doesn't exist (this skill is the only one defining it), OR
-- co-exist with an existing definition from another skill.
create table if not exists public.org_settings (
  id          uuid primary key default gen_random_uuid(),
  org_name    text not null default 'My Organisation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Add SMS-specific columns (idempotent — won't error if they already exist).
alter table public.org_settings
  add column if not exists sms_enabled              boolean not null default false,
  add column if not exists sms_sender_name          text,
  add column if not exists sms_credits_balance      integer not null default 0,
  add column if not exists sms_low_credit_notified  boolean not null default false;

-- Seed exactly one row so the settings UI always has something to edit.
insert into public.org_settings (org_name)
select 'My Organisation'
where not exists (select 1 from public.org_settings);

-- ─── sms_templates ──────────────────────────────────────────────────────
create table if not exists public.sms_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  system_key  text unique,
  body        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Seed: edit these to match your app's transactional SMS flows, or remove.
insert into public.sms_templates (name, system_key, body) values
  ('Generic Notification', 'generic_notification',
     'Hi {{person_name}}, this is a notification from {{org_name}}.'),
  ('Appointment Reminder', 'appointment_reminder',
     'Hi {{person_name}}, reminder: appointment with {{worker_name}} at {{org_name}} on {{date}} at {{time}}.')
on conflict (system_key) do nothing;

-- ─── sms_log ────────────────────────────────────────────────────────────
-- case_id / person_id are intentionally plain uuid (no FK) so this migration
-- runs standalone even if cases/people tables aren't in the schema. Add FKs
-- in a later migration once those tables are confirmed present.
create table if not exists public.sms_log (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid,
  person_id       uuid,
  recipient_phone text not null,
  message_body    text not null,
  twilio_sid      text,
  status          text not null,
  credits_used    integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists idx_sms_log_created_at on public.sms_log(created_at desc);
create index if not exists idx_sms_log_person     on public.sms_log(person_id) where person_id is not null;
create index if not exists idx_sms_log_case       on public.sms_log(case_id)   where case_id   is not null;

-- ─── sms_credit_purchases ───────────────────────────────────────────────
create table if not exists public.sms_credit_purchases (
  id                      uuid primary key default gen_random_uuid(),
  credits_purchased       integer not null,
  amount_paid_pence       integer not null,
  gocardless_payment_id   text unique,
  status                  text not null default 'completed',
  created_at              timestamptz not null default now()
);

create index if not exists idx_sms_purchases_created_at on public.sms_credit_purchases(created_at desc);

-- ─── updated_at triggers ────────────────────────────────────────────────
drop trigger if exists trg_org_settings_sms_updated_at on public.org_settings;
create trigger trg_org_settings_sms_updated_at before update on public.org_settings
  for each row execute procedure public.touch_sms_credits_updated_at();

drop trigger if exists trg_sms_templates_updated_at on public.sms_templates;
create trigger trg_sms_templates_updated_at before update on public.sms_templates
  for each row execute procedure public.touch_sms_credits_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────
alter table public.org_settings         enable row level security;
alter table public.sms_templates        enable row level security;
alter table public.sms_log              enable row level security;
alter table public.sms_credit_purchases enable row level security;

-- Policy template: any authenticated user can read/write. Tighten if your
-- app distinguishes admin / member roles (e.g. require profiles.is_active).
do $$
declare t text;
begin
  for t in select unnest(array['org_settings', 'sms_templates', 'sms_log', 'sms_credit_purchases']) loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=format('Auth can read %s', t)) then
      execute format('create policy "Auth can read %1$s" on public.%1$s for select to authenticated using (true)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=format('Auth can insert %s', t)) then
      execute format('create policy "Auth can insert %1$s" on public.%1$s for insert to authenticated with check (true)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=format('Auth can update %s', t)) then
      execute format('create policy "Auth can update %1$s" on public.%1$s for update to authenticated using (true) with check (true)', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname=format('Auth can delete %s', t)) then
      execute format('create policy "Auth can delete %1$s" on public.%1$s for delete to authenticated using (true)', t);
    end if;
  end loop;
end $$;
