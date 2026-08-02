-- ============================================================================
-- Contracts — Phase 5a: stage model, stage dates, the quote link, and the
-- per-tenant reference uniqueness that leads has had since day one.
-- ============================================================================
-- RLS is already enabled on public.contracts with the tenant-isolation policy
-- (bulk-applied in 20260721090200_core_crm_full.sql), so nothing here touches
-- policies. This adds only what the contract record and board need.
-- ============================================================================

-- ---- Stage -----------------------------------------------------------------
-- The design's stepper (screen 05): Signed → Survey → Ordered → Delivery →
-- Installation → Complete. This is the SAME split leads already use: `stage` is
-- where the job has got to, and the existing `status` stays the alive/cancelled
-- axis — exactly as `leads.result` sits beside `leads.status`. Keeping them
-- apart is what lets a contract be "cancelled while at the Ordered stage"
-- without either fact overwriting the other.
alter table public.contracts
  add column if not exists stage text default 'signed';

-- Backfill: every existing contract has at least been signed.
update public.contracts set stage = 'signed' where stage is null;

-- ---- Stage dates -----------------------------------------------------------
-- One date per step of the stepper, so the record can show "Survey · 28 May"
-- rather than just a lit dot. `contract_date` is ALREADY the Signed date, so it
-- is not repeated here. Delivery is deliberately absent too: delivery_lines
-- carries its own per-line delivery_due_date, and a single contract-level
-- delivery date would immediately disagree with them once Phase 7 lands.
alter table public.contracts
  add column if not exists survey_date        timestamptz,
  add column if not exists order_date         timestamptz,
  add column if not exists install_start_date timestamptz,
  add column if not exists install_end_date   timestamptz,
  add column if not exists completed_date     timestamptz;

-- ---- The quote link --------------------------------------------------------
-- Nullable, and added NOW rather than with Phase 5b. Contracts ship first and
-- convert from the LEAD (contracts.lead_id is not null — that is the design's
-- "↩ Converted from L-2103"); quotes arrive after. Adding the column up front
-- means the agreed-quote link is a write, not a migration, when 5b lands —
-- the same reasoning as the entitlement columns in 20260721090300.
alter table public.contracts
  add column if not exists quote_id uuid references public.quotes (id);

-- ---- Per-tenant reference uniqueness ---------------------------------------
-- A real gap, not a new requirement: leads has had this since
-- 20260721090100_core_crm_slice.sql:155, contracts never got it. Without it
-- nothing stops two contracts in one tenant sharing a number, and a reference
-- that isn't unique is not an identity. Partial, because contract_number is
-- nullable and allocated by next_reference('contract') on conversion.
create unique index if not exists contracts_company_contract_number_idx
  on public.contracts (company_id, contract_number)
  where contract_number is not null;

-- ---- Board indexes ---------------------------------------------------------
-- The kanban runs one query per stage, so it reads (company_id, stage) on every
-- column load. customer_id backs the customer record's contracts digest.
create index if not exists contracts_company_stage_idx on public.contracts (company_id, stage);
create index if not exists contracts_customer_id_idx   on public.contracts (customer_id);
create index if not exists contracts_lead_id_idx       on public.contracts (lead_id);
create index if not exists contracts_quote_id_idx      on public.contracts (quote_id);
