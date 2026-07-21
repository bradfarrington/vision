-- ============================================================================
-- Tenant isolation test  —  run AFTER `supabase db reset` (which loads seed.sql)
--   supabase db reset
--   psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" \
--        -f supabase/tests/tenant_isolation.sql
--
-- Simulates an authenticated request by (a) switching to the `authenticated`
-- role and (b) setting request.jwt.claims — exactly what auth.jwt() reads. If
-- RLS is doing its job, a BSW user sees ONLY BSW rows, even with a bare,
-- unscoped `select * from customers` (no WHERE company_id). Any leak raises an
-- exception and the script exits non-zero.
-- ============================================================================

do $$
declare
  vision uuid := '00000000-0000-0000-0000-000000000001';
  bsw    uuid := '00000000-0000-0000-0000-000000000002';
  n      int;
  leaked int;
begin
  -- ---- Act as a BSW user ---------------------------------------------------
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('app_metadata', json_build_object('company_id', bsw, 'user_role', 'staff'))::text,
    true
  );

  -- Deliberately UNSCOPED query — RLS must still confine it to BSW.
  select count(*) into n      from public.customers;
  select count(*) into leaked from public.customers where company_id <> bsw;
  assert n = 2,      format('BSW should see 2 customers, saw %s', n);
  assert leaked = 0, format('LEAK: BSW saw %s customers from another tenant', leaked);

  select count(*) into leaked from public.leads where company_id <> bsw;
  assert leaked = 0, format('LEAK: BSW saw %s leads from another tenant', leaked);

  -- A cross-tenant WRITE must be rejected by WITH CHECK.
  begin
    insert into public.customers (company_id, first_name, last_name)
    values (vision, 'Mallory', 'Cross');   -- BSW user trying to write a Vision row
    raise exception 'LEAK: BSW inserted a customer into Vision';
  exception when others then
    if sqlerrm like 'LEAK:%' then raise; end if;   -- re-raise our own failure
    -- otherwise: RLS correctly blocked it. Good.
  end;

  reset role;
  raise notice 'PASS: BSW is fully isolated (read + write).';

  -- ---- Act as a Vision user -----------------------------------------------
  set local role authenticated;
  perform set_config(
    'request.jwt.claims',
    json_build_object('app_metadata', json_build_object('company_id', vision, 'user_role', 'staff'))::text,
    true
  );
  select count(*) into leaked from public.customers where company_id <> vision;
  assert leaked = 0, format('LEAK: Vision saw %s customers from another tenant', leaked);
  reset role;
  raise notice 'PASS: Vision is fully isolated.';

  -- ---- No tenant in JWT => sees nothing ------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', '{}', true);
  select count(*) into n from public.customers;
  assert n = 0, format('A tenant-less session should see 0 customers, saw %s', n);
  reset role;
  raise notice 'PASS: tenant-less session sees nothing.';

  raise notice 'ALL ISOLATION CHECKS PASSED.';
end $$;
