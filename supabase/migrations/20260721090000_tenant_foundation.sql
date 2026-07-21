-- ============================================================================
-- Vision CRM — Wave 1: tenant-isolation foundation
-- ============================================================================
-- Model: single database, shared `public` schema, `company_id` on every
-- tenant-owned row, enforced by Postgres RLS keyed off the user's JWT.
--
-- Decision record: AGENTS.md § "Backend & multi-tenant security — decided 2026-07-21".
-- ============================================================================

-- ----------------------------------------------------------------------------
-- companies — the tenant catalog. This is a GLOBAL table (not tenant-scoped);
-- a row here *defines* a tenant. Only platform admins and the service role
-- write to it. Authenticated users may read their own company row.
-- ----------------------------------------------------------------------------
create table public.companies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  brand_color_1 text,
  brand_color_2 text,
  logo_url      text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- users — one profile row per auth.users, carrying the tenant membership.
-- `company_id` here is the single source of truth the access-token hook reads
-- to stamp the JWT. `role` distinguishes tenant staff from platform admins.
-- Tenant-owned tables reference public.users(id) for takenBy/assignedTo/etc.
-- ----------------------------------------------------------------------------
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references public.companies (id),
  email      text,
  first_name text,
  last_name  text,
  role       text not null default 'staff',   -- 'staff' | 'company_admin' | 'platform_admin'
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index users_company_id_idx on public.users (company_id);

-- ============================================================================
-- Access-token hook — stamps company_id + role into the JWT's app_metadata on
-- every token issue/refresh. app_metadata is server-controlled (NOT the
-- user-editable user_metadata), so it is safe to authorize against.
-- Verified against:
--   https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
-- Enable it in config.toml:
--   [auth.hook.custom_access_token]
--   enabled = true
--   uri = "pg-functions://postgres/public/custom_access_token_hook"
-- ============================================================================
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims       jsonb;
  v_company_id uuid;
  v_role       text;
begin
  select company_id, role
    into v_company_id, v_role
    from public.users
   where id = (event->>'user_id')::uuid;

  claims := event->'claims';

  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;

  claims := jsonb_set(claims, '{app_metadata, company_id}',
                      coalesce(to_jsonb(v_company_id::text), 'null'::jsonb));
  claims := jsonb_set(claims, '{app_metadata, user_role}',
                      coalesce(to_jsonb(v_role), 'null'::jsonb));

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- The auth admin runs the hook; nobody else may call it or read the lookup table.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant all on table public.users to supabase_auth_admin;

-- ============================================================================
-- RLS helpers — read the tenant + role from the verified JWT.
-- These are the ONLY source of the caller's tenant. Never trust a client id.
-- ============================================================================
create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'company_id', '')::uuid
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'platform_admin'
$$;

-- ============================================================================
-- RLS — companies
-- ============================================================================
alter table public.companies enable row level security;

create policy "companies: read own"
  on public.companies for select to authenticated
  using ( id = public.current_company_id() or public.is_platform_admin() );

create policy "companies: platform admin writes"
  on public.companies for all to authenticated
  using ( public.is_platform_admin() )
  with check ( public.is_platform_admin() );

-- ============================================================================
-- RLS — users
-- A user may read the profiles within their own company; platform admins see
-- all. Writes to membership/role are admin-only (never self-serve) to prevent
-- a user granting themselves another company_id or platform_admin.
-- ============================================================================
alter table public.users enable row level security;

create policy "users: read within company"
  on public.users for select to authenticated
  using ( company_id = public.current_company_id() or public.is_platform_admin() );

create policy "users: admin manage"
  on public.users for all to authenticated
  using ( public.is_platform_admin() )
  with check ( public.is_platform_admin() );

comment on function public.current_company_id() is
  'Caller''s tenant, read from the verified JWT app_metadata. The single source of tenant identity for RLS.';
