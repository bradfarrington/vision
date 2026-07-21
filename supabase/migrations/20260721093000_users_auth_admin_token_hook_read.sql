-- ============================================================================
-- Fix: let the access-token hook read public.users
-- ============================================================================
-- public.custom_access_token_hook runs as the `supabase_auth_admin` role (it is
-- a `stable`, non-SECURITY DEFINER function invoked by GoTrue). public.users has
-- RLS enabled with policies scoped only `to authenticated`, and supabase_auth_admin
-- does NOT bypass RLS — so the hook's `select company_id, role from public.users`
-- matched ZERO rows and stamped `company_id = null` into every JWT. Result:
-- current_company_id() was null for everyone and every tenant table read empty.
--
-- The documented Supabase pattern for auth hooks is an explicit permissive SELECT
-- policy for supabase_auth_admin. Grants alone are not enough — RLS still applies.
--   https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
-- ============================================================================

grant usage on schema public to supabase_auth_admin;
grant select on table public.users to supabase_auth_admin;

create policy "users: auth admin reads for token hook"
  on public.users for select to supabase_auth_admin
  using ( true );
