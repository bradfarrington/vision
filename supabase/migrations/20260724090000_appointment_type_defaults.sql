-- ============================================================================
-- Appointment type defaults — tenant-editable pick-list for lead appointments
-- ============================================================================
-- A lead can now carry one or more APPOINTMENTS (a sales call, a survey, a
-- measure-up…), booked from the New Lead wizard and stored in public.appointments
-- (which already exists, with lead_id/customer_id/type/date/time/…). In this
-- industry not everyone does a "survey" on a lead, so the appointment's TYPE is a
-- tenant-editable lookup rather than a fixed "survey", same pattern as the lead
-- lookups in 20260723090000 — per-tenant rows, so one tenant's additions never
-- leak into another's list. Safe to RE-RUN as tenants are added (on conflict do
-- nothing) until onboarding seeds lookups itself.
-- ============================================================================

insert into public.tenant_options (company_id, list_key, label, sort_order)
select c.id, d.list_key, d.label, d.ord
from public.companies c
cross join (values
  ('appointment_type', 'Sales call', 1),
  ('appointment_type', 'Survey', 2),
  ('appointment_type', 'Measure up', 3),
  ('appointment_type', 'Follow-up call', 4),
  ('appointment_type', 'Site visit', 5),
  ('appointment_type', 'Design consultation', 6),
  ('appointment_type', 'Remedial visit', 7),
  ('appointment_type', 'Other', 8)
) as d(list_key, label, ord)
on conflict (company_id, list_key, label) do nothing;
