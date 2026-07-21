-- ============================================================================
-- Vision CRM — Wave 1 vertical slice: customers + leads
-- ============================================================================
-- Proves the tenant-isolation pattern end-to-end on two real tables before we
-- fan it out to the rest (Wave 2). Every tenant table follows THIS shape:
--   * company_id uuid NOT NULL references companies(id), indexed
--   * RLS enabled
--   * one FOR ALL policy: row's company_id = current_company_id()
--     (USING for read/update/delete, WITH CHECK so writes can't set another tenant)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- customers
-- ----------------------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id),
  customer_type  text default 'residential',
  title          text,
  first_name     text not null,
  last_name      text not null,
  company_name   text,
  email          text,
  phone          text,
  home_telephone text,
  work_telephone text,
  mobile         text,
  mobile_2       text,
  house_name     text,
  house_number   text,
  street         text,
  locality       text,
  town           text,
  county         text,
  postcode       text,
  what_3_words   text,
  address        text,
  city           text,
  state          text,
  zip_code       text,
  property_type  text,
  notes          text,
  tt_customer_id text,
  created_at     timestamptz not null default now()
);
create index customers_company_id_idx on public.customers (company_id);

alter table public.customers enable row level security;

create policy "customers: tenant isolation"
  on public.customers for all to authenticated
  using      ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );

-- ----------------------------------------------------------------------------
-- leads  (doubles as quotes/contracts via status + contract_number)
-- ----------------------------------------------------------------------------
create table public.leads (
  id                              uuid primary key default gen_random_uuid(),
  company_id                      uuid not null references public.companies (id),
  lead_number                     integer default 0,
  contract_number                 integer,
  office_reference                text,
  office_reference_2              text,
  lead_date                       timestamptz default now(),
  contract_date                   timestamptz,
  customer_id                     uuid references public.customers (id),
  installation_house_name         text,
  installation_house_number       text,
  installation_street             text,
  installation_locality           text,
  installation_town               text,
  installation_county             text,
  installation_postcode           text,
  installation_what_3_words       text,
  same_as_customer_address        boolean default true,
  taken_by                        uuid references public.users (id),
  salesperson_type                text,
  salesman                        text,
  source                          text,
  sub_source                      text,
  product_type                    text,
  product_interest_1              text,
  product_interest_2              text,
  quote_date                      timestamptz,
  gross_value                     numeric(10, 2),
  result_date                     timestamptz,
  result                          text default 'alive',
  result_reason                   text,
  quote_type                      text,
  payment_method                  text,
  status                          text default 'new',
  priority                        text default 'medium',
  assigned_to                     uuid references public.users (id),
  estimated_value                 numeric(10, 2),
  window_count                    integer,
  window_types                    text[],
  notes                           text,
  created_at                      timestamptz not null default now(),
  follow_up_date                  timestamptz,
  supply_only                     boolean default false,
  delivery_method                 text,
  contract_type                   text,
  installation_manager            text,
  on_hold                         boolean default false,
  hold_reason                     text,
  hold_date_on                    timestamptz,
  hold_date_off                   timestamptz,
  contract_cancelled              boolean default false,
  cancel_reason                   text,
  cancel_date                     timestamptz,
  sales_area                      text,
  sales_director                  text,
  balance_reason                  text,
  old_balance_reason              text,
  invoice_same_as_customer        boolean default true,
  invoice_name                    text,
  invoice_house_name              text,
  invoice_house_number            text,
  invoice_street                  text,
  invoice_locality                text,
  invoice_town                    text,
  invoice_county                  text,
  invoice_postcode                text,
  fitting_same_as_customer        boolean default true,
  fitting_house_name              text,
  fitting_house_number            text,
  fitting_street                  text,
  fitting_locality                text,
  fitting_town                    text,
  fitting_county                  text,
  fitting_postcode                text,
  fitting_what_3_words            text,
  fitting_directions              text,
  send_letters_to_fitting         boolean default false,
  estimated_fitting_days          numeric(5, 1),
  installation_completed          text,
  signboard_left                  boolean default false,
  signboard_date                  text,
  guarantee_number                text,
  guarantee_date                  text,
  insurance_backed_guarantee_ref  text,
  tt_customer_id                  text,
  tt_sync_status                  text,
  tt_quote_id                     text,
  tt_quote_url                    text,
  tt_quote_reference              text,
  tt_quote_pdf_url                text,
  tt_quote_pdf_file_name          text,
  tt_last_sync_at                 timestamptz
);
create index leads_company_id_idx  on public.leads (company_id);
create index leads_customer_id_idx on public.leads (customer_id);
-- Per-tenant uniqueness for human reference numbers (see next_reference()).
create unique index leads_company_lead_number_idx
  on public.leads (company_id, lead_number) where lead_number is not null;

alter table public.leads enable row level security;

create policy "leads: tenant isolation"
  on public.leads for all to authenticated
  using      ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );
