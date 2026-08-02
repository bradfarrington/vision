-- ============================================================================
-- ONE appointment table — fold fitting_appointments into public.appointments
-- ============================================================================
-- The CRM had two appointment tables that never met:
--
--   public.appointments          sales-side. lead_id, customer_id, one
--                                `assigned_to` text, `duration` in minutes,
--                                `date` timestamptz + `time` text. Written by
--                                the New Lead wizard, read by the lead record.
--
--   public.fitting_appointments  install-side. contract_id, assigned_staff_ids
--                                text[], duration_days AND duration_hours, a
--                                TEXT date, provisional/confirmed/locked/
--                                completed, travel_time. Read by the dashboard's
--                                "today's diary" — and NOTHING wrote it.
--
-- So an appointment booked in the wizard never appeared on the dashboard. They
-- are the same concept — a person, somewhere, at a time — split by which screen
-- happened to need it, exactly like the installation_*/fitting_* addresses that
-- 20260723092000 merged. The diary (screen 07) puts surveys and installations on
-- ONE timeline with staff as rows, so it cannot be built on two tables.
--
-- Nothing FKs to fitting_appointments; it appears only in the bulk RLS list. RLS
-- is already enabled on public.appointments with the tenant-isolation policy, so
-- nothing here touches policies.
--
-- ⚠ DESTRUCTIVE and NOT re-runnable: it drops a table and replaces the
--   date/time pair. Take a backup first if the data matters.
-- ============================================================================

-- ---- One time model --------------------------------------------------------
-- `date timestamptz` + `time text` cannot be ordered or overlap-tested, and a
-- diary does both constantly ("who is free between 9 and 11?"). One instant,
-- plus a duration in MINUTES as the single unit — 1.5 days is 720, so the
-- days/hours pair that could disagree with itself is gone.
alter table public.appointments
  add column if not exists starts_at      timestamptz,
  add column if not exists contract_id    uuid references public.contracts (id),
  add column if not exists work_type      text,
  add column if not exists description    text,
  add column if not exists staff_ids      uuid[]  default '{}',
  add column if not exists staff_names    text[]  default '{}',
  add column if not exists travel_minutes integer,
  add column if not exists confirmed_at   timestamptz,
  add column if not exists confirmed_by   text,
  add column if not exists confirmed_method text,
  add column if not exists completed_at   timestamptz,
  add column if not exists locked         boolean default false;

-- Backfill starts_at from the existing date + time text. `time` was free text,
-- so only a well-formed HH:MM is trusted; anything else keeps the date's own
-- time-of-day rather than silently landing the job at midnight.
update public.appointments
set starts_at = case
      when time ~ '^[0-2]?[0-9]:[0-5][0-9]' then date::date + (substring(time from '^[0-2]?[0-9]:[0-5][0-9]'))::time
      else date
    end
where starts_at is null;

alter table public.appointments alter column starts_at set not null;

-- `date` is NOT NULL and is dropped at the END of this migration — but it still
-- exists while the fold below runs, and the fold writes starts_at rather than
-- date. Relax the constraint first, or every folded row trips over a column
-- that is on its way out.
alter table public.appointments alter column date drop not null;

-- `status` becomes the one lifecycle column: provisional | confirmed | done |
-- cancelled. The old default was 'scheduled'.
update public.appointments set status = 'confirmed' where status = 'scheduled' or status is null;
alter table public.appointments alter column status set default 'confirmed';

-- ---- Fold the fitting appointments across ----------------------------------
-- duration_days wins over duration_hours where both are set (a multi-day fit is
-- booked in days); 1 day = 8 working hours = 480 minutes.
insert into public.appointments (
  company_id, lead_id, contract_id, customer_id,
  title, type, work_type, description, notes,
  starts_at, duration, staff_names, travel_minutes,
  status, confirmed_method, confirmed_by, completed_at, locked
)
select
  f.company_id,
  f.lead_id,
  f.contract_id,
  -- fitting_appointments has no customer_id of its own; take it from whichever
  -- parent it hangs off so the row still reads from the customer record.
  coalesce(c.customer_id, l.customer_id),
  coalesce(nullif(btrim(f.description), ''), 'Fitting'),
  coalesce(nullif(btrim(f.work_type), ''), 'fitting'),
  f.work_type,
  f.description,
  f.comments,
  case
    when f.date is null then now()
    when f.time ~ '^[0-2]?[0-9]:[0-5][0-9]'
      then f.date::date + (substring(f.time from '^[0-2]?[0-9]:[0-5][0-9]'))::time
    else f.date::date + time '08:00'
  end,
  case
    when coalesce(f.duration_days, 0) > 0 then round(f.duration_days * 480)::int
    when coalesce(f.duration_hours, 0) > 0 then round(f.duration_hours * 60)::int
    else 480
  end,
  coalesce(f.assigned_staff_names, '{}'),
  -- travel_time was free text ("40 min", "1 hr"); keep only a leading number of
  -- minutes and drop anything unparseable rather than guessing.
  nullif(substring(f.travel_time from '^[0-9]+'), '')::int,
  case
    when f.completed then 'done'
    when f.provisional then 'provisional'
    when f.confirmed then 'confirmed'
    else 'provisional'
  end,
  f.confirmed_method,
  f.confirmed_by,
  case when f.completed and f.completed_date ~ '^\d{4}-\d{2}-\d{2}' then f.completed_date::timestamptz end,
  coalesce(f.locked, false)
from public.fitting_appointments f
left join public.contracts c on c.id = f.contract_id
left join public.leads     l on l.id = f.lead_id;

-- assigned_staff_ids was text[], not a real FK to staff_members — cast across
-- only the entries that are genuinely uuids, so a legacy free-text name can't
-- fail the whole migration.
update public.appointments a
set staff_ids = (
  select coalesce(array_agg(s::uuid), '{}')
  from public.fitting_appointments f2, unnest(coalesce(f2.assigned_staff_ids, '{}')) s
  where f2.contract_id is not distinct from a.contract_id
    and f2.lead_id is not distinct from a.lead_id
    and s ~ '^[0-9a-fA-F-]{36}$'
)
where a.contract_id is not null;

drop table public.fitting_appointments;

-- ---- Retire the split date/time --------------------------------------------
-- Kept until the fold above has read them, then dropped: starts_at is the one
-- source of truth and a stale second copy is how the two would drift.
alter table public.appointments drop column if exists date;
alter table public.appointments drop column if exists time;

-- ---- Indexes ---------------------------------------------------------------
-- The diary's day/week/month views are all range scans over starts_at, and the
-- per-staff filter is an array containment test.
create index if not exists appointments_company_starts_idx on public.appointments (company_id, starts_at);
create index if not exists appointments_staff_ids_idx      on public.appointments using gin (staff_ids);
create index if not exists appointments_lead_idx           on public.appointments (lead_id);
create index if not exists appointments_contract_idx       on public.appointments (contract_id);
create index if not exists appointments_customer_idx       on public.appointments (customer_id);
