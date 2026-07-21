-- ============================================================================
-- Vision CRM — seed data (runs as postgres on `supabase db reset`, bypasses RLS)
-- ============================================================================
-- Two tenants so we can prove isolation: log in as a BSW user and confirm the
-- Vision rows below are invisible. Fixed UUIDs so you can point a test user's
-- public.users.company_id at one of them.
--
--   Vision (demo)          00000000-0000-0000-0000-000000000001  accent #2f7de1
--   Bradley Scott Windows  00000000-0000-0000-0000-000000000002  accent #e5040a
--
-- Vision is the rich demo tenant (Phase 4 screens read best against it); BSW is
-- intentionally sparse so the isolation contrast is obvious.
-- Lead `status` values map to the pipeline stages in src/lib/leads.ts:
--   new · contacted · survey_booked · quoted · won · lost
-- ============================================================================

insert into public.companies (id, name, slug, brand_color_1, brand_color_2, active) values
  ('00000000-0000-0000-0000-000000000001', 'Vision',                'vision', '#2f7de1', '#1f56a3', true),
  ('00000000-0000-0000-0000-000000000002', 'Bradley Scott Windows', 'bsw',    '#e5040a', '#b8030a', true);

-- ============================================================================
-- Vision customers (Tamworth / Staffordshire flavour, matching the designs)
-- ============================================================================
insert into public.customers
  (id, company_id, customer_type, title, first_name, last_name, email, phone, mobile, home_telephone,
   house_number, street, town, county, postcode, what_3_words, property_type, notes) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'residential', 'Mrs', 'Margaret', 'Ellison', 'm.ellison@btinternet.com', '07812 445902', '07812 445902', '01827 55213', '14', 'Ashby Road', 'Tamworth', 'Staffordshire', 'B79 8AJ', '///plot.gains.slower', 'Detached', 'Repeat customer — windows done in 2024, came back for the front door. Prefers afternoon calls. Access via side gate; dog in the garden.'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'residential', 'Mr', 'David', 'Openshaw', 'openshaws@gmail.com', '07903 118264', '07903 118264', null, '3', 'Cathedral Close', 'Lichfield', 'Staffordshire', 'WS13 7LD', null, 'Semi-detached', 'Interested in a garden room next year.'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'residential', 'Mr', 'Raj', 'Patel', 'raj.patel74@outlook.com', '07456 220981', '07456 220981', null, '22', 'Streetly Lane', 'Sutton Coldfield', 'West Midlands', 'B74 4TU', null, 'Detached', null),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'residential', 'Mr', 'Trevor', 'Bickley', 't.bickley@sky.com', '01827 260114', null, '01827 260114', '8', 'Drayton Lane', 'Fazeley', 'Staffordshire', 'B78 3TX', null, 'Bungalow', null),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'residential', 'Ms', 'Janet', 'Holloway', 'janholloway@icloud.com', '07981 002337', '07981 002337', null, '41', 'Comberford Road', 'Tamworth', 'Staffordshire', 'B79 9PB', null, 'Terraced', null),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'residential', 'Mr', 'Colin', 'Wrightson', 'wrightsons5@gmail.com', '07700 900442', '07700 900442', null, '5', 'Meadow Rise', 'Atherstone', 'Warwickshire', 'CV9 1DN', null, 'Detached', null),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'residential', 'Mrs', 'Sandra', 'Doyle', 'sandra.doyle1@gmail.com', '07522 719604', '07522 719604', null, '17', 'Bonehill Road', 'Tamworth', 'Staffordshire', 'B78 3HP', null, 'Semi-detached', null),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'residential', 'Mr', 'Alan', 'Foster', 'alanfoster92@yahoo.co.uk', '01827 313559', null, '01827 313559', '92', 'Upper Gungate', 'Tamworth', 'Staffordshire', 'B79 8AT', null, 'Terraced', null),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'commercial', null, 'Nadia', 'Rahman', 'nadia.rahman@hotmail.co.uk', '07845 663210', '07845 663210', null, '6', 'Wigginton Lodge Mews', 'Tamworth', 'Staffordshire', 'B79 8RN', null, 'Detached', null);

-- ============================================================================
-- Vision leads — spread across every pipeline stage for a realistic funnel
-- ============================================================================
insert into public.leads
  (id, company_id, lead_number, customer_id, lead_date, quote_date, follow_up_date, result_date,
   source, sub_source, product_type, product_interest_1, product_interest_2, window_count,
   salesman, salesperson_type, status, result, priority, gross_value, estimated_value, notes,
   same_as_customer_address) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 2417, '10000000-0000-0000-0000-000000000001',
   now() - interval '14 days', now() - interval '8 days', now() + interval '2 days', null,
   'Referral', 'Neighbour', 'uPVC Casement Windows', 'uPVC Casement', 'Composite Door', 8,
   'Karen Blake', 'internal', 'quoted', 'alive', 'high', 8940.00, 8940.00,
   'Neighbour at no. 12 (referrer) had windows done May — same spec wanted.', true),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 2431, '10000000-0000-0000-0000-000000000002',
   now() - interval '9 days', null, now() + interval '1 day', null,
   'Website', null, 'Conservatory', 'Conservatory', null, null,
   'James Holloway', 'internal', 'survey_booked', 'alive', 'medium', null, 14200.00,
   'Wants a survey before committing — access is tight at the rear.', true),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 2438, '10000000-0000-0000-0000-000000000003',
   now() - interval '3 days', now() - interval '1 day', now() + interval '4 days', null,
   'Checkatrade', null, 'Composite Front Door', 'Composite Door', 'Sidelight', null,
   'Karen Blake', 'internal', 'quoted', 'alive', 'medium', 14320.00, 14320.00, null, true),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 2440, '10000000-0000-0000-0000-000000000004',
   now() - interval '1 day', null, null, null,
   'Showroom', null, 'Windows', 'uPVC Casement', null, 5,
   'Priya Shah', 'internal', 'new', 'alive', 'low', null, 4200.00, null, true),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 2402, '10000000-0000-0000-0000-000000000005',
   now() - interval '30 days', now() - interval '24 days', null, now() - interval '10 days',
   'Referral', null, 'Windows', 'uPVC Casement', 'Doors', 6,
   'Karen Blake', 'internal', 'won', 'won', 'medium', 6480.00, 6480.00, null, true),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 2388, '10000000-0000-0000-0000-000000000006',
   now() - interval '40 days', now() - interval '33 days', now() + interval '1 day', null,
   'Facebook', null, 'Roofline', 'Fascias & Soffits', null, null,
   'James Holloway', 'internal', 'contacted', 'alive', 'low', null, 3100.00, null, true),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 2375, '10000000-0000-0000-0000-000000000007',
   now() - interval '55 days', now() - interval '50 days', null, now() - interval '30 days',
   'Website', null, 'Conservatory roof repair', 'Roofing', null, null,
   'Priya Shah', 'internal', 'lost', 'lost', 'low', 2120.00, 2120.00, 'Lost on price.', true),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 2444, '10000000-0000-0000-0000-000000000008',
   now(), null, null, null,
   'Repeat customer', null, 'Repairs', 'Repairs', null, null,
   'Karen Blake', 'internal', 'new', 'alive', 'medium', null, 480.00, null, true),
  ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 2409, '10000000-0000-0000-0000-000000000009',
   now() - interval '22 days', now() - interval '16 days', null, now() - interval '5 days',
   'Referral', null, 'Bi-fold Doors', 'Bi-fold Doors', null, null,
   'Karen Blake', 'internal', 'won', 'won', 'high', 12480.00, 12480.00, null, true);

-- Notes on the flagship lead (L-2417)
insert into public.lead_notes (company_id, lead_id, content, created_at) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Access via side gate only — dog in the garden.', now() - interval '11 days'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Prefers afternoon calls.', now() - interval '18 days'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Neighbour at no. 12 (referrer) had windows done May — same spec wanted.', now() - interval '19 days');

-- Checklist on L-2417
insert into public.lead_checklist_items
  (company_id, lead_id, sort_order, action_name, status, due_date, priority, completed_at, completed_by_name) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'Book survey',    'completed', now() - interval '6 days', 'medium', now() - interval '5 days', 'Michelle C.'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 2, 'Send quote',     'completed', now() - interval '8 days', 'medium', now() - interval '8 days', 'Karen B.'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 3, 'Follow-up call', 'pending',   now() + interval '2 days', 'high', null, null);

-- Activity timeline on L-2417
insert into public.activities (company_id, type, description, lead_id, customer_id, created_at) values
  ('00000000-0000-0000-0000-000000000001', 'email_out', 'Quote sent with survey summary and guarantee details.', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '8 days'),
  ('00000000-0000-0000-0000-000000000001', 'call_in',   'Asked whether trickle vents are included on all eight windows — confirmed on four per survey.', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '6 days'),
  ('00000000-0000-0000-0000-000000000001', 'email_in',  'Thank you for the quote. Could you tell me roughly when you could fit them if we go ahead?', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '2 days');

-- Today's diary (dates are text YYYY-MM-DD; use today so the dashboard populates)
insert into public.fitting_appointments (company_id, lead_id, work_type, description, date, time, confirmed) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'survey',          'Survey · L-2431 Openshaw · WS13', to_char(now(), 'YYYY-MM-DD'), '09:30', true),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'initial_fitting', 'Install · Holloway · Windows ×6',   to_char(now(), 'YYYY-MM-DD'), '08:30', true),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'service',         'Service · Doyle · misted unit',      to_char(now(), 'YYYY-MM-DD'), '13:00', false);

-- ============================================================================
-- BSW — intentionally sparse (isolation contrast)
-- ============================================================================
insert into public.customers (id, company_id, first_name, last_name, email, phone, town, postcode) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Priya',  'Shah',   'priya@example.com',  '02222 000001', 'Bolton',  'BL1 2CD'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Derek',  'Owens',  'derek@example.com',  '02222 000002', 'Wigan',   'WN1 3EF');

insert into public.leads (company_id, lead_number, customer_id, source, product_type, status, gross_value) values
  ('00000000-0000-0000-0000-000000000002', 1, '20000000-0000-0000-0000-000000000001', 'Facebook', 'Conservatory', 'new',    9600.00),
  ('00000000-0000-0000-0000-000000000002', 2, '20000000-0000-0000-0000-000000000002', 'Google',   'Roofing',      'quoted', 3200.00);

-- Seed the reference counters so the next lead in each tenant continues cleanly.
insert into public.tenant_counters (company_id, name, value) values
  ('00000000-0000-0000-0000-000000000001', 'lead', 2444),
  ('00000000-0000-0000-0000-000000000002', 'lead', 2);
