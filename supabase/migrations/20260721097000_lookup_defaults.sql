-- ============================================================================
-- Standard lookup defaults for tenant-editable dropdowns
-- ============================================================================
-- Seeds tenant_options with a sensible default set for each lookup list, for
-- EVERY existing tenant. Options are per-tenant (company_id scoped), so tenants
-- can add their own without polluting anyone else's lists — but everyone starts
-- from the same standard set. New tenants get theirs seeded at onboarding.
--   list_key values: title · property_type · payment_terms · settlement_terms ·
--                    marketing_source
-- ============================================================================

insert into public.tenant_options (company_id, list_key, label, sort_order)
select c.id, d.list_key, d.label, d.ord
from public.companies c
cross join (values
  -- Title
  ('title', 'Mr', 1), ('title', 'Mrs', 2), ('title', 'Miss', 3), ('title', 'Ms', 4),
  ('title', 'Mx', 5), ('title', 'Dr', 6), ('title', 'Prof', 7), ('title', 'Rev', 8),
  ('title', 'Sir', 9), ('title', 'Dame', 10),
  -- Property type
  ('property_type', 'Detached', 1), ('property_type', 'Semi-detached', 2),
  ('property_type', 'Terraced', 3), ('property_type', 'End terrace', 4),
  ('property_type', 'Bungalow', 5), ('property_type', 'Flat', 6),
  ('property_type', 'Maisonette', 7), ('property_type', 'Cottage', 8),
  ('property_type', 'Commercial', 9), ('property_type', 'Other', 10),
  -- Payment terms
  ('payment_terms', 'On receipt', 1), ('payment_terms', '7 days', 2),
  ('payment_terms', '14 days', 3), ('payment_terms', '30 days', 4),
  ('payment_terms', '60 days', 5), ('payment_terms', '90 days', 6),
  -- Settlement discount terms
  ('settlement_terms', 'None', 1), ('settlement_terms', '7 days', 2),
  ('settlement_terms', '14 days', 3), ('settlement_terms', '30 days', 4),
  -- Marketing source
  ('marketing_source', 'Referral', 1), ('marketing_source', 'Website', 2),
  ('marketing_source', 'Checkatrade', 3), ('marketing_source', 'Showroom', 4),
  ('marketing_source', 'Facebook', 5), ('marketing_source', 'Google', 6),
  ('marketing_source', 'Repeat customer', 7), ('marketing_source', 'Leaflet drop', 8),
  ('marketing_source', 'Local paper', 9), ('marketing_source', 'Radio', 10),
  ('marketing_source', 'Other', 11)
) as d(list_key, label, ord)
on conflict (company_id, list_key, label) do nothing;
