-- ============================================================================
-- Email Builder — consolidated schema migration
--
-- Creates everything the email builder + Resend send pipeline + unsubscribe
-- flow depend on. Run this once in the Supabase SQL editor (or as a new
-- numbered migration in your project's supabase/migrations/ directory).
--
-- Tables created (all under public):
--   comms_campaigns           — one row per email campaign
--   comms_lists               — mailing lists
--   comms_list_members        — list ↔ people join
--   comms_email_templates     — reusable saved designs
--   comms_campaign_recipients — per-recipient send log + Resend events
--   system_email_templates    — transactional templates keyed by string
--   email_opt_outs            — unsubscribe audit trail
--   org_settings              — organisation-level settings (From address, etc.)
--
-- Storage bucket created:
--   email-images              — public bucket for inline images
--
-- HOST PROJECT MUST ALREADY HAVE:
--   profiles (id uuid pk, full_name text, email text, role text)
--   people   (id uuid pk, full_name, email, phone, ref_code, address,
--             region, preferred_name, marketing_opt_out boolean)
--   notifications (user_id, type, title, body, link)
--
-- If your project uses different table names, search/replace before running.
-- ============================================================================

-- ─── helpers: updated_at trigger ─────────────────────────────────────────
create or replace function public.touch_email_builder_updated_at()
returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

-- ─── org_settings ────────────────────────────────────────────────────────
create table if not exists public.org_settings (
  id                      uuid primary key default gen_random_uuid(),
  org_name                text not null default 'My Organisation',
  campaign_from_email     text,         -- e.g. "hello@example.com"
  campaign_from_name      text,         -- e.g. "My Organisation"
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Seed exactly one row so the settings UI always has something to edit.
insert into public.org_settings (org_name)
select 'My Organisation'
where not exists (select 1 from public.org_settings);

-- ─── comms_lists ─────────────────────────────────────────────────────────
create table if not exists public.comms_lists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  count       integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── comms_campaigns ─────────────────────────────────────────────────────
create table if not exists public.comms_campaigns (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  type              text not null default 'email',     -- email | sms (sms ignored here)
  status            text not null default 'draft',     -- draft | sending | sent | failed
  subject           text,
  preview_text      text,
  body_blocks       jsonb not null default '[]'::jsonb,
  body_settings     jsonb not null default '{}'::jsonb,
  body_html         text,
  list_id           uuid references public.comms_lists(id) on delete set null,
  send_from_user_id uuid references public.profiles(id) on delete set null,
  recipient_count   integer,
  sent_at           timestamptz,
  sent_by           uuid references public.profiles(id) on delete set null,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_comms_campaigns_status on public.comms_campaigns(status);
create index if not exists idx_comms_campaigns_list   on public.comms_campaigns(list_id);

-- ─── comms_list_members ──────────────────────────────────────────────────
create table if not exists public.comms_list_members (
  list_id   uuid not null references public.comms_lists(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  added_at  timestamptz not null default now(),
  added_by  uuid references public.profiles(id) on delete set null,
  primary key (list_id, person_id)
);

create index if not exists idx_comms_list_members_person on public.comms_list_members(person_id);

-- ─── comms_email_templates ───────────────────────────────────────────────
create table if not exists public.comms_email_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  subject       text,
  preview_text  text,
  body_blocks   jsonb not null default '[]'::jsonb,
  body_settings jsonb not null default '{}'::jsonb,
  body_html     text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ─── comms_campaign_recipients ───────────────────────────────────────────
create table if not exists public.comms_campaign_recipients (
  id                    uuid primary key default gen_random_uuid(),
  campaign_id           uuid not null references public.comms_campaigns(id) on delete cascade,
  person_id             uuid references public.people(id) on delete set null,
  email                 text not null,
  status                text not null default 'queued', -- queued | sent | failed | skipped
  error                 text,
  sent_at               timestamptz,
  provider_message_id   text,
  opened_at             timestamptz,
  clicked_at            timestamptz,
  bounced_at            timestamptz,
  complained_at         timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists idx_comms_recipients_campaign     on public.comms_campaign_recipients(campaign_id);
create index if not exists idx_comms_recipients_person       on public.comms_campaign_recipients(person_id);
create index if not exists idx_comms_recipients_status       on public.comms_campaign_recipients(status);
create index if not exists idx_comms_recipients_provider_msg on public.comms_campaign_recipients(provider_message_id)
  where provider_message_id is not null;

-- ─── system_email_templates ──────────────────────────────────────────────
create table if not exists public.system_email_templates (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  name          text not null,
  description   text,
  subject       text,
  preview_text  text,
  body_blocks   jsonb not null default '[]'::jsonb,
  body_settings jsonb not null default '{}'::jsonb,
  body_html     text,
  is_active     boolean not null default true,
  updated_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Seed: add rows here for each transactional email kind your app sends.
-- body_blocks is left empty — the builder fills in defaults from
-- src/features/email-marketing/builder/systemTemplates.ts on first open
-- and persists them on first save.
--
-- Edit / add to this list per project — these are the GamLEARN defaults.
insert into public.system_email_templates (key, name, description, subject, preview_text) values
  ('staff_invite', 'Staff invitation', 'Sent when an admin invites a new team member.',
     'You''re invited to {{org_name}}', 'Accept your invite to get started.'),
  ('password_reset', 'Password reset', 'Sent when a user requests a password reset.',
     'Reset your {{org_name}} password', 'Click the link inside to choose a new password.')
on conflict (key) do nothing;

-- ─── people: opt-out flag ────────────────────────────────────────────────
-- These columns are added to your existing people table. Adjust if your
-- people table is called something else.
alter table public.people
  add column if not exists marketing_opt_out         boolean not null default false,
  add column if not exists marketing_opt_out_at      timestamptz,
  add column if not exists marketing_opt_out_source  text;

create index if not exists idx_people_marketing_opt_out
  on public.people(marketing_opt_out) where marketing_opt_out = true;

-- ─── email_opt_outs: audit trail ─────────────────────────────────────────
create table if not exists public.email_opt_outs (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid references public.people(id) on delete set null,
  email           text not null,
  scope           text not null default 'all',   -- 'all' | 'list'
  list_id         uuid references public.comms_lists(id) on delete set null,
  campaign_id     uuid references public.comms_campaigns(id) on delete set null,
  reason          text,
  user_agent      text,
  ip_address      text,
  unsubscribed_at timestamptz not null default now()
);

create index if not exists idx_email_opt_outs_person on public.email_opt_outs(person_id);
create index if not exists idx_email_opt_outs_email  on public.email_opt_outs(lower(email));

-- ─── updated_at triggers ─────────────────────────────────────────────────
drop trigger if exists trg_org_settings_updated_at on public.org_settings;
create trigger trg_org_settings_updated_at before update on public.org_settings
  for each row execute procedure public.touch_email_builder_updated_at();

drop trigger if exists trg_comms_campaigns_updated_at on public.comms_campaigns;
create trigger trg_comms_campaigns_updated_at before update on public.comms_campaigns
  for each row execute procedure public.touch_email_builder_updated_at();

drop trigger if exists trg_comms_lists_updated_at on public.comms_lists;
create trigger trg_comms_lists_updated_at before update on public.comms_lists
  for each row execute procedure public.touch_email_builder_updated_at();

drop trigger if exists trg_comms_email_templates_updated_at on public.comms_email_templates;
create trigger trg_comms_email_templates_updated_at before update on public.comms_email_templates
  for each row execute procedure public.touch_email_builder_updated_at();

drop trigger if exists trg_system_email_templates_updated_at on public.system_email_templates;
create trigger trg_system_email_templates_updated_at before update on public.system_email_templates
  for each row execute procedure public.touch_email_builder_updated_at();

-- ─── list member-count maintenance ───────────────────────────────────────
create or replace function public.refresh_comms_list_count()
returns trigger as $$
declare target_list_id uuid;
begin
  target_list_id := coalesce(new.list_id, old.list_id);
  update public.comms_lists
     set count = (select count(*) from public.comms_list_members where list_id = target_list_id),
         updated_at = now()
   where id = target_list_id;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_refresh_comms_list_count on public.comms_list_members;
create trigger trg_refresh_comms_list_count
  after insert or delete on public.comms_list_members
  for each row execute procedure public.refresh_comms_list_count();

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table public.org_settings              enable row level security;
alter table public.comms_campaigns           enable row level security;
alter table public.comms_lists               enable row level security;
alter table public.comms_list_members        enable row level security;
alter table public.comms_email_templates     enable row level security;
alter table public.comms_campaign_recipients enable row level security;
alter table public.system_email_templates    enable row level security;
alter table public.email_opt_outs            enable row level security;

-- Policy template: any authenticated user can read/write. Tighten this if
-- your app distinguishes admin / member roles.
do $$
declare t text;
begin
  for t in select unnest(array[
    'org_settings', 'comms_campaigns', 'comms_lists', 'comms_list_members',
    'comms_email_templates', 'comms_campaign_recipients', 'system_email_templates'
  ]) loop
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

-- email_opt_outs: read for auth, writes only via service-role edge function
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='email_opt_outs' and policyname='Auth can read email_opt_outs') then
    create policy "Auth can read email_opt_outs" on public.email_opt_outs for select to authenticated using (true);
  end if;
end $$;

-- ─── Storage bucket for inline images ────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('email-images', 'email-images', true, 10485760)  -- 10 MB
on conflict (id) do update set public = true, file_size_limit = 10485760;

-- Even on public buckets, supabase-js does an internal SELECT/HEAD check
-- on upserts that goes through RLS — so we need explicit policies.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth read email-images') then
    create policy "Auth read email-images" on storage.objects for select to authenticated
      using (bucket_id = 'email-images');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth upload email-images') then
    create policy "Auth upload email-images" on storage.objects for insert to authenticated
      with check (bucket_id = 'email-images');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth update email-images') then
    create policy "Auth update email-images" on storage.objects for update to authenticated
      using (bucket_id = 'email-images') with check (bucket_id = 'email-images');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Auth delete email-images') then
    create policy "Auth delete email-images" on storage.objects for delete to authenticated
      using (bucket_id = 'email-images');
  end if;
end $$;
