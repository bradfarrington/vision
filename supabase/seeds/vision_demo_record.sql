-- ============================================================================
-- Vision demo — populate the expanded customer record (run AFTER the
-- 20260721094000 migration). Paste into the Supabase SQL Editor and Run.
-- Scoped to the Vision tenant (…0001) and its demo customer Margaret Ellison
-- (customer 10000000-…0001). Idempotent: clears its own demo child rows first.
-- ============================================================================

begin;

-- ---- Backfill per-tenant customer numbers (0001, 0002, …) ------------------
with numbered as (
  select id, row_number() over (order by created_at, id) as rn
  from public.customers
  where company_id = '00000000-0000-0000-0000-000000000001'
)
update public.customers c
set customer_number = n.rn
from numbered n
where c.id = n.id;

-- Keep the 'customer' counter ahead so the next new customer continues cleanly.
insert into public.tenant_counters (company_id, name, value)
values (
  '00000000-0000-0000-0000-000000000001', 'customer',
  (select count(*) from public.customers where company_id = '00000000-0000-0000-0000-000000000001')
)
on conflict (company_id, name) do update set value = greatest(public.tenant_counters.value, excluded.value);

-- ---- Enrich Margaret Ellison with the new-field values ---------------------
update public.customers set
  salutation                 = 'Mrs Ellison',
  business_address           = false,
  flash_note                 = 'Access via side gate only — dog in the garden. Prefers afternoon calls.',
  directions                 = 'Turn off Ashby Road at the church, second house on the left after the postbox. Parking on the driveway; side gate is on the right.',
  invoice_name               = 'Mrs M Ellison',
  invoice_address_1          = '14 Ashby Road',
  invoice_address_2          = 'Tamworth',
  invoice_address_3          = 'Staffordshire',
  invoice_postcode           = 'B79 8AJ',
  invoice_tel                = '01827 55213',
  payment_terms              = '30 days',
  settlement_disc_terms      = '7 days',
  settlement_disc_pct        = 2.5,
  account_created_in_package = true,
  default_account_reference  = 'ELLIS001',
  sales_manager              = 'Karen Blake',
  vat_no                     = null,
  marketing_code             = 'REF-NEIGHBOUR',
  marketing_notes            = 'Referred by neighbour at no. 12. Happy to be contacted about future projects.',
  no_sms_marketing           = true,
  phone_opt_in               = true,
  letter_opt_in              = true,
  email_opt_in               = true,
  opt_in_date                = '2024-03-12',
  opted_in_by                = 'Michelle C.',
  bad_payer                  = false
where id = '10000000-0000-0000-0000-000000000001';

-- ---- Linked contacts (clear + reinsert) ------------------------------------
delete from public.customer_contacts where company_id = '00000000-0000-0000-0000-000000000001';
insert into public.customer_contacts (company_id, customer_id, name, email, phone, position_role, is_default, no_whatsapp) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Margaret Ellison', 'm.ellison@btinternet.com', '07812 445902', 'Homeowner (main contact)', true,  false),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Geoff Ellison',    'g.ellison@btinternet.com', '07812 445988', 'Husband — decisions',      false, false),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Sophie Ellison',   'sophie.e@gmail.com',       '07700 900123', 'Daughter — on-site access', false, true);

-- ---- Account references (ledger accounts) ----------------------------------
delete from public.customer_account_references where company_id = '00000000-0000-0000-0000-000000000001';
insert into public.customer_account_references (company_id, customer_id, reference, acc_name) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ELLIS001', 'Ellison — Windows 2024'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'ELLIS002', 'Ellison — Front door 2026');

-- ---- Custom field VALUES for Margaret (the fields themselves are seeded for
-- ---- every tenant by migration 20260721099200) -----------------------------
delete from public.custom_field_values where company_id = '00000000-0000-0000-0000-000000000001';
insert into public.custom_field_values (company_id, definition_id, customer_id, value, initials)
select '00000000-0000-0000-0000-000000000001', d.id, '10000000-0000-0000-0000-000000000001', v.value, 'MC'
from public.custom_field_definitions d
join (values
  ('Preferred contact time', 'Afternoon'),
  ('Gate / alarm code',      'Side gate latch — no code'),
  ('Heard about us via',     'Referral')
) as v(question, value) on v.question = d.question
where d.company_id = '00000000-0000-0000-0000-000000000001';

-- ---- A document ------------------------------------------------------------
delete from public.documents where company_id = '00000000-0000-0000-0000-000000000001' and customer_id = '10000000-0000-0000-0000-000000000001';
insert into public.documents (company_id, customer_id, name, file_name, file_type, file_size, file_url, category, context) values
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Signed order — windows', 'order-2024.pdf', 'application/pdf', 214000, 'https://example.com/order-2024.pdf', 'Contract', 'customer');

commit;
