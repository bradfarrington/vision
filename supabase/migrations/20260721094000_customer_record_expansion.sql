-- ============================================================================
-- Customer record expansion — full contact record per the legacy CRM
-- ============================================================================
-- Adds the customer fields the office needs (identity, flags, billing/account,
-- marketing/consent, directions) plus related tables (multiple contacts,
-- account references, tenant-defined custom fields). Reuses what already exists:
--   * documents            — already customer-scoped (adds a `category`)
--   * lead_notes           — already carries customer_id (customer comment log)
--   * activities           — already carries customer_id (activity timeline)
-- Every new table follows the standard tenant shape: company_id NOT NULL + FK,
-- indexed, RLS enabled, one FOR ALL policy keyed on current_company_id().
-- ============================================================================

-- ---- customers: new columns ------------------------------------------------
alter table public.customers
  -- identity / overview
  add column if not exists customer_number      integer,
  add column if not exists title_2               text,
  add column if not exists first_name_2          text,
  add column if not exists last_name_2           text,
  add column if not exists salutation            text,
  add column if not exists business_address      boolean default false,
  add column if not exists office_ref_1          text,
  add column if not exists office_ref_2          text,
  add column if not exists flash_note            text,
  add column if not exists customer_moved_away   boolean default false,
  add column if not exists no_whatsapp           boolean default false,
  add column if not exists fax_alt_no            text,
  add column if not exists directions            text,
  add column if not exists created_by            uuid references public.users (id),
  -- billing / account
  add column if not exists invoice_name          text,
  add column if not exists invoice_address_1     text,
  add column if not exists invoice_address_2     text,
  add column if not exists invoice_address_3     text,
  add column if not exists invoice_address_4     text,
  add column if not exists invoice_postcode      text,
  add column if not exists invoice_tel           text,
  add column if not exists payment_terms         text,
  add column if not exists settlement_disc_terms text,
  add column if not exists settlement_disc_pct   numeric(5, 2),
  add column if not exists calculate_vat_on_reduced   boolean default false,
  add column if not exists account_created_in_package boolean default false,
  add column if not exists default_account_reference  text,
  add column if not exists sales_manager         text,
  add column if not exists vat_no                text,
  add column if not exists cis_reg               text,
  -- marketing / consent (GDPR)
  add column if not exists marketing_code        text,
  add column if not exists marketing_notes       text,
  add column if not exists no_postal_marketing   boolean default false,
  add column if not exists no_email_marketing    boolean default false,
  add column if not exists no_sms_marketing      boolean default false,
  add column if not exists no_telephone_marketing boolean default false,
  add column if not exists do_not_contact        boolean default false,
  add column if not exists bad_payer             boolean default false,
  add column if not exists opt_in_date           date,
  add column if not exists opted_in_by           text,
  add column if not exists opt_in_document       text,
  add column if not exists phone_opt_in          boolean default false,
  add column if not exists letter_opt_in         boolean default false,
  add column if not exists email_opt_in          boolean default false,
  add column if not exists sms_opt_in            boolean default false;

-- Per-tenant human customer number (parallels leads.lead_number).
create unique index if not exists customers_company_number_idx
  on public.customers (company_id, customer_number) where customer_number is not null;

-- ---- documents: reuse existing table, add a category ------------------------
alter table public.documents add column if not exists category text;

-- ---- customer_contacts (multiple people per account) -----------------------
create table if not exists public.customer_contacts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  customer_id   uuid not null references public.customers (id) on delete cascade,
  name          text not null,
  email         text,
  phone         text,
  position_role text,
  is_default    boolean default false,
  no_whatsapp   boolean default false,
  created_at    timestamptz not null default now()
);
create index if not exists customer_contacts_customer_idx on public.customer_contacts (customer_id);
create index if not exists customer_contacts_company_idx  on public.customer_contacts (company_id);
alter table public.customer_contacts enable row level security;
create policy "customer_contacts: tenant isolation"
  on public.customer_contacts for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );

-- ---- customer_account_references -------------------------------------------
create table if not exists public.customer_account_references (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id),
  customer_id uuid not null references public.customers (id) on delete cascade,
  reference   text,
  acc_name    text,
  created_at  timestamptz not null default now()
);
create index if not exists customer_account_refs_customer_idx on public.customer_account_references (customer_id);
create index if not exists customer_account_refs_company_idx  on public.customer_account_references (company_id);
alter table public.customer_account_references enable row level security;
create policy "customer_account_references: tenant isolation"
  on public.customer_account_references for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );

-- ---- custom fields: tenant-defined questions, reusable on customer + lead ----
create table if not exists public.custom_field_definitions (
  id          integer generated by default as identity primary key,
  company_id  uuid not null references public.companies (id),
  entity      text not null default 'customer',   -- 'customer' | 'lead'
  question    text not null,
  data_type   text not null default 'text',        -- text | number | date | boolean | select
  options     text[],                              -- for data_type = 'select'
  required    boolean default false,
  sort_order  integer default 0,
  is_active   boolean default true,
  created_at  timestamptz not null default now()
);
create index if not exists custom_field_defs_company_idx on public.custom_field_definitions (company_id);
alter table public.custom_field_definitions enable row level security;
create policy "custom_field_definitions: tenant isolation"
  on public.custom_field_definitions for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );

create table if not exists public.custom_field_values (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id),
  definition_id integer not null references public.custom_field_definitions (id) on delete cascade,
  customer_id   uuid references public.customers (id) on delete cascade,
  lead_id       uuid references public.leads (id) on delete cascade,
  value         text,
  initials      text,
  updated_by    uuid references public.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists custom_field_values_customer_idx on public.custom_field_values (customer_id);
create index if not exists custom_field_values_lead_idx     on public.custom_field_values (lead_id);
create index if not exists custom_field_values_company_idx  on public.custom_field_values (company_id);
alter table public.custom_field_values enable row level security;
create policy "custom_field_values: tenant isolation"
  on public.custom_field_values for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );
