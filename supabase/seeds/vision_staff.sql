-- ============================================================================
-- Vision CRM — demo STAFF for the Vision tenant (diary columns)
-- ============================================================================
-- Paste into the Supabase dashboard → SQL Editor → Run. NOT a migration: this
-- is demo data for one tenant, not schema, so it stays out of the migration
-- chain every tenant replays.
--
-- Safe to RE-RUN: fixed ids + `on conflict (id) do nothing`, so a second pass
-- changes nothing and never duplicates a person.
--
-- It only INSERTS — any staff already added through the app are untouched, and
-- no other tenant is written to.
--
-- These are the four trades from design screen 07 (two installers, two
-- surveyors). They appear as columns on the diary's day AND week views
-- (getDiaryStaff returns every ACTIVE staff member, ordered role then surname)
-- but NOT in the Sales manager / Salesperson pickers, which filter to the
-- sales role — so the customer and lead records are unaffected.
-- ============================================================================

begin;

with target as (
  -- The Vision tenant, however it was created: the seeded id, the slug, or the
  -- name. One row either way.
  select id
  from public.companies
  where id = '00000000-0000-0000-0000-000000000001'
     or slug = 'vision'
     or lower(name) = 'vision'
  order by (id = '00000000-0000-0000-0000-000000000001') desc
  limit 1
)
insert into public.staff_members
  (id, company_id, first_name, last_name, role, roles, email, phone, active)
select v.id, t.id, v.first_name, v.last_name, v.role, array[v.role], v.email, v.phone, true
from target t
cross join (values
  ('20000000-0000-0000-0000-0000000000a1'::uuid, 'Dave',  'Nolan',    'installer', 'dave.nolan@getvision.uk',      '07700 900311'),
  ('20000000-0000-0000-0000-0000000000a2'::uuid, 'Ryan',  'Cope',     'installer', 'ryan.cope@getvision.uk',       '07700 900312'),
  ('20000000-0000-0000-0000-0000000000a3'::uuid, 'Gary',  'Whitmore', 'surveyor',  'gary.whitmore@getvision.uk',   '07700 900313'),
  ('20000000-0000-0000-0000-0000000000a4'::uuid, 'Aaron', 'Blake',    'surveyor',  'aaron.blake@getvision.uk',     '07700 900314')
) as v (id, first_name, last_name, role, email, phone)
on conflict (id) do nothing;

commit;
