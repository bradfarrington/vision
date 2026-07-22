-- ============================================================================
-- Per-user UI layout preferences
-- ============================================================================
-- Where a user's own arrangement of a customisable surface is stored — the first
-- being the customer-record OVERVIEW bento (which cards sit in which column, in
-- what order). Layout is PER USER, not per tenant: a salesperson and a fitter
-- want different things on screen, and one admin's arrangement must never become
-- everyone's (same decision already recorded for the list-screen column picker in
-- AGENTS.md § Lists & columns — this table is where that lands too).
--
-- Deliberately GENERIC so the future `/leads` and `/customers` saved column
-- layouts reuse it rather than each growing their own table:
--   * `layout_key` names the surface ('customer_overview', later 'leads_columns'…)
--   * `layout` is opaque jsonb owned by that surface's client code. For the
--     overview it is { "columns": [ ["identity","flags"], ["contact",…], … ] } —
--     an ordered list of card ids per column. The DB does not interpret it.
--
-- One row per (user, surface): unique (user_id, layout_key), upserted on save.
--
-- company_id is carried for tenant scoping / defence-in-depth even though the row
-- is already pinned to one user — every table in `public` follows the tenant
-- pattern, and it lets a future tenant-default layout live in the same shape.
-- ============================================================================

create table if not exists public.user_ui_layouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  company_id  uuid not null references public.companies (id),
  layout_key  text not null,                 -- names the surface, e.g. 'customer_overview'
  layout      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, layout_key)
);

create index if not exists user_ui_layouts_user_key_idx
  on public.user_ui_layouts (user_id, layout_key);

alter table public.user_ui_layouts enable row level security;

-- A user reaches ONLY their own rows, and only within their own tenant. This is
-- what keeps Company A's five users' layouts private from one another.
create policy "user_ui_layouts: own rows"
  on public.user_ui_layouts for all to authenticated
  using ( user_id = auth.uid() and company_id = public.current_company_id() )
  with check ( user_id = auth.uid() and company_id = public.current_company_id() );
