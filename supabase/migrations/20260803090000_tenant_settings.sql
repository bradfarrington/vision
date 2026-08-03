-- ============================================================================
-- Per-tenant display settings — starting with the diary's legend colours.
-- ============================================================================
-- A tenant can now recolour the diary's job types. That needs somewhere a
-- NORMAL user of the tenant can write, and `companies` is not it: its only
-- write policy is platform-admin, deliberately (it carries the plan, the seat
-- limit and the brand). Widening that to let staff recolour a legend would
-- hand them the billing columns too.
--
-- So: a small table of its own, one row per tenant, RLS-isolated like every
-- other tenant table. `settings` is an opaque jsonb the app owns the shape of
-- — which also makes this the obvious home for the per-company WORKING HOURS
-- that lib/diary.ts is waiting for, and whatever settings come after.
--
-- Safe to RE-RUN: everything is `if not exists` / `drop policy if exists`.
-- ============================================================================

create table if not exists public.tenant_settings (
  company_id uuid primary key references public.companies (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.tenant_settings enable row level security;

-- Tenant isolation, the same shape as every other tenant table: the row must
-- belong to the caller's company, read and write alike.
drop policy if exists "tenant_settings: own tenant" on public.tenant_settings;
create policy "tenant_settings: own tenant"
  on public.tenant_settings for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );
