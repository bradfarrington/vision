-- ============================================================================
-- Lead lookup defaults — tenant-editable pick-lists for the lead record
-- ============================================================================
-- The lead detail captured Source / Sub-Source / Product type / Quote type /
-- Payment method / Result reason as FREE TEXT, which is exactly the mixed-data
-- problem the lookup pattern exists to prevent (see AGENTS.md § Lookup
-- dropdowns). This seeds a default set for every existing tenant, same pattern
-- as 20260721097000_lookup_defaults.sql — per-tenant rows, so one tenant's
-- additions never leak into another's list.
--
-- `lead_source` is deliberately its OWN list, separate from the customer's
-- `marketing_source`: they share a vocabulary today but answer different
-- questions ("how did we get this customer" vs "how did this enquiry arrive"),
-- and a tenant must be able to curate them apart.
-- ============================================================================

insert into public.tenant_options (company_id, list_key, label, sort_order)
select c.id, d.list_key, d.label, d.ord
from public.companies c
cross join (values
  -- Lead source (how the enquiry arrived)
  ('lead_source', 'Referral', 1), ('lead_source', 'Website', 2),
  ('lead_source', 'Checkatrade', 3), ('lead_source', 'Showroom', 4),
  ('lead_source', 'Facebook', 5), ('lead_source', 'Google', 6),
  ('lead_source', 'Repeat customer', 7), ('lead_source', 'Leaflet drop', 8),
  ('lead_source', 'Local paper', 9), ('lead_source', 'Radio', 10),
  ('lead_source', 'Trade counter', 11), ('lead_source', 'Canvasser', 12),
  ('lead_source', 'Exhibition', 13), ('lead_source', 'Other', 14),

  -- Lead sub-source (the detail under the source)
  ('lead_sub_source', 'Existing customer', 1), ('lead_sub_source', 'Friend or family', 2),
  ('lead_sub_source', 'Neighbour', 3), ('lead_sub_source', 'Organic search', 4),
  ('lead_sub_source', 'Paid search', 5), ('lead_sub_source', 'Social post', 6),
  ('lead_sub_source', 'Review site', 7), ('lead_sub_source', 'Walk-in', 8),
  ('lead_sub_source', 'Phone enquiry', 9), ('lead_sub_source', 'Email enquiry', 10),
  ('lead_sub_source', 'Web form', 11), ('lead_sub_source', 'Other', 12),

  -- Product type / interest (drives product_type + product_interest_1/2)
  ('product_type', 'Windows', 1), ('product_type', 'Doors', 2),
  ('product_type', 'Composite door', 3), ('product_type', 'Bi-fold doors', 4),
  ('product_type', 'Patio doors', 5), ('product_type', 'French doors', 6),
  ('product_type', 'Conservatory', 7), ('product_type', 'Orangery', 8),
  ('product_type', 'Roofline / fascias', 9), ('product_type', 'Soffits & guttering', 10),
  ('product_type', 'Cladding', 11), ('product_type', 'Porch', 12),
  ('product_type', 'Garage door', 13), ('product_type', 'Roof lantern', 14),
  ('product_type', 'Glass only', 15), ('product_type', 'Repair / service', 16),
  ('product_type', 'Other', 17),

  -- Quote type
  ('quote_type', 'Supply & fit', 1), ('quote_type', 'Supply only', 2),
  ('quote_type', 'Fit only', 3), ('quote_type', 'Budget estimate', 4),
  ('quote_type', 'Firm quotation', 5), ('quote_type', 'Insurance work', 6),

  -- Payment method
  ('payment_method', 'Bank transfer', 1), ('payment_method', 'Card', 2),
  ('payment_method', 'Cash', 3), ('payment_method', 'Cheque', 4),
  ('payment_method', 'Finance', 5), ('payment_method', 'Direct debit', 6),
  ('payment_method', 'Insurance backed', 7), ('payment_method', 'Other', 8),

  -- Result reason (why a lead was won or lost)
  ('result_reason', 'Price too high', 1), ('result_reason', 'Went elsewhere', 2),
  ('result_reason', 'Postponed', 3), ('result_reason', 'No longer needed', 4),
  ('result_reason', 'Could not contact', 5), ('result_reason', 'Out of area', 6),
  ('result_reason', 'Work not offered', 7), ('result_reason', 'Timescale too long', 8),
  ('result_reason', 'Best price', 9), ('result_reason', 'Recommendation', 10),
  ('result_reason', 'Existing customer', 11), ('result_reason', 'Product range', 12),
  ('result_reason', 'Other', 13),

  -- Salesperson type (employed rep vs subcontract canvasser etc.)
  ('salesperson_type', 'Employed', 1), ('salesperson_type', 'Self-employed', 2),
  ('salesperson_type', 'Canvasser', 3), ('salesperson_type', 'Telesales', 4),
  ('salesperson_type', 'Owner', 5), ('salesperson_type', 'Other', 6)
) as d(list_key, label, ord)
on conflict (company_id, list_key, label) do nothing;
