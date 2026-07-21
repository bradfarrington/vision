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
  -- Customer type
  ('customer_type', 'Residential', 1), ('customer_type', 'Commercial', 2),
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
  ('marketing_source', 'Other', 11),
  -- Contact role (who a linked contact is to the account)
  ('contact_role', 'Main contact', 1), ('contact_role', 'Homeowner', 2),
  ('contact_role', 'Partner', 3), ('contact_role', 'Spouse', 4),
  ('contact_role', 'Parent', 5), ('contact_role', 'Son', 6),
  ('contact_role', 'Daughter', 7), ('contact_role', 'Tenant', 8),
  ('contact_role', 'Landlord', 9), ('contact_role', 'Letting agent', 10),
  ('contact_role', 'Site contact', 11), ('contact_role', 'Accounts / billing', 12),
  ('contact_role', 'Project manager', 13), ('contact_role', 'Other', 14),
  -- Consent captured by (how marketing consent was obtained)
  ('consent_by', 'Web form', 1), ('consent_by', 'Phone call', 2),
  ('consent_by', 'In person', 3), ('consent_by', 'Email', 4),
  ('consent_by', 'Signed form', 5), ('consent_by', 'Verbal', 6),
  ('consent_by', 'Imported', 7),
  -- Additional-info dropdowns
  ('preferred_contact_time', 'Morning', 1), ('preferred_contact_time', 'Afternoon', 2),
  ('preferred_contact_time', 'Evening', 3), ('preferred_contact_time', 'Anytime', 4),
  ('preferred_contact_time', 'Weekends only', 5),
  ('heard_about_us', 'Referral', 1), ('heard_about_us', 'Website', 2),
  ('heard_about_us', 'Facebook', 3), ('heard_about_us', 'Google', 4),
  ('heard_about_us', 'Recommendation', 5), ('heard_about_us', 'Repeat customer', 6),
  ('heard_about_us', 'Other', 7)
) as d(list_key, label, ord)
on conflict (company_id, list_key, label) do nothing;
