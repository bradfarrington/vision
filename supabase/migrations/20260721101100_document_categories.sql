-- ============================================================================
-- Default document categories (tenant-editable dropdown)
-- ============================================================================
-- Documents can be tagged with a category (Quote, Invoice, Survey, …). Like all
-- pick-lists, categories are tenant-editable `tenant_options` rows under the
-- `document_category` list_key, seeded with a sensible default set for EVERY
-- existing tenant. Tenants add their own from the dropdown without affecting
-- anyone else. New tenants get theirs seeded at onboarding (future phase).
--
-- Apply BY HAND in the Supabase SQL editor (per AGENTS.md).
-- ============================================================================

insert into public.tenant_options (company_id, list_key, label, sort_order)
select c.id, d.list_key, d.label, d.ord
from public.companies c
cross join (values
  ('document_category', 'Quote', 1),
  ('document_category', 'Contract', 2),
  ('document_category', 'Invoice', 3),
  ('document_category', 'Survey', 4),
  ('document_category', 'Plans & drawings', 5),
  ('document_category', 'Photo', 6),
  ('document_category', 'Certificate', 7),
  ('document_category', 'Correspondence', 8),
  ('document_category', 'Signed document', 9),
  ('document_category', 'Other', 10)
) as d(list_key, label, ord)
on conflict (company_id, list_key, label) do nothing;
