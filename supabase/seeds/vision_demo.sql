-- ============================================================================
-- Vision CRM — remote-safe demo seed for the VISION tenant only
-- ============================================================================
-- Use this to load the Phase-4 demo data into an EXISTING (remote) database —
-- e.g. paste it into the Supabase dashboard → SQL Editor → Run.
--
-- Unlike supabase/seed.sql (which assumes a fresh `db reset`), this script is
-- idempotent and safe to re-run: it wipes the Vision tenant's own demo rows
-- first, then reinserts them. It ONLY touches company_id =
--   00000000-0000-0000-0000-000000000001  (the "Vision" demo tenant)
-- so Bradley Scott Windows and every other tenant are left completely alone.
-- It never touches companies or users, so your logins/theming are untouched.
--
-- Wrapped in a transaction: if anything fails, nothing is committed.
-- ============================================================================

begin;

-- Convenience: the Vision tenant id.
-- (inlined below as a literal so this runs anywhere, no \set needed)

-- ---- 1. Clear existing Vision demo rows, children first (FK-safe order) -----
-- Every tenant table carries company_id, so we can scope the wipe cleanly.
-- Deleting from a table that has no Vision rows is a harmless no-op.
delete from public.finance_payments      where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.fitting_appointments  where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.activities            where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.lead_checklist_items  where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.contract_checklist_items where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.lead_notes            where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.contract_notes        where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.contract_products     where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.delivery_lines        where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.commissions           where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.job_invoices          where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.finance_lines         where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.quotes                where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.contracts             where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.messages              where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.leads                 where company_id = '00000000-0000-0000-0000-000000000001';
delete from public.customers             where company_id = '00000000-0000-0000-0000-000000000001';

-- ---- 2. Vision customers ---------------------------------------------------
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

-- ---- 3. Vision leads (spread across every pipeline stage) -------------------
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

-- ---- 4. Notes / checklist / activity on the flagship lead (L-2417) ----------
insert into public.lead_notes (company_id, lead_id, content, created_at) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Access via side gate only — dog in the garden.', now() - interval '11 days'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Prefers afternoon calls.', now() - interval '18 days'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Neighbour at no. 12 (referrer) had windows done May — same spec wanted.', now() - interval '19 days');

insert into public.lead_checklist_items
  (company_id, lead_id, sort_order, action_name, status, due_date, priority, completed_at, completed_by_name) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'Book survey',    'completed', now() - interval '6 days', 'medium', now() - interval '5 days', 'Michelle C.'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 2, 'Send quote',     'completed', now() - interval '8 days', 'medium', now() - interval '8 days', 'Karen B.'),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 3, 'Follow-up call', 'pending',   now() + interval '2 days', 'high', null, null);

insert into public.activities (company_id, type, description, lead_id, customer_id, created_at) values
  ('00000000-0000-0000-0000-000000000001', 'email_out', 'Quote sent with survey summary and guarantee details.', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '8 days'),
  ('00000000-0000-0000-0000-000000000001', 'call_in',   'Asked whether trickle vents are included on all eight windows — confirmed on four per survey.', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '6 days'),
  ('00000000-0000-0000-0000-000000000001', 'email_in',  'Thank you for the quote. Could you tell me roughly when you could fit them if we go ahead?', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', now() - interval '2 days');

-- ---- 5. Today's diary (for the dashboard) ----------------------------------
insert into public.fitting_appointments (company_id, lead_id, work_type, description, date, time, confirmed) values
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'survey',          'Survey · L-2431 Openshaw · WS13', to_char(now(), 'YYYY-MM-DD'), '09:30', true),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005', 'initial_fitting', 'Install · Holloway · Windows ×6',   to_char(now(), 'YYYY-MM-DD'), '08:30', true),
  ('00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007', 'service',         'Service · Doyle · misted unit',      to_char(now(), 'YYYY-MM-DD'), '13:00', false);

-- ---- 6. Keep the per-tenant lead counter ahead of the seeded numbers -------
insert into public.tenant_counters (company_id, name, value) values
  ('00000000-0000-0000-0000-000000000001', 'lead', 2444)
on conflict (company_id, name) do update set value = greatest(public.tenant_counters.value, excluded.value);

commit;
