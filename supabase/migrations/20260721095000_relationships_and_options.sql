-- ============================================================================
-- Customer relationships + tenant-customisable option lists
-- ============================================================================
-- tenant_options: per-tenant editable pick-lists (the "search + add new"
-- dropdown). Keyed by list_key so one table serves relationship types, and
-- later lead sources, marketing codes, etc.
-- customer_relationships: links one customer record to another (family,
-- neighbour, referrer…) so their own history/contracts are one click away.
-- ============================================================================

create table if not exists public.tenant_options (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  list_key   text not null,                 -- e.g. 'relationship_type'
  label      text not null,
  sort_order integer default 0,
  is_active  boolean default true,
  created_at timestamptz not null default now(),
  unique (company_id, list_key, label)
);
create index if not exists tenant_options_company_list_idx on public.tenant_options (company_id, list_key);
alter table public.tenant_options enable row level security;
create policy "tenant_options: tenant isolation"
  on public.tenant_options for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );

create table if not exists public.customer_relationships (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies (id),
  customer_id         uuid not null references public.customers (id) on delete cascade,
  related_customer_id uuid not null references public.customers (id) on delete cascade,
  relationship_type   text,
  notes               text,
  created_at          timestamptz not null default now()
);
create index if not exists customer_relationships_customer_idx on public.customer_relationships (customer_id);
create index if not exists customer_relationships_related_idx  on public.customer_relationships (related_customer_id);
create index if not exists customer_relationships_company_idx  on public.customer_relationships (company_id);
alter table public.customer_relationships enable row level security;
create policy "customer_relationships: tenant isolation"
  on public.customer_relationships for all to authenticated
  using ( company_id = public.current_company_id() )
  with check ( company_id = public.current_company_id() );

-- Seed a sensible starter set of relationship types for every existing tenant
-- (they can add / remove their own from the dropdown). New tenants get theirs
-- seeded at onboarding (later phase).
insert into public.tenant_options (company_id, list_key, label, sort_order)
select c.id, 'relationship_type', t.label, t.ord
from public.companies c
cross join (values
  ('Family', 1), ('Neighbour', 2), ('Referred by', 3), ('Referrer', 4),
  ('Landlord', 5), ('Tenant', 6), ('Previous owner', 7), ('Colleague', 8),
  ('Other', 9)
) as t(label, ord)
on conflict (company_id, list_key, label) do nothing;
