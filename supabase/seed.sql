-- ============================================================================
-- Vision CRM — seed data (runs as postgres on `supabase db reset`, bypasses RLS)
-- ============================================================================
-- Two tenants so we can prove isolation: log in as a BSW user and confirm the
-- Vision rows below are invisible. Fixed UUIDs so you can point a test user's
-- public.users.company_id at one of them.
--
--   Vision (demo)          00000000-0000-0000-0000-000000000001  accent #2f7de1
--   Bradley Scott Windows  00000000-0000-0000-0000-000000000002  accent #e5040a
-- ============================================================================

insert into public.companies (id, name, slug, brand_color_1, brand_color_2, active) values
  ('00000000-0000-0000-0000-000000000001', 'Vision',                'vision', '#2f7de1', '#1f56a3', true),
  ('00000000-0000-0000-0000-000000000002', 'Bradley Scott Windows', 'bsw',    '#e5040a', '#b8030a', true);

-- --- Vision customers -------------------------------------------------------
insert into public.customers (id, company_id, first_name, last_name, email, phone, town, postcode) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Alice',  'Turner', 'alice@example.com',  '01111 000001', 'Leeds',   'LS1 4AB'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Mark',   'Ellis',  'mark@example.com',   '01111 000002', 'York',    'YO1 7HH');

-- --- BSW customers ----------------------------------------------------------
insert into public.customers (id, company_id, first_name, last_name, email, phone, town, postcode) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Priya',  'Shah',   'priya@example.com',  '02222 000001', 'Bolton',  'BL1 2CD'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Derek',  'Owens',  'derek@example.com',  '02222 000002', 'Wigan',   'WN1 3EF');

-- --- Vision leads -----------------------------------------------------------
insert into public.leads (company_id, lead_number, customer_id, source, product_type, status, gross_value) values
  ('00000000-0000-0000-0000-000000000001', 1001, '10000000-0000-0000-0000-000000000001', 'Website',  'Windows', 'new',   4250.00),
  ('00000000-0000-0000-0000-000000000001', 1002, '10000000-0000-0000-0000-000000000002', 'Referral', 'Doors',   'quoted', 1890.00);

-- --- BSW leads --------------------------------------------------------------
insert into public.leads (company_id, lead_number, customer_id, source, product_type, status, gross_value) values
  ('00000000-0000-0000-0000-000000000002', 1, '20000000-0000-0000-0000-000000000001', 'Facebook', 'Conservatory', 'new',   9600.00),
  ('00000000-0000-0000-0000-000000000002', 2, '20000000-0000-0000-0000-000000000002', 'Google',   'Roofing',      'quoted', 3200.00);

-- Seed the reference counters so the next lead in each tenant continues cleanly.
insert into public.tenant_counters (company_id, name, value) values
  ('00000000-0000-0000-0000-000000000001', 'lead', 1002),
  ('00000000-0000-0000-0000-000000000002', 'lead', 2);
