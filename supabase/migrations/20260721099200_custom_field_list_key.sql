-- ============================================================================
-- Custom fields: dropdown fields point at a tenant_options list_key
-- ============================================================================
-- A select-type custom field renders the same tenant-editable dropdown as the
-- rest of the app by referencing a tenant_options list_key (options seeded in
-- 20260721097000). Also seeds the standard "Additional info" fields for every
-- tenant, so this config lives in a migration — not in per-tenant demo SQL.
-- ============================================================================

alter table public.custom_field_definitions add column if not exists list_key text;

-- Seed the standard additional-info fields for every existing tenant.
-- 'select' fields reference a seeded tenant_options list; free-text fields don't.
insert into public.custom_field_definitions (company_id, entity, question, data_type, list_key, sort_order)
select c.id, 'customer', v.question, v.data_type, v.list_key, v.ord
from public.companies c
cross join (values
  ('Preferred contact time', 'select', 'preferred_contact_time', 1),
  ('Gate / alarm code',      'text',   null,                     2),
  ('Heard about us via',     'select', 'heard_about_us',         3)
) as v(question, data_type, list_key, ord)
where not exists (
  select 1 from public.custom_field_definitions d
  where d.company_id = c.id and d.entity = 'customer' and d.question = v.question
);

-- Backfill any pre-existing standard fields (created before list_key existed)
-- so they render as the tenant-editable dropdown too.
update public.custom_field_definitions
set list_key = 'preferred_contact_time', data_type = 'select'
where entity = 'customer' and question = 'Preferred contact time';

update public.custom_field_definitions
set list_key = 'heard_about_us', data_type = 'select'
where entity = 'customer' and question = 'Heard about us via';

update public.custom_field_definitions
set data_type = 'text'
where entity = 'customer' and question = 'Gate / alarm code';
